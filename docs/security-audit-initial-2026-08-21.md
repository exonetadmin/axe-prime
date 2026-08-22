# Auditoria inicial de segurança — AXE PRIME

Data: 2026-08-21  
Commit auditado: `df4a1e0` (`main`)  
Estado deste documento: **antes das correções**

## 1. Resumo executivo

A aplicação possui uma base de autenticação melhor que a média: senhas novas usam scrypt com limite de concorrência, JWTs têm algoritmo/issuer/audience/tipo fixados, refresh tokens são opacos e rotativos, as sessões são revogáveis no PostgreSQL, mutações REST usam Origin/Fetch Metadata/CSRF, queries de aplicação são parametrizadas e o upload de avatar aplica limite de corpo, inspeção estrutural e decodificação completa.

Mesmo assim, o estado auditado **não deve ser considerado pronto para produção financeira**. Há um segredo real no histórico Git, contas administrativas financeiras não usam MFA, CPF/RG/endereço/PIX ficam legíveis pela aplicação no banco e não existe trilha de auditoria de segurança/financeira. Também há falhas de integridade/idempotência em fluxos financeiros, lacunas de headers, validação KYC incompleta e um pipeline CI parcialmente inoperante.

Classificação inicial:

| Severidade | Quantidade |
| --- | ---: |
| Crítica | 1 |
| Alta | 3 |
| Média | 8 |
| Baixa | 4 |

Não foi encontrada, por revisão estática, evidência de SQL injection, bypass anônimo de autenticação, IDOR nas APIs REST atuais, armazenamento de senha em texto puro no estado atual, refresh token no JSON, SSRF controlável pelo usuário ou upload de conteúdo ativo. Isso **não equivale** a um pentest externo aprovado: o ambiente publicado, Railway, DNS, TLS público, banco real e dependências contra bases de CVE não puderam ser testados.

Referenciais usados: [OWASP ASVS 5.0.0](https://github.com/OWASP/ASVS), [OWASP API Security Top 10 2023](https://owasp.org/API-Security/editions/2023/en/0x11-t10/), [NIST SP 800-63B-4](https://pages.nist.gov/800-63-4/sp800-63b.html), [OWASP File Upload Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html) e [OWASP Logging Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Logging_Cheat_Sheet.html).

## 2. Arquitetura e fronteiras de confiança

- Runtime: Next.js 16 App Router, React 19 e TypeScript.
- Backend: Route Handlers, Server Actions e Server Components no mesmo processo Next.js.
- Persistência: PostgreSQL via `pg`; acesso ao banco restrito a módulos `server-only` e scripts operacionais.
- Perfis: usuário do portal; administradores `master`, `financeiro` e `suporte`.
- Autenticação: access JWT HS256 curto + refresh opaco em cookie HttpOnly; famílias de refresh e sessões no PostgreSQL.
- Autorização: identidade conferida novamente no banco; RBAC administrativo por função/role.
- Upload: avatar em `BYTEA`, limite de 5 MiB, máximo de 16 MP e decodificação via Sharp.
- Integrações encontradas: ViaCEP no navegador, webhook HTTPS de recuperação de senha e importador operacional de avatares legados.
- Integrações não encontradas: Mercado Pago, webhook de pagamento, campanha/sorteio/reserva, Redis, object storage atual, Docker ou manifesto Railway.

Fluxo principal:

```text
Navegador/cliente API
  -> Next.js (páginas, Route Handlers, Server Actions)
     -> validação/autenticação/autorização
     -> repositories parametrizados
        -> PostgreSQL por TLS configurável

Recuperação de senha -> webhook HTTPS configurado pelo operador
KYC no navegador -> ViaCEP (somente consulta de CEP)
Importação pontual -> host HTTPS allowlisted e IP público fixado -> PostgreSQL
```

Dados sensíveis identificados:

- credenciais e hashes de senha/token;
- CPF, RG, data de nascimento, filiação, endereço, profissão, renda e patrimônio;
- chave Pix de saque;
- valores de plano, cashback, comissão e saques;
- IP e hash de User-Agent de sessões;
- dados de administradores.

## 3. Superfície de ataque inventariada

### Público

- páginas `/`, `/auth` e assets;
- `POST /api/auth/login`;
- `POST /api/auth/register`;
- `POST /api/auth/reset`;
- `POST /api/auth/reset/confirm`;
- `POST /api/auth/refresh` e `/logout` dependentes de cookies/tokens;
- `GET /api/auth/session`.

### Usuário autenticado

- `PATCH /api/v1/profile`;
- `POST|DELETE /api/v1/profile/avatar`;
- `GET /api/v1/avatars/[userId]` (self-only);
- `POST /api/v1/withdrawals`;
- Server Actions de KYC, onboarding e troca de plano;
- páginas do portal, rede, cashback, comissões e carteira.

### Administração

- login e sessão próprios sob `/admin`;
- `POST /admin/session/refresh`;
- `GET /admin/avatars/[userId]` com permissão `rede`;
- Server Actions de usuários, planos, administradores, saques, Pix, cashback e comissões;
- módulos protegidos por roles `master`, `financeiro` e `suporte`.

### Operacional

- `scripts/migrate-postgres.mjs`;
- `scripts/create-admin.mjs`;
- `scripts/import-legacy-avatars.mjs`;
- GitHub Actions em `.github/workflows/quality-gates.yml`.

## 4. Achados

### SEC-001 — segredo real permanece no histórico Git

| Campo | Valor |
| --- | --- |
| Severidade | **Crítica** |
| Status | **Vulnerável — confirmado no histórico; validade da chave não testada** |
| Referência | CWE-798; OWASP A02/A05; ASVS v5.0.0 V13.3 |
| Evidência | commits `aade38d` e `8968bf8`, arquivo `.env.backup.1773345320698`, variável `GEMINI_API_KEY` com valor não-placeholder de 39 caracteres |
| Superfície | repositório Git/GitHub |

Reprodução segura, sem revelar o segredo:

```bash
git log --all -- .env.backup.1773345320698
git show aade38d:.env.backup.1773345320698 \
  | awk -F= '/^GEMINI_API_KEY=/{print $1 "=<redacted:length=" length($2) ">"}'
```

Impacto: qualquer pessoa com acesso ao histórico pode recuperar a credencial. A chave deve ser tratada como comprometida mesmo que o arquivo tenha sido apagado do working tree.

Causa: segredo incluído em snapshot versionado; remoção posterior sem reescrita do histórico.

Correção: revogar/rotacionar no provedor; verificar uso/faturamento; reescrever ou reiniciar o histórico publicado; invalidar clones/caches quando possível; instalar secret scanning/pre-receive. A rotação exige acesso ao provedor e a purga exige operação Git destrutiva coordenada, portanto não deve ser simulada.

Teste pós-correção: scanner de segredos no working tree **e em todos os objetos Git**, seguido de confirmação no provedor de que a chave antiga não autentica.

Risco residual: forks, clones e caches externos podem reter o segredo; somente a revogação elimina esse risco.

### SEC-002 — autenticação administrativa financeira sem MFA

| Campo | Valor |
| --- | --- |
| Severidade | **Alta** |
| Status | **Vulnerável — confirmado por revisão de código** |
| Referência | ASVS v5.0.0-6.3.3; OWASP API2:2023 |
| Evidência | `app/admin/actions.ts:19-64`; `src/features/admin/admin.auth.ts:228-313` |
| Superfície | login `/admin/login`; todas as operações master/financeiro |

O login valida apenas e-mail e senha. Uma credencial comprometida permite aprovar saques, alterar planos, creditar cashback, manipular comissões e administrar outras contas conforme a role.

Reprodução por revisão: não existe coluna/serviço/desafio WebAuthn, TOTP, recovery code ou segundo passo entre `validateAdminCredentials()` e `createAdminSession()`.

Correção: exigir MFA resistente a phishing (preferencialmente WebAuthn/passkey) para `master` e `financeiro`, com enrollment autenticado, recovery codes de uso único, revogação, proteção contra replay e step-up para operações financeiras.

Teste: login sem segundo fator deve falhar; fator de outra conta/reutilizado/expirado deve falhar; recovery code deve funcionar uma vez; operações financeiras devem exigir sessão com MFA recente.

Risco residual: recuperação de conta e dispositivo comprometido ainda precisam de processo operacional seguro.

### SEC-003 — PII, KYC e Pix ficam legíveis na camada de aplicação/banco

| Campo | Valor |
| --- | --- |
| Severidade | **Alta** |
| Status | **Vulnerável — criptografia do volume do provedor não verificada** |
| Referência | OWASP A02; ASVS v5.0.0 V11/V14; LGPD (validação jurídica pendente) |
| Evidência | `database/data/10_users.sql:8-16`; `database/data/21_plan_requests.sql:14-40`; `database/data/33_withdrawal_requests.sql:6-12` |
| Superfície | PostgreSQL, dumps, credencial runtime/migradora, páginas administrativas |

CPF, RG, endereço, filiação, renda, patrimônio e chave Pix são colunas `TEXT`/numéricas comuns. TLS protege o trânsito, mas uma leitura do banco, dump ou credencial comprometida obtém os valores em claro. Não foi possível confirmar criptografia de disco/backup no Railway.

Correção: classificar/minimizar dados e retenção; aplicar envelope encryption autenticada (AES-GCM) nos campos de maior impacto, com chave versionada fora do banco/KMS, rotação e blind indexes apenas quando consulta for necessária; separar credenciais e backups; mascarar na UI/logs.

Teste: dump não deve conter valores originais; adulteração do ciphertext deve falhar; rotação deve preservar leitura; roles sem necessidade não devem acessar as colunas; restauração de backup deve preservar proteção.

Risco residual: dados ficam em claro na memória durante uso legítimo e administradores autorizados continuam podendo visualizá-los.

### SEC-004 — ausência de trilha de auditoria de segurança e financeira

| Campo | Valor |
| --- | --- |
| Severidade | **Alta** |
| Status | **Vulnerável — confirmado** |
| Referência | ASVS v5.0.0-16.1.1, 16.2.1, 16.3.1–16.3.4, 16.4.2–16.4.3; OWASP A09 |
| Evidência | buscas por logging mostram apenas `console.error`; não há tabela/serviço de eventos; `app/admin/actions.ts`; `app/admin/admin.actions.ts` |
| Superfície | autenticação, RBAC, saques, cashback, comissões, planos e administradores |

Há alguns campos mutáveis como `reviewed_by`, mas não uma trilha append-only com ator, ação, alvo, resultado, horário, correlação e metadados seguros. Falhas de login/autorização, mudanças de role, aprovação de saque e alterações financeiras não podem ser reconstruídas de forma confiável.

Correção: eventos estruturados e minimizados, armazenamento append-only protegido da role runtime, identificador de correlação, política de retenção, exportação para sistema separado/SIEM e alertas para eventos críticos. Nunca registrar senha, token, CPF/Pix completos ou payload sensível.

Teste: cada sucesso/falha relevante produz exatamente um evento; caracteres de controle não causam log injection; a role runtime não altera/apaga eventos; falha no sink segue política fail-closed para operação financeira ou outbox transacional.

### SEC-005 — valor de cashback é confiado ao cliente administrativo

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável — confirmado por data flow** |
| Referência | CWE-602; OWASP API3/API6:2023; ASVS v5.0.0 V2/V8/V15.4 |
| Evidência | `app/admin/(protected)/cashback/cashback-months-popup.tsx:48-56`; `app/admin/admin.actions.ts:296-317`; `src/features/admin/admin.repository.ts:622-651` |
| Superfície | Server Action `markCashbackMonthAction` (role `master`) |

O cliente envia `amountCents`, a Action apenas faz `parseInt` e o repository persiste o valor. O backend já possui plano, percentual e configuração necessários para recalcular o valor, mas não os usa para validar o crédito. A comissão é calculada separadamente pelo valor mensal do plano, permitindo divergência de razão contábil.

Reprodução não executada (requer sessão master): interceptar a invocação da Server Action e trocar `amountCents` por outro inteiro positivo; o SQL usa esse valor em `cashback_payments`.

Correção: remover `amountCents` do contrato externo; bloquear usuário/configuração; calcular no mesmo `SELECT ... FOR UPDATE` e transação; verificar faixa do mês e transições; auditar valor calculado.

Teste: alteração do payload não muda o crédito; concorrência gera um lançamento; plano/configuração alterados simultaneamente resultam em valor consistente.

### SEC-006 — saque sem idempotência e sem limite específico do fluxo

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável — saldo concorrente está protegido, repetição lógica não** |
| Referência | OWASP API4/API6:2023; ASVS v5.0.0 V2/V15.4 |
| Evidência | `app/api/v1/withdrawals/route.ts:13-54`; `src/features/wallet/wallet.repository.ts:81-131` |
| Superfície | `POST /api/v1/withdrawals` |

A trava por usuário evita gastar acima do saldo, mas retries, duas abas ou duplo clique criam solicitações distintas enquanto houver saldo. Não há `Idempotency-Key`, chave única de negócio, janela de deduplicação ou rate limit por usuário.

Correção: exigir uma chave de idempotência opaca com limite de tamanho, persistir hash + usuário + request fingerprint + resposta em transação e adicionar rate limit por usuário/global. Reuso com payload diferente deve retornar conflito.

Teste: 20 solicitações concorrentes com a mesma chave criam uma linha e retornam o mesmo resultado; chave igual/payload diferente retorna `409`; chaves diferentes respeitam saldo e rate limit.

### SEC-007 — access JWT exposto ao JavaScript nas respostas do navegador

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável — confirmado** |
| Referência | ASVS v5.0.0-3.3.4; OWASP API2:2023 |
| Evidência | `app/api/auth/login/route.ts:32-43`; `register/route.ts:36-51`; `refresh/route.ts:34-46` |
| Superfície | login, cadastro e refresh |

Os endpoints gravam o JWT em cookie HttpOnly, mas também devolvem `accessToken` no JSON. O frontend não usa esse campo (`app/auth/auth-panel.tsx:127-205`; `lib/api-client.ts:67-76`). Um XSS pode exfiltrar o bearer e usá-lo fora do navegador durante sua validade, reduzindo o benefício do HttpOnly.

Correção: o fluxo browser/BFF deve devolver apenas usuário e expiração, mantendo access/refresh exclusivamente em `Set-Cookie`. Caso clientes externos sejam necessários, criar fluxo explicitamente separado, documentado e não acessível por autenticação ambiente do navegador.

Teste: respostas browser não contêm token; cookies continuam `HttpOnly`, `Secure` e `SameSite`; bearer explícito válido continua aceito onde provisionado.

### SEC-008 — cookies sensíveis não usam prefixo de segurança e CSP está ausente

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável/defesa em profundidade ausente** |
| Referência | ASVS v5.0.0-3.3.1, 3.3.3, 3.4.3, 3.4.4, 3.4.6 |
| Evidência | `src/server/security/tokens.ts:6-8`; `src/features/admin/admin.auth.ts:23-27`; `next.config.ts:1-30` |
| Superfície | todas as páginas e sessões |

Os cookies têm flags adequadas em produção, mas não usam `__Host-`/`__Secure-`. Os headers globais só incluem HSTS e Referrer-Policy; faltam CSP, `frame-ancestors`, `X-Content-Type-Options` global, Permissions-Policy e COOP. Isso amplia impacto de XSS futuro e permite framing/clickjacking onde SameSite não basta.

Correção: prefixos compatíveis (`__Host-` para cookies Path=/ e `__Secure-` para admin Path=/admin), CSP testada com nonce/hash quando possível, `object-src 'none'`, `base-uri 'none'`, `frame-ancestors 'none'`, `form-action 'self'`, `nosniff`, Permissions-Policy restritiva e COOP. HSTS L2 deve incluir subdomínios após validar que todos suportam HTTPS.

Teste: assertions de headers/cookies e verificação manual no navegador; CSP primeiro em Report-Only, depois enforcement sem violações necessárias.

### SEC-009 — senhas não são comparadas com blocklist comum/vazada

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável — política parcial** |
| Referência | NIST SP 800-63B-4 §3.1.1.2; ASVS v5.0.0-6.2.4, 6.2.11, 6.2.12 |
| Evidência | `lib/validators.ts:3-14`; `src/features/auth/services/auth.service.ts:67-76`; `app/admin/actions.ts:104-110` |
| Superfície | cadastro, reset, troca de senha e criação de admin |

O mínimo de 15, máximo de 128, Unicode/NFC, ausência de regras de composição e throttling estão adequados. Não existe, porém, comparação com senhas comuns, contextuais ou vazadas. Assim, uma passphrase longa e previsível pode ser aceita.

Correção: blocklist local versionada/licenciada com pelo menos 3.000 entradas compatíveis e termos contextuais, ou serviço de senha vazada com privacidade/fail policy documentada. Aplicar em todos os pontos que definem senha, não no login.

Teste: senhas comuns/contextuais são recusadas; passphrases fortes com espaços/Unicode são aceitas; indisponibilidade do serviço segue política definida.

### SEC-010 — KYC tem validação de domínio/tamanho insuficiente e pode revelar erro interno

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável — confirmado** |
| Referência | OWASP API3/API4:2023; ASVS v5.0.0 V2 e 16.5.1 |
| Evidência | `app/portal/planos/plans.actions.ts:24-117`; `database/data/21_plan_requests.sql:14-40` |
| Superfície | Server Action de onboarding/KYC |

CPF é validado apenas por comprimento, datas/e-mail/telefone/UF/estado civil não têm domínio completo, campos `TEXT` não têm teto e o catch devolve `e.message` ao usuário. O limite padrão do framework reduz, mas não elimina, abuso de armazenamento nem dados inválidos.

Correção: schema compartilhado Zod com limites e normalização, CPF com dígitos verificadores, datas ISO reais/faixa plausível, e-mail/telefone/CEP/UF/estado civil, teto de bytes/campo, mensagens externas genéricas e erro detalhado apenas no log seguro.

Teste: valores malformados/extremos são recusados antes do banco; Unicode normalizado; erro PostgreSQL simulado nunca aparece na resposta.

### SEC-011 — operações PostgreSQL de runtime não têm timeout de statement/transação

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável à degradação** |
| Referência | OWASP API4:2023; ASVS v5.0.0 V12/V15.3 |
| Evidência | `src/server/db/postgres.ts:88-96`, `151-165` |
| Superfície | todas as consultas; árvores/relatórios administrativos |

Há pool máximo e timeout de conexão, mas não `statement_timeout`, `lock_timeout` nem `idle_in_transaction_session_timeout` no runtime. Consulta ou lock demorado pode ocupar conexões e degradar todas as APIs.

Correção: limites configuráveis e fail-closed no pool/transações, timeout menor para web e exceções explícitas para jobs; telemetria para timeouts; paginação/limites nos relatórios pesados.

Teste: `pg_sleep`/lock controlado em banco de teste termina dentro do teto e libera conexão/transação.

### SEC-012 — CI/CD não é reproduzível nem cobre segurança/dependências

| Campo | Valor |
| --- | --- |
| Severidade | **Média** |
| Status | **Vulnerável/inoperante em partes — confirmado localmente** |
| Referência | OWASP A06/A08; ASVS v5.0.0 V15.2 |
| Evidência | `.github/workflows/quality-gates.yml:14-103`; `package.json:17-22` |
| Superfície | GitHub Actions e supply chain |

Problemas confirmados:

- actions usam tags mutáveis (`@v4`, `codecov-action@v3`) em vez de commit SHA;
- `permissions` não é declarado de modo fail-closed;
- CI chama `vitest ... --coverage`, mas `@vitest/coverage-v8` não está instalado; reprodução local: `npm run test:coverage` falha imediatamente;
- o job E2E faz build e chama Playwright, mas não configura `webServer` nem inicia `next start`;
- não há SCA, SBOM, secret scanning, CodeQL/SAST ou política de atualização.

O lockfile v3 possui integrity para todos os 631 pacotes resolvidos. `npm audit` **não foi executado**: DNS foi bloqueado e a autorização para enviar metadados da árvore ao registry npm foi negada pelo ambiente. Nenhuma conclusão sobre CVEs pode ser tirada.

Correção: SHA completo em actions, permissões mínimas, instalar/configurar cobertura ou retirar a alegação, subir app/banco efêmero no E2E, SCA/SBOM/secret scan/SAST com política de falha e atualização automatizada.

Teste: pipeline em PR sem secrets passa; action não muda sem alteração de SHA; E2E confirma que servidor realmente iniciou; SCA gera artefato/resultado verificável.

### SEC-013 — página administrativa consulta KYC antes de validar a role do módulo

| Campo | Valor |
| --- | --- |
| Severidade | **Baixa** |
| Status | **Vulnerável em defesa em profundidade; resposta com dados não demonstrada** |
| Referência | OWASP API5:2023; ASVS v5.0.0 V8 |
| Evidência | `app/admin/(protected)/planos/page.tsx:15-35`; `app/admin/_components/admin-module-gate.tsx:22-43` |
| Superfície | `GET /admin/planos` |

Um admin `suporte` é autenticado, as solicitações KYC são consultadas, e só depois o componente `AdminModuleGate` decide não renderizar os filhos. A serialização dos dados ao cliente não foi demonstrada, mas a regra deveria negar antes de qualquer acesso ao repositório.

Correção: autorização `master|financeiro` no início da página/service e testes negativos que garantam zero consulta ao banco.

### SEC-014 — endpoint legado de avatar amplia inventário sem necessidade

| Campo | Valor |
| --- | --- |
| Severidade | **Baixa** |
| Status | **Exposto, mas herda os mesmos controles** |
| Referência | OWASP API9:2023 |
| Evidência | `app/api/perfil/avatar/route.ts:1-2`; clientes usam `/api/v1/profile/avatar` |

Correção: remover o alias ou responder `410 Gone` durante janela documentada de depreciação; manter inventário OpenAPI/rotas.

### SEC-015 — build depende de download do Google Fonts

| Campo | Valor |
| --- | --- |
| Severidade | **Baixa** |
| Status | **Falha de disponibilidade/reprodutibilidade confirmada** |
| Referência | OWASP A08; ASVS v5.0.0 V15.2 |
| Evidência | `app/layout.tsx` usa `next/font/google`; `npm run build` falhou ao acessar `fonts.googleapis.com` |

Correção: self-host de fontes versionadas e licenciadas ou stack de fontes do sistema. O problema é de build; `next/font` normalmente incorpora a fonte no artefato e não implica chamada runtime ao Google.

### SEC-016 — enumeração de e-mail no cadastro

| Campo | Valor |
| --- | --- |
| Severidade | **Baixa** |
| Status | **Confirmado; reset e login são uniformes** |
| Referência | ASVS v5.0.0-6.3.8 (L3) |
| Evidência | `app/api/auth/register/route.ts:55-57` retorna `409` específico |

Correção: se o modelo de ameaça justificar L3, resposta uniforme e fluxo de verificação/convite que não revele existência. Avaliar impacto de UX antes de alterar.

## 5. Controles aprovados por revisão/teste

| Controle | Status | Evidência |
| --- | --- | --- |
| SQL parametrizado no runtime | Aprovado por revisão | repositories usam `$1...`; SQL dinâmico limitado a fragmentos internos/identificadores validados |
| Senha armazenada com KDF | Aprovado por teste/revisão | scrypt `N=2^17,r=8,p=1`, salt; bcrypt somente legado com rehash |
| JWT | Aprovado por teste/revisão | HS256 fixo, `iss`, `aud`, `typ`, `sub`, `jti`, `sid`, `ver`, expiração curta |
| Refresh token | Aprovado por teste/revisão | opaco 384 bits, HMAC no banco, rotação, replay e revogação |
| Sessão revogável | Aprovado por teste/revisão | DB valida sessão, usuário ativo e `token_version` em cada access token |
| CSRF REST | Aprovado por teste/revisão | Origin + Fetch Metadata + double-submit assinado e ligado ao refresh do usuário |
| BOLA/IDOR REST | Aprovado nos endpoints existentes | perfil/saque usam `user.id`; avatar comum é self-only; avatar admin exige `rede` |
| Concorrência de saldo | Aprovado por revisão | `SELECT ... FOR UPDATE` por usuário antes do saque |
| Solicitação de plano pendente | Aprovado por revisão | trava de usuário + índice único parcial + tratamento de `23505` |
| Upload de avatar | Aprovado por 31 testes focados prévios e revisão | limite streaming, MIME binário, dimensões/pixels/metadados, animação recusada, Sharp decode, resposta protegida |
| SSRF no importador | Aprovado por revisão/testes locais | host HTTPS allowlisted, DNS público validado, IP fixado, sem redirects, TLS/SNI, tempo e bytes limitados |
| Redirect administrativo | Aprovado por revisão/testes | caminho restrito a `/admin`, origin sintético e áreas de sessão excluídas |
| Segredos no estado atual | Aprovado parcialmente | `.env*`, chaves, PEM e dumps ignorados; nenhum valor atual encontrado; histórico falha em SEC-001 |
| TLS PostgreSQL | Aprovado por revisão, não integrado | produção recusa `disable`; `rejectUnauthorized`; override por query string bloqueado |
| Privilégio mínimo PostgreSQL | Aprovado estaticamente, não integrado | runner audita role runtime e revoga DDL/privilégios extras |

## 6. Priorização

### Bloqueadores de produção

1. Revogar/rotacionar a chave do histórico e decidir a purga Git (SEC-001).
2. Exigir MFA para contas financeiras/admin (SEC-002).
3. Definir e implementar proteção/retenção de PII/KYC/Pix e confirmar criptografia de volume/backup (SEC-003).
4. Criar trilha de auditoria e monitoramento para autenticação e finanças (SEC-004).
5. Executar migration e testes de autorização/TLS contra PostgreSQL staging real.

### Correção imediata no código

1. Cálculo server-side de cashback (SEC-005).
2. Idempotência/rate limit de saque (SEC-006).
3. Remover access token do JSON browser e endurecer cookies (SEC-007/008).
4. Validar KYC e impedir erro interno na resposta (SEC-010).
5. Timeouts PostgreSQL (SEC-011).
6. Corrigir CI, cobertura, E2E e headers (SEC-008/012/015).
7. Negar role antes de consultar KYC e remover rota legada (SEC-013/014).

### Backlog controlado

- blocklist/vazamento de senhas com fonte operacional definida (SEC-009);
- política L3 de enumeração no cadastro (SEC-016);
- rotação de JWT/pepper com `kid` e múltiplas chaves;
- testes externos autorizados e observabilidade/SIEM.

## 7. Cobertura e limitações

| Área | Resultado |
| --- | --- |
| Inventário de rotas/componentes/roles/dados | Executado por revisão estática |
| Auth, sessão, JWT, refresh, CSRF, rate limit | Executado por revisão + 126 testes locais |
| RBAC/BOLA/IDOR | Executado por revisão; sem banco/browser integrado |
| SQL injection e queries dinâmicas | Executado por revisão estática |
| XSS/redirect/CORS/headers | Executado por revisão; DAST não executado |
| Upload/parser/limites | Executado por revisão + testes unitários |
| SSRF | Executado por revisão/testes do importador; sem chamada externa |
| Regras financeiras/concorrência | Executado por revisão; PostgreSQL real não executado |
| Git/secrets | Working tree e histórico local revisados; validade/uso do segredo não testados |
| SCA/CVEs/licenças/SBOM | Inventário local feito; `npm audit` e CVE online não executados |
| CI/CD | Workflow revisado; GitHub Actions/branch protection não executados/verificados |
| Railway/DNS/TLS/WAF/portas/DB público | **Não executado — sem acesso ao ambiente** |
| Mercado Pago/webhooks de pagamento | **Fora do escopo efetivo — integração ausente no repositório** |
| DAST/pentest no site publicado | **Não executado — alvo/autorização/URL não fornecidos** |
| PostgreSQL staging, migrations, roles e restore | **Não executado — não há PostgreSQL/psql acessível** |
| Lint | Executado, passou |
| Typecheck | Executado, passou |
| Testes unitários | Executado, 22 arquivos/126 testes passaram |
| Cobertura | Não executada: falta `@vitest/coverage-v8` |
| Build | Executado, falhou apenas no download bloqueado de Google Fonts |

Este relatório não certifica conformidade integral com os cerca de 350 requisitos do ASVS 5.0.0, LGPD, PCI DSS ou regras regulatórias financeiras. Questões jurídicas, configuração do provedor, logs externos, criptografia de disco/backup, IAM e evidências do ambiente publicado precisam de validação manual por seus responsáveis.
