# Migração PostgreSQL

Os scripts `npm run db:migrate`, `npm run admin:create` e
`npm run avatars:migrate` leem `.env.local` e usam
`DATABASE_SSL_MODE`/`DATABASE_CA_CERT`. Os utilitários libpq (`pg_dump` e
`pg_restore`) não leem essas variáveis da aplicação; configure TLS também no
serviço libpq usado pelos comandos abaixo.

Em produção, use credenciais PostgreSQL separadas: `DATABASE_URL` para a
aplicação (sem permissão de DDL), `DATABASE_MIGRATION_URL` para o dono/migrador
do schema. O bootstrap administrativo também usa a credencial migradora, mas
somente no processo pontual; nunca disponibilize essa URL ao runtime da
aplicação. Em desenvolvimento, os scripts caem em `DATABASE_URL` quando a URL
migradora fica vazia.

No deploy web de produção, o ambiente persistente deve conter somente
`DATABASE_URL`. Injete `DATABASE_MIGRATION_URL` exclusivamente no job de
migration/bootstrap e `DATABASE_AVATAR_IMPORT_URL` somente no job de importação;
remova-as ao terminar. Não grave URLs privilegiadas no `.env.local` empacotado
ou montado no servidor Next.

Crie previamente pelo provedor/DBA uma role `LOGIN` exclusiva para a aplicação,
conceda a ela somente `CONNECT` no banco e informe seu nome em
`DATABASE_RUNTIME_ROLE`; não grave a senha em SQL nem no repositório. A role
não pode ser dona do banco, schema ou tabelas, ter atributos administrativos ou
ser membro da role migradora. Ao fim de cada `db:migrate`, o runner revoga
privilégios públicos, concede somente `USAGE` e DML nas tabelas/sequências
atuais, configura os mesmos privilégios padrão para objetos futuros e retira
qualquer acesso a `schema_migrations`. A role dona/migradora deve possuir o
schema `public` e todos os objetos restaurados; ela continua sendo a única com
DDL. Em produção, as URLs migradora/runtime separadas e
`DATABASE_RUNTIME_ROLE` são obrigatórias, e o runner confirma que o usuário de
`DATABASE_URL` corresponde à role informada. Se a role ficar vazia no
desenvolvimento, o runner avisa e não gerencia grants.

`DATABASE_MIGRATION_URL` deve apontar diretamente ao PostgreSQL ou a um pooler
em modo de sessão. Não use pooler em modo de transação: o runner mantém um
advisory lock de sessão durante todo o lote de migrations.

## Conexão segura para pg_dump e pg_restore

Use um arquivo de serviços libpq fora do repositório e um `PGPASSFILE` separado
com permissão `0600`. Isso mantém a senha fora dos argumentos visíveis do
processo e torna `verify-full` explícito. Exemplo de arquivo apontado por
`PGSERVICEFILE`:

```ini
[axe_prime_source]
host=source.example.com
port=5432
dbname=postgres
user=axe_prime_export
sslmode=verify-full
sslrootcert=/run/secrets/postgresql-source-ca.pem

[axe_prime_target]
host=target.example.com
port=5432
dbname=axe_prime
user=axe_prime_migrator
sslmode=verify-full
sslrootcert=/run/secrets/postgresql-target-ca.pem
```

O `PGPASSFILE` segue o formato `host:port:database:user:password`, uma linha por
conexão. Prepare ambos pelo gerenciador de segredos antes da janela:

```bash
export PGSERVICEFILE=/run/secrets/axe-prime-pg-service.conf
export PGPASSFILE=/run/secrets/axe-prime-pgpass
chmod 600 "$PGSERVICEFILE" "$PGPASSFILE"
```

Não coloque senha no arquivo de serviços nem numa URL passada a `--dbname`.

## Backup antes de qualquer mudança

Primeiro ensaie backup, restauração e migration em staging com uma cópia recente.
Para produção, abra uma janela de manutenção completa, interrompa aplicação e
workers e gere um backup PostgreSQL em formato custom antes de migrar ou tentar
rollback. O exemplo usa o serviço libpq de destino configurado acima; troque o
nome com `AXE_PRIME_TARGET_PG_SERVICE` se necessário:

```bash
umask 077
backup_dir="${AXE_PRIME_BACKUP_DIR:-../axe-prime-backups}"
mkdir -p "$backup_dir"
chmod 700 "$backup_dir"
backup_file="$backup_dir/axe-prime-$(date +%Y%m%d-%H%M%S).dump"
target_service="${AXE_PRIME_TARGET_PG_SERVICE:-axe_prime_target}"
pg_dump --format=custom --no-owner --no-privileges \
  --file="$backup_file" --dbname="service=$target_service"
pg_restore --list "$backup_file"
```

O caminho padrão fica fora do repositório; em produção, defina
`AXE_PRIME_BACKUP_DIR` para armazenamento seguro, criptografado e com controle
de acesso. Guarde outra cópia fora do servidor e teste periodicamente a
restauração. `backups/` e `*.dump` também são ignorados pelo Git como defesa
adicional contra versionamento acidental de PII. O formato custom do PostgreSQL
é compactado, mas não é criptografado; a proteção deve vir do filesystem ou
cofre de backups.

Esse primeiro dump é o rollback correto apenas para upgrade in-place de um
banco legado. Quando o destino é novo, ele estará vazio; nesse caso capture o
snapshot pré-migration indicado na seção seguinte.

## Transferir os dados do banco de origem

A `001` cria a estrutura em um banco vazio ou atualiza uma estrutura legada já
restaurada; ela não adivinha a origem nem copia dados por uma API externa. Para
preservar usuários, planos e histórico financeiro, restaure primeiro um dump do
schema `public` em um banco PostgreSQL de destino novo e isolado. Mantenha o
banco e o storage antigos intactos até concluir todas as conferências.

Confirme cuidadosamente que o serviço de destino aponta para um banco novo, sem
dados de produção. Os nomes padrão abaixo podem ser substituídos por
`AXE_PRIME_SOURCE_PG_SERVICE` e `AXE_PRIME_TARGET_PG_SERVICE`:

```bash
umask 077
transfer_dir="${AXE_PRIME_BACKUP_DIR:-../axe-prime-backups}"
mkdir -p "$transfer_dir"
chmod 700 "$transfer_dir"
source_dump="$transfer_dir/axe-prime-source-$(date +%Y%m%d-%H%M%S).dump"
source_service="${AXE_PRIME_SOURCE_PG_SERVICE:-axe_prime_source}"
target_service="${AXE_PRIME_TARGET_PG_SERVICE:-axe_prime_target}"
pg_dump --format=custom --schema=public --no-owner --no-privileges \
  --file="$source_dump" --dbname="service=$source_service"
pg_restore --list "$source_dump"
pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges \
  --dbname="service=$target_service" "$source_dump"

# Artefato exato para desfazer a 001 no destino, depois do restore legado e
# antes de npm run db:migrate.
pre_migration_dump="$transfer_dir/axe-prime-target-pre-migration-$(date +%Y%m%d-%H%M%S).dump"
pg_dump --format=custom --no-owner --no-privileges \
  --file="$pre_migration_dump" --dbname="service=$target_service"
pg_restore --list "$pre_migration_dump"
```

Registre antes e depois as contagens, no mínimo, de `users`, `plan_requests`,
`payments`, `commission_entries`, `cashback_payments` e
`withdrawal_requests`. Compare também somas em centavos por período e por
status; contagem igual, sozinha, não valida saldos. Se o restore acusar objetos
já existentes, pare: não use `--clean` contra um destino que não tenha sido
confirmado como descartável.

## Aplicar migrations

O destino precisa oferecer a extensão `pgcrypto`. O runner tenta instalá-la;
em serviços gerenciados que restrinjam `CREATE EXTENSION`, habilite-a antes da
janela pelo painel do provedor ou pelo DBA.

```bash
npm run db:migrate
```

O runner serializa execuções com advisory lock, aplica cada migration em uma
transação e registra seu checksum em `schema_migrations`. Uma migration pode
ser um arquivo SQL ou uma pasta com fragments SQL ordenados pelo caminho. A
pasta `database/migrations/001_initial_schema/` organiza o schema por
tabela/domínio, mas é executada como a única migration `001_initial_schema.sql`;
seus fragments não são migrations independentes. Migration aplicada nunca deve
ser editada; crie uma nova versão.

A migration consolidada remove as tabelas descontinuadas
`knowledge_entries` e `copiloto_persona`. Preserve o backup se houver algum
dado histórico nelas que precise ser arquivado fora da aplicação.

Tokens de recuperação de senha do sistema legado são invalidados porque já
foram expostos a logs pela implementação antiga. Após a migração, qualquer
recuperação em andamento precisa ser solicitada novamente.

## Importar avatares externos

O dump de `public` contém apenas `users.avatar_url`; os bytes dos avatares
ficavam no storage externo. Depois de `db:migrate`, mas antes de desligar esse
storage, configure `LEGACY_AVATAR_ALLOWED_HOSTS` com os hostnames HTTPS exatos
da origem. O importador recusa redirects, IPs literais, DNS que resolva para
redes privadas/loopback, hosts fora da allowlist, arquivos maiores que 5 MB e
conteúdo que não seja JPEG, PNG, WebP ou GIF estático válido. A conexão HTTPS
é fixada ao IP público previamente resolvido, preservando SNI/validação do
certificado; o arquivo passa por decodificação completa com os mesmos limites de
dimensão, pixels e metadata usados no upload normal:

Antes de executar o importador em qualquer ambiente, crie uma role `LOGIN`
temporária, diferente das roles runtime e migradora, e use sua URL em
`DATABASE_AVATAR_IMPORT_URL`. Depois de criar a role e conceder `CONNECT` pelo
provedor/DBA, o dono das tabelas deve limitar seu acesso ao necessário para esta
importação (substitua o identificador pelo nome exato validado pelo DBA):

```sql
GRANT USAGE ON SCHEMA public TO axe_prime_avatar_import;
GRANT SELECT (id, avatar_url), UPDATE (avatar_url)
  ON TABLE public.users TO axe_prime_avatar_import;
GRANT SELECT (user_id, sha256), INSERT
  ON TABLE public.user_avatars TO axe_prime_avatar_import;
```

O importador audita `current_user` antes de ler dados e aborta se encontrar
ownership, atributos administrativos, memberships, DDL ou privilégios fora
dessa matriz. Não reutilize uma role dona apenas omitindo sua outra URL do job.

```bash
npm run avatars:migrate -- --dry-run
npm run avatars:migrate
```

Ele grava os bytes em `user_avatars` e troca cada URL por
`/api/v1/avatars/{userId}` de forma idempotente. Não desligue o storage antigo
se o comando terminar com falhas. Confirme que não restou URL externa:

```sql
SELECT COUNT(*) AS avatares_externos_pendentes
FROM public.users
WHERE avatar_url IS NOT NULL
  AND avatar_url NOT LIKE '/api/v1/avatars/%';
```

Ao concluir e validar, revogue `CONNECT`/privilégios e elimine a role temporária
pelo provedor/DBA; remova também `DATABASE_AVATAR_IMPORT_URL` e
`LEGACY_AVATAR_ALLOWED_HOSTS` do ambiente.

## Criar ou rotacionar um administrador

O modo recomendado pede e confirma a senha em um prompt TTY oculto:

```bash
npm run admin:create -- \
  --email administrador@example.com \
  --name "Administrador" \
  --role master
```

A senha precisa ter ao menos 15 caracteres. Para automação, injete
`ADMIN_BOOTSTRAP_PASSWORD` e `ADMIN_BOOTSTRAP_PASSWORD_CONFIRM` pelo gerenciador
de segredos do ambiente; nunca passe a senha em argumentos nem a grave em
`.env.local` ou no histórico do shell.

Uma conta existente só é alterada com consentimento explícito. A rotação ativa
a conta, incrementa `token_version` e revoga todas as sessões e refresh tokens:

```bash
npm run admin:create -- \
  --email administrador@example.com \
  --name "Administrador" \
  --role master \
  --upsert
```

## Rollback

Não há rollback destrutivo automático. Mantenha o banco, storage e deploy
antigos intactos até terminar os smoke tests do novo ambiente. Se a falha
ocorrer antes do cutover, descarte o destino e continue no ambiente antigo.

Para reconstruir o destino no estado legado anterior à `001`:

1. interrompa as escritas e preserve outro backup do estado atual;
2. crie um banco vazio isolado;
3. selecione explicitamente o `pre_migration_dump` criado após o restore;
4. restaure-o com o comando abaixo e valide schema/contagens;
5. use somente uma versão antiga compatível da aplicação ou corte o tráfego de
   volta ao deploy e banco de origem preservados. O código novo não opera sobre
   o schema legado.

```bash
rollback_service="${AXE_PRIME_ROLLBACK_PG_SERVICE:?defina o serviço libpq de rollback}"
pre_migration_dump="${AXE_PRIME_PRE_MIGRATION_DUMP:?defina o snapshot pré-migration validado}"
pg_restore --exit-on-error --single-transaction \
  --no-owner --no-privileges \
  --dbname="service=$rollback_service" "$pre_migration_dump"
```

Se o novo ambiente já recebeu escritas, restaurar um snapshot anterior perde
transações. Nesse cenário, mantenha a janela fechada e faça reconciliação
orientada por ledger/auditoria antes de qualquer cutback; não execute o restore
acima diretamente sobre produção.

Não apague linhas de `schema_migrations` e não reverta DDL manualmente no banco
de produção: isso deixa o checksum sem correspondência com o schema real.

## Modelo de segurança da aplicação

O navegador não acessa PostgreSQL. Route Handlers, Server Actions protegidas e
repositories `server-only` formam a fronteira backend; todas as consultas usam
parâmetros. Clientes de API podem enviar o access token curto em
`Authorization: Bearer`, enquanto o refresh opaco permanece somente em cookie
`HttpOnly`, é armazenado como HMAC no banco, rotacionado e revogável por sessão.
Mutações autenticadas por cookie também exigem Origin/Fetch Metadata e CSRF.

HTTPS é obrigatório na borda e a conexão Node↔PostgreSQL valida o certificado.
Senhas usam scrypt e tokens não ficam em texto puro. CPF, RG, endereço e chaves
PIX continuam sendo colunas de texto: habilite criptografia de disco/backup no
provedor. Criptografia de campo com KMS e rotação de chaves é uma evolução
separada caso o modelo de ameaça exija proteção contra acesso direto ao banco.

## Entrega de recuperação de senha

Configure `APP_PUBLIC_URL`, `PASSWORD_RESET_WEBHOOK_URL` e
`PASSWORD_RESET_WEBHOOK_BEARER_TOKEN` (ao menos 32 caracteres) no gerenciador
de segredos. As duas URLs devem usar HTTPS. O webhook recebe um POST JSON com
o destinatário e `resetUrl`, autenticado por Bearer e com uma chave de
idempotência. O token bruto nunca é persistido nem registrado em logs.
O link o carrega no fragmento (`#token=...`), que não chega aos access logs, e
o navegador o envia ao backend somente no corpo JSON protegido por HTTPS.

Sem essa configuração, `/api/auth/reset` responde 503 antes de consultar o
e-mail, evitando indicar se a conta existe. Em uma falha transitória de entrega,
o token recém-criado é invalidado e a resposta continua sendo 202, igual à de
um e-mail inexistente, para não criar um canal de enumeração de contas.

## Capacidade de autenticação

`PASSWORD_SCRYPT_CONCURRENCY` limita as operações scrypt simultâneas por
processo. `PASSWORD_SCRYPT_QUEUE_LIMIT` também limita a fila; quando ela fica
cheia, a API responde 429 em vez de acumular trabalho sem limite.
`AUTH_LOGIN_GLOBAL_LIMIT` define o teto distribuído de tentativas de login por
minuto (padrão: 60). Ajuste esses valores somente após medir CPU, memória e
latência no ambiente de produção.

`AUTH_REFRESH_GLOBAL_LIMIT` faz o mesmo para renovações (padrão: 120/minuto).
JSON de autenticação é lido como stream e interrompido em 16 KB; o upload de
avatar também conta o stream e interrompe multipart acima do teto da aplicação.
Replique limites equivalentes no load balancer/CDN para rejeitar payloads antes
da aplicação.

`AUTH_RECORD_RETENTION_DAYS` controla por quantos dias sessões revogadas ou
expiradas e tokens consumidos permanecem disponíveis para auditoria e detecção
de replay (padrão: 7). A aplicação remove registros antigos em lotes pequenos
com `SKIP LOCKED`; nunca seleciona uma sessão ativa e não expirada.
