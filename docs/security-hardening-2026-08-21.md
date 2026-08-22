# Relatório final de hardening — AXE PRIME

Data: 2026-08-21  
Branch: `security/audit-hardening-2026-08-21`  
Baseline: `df4a1e0` (`main`)  
Relatório anterior às correções: [`security-audit-initial-2026-08-21.md`](./security-audit-initial-2026-08-21.md)

## Decisão executiva

O código ficou materialmente mais resistente, mas **a publicação financeira
ainda não deve ser liberada**. Três decisões externas ao código continuam
obrigatórias:

1. revogar a `GEMINI_API_KEY` já exposta e purgar o histórico Git;
2. implantar MFA/step-up para administradores `master` e `financeiro`;
3. definir e executar criptografia de campo/KMS para KYC, CPF e Pix, além da
   criptografia de volume e backups do provedor.

O gate de CI `secret-history` foi deliberadamente configurado para falhar
enquanto o item 1 não for resolvido. A correção não oculta esse risco.

Não foi identificado bypass de login, acesso administrativo anônimo, SQL
injection ou conexão do navegador ao PostgreSQL no código atual. A manipulação
confirmada do valor de cashback e a repetição lógica de saques foram corrigidas
no backend. Ainda existe possibilidade material de exposição de dados por uma
credencial histórica comprometida ou por leitura legítima/indevida do banco,
pois os campos KYC/Pix não têm criptografia de aplicação. Portanto, a decisão é
**não liberar produção financeira** até fechar os bloqueadores acima e executar
as validações de staging/infraestrutura.

## Arquitetura encontrada e fronteiras de confiança

```text
Navegador ou cliente API
  -> Next.js 16 (páginas, Route Handlers, Server Actions e Proxy)
     -> validação + autenticação + autorização + regra de negócio
     -> repositories server-only com SQL parametrizado
        -> PostgreSQL por TLS

Recuperação de senha -> webhook HTTPS configurado pelo operador
Perfil no navegador  -> ViaCEP, apenas para consulta de CEP
Job operacional      -> importador allowlisted de avatares -> PostgreSQL
CI                    -> PostgreSQL efêmero + build + testes Playwright
```

Não há Express, NestJS, Mercado Pago, webhook de pagamento, Pix de cobrança,
GraphQL, WebSocket, Redis, Dockerfile ou manifesto Railway no repositório. O Pix
existente é uma chave de destino para solicitações de saque. Domínios,
subdomínios, portas públicas, rede privada, WAF, IAM, backups e TLS do ambiente
futuro não puderam ser confirmados sem acesso ao Railway.

### Matriz de papéis e permissões efetivas

| Papel                   | Leitura                                   | Criação/alteração                          | Exclusão/operação crítica                   | Limites principais                                |
| ----------------------- | ----------------------------------------- | ------------------------------------------ | ------------------------------------------- | ------------------------------------------------- |
| Visitante               | páginas públicas e auth                   | cadastro/login/reset                       | nenhuma                                     | sem acesso a portal/admin/DB                      |
| Usuário ativo           | próprio perfil, carteira e rede permitida | próprio perfil/KYC/plano/avatar/saque      | exclui apenas o próprio avatar              | identidade vem da sessão, não do body/URL         |
| Admin `suporte`         | dashboard e usuários                      | operações de suporte permitidas            | sem finanças/configuração                   | RBAC no servidor                                  |
| Admin `financeiro`      | dashboard, saques, Pix, extrato e planos  | aprova/rejeita saque e plano               | sem usuários/configuração/cashback/comissão | RBAC no servidor; MFA ainda ausente               |
| Admin `master`          | todos os módulos                          | configura planos/comissões/cashback/admins | operações financeiras e contas              | MFA/step-up ainda ausente                         |
| Role PostgreSQL runtime | tabelas de aplicação                      | `SELECT/INSERT/UPDATE/DELETE` necessários  | sem DDL; audit log só `SELECT/INSERT`       | provisionamento precisa ser validado em staging   |
| Job migrador            | schema completo                           | DDL/migrations                             | provisiona ACL runtime                      | credencial exclusiva do job, nunca do web runtime |
| Webhook de reset        | recebe link opaco de uso único            | entrega e-mail fora do processo            | nenhuma API privilegiada                    | destino HTTPS fixo/configurado                    |

## Evolução dos achados

| ID      | Inicial | Estado após hardening                              | Resultado                                                                                                             |
| ------- | ------- | -------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| SEC-001 | Crítica | **Aberta/bloqueia release**                        | segredo ainda existe em 2 commits; validade não testada                                                               |
| SEC-002 | Alta    | **Aberta/bloqueia release financeira**             | MFA administrativo não foi improvisado sem enrollment/recovery seguros                                                |
| SEC-003 | Alta    | **Aberta/bloqueia decisão de risco**               | TLS existe, mas KYC/CPF/Pix continuam legíveis por quem lê o banco/dump                                               |
| SEC-004 | Alta    | **Mitigada parcialmente**                          | trilha transacional append-only para finanças + eventos centrais de auth; falta SIEM/cobertura total/retention formal |
| SEC-005 | Média   | **Corrigida no código**                            | cashback é calculado no backend sob lock                                                                              |
| SEC-006 | Média   | **Corrigida no código**                            | saque idempotente + fingerprint + limite distribuído                                                                  |
| SEC-007 | Média   | **Corrigida para o navegador**                     | JWT não é mais devolvido no JSON de login/cadastro/refresh                                                            |
| SEC-008 | Média   | **Mitigada**                                       | prefixos de cookie, CSP e headers globais; CSP ainda precisa eliminar `unsafe-inline` com nonce/hash                  |
| SEC-009 | Média   | **Mitigada parcialmente**                          | baseline local de senhas comuns/contextuais; falta corpus comum/vazado >= 3.000                                       |
| SEC-010 | Média   | **Corrigida no código**                            | KYC tipado, limitado e normalizado; erro interno não volta ao cliente                                                 |
| SEC-011 | Média   | **Corrigida no código**                            | timeouts de statement, lock e transação no pool                                                                       |
| SEC-012 | Média   | **Corrigida/configurada, não executada no GitHub** | SHA fixo, permissões mínimas, SCA, SBOM, PostgreSQL e webServer no E2E                                                |
| SEC-013 | Baixa   | **Corrigida**                                      | RBAC ocorre antes da consulta KYC                                                                                     |
| SEC-014 | Baixa   | **Corrigida**                                      | alias legado de avatar removido                                                                                       |
| SEC-015 | Baixa   | **Corrigida**                                      | build usa stack local do sistema e funciona sem baixar fonte                                                          |
| SEC-016 | Baixa   | **Aberta/aceita temporariamente**                  | cadastro ainda informa que o e-mail já existe                                                                         |

Contagem residual de risco: **1 crítica, 2 altas, 3 médias parciais e 1 baixa**,
além de verificações externas/manuais não executadas.

## Correções implementadas e evidências

### Integridade financeira

- `POST /api/v1/withdrawals` exige `Idempotency-Key` com formato/tamanho
  limitado, aplica buckets PostgreSQL global e por usuário e usa HMAC para não
  persistir a chave bruta (`app/api/v1/withdrawals/route.ts:25-91`).
- A transação trava o usuário, detecta replay, rejeita a mesma chave com payload
  diferente, confirma saldo e grava o saque + evento de auditoria de forma
  atômica (`src/features/wallet/wallet.repository.ts:86-177`).
- O schema possui fingerprint e índice único parcial por usuário/chave
  (`database/data/33_withdrawal_requests.sql`).
- O cliente preserva a mesma chave ao repetir uma tentativa de igual valor
  (`app/portal/carteira/wallet-client.tsx`).
- O valor do cashback não pertence mais ao `FormData`; o repository lê plano,
  percentual, adesão e status sob `FOR UPDATE` e calcula os centavos no servidor
  (`src/features/admin/admin.repository.ts:623-680`).

### Trilha de auditoria

- `security_audit_events` limita domínio, ação e metadata e possui índices por
  tempo, ator e alvo (`database/data/60_security_audit_events.sql`).
- A role runtime recebe apenas `SELECT, INSERT`; `UPDATE`, `DELETE`, `TRUNCATE`,
  `REFERENCES` e `TRIGGER` são revogados
  (`scripts/migrate-postgres.mjs:403-409`).
- Saque, aprovação/rejeição de saque, cashback, comissão e decisão de plano
  registram evento na mesma transação da operação. Falha no evento causa
  rollback financeiro.
- Login de usuário/admin e negação por role também geram evento minimizado. Uma
  indisponibilidade do sink de autenticação é tratada sem registrar senha,
  token, e-mail, CPF ou payload.

Risco residual: a tabela está no mesmo PostgreSQL e a role dona ainda pode
alterá-la. É necessário exportar para armazenamento separado/SIEM, definir
retenção, correlação e alertas. Mudanças de plano/configuração e contas admin
também são transacionais; eventos de reset, rate limit e algumas alterações de
usuário ainda não têm cobertura completa/correlação por request ID.

### Autenticação e sessão

- Login, cadastro e refresh do navegador não incluem mais `accessToken` nem
  `tokenType` no JSON. Access e refresh continuam em `Set-Cookie` HttpOnly.
- Em produção, cookies do portal usam `__Host-`; cookies limitados a `/admin`
  usam `__Secure-` (`src/server/security/tokens.ts:9-16`).
- A API ainda aceita um bearer apresentado explicitamente. Não foi criado um
  fluxo OAuth/client-credentials para integrações externas; ele deve ser
  projetado separadamente se houver esse consumidor.
- A política agora recusa padrões comuns, repetidos e contextuais em cadastro,
  reset, perfil, criação/rotação administrativa e bootstrap. Ela complementa,
  mas não substitui, um corpus conhecido/vazado adequado.

### Validação, autorização e minimização de superfície

- O KYC usa Zod com limites por campo, NFC, CPF com dígitos verificadores,
  datas reais, telefone, CEP, UF, e-mail e estado civil
  (`app/portal/planos/plans.actions.ts:57-206`).
- KYC e troca de plano possuem limite distribuído por usuário. Mensagens
  PostgreSQL não são retornadas ao cliente.
- `/admin/planos` verifica `canAccess(..., 'planos')` antes de consultar o
  repository.
- `/api/perfil/avatar` foi removido; permanece somente a rota versionada.

### Headers, banco e disponibilidade

- CSP, `nosniff`, anti-framing, Permissions-Policy, COOP, CORP, Referrer-Policy
  e HSTS com subdomínios foram aplicados globalmente; `X-Powered-By` foi
  removido (`next.config.ts`).
- A CSP usa `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'` e
  `form-action 'self'`. O uso de `unsafe-inline` para scripts/estilos é risco
  residual até a adoção de nonce/hash compatível com o Next.js.
- `statement_timeout`, `lock_timeout` e
  `idle_in_transaction_session_timeout` são configuráveis e têm defaults
  conservadores (`src/server/db/postgres.ts:87-105`).
- O download de Google Fonts foi removido do build; a aplicação usa fontes do
  sistema sem dependência externa de compilação.

### Supply chain e CI

- GitHub Actions usam SHA completo e `permissions: contents: read`.
- O pipeline executa lint, typecheck, testes, `npm audit --audit-level=high`,
  gera SBOM CycloneDX, inicializa PostgreSQL 17.6, aplica o schema, constrói a
  aplicação, inicia `next start` pelo Playwright e executa E2E Chromium.
- Segredos de autenticação do E2E são aleatórios e efêmeros no runner.
- O scan de histórico não imprime valores e falha enquanto encontrar material
  semelhante a credencial.

Risco residual: esse workflow ainda não foi executado no GitHub nesta branch.
O container PostgreSQL usa tag de patch, não digest OCI. Não há CodeQL/SAST nem
Dependabot/Renovate configurado neste repositório.

## Testes e status preciso

| Verificação                                            | Status                                | Resultado                                                            |
| ------------------------------------------------------ | ------------------------------------- | -------------------------------------------------------------------- |
| Inventário de rotas, roles, repositories e integrações | Executado                             | concluído por revisão estática                                       |
| Busca de acesso direto do frontend ao PostgreSQL       | Executado                             | nenhum acesso de browser encontrado                                  |
| Busca de SQL injection em queries atuais               | Revisão de código                     | queries parametrizadas; nenhum caso confirmado                       |
| Fluxos JWT/refresh/CSRF/RBAC                           | Executado + revisão                   | testes existentes e novos aprovados                                  |
| Idempotência/rate limit de saque                       | Executado unitariamente               | replay, conflito, hashing, 429 e auth cobertos                       |
| Cashback calculado no backend                          | Executado unitariamente               | payload monetário adulterado é ignorado                              |
| Validação de CPF/data/senha                            | Executado unitariamente               | casos válidos, inválidos, comuns e Unicode cobertos                  |
| Lint                                                   | Executado                             | aprovado                                                             |
| TypeScript                                             | Executado                             | aprovado                                                             |
| Vitest                                                 | Executado                             | 27 arquivos e 142 testes aprovados                                   |
| Build Next.js de produção                              | Executado                             | aprovado sem acesso a Google Fonts                                   |
| Smoke HTTP local                                       | Executado                             | `/` retornou 200 e headers esperados                                 |
| `git diff --check`                                     | Executado                             | aprovado                                                             |
| Busca segura do segredo no histórico                   | Executado                             | vulnerável: 2 commits, valor nunca exibido                           |
| `npm audit` local                                      | **Não executado**                     | rede bloqueada e autorização para exportar metadados foi negada      |
| SCA/SBOM no GitHub                                     | Configurado, não executado            | aguarda push/CI                                                      |
| E2E com PostgreSQL real                                | Configurado, não executado localmente | ambiente local não possui PostgreSQL/Playwright operacional completo |
| DDL em banco vazio e restore legado                    | **Não executado**                     | exige staging PostgreSQL real                                        |
| Railway/DNS/TLS público/WAF                            | **Verificação manual pendente**       | nenhum acesso/configuração externa foi fornecido                     |
| Mercado Pago/webhooks de pagamento                     | Fora do escopo efetivo                | integração não existe no código auditado                             |
| Validade da chave histórica                            | **Não testada intencionalmente**      | testar credencial comprometida seria uso externo indevido            |

O smoke test do artefato de produção confirmou `HTTP 200`, CSP, HSTS com
subdomínios, `nosniff`, anti-framing, Permissions-Policy, COOP, CORP e
Referrer-Policy, sem `X-Powered-By`. A busca no bundle público não encontrou
nomes de segredos/connection strings. O único source map público gerado é do
polyfill do Next.js e não contém fonte da aplicação.

## Priorização pós-hardening

### Ação imediata — antes de qualquer release

1. Revogar/rotacionar a chave histórica, investigar uso e purgar o histórico de
   forma coordenada.
2. Implantar MFA/step-up para `master` e `financeiro`.
3. Definir criptografia de campo/KMS e retenção para KYC/Pix; validar volume,
   backup e restore do provedor.
4. Executar schema e testes de concorrência/autorização em staging PostgreSQL e
   validar a configuração pública do Railway.

### Curto prazo

1. Remover `unsafe-inline` da CSP com nonce/hash testado.
2. Integrar uma blocklist de senhas comuns/vazadas com pelo menos 3.000 itens.
3. Exportar auditoria para sink separado, criar alertas, retenção e correlação.
4. Uniformizar o cadastro caso o modelo de ameaça exija resistência a
   enumeração de contas.
5. Executar o pipeline no GitHub após sanar o histórico e revisar os resultados
   de SCA/SBOM/E2E.

### Médio prazo

1. Adicionar SAST/CodeQL, atualização automatizada e política de dependências.
2. Planejar rotação de JWT/pepper com `kid` e múltiplas chaves.
3. Executar DAST/pentest autorizado no ambiente publicado e exercícios de
   resposta a incidente/restore.

## Matriz de cobertura dos referenciais

| Referencial/área       | Cobertura neste trabalho                                                                                 | Limitação explícita                                                            |
| ---------------------- | -------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| OWASP Top 10:2025      | A01, A02, A03, A04, A05, A06, A07, A08, A09 e A10 revisados por código/testes aplicáveis                 | não equivale a certificação nem DAST externo                                   |
| OWASP API Top 10:2023  | autenticação, BOLA/BFLA, property authorization, consumo de recursos, SSRF e inventário                  | somente APIs presentes; sem alvo publicado                                     |
| OWASP ASVS 5.0.0       | sessões, autenticação, autorização, validação, dados, API, configuração e logging usados como requisitos | não foi executada verificação requisito a requisito dos cerca de 350 controles |
| OWASP WSTG 4.2         | informação, configuração, auth, sessão, autorização, input e client-side cobertos por revisão            | testes ativos de rede/DAST não executados                                      |
| NIST SSDF 1.1          | inventário, proteção de código/segredos, gates CI, teste, correção e registro de risco                   | governança/IAM/response externos não auditados                                 |
| PostgreSQL/financeiro  | SQL parametrizado, locks, constraints, idempotência, ACL e auditoria                                     | sem execução contra banco real nesta máquina                                   |
| Infraestrutura/Railway | requisitos e roteiro documentados                                                                        | sem credenciais, domínio ou autorização de varredura                           |

## Testes de abuso recomendados em staging

1. Enviar 20 saques concorrentes com a mesma chave: uma linha, respostas
   semanticamente idênticas e nenhum débito duplicado.
2. Reusar a chave com outro valor: `409 IDEMPOTENCY_CONFLICT`.
3. Segurar lock de usuário/tabela: requisição deve terminar pelos timeouts e a
   conexão deve voltar ao pool.
4. Alterar `amountCents` na Server Action de cashback: o valor persistido deve
   continuar sendo plano × percentual do banco.
5. Forçar falha de `security_audit_events`: toda mutação financeira na mesma
   transação deve reverter.
6. Executar DDL sobre banco vazio e sobre dump legado restaurado; comparar
   contagens e somas financeiras por status/período.
7. Testar CSP no navegador antes de remover `unsafe-inline`, coletando apenas
   violações sem payload sensível.
8. Confirmar na infraestrutura TLS público, HSTS, limites de corpo/conexão,
   backups criptografados, restore e ausência de roles privilegiadas no runtime.

## Bloqueadores operacionais obrigatórios

### 1. Credencial no histórico

- Revogar e rotacionar a chave no provedor imediatamente.
- Revisar uso, faturamento e logs desde o primeiro commit afetado.
- Coordenar reescrita/squash/orphan history, force-push e invalidação de clones.
- Executar scanner de segredos em todos os objetos e confirmar que a chave
  antiga não autentica. Forks/caches tornam a **revogação** indispensável.

Nenhuma dessas ações foi executada automaticamente: revogação exige acesso ao
provedor e reescrita Git é destrutiva para colaboradores.

### 2. MFA administrativo

Exigir WebAuthn/passkey para `master` e `financeiro`, com recovery codes de uso
único, enrollment autenticado, revogação e step-up recente para saque,
cashback, comissão e mudanças de role. Até isso existir, contas financeiras não
devem operar produção.

### 3. Proteção de KYC/PII/Pix

Definir com segurança/jurídico a minimização e retenção. Para o que permanecer,
usar envelope encryption AES-GCM com chave versionada em KMS fora do banco,
rotação e blind index apenas quando consulta for inevitável. Habilitar também
criptografia de volume e backup no provedor e testar restore. Não armazenar a
chave na mesma `DATABASE_URL`/`.env` do dump.

## Referenciais

- [OWASP Top 10:2025](https://owasp.org/Top10/)
- [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS)
- [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/)
- [OWASP Web Security Testing Guide 4.2](https://owasp.org/www-project-web-security-testing-guide/v42/)
- [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html)
- [NIST SP 800-218 — SSDF 1.1](https://csrc.nist.gov/pubs/sp/800/218/final)
- [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html)
- [OWASP Content Security Policy Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Content_Security_Policy_Cheat_Sheet.html)
- [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html)
