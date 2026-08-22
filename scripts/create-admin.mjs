#!/usr/bin/env node

import { randomBytes, scrypt as nodeScrypt } from 'node:crypto';
import process from 'node:process';
import { Writable } from 'node:stream';
import { createInterface } from 'node:readline/promises';
import pg from 'pg';

const { Client } = pg;

const SCRYPT_N = 2 ** 17;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_LENGTH = 64;
const SCRYPT_MAX_MEMORY = 256 * 1024 * 1024;
const SCRYPT_SALT_LENGTH = 16;
const MINIMUM_PASSWORD_LENGTH = 8;
const MAXIMUM_PASSWORD_LENGTH = 128;
const ADMIN_ROLES = new Set(['master', 'financeiro', 'suporte']);
const COMMON_PASSWORD_ROOTS = [
  'admin',
  'administrador',
  'axeprime',
  'changeme',
  'letmein',
  'password',
  'qwerty',
  'senha',
  'welcome',
];

function foldPasswordValue(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
    .replace(/[^a-z0-9]/g, '');
}

function isUnsafeBootstrapPassword(password, options) {
  const compact = foldPasswordValue(password);
  if (
    new Set([
      '123456789012345',
      'adminadminadmin',
      'administrador123',
      'axeprimeaxeprime',
      'changemechangeme',
      'passwordpassword',
      'qwertyqwerty123',
      'senhasenhasenha',
      'welcome123456789',
    ]).has(compact)
  ) {
    return true;
  }
  if (/^(.)\1{14,}$/.test(compact) || /^(.{1,8})\1{2,}$/.test(compact)) return true;
  if (/^(?:0123456789|1234567890|9876543210){2,}$/.test(compact)) return true;
  for (const root of COMMON_PASSWORD_ROOTS) {
    if (compact === root || new RegExp(`^(?:${root}){2,}[0-9]*$`).test(compact)) return true;
    if (compact.startsWith(root) && /^\d{1,8}$/.test(compact.slice(root.length))) return true;
  }
  for (const raw of ['axe prime', options.name, options.email.split('@')[0] ?? '']) {
    const context = foldPasswordValue(raw);
    if (context.length < 4) continue;
    const remainder = compact.replace(context, '');
    if (compact === context || (remainder !== compact && /^\d{0,8}$/.test(remainder))) return true;
  }
  return false;
}

function hasMinimumComposition(password) {
  return (
    /\p{L}/u.test(password) &&
    /\p{N}/u.test(password) &&
    /[^\p{L}\p{N}\s]/u.test(password)
  );
}

function usage() {
  return `
Uso:
  npm run admin:create -- --email EMAIL --name NOME [--role master] [--upsert]

Opções:
  --email EMAIL   E-mail do administrador (ou ADMIN_BOOTSTRAP_EMAIL)
  --name NOME     Nome do administrador (ou ADMIN_BOOTSTRAP_NAME)
  --role ROLE     master, financeiro ou suporte (padrão: master)
  --upsert        Rotaciona senha/dados de uma conta existente
  --help          Exibe esta ajuda

A senha nunca é aceita por argumento. Informe-a no prompt oculto ou use
ADMIN_BOOTSTRAP_PASSWORD e ADMIN_BOOTSTRAP_PASSWORD_CONFIRM.
`.trim();
}

function parseArguments(argv) {
  const options = {
    email: process.env.ADMIN_BOOTSTRAP_EMAIL?.trim() ?? '',
    name: process.env.ADMIN_BOOTSTRAP_NAME?.trim() ?? '',
    role: process.env.ADMIN_BOOTSTRAP_ROLE?.trim().toLowerCase() || 'master',
    upsert: false,
    help: false,
  };
  const valueOptions = new Map([
    ['--email', 'email'],
    ['--name', 'name'],
    ['--role', 'role'],
  ]);

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];

    if (argument === '--help') {
      options.help = true;
      continue;
    }
    if (argument === '--upsert') {
      options.upsert = true;
      continue;
    }
    if (/password|senha/i.test(argument)) {
      throw new Error('A senha nunca pode ser informada por argumento de linha de comando.');
    }

    const equalIndex = argument.indexOf('=');
    const optionName = equalIndex >= 0 ? argument.slice(0, equalIndex) : argument;
    const property = valueOptions.get(optionName);
    if (!property) throw new Error(`Argumento desconhecido: ${argument}`);

    const value = equalIndex >= 0 ? argument.slice(equalIndex + 1) : argv[(index += 1)];
    if (!value || value.startsWith('--')) {
      throw new Error(`${optionName} exige um valor.`);
    }
    options[property] = value.trim();
  }

  options.email = options.email.toLowerCase();
  options.role = options.role.toLowerCase();
  return options;
}

function validateOptions(options) {
  if (!options.name || options.name.length < 2 || options.name.length > 160) {
    throw new Error('O nome deve ter entre 2 e 160 caracteres.');
  }
  if (options.email.length > 320 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(options.email)) {
    throw new Error('Informe um e-mail válido.');
  }
  if (!ADMIN_ROLES.has(options.role)) {
    throw new Error('Role inválida. Use master, financeiro ou suporte.');
  }
}

async function promptForHiddenValue(message) {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    throw new Error(
      'Sem TTY para prompt oculto. Use ADMIN_BOOTSTRAP_PASSWORD e ' +
        'ADMIN_BOOTSTRAP_PASSWORD_CONFIRM.'
    );
  }

  let muted = false;
  const hiddenOutput = new Writable({
    write(chunk, encoding, callback) {
      if (!muted) process.stdout.write(chunk, encoding);
      callback();
    },
  });
  const prompt = createInterface({
    input: process.stdin,
    output: hiddenOutput,
    terminal: true,
  });

  try {
    const answerPromise = prompt.question(message);
    muted = true;
    const answer = await answerPromise;
    muted = false;
    process.stdout.write('\n');
    return answer;
  } finally {
    muted = false;
    prompt.close();
  }
}

async function readConfirmedPassword(options) {
  const environmentPassword = process.env.ADMIN_BOOTSTRAP_PASSWORD;
  const environmentConfirmation = process.env.ADMIN_BOOTSTRAP_PASSWORD_CONFIRM;

  // Reduz o tempo em que os segredos permanecem disponíveis a dependências.
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD;
  delete process.env.ADMIN_BOOTSTRAP_PASSWORD_CONFIRM;

  let password;
  let confirmation;
  if (environmentPassword !== undefined || environmentConfirmation !== undefined) {
    if (environmentPassword === undefined || environmentConfirmation === undefined) {
      throw new Error('Defina ADMIN_BOOTSTRAP_PASSWORD e ADMIN_BOOTSTRAP_PASSWORD_CONFIRM juntas.');
    }
    password = environmentPassword;
    confirmation = environmentConfirmation;
  } else {
    password = await promptForHiddenValue('Senha do administrador: ');
    confirmation = await promptForHiddenValue('Confirme a senha: ');
  }

  const normalizedPassword = password.normalize('NFC');
  const normalizedConfirmation = confirmation.normalize('NFC');
  if (normalizedPassword !== normalizedConfirmation) {
    throw new Error('A confirmação da senha não confere.');
  }
  const passwordLength = Array.from(normalizedPassword).length;
  if (passwordLength < MINIMUM_PASSWORD_LENGTH || passwordLength > MAXIMUM_PASSWORD_LENGTH) {
    throw new Error(
      `A senha deve ter entre ${MINIMUM_PASSWORD_LENGTH} e ` +
        `${MAXIMUM_PASSWORD_LENGTH} caracteres.`
    );
  }
  if (!hasMinimumComposition(normalizedPassword)) {
    throw new Error('A senha deve conter pelo menos uma letra, um número e um caractere especial.');
  }

  const foldedPassword = normalizedPassword.toLocaleLowerCase('pt-BR');
  if (
    foldedPassword === options.email.normalize('NFC').toLocaleLowerCase('pt-BR') ||
    foldedPassword === options.name.normalize('NFC').toLocaleLowerCase('pt-BR')
  ) {
    throw new Error('A senha não pode ser igual ao nome ou ao e-mail.');
  }
  if (isUnsafeBootstrapPassword(normalizedPassword, options)) {
    throw new Error('Escolha uma senha menos comum e sem dados do administrador ou da empresa.');
  }

  return normalizedPassword;
}

function deriveScrypt(password, salt) {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      SCRYPT_KEY_LENGTH,
      {
        N: SCRYPT_N,
        r: SCRYPT_R,
        p: SCRYPT_P,
        maxmem: SCRYPT_MAX_MEMORY,
      },
      (error, derivedKey) => {
        if (error) reject(error);
        else resolve(derivedKey);
      }
    );
  });
}

async function hashPassword(password) {
  const salt = randomBytes(SCRYPT_SALT_LENGTH);
  const derivedKey = await deriveScrypt(password, salt);
  const encoded = [
    'scrypt',
    String(SCRYPT_N),
    String(SCRYPT_R),
    String(SCRYPT_P),
    salt.toString('base64url'),
    derivedKey.toString('base64url'),
  ].join('$');
  derivedKey.fill(0);
  return encoded;
}

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  return value;
}

function positiveIntegerEnvironment(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return value;
}

function validateDatabaseUrl(value) {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error('DATABASE_URL deve ser uma URL PostgreSQL válida.');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('DATABASE_URL deve usar postgres:// ou postgresql://.');
  }

  const forbiddenNames = new Set([
    'ssl',
    'sslcert',
    'sslkey',
    'sslmode',
    'sslpassword',
    'sslrootcert',
    'uselibpqcompat',
    'options',
  ]);
  const forbidden = [...parsed.searchParams.keys()].filter(name =>
    forbiddenNames.has(name.toLowerCase())
  );
  if (forbidden.length > 0) {
    throw new Error(
      `Remova parâmetros proibidos da DATABASE_URL: ${forbidden.join(', ')}. ` +
        'Use DATABASE_SSL_MODE/DATABASE_CA_CERT para TLS.'
    );
  }
  return value;
}

function tlsConfiguration() {
  const mode = (process.env.DATABASE_SSL_MODE ?? 'verify-full').trim().toLowerCase();
  if (mode === 'disable') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_SSL_MODE=disable não é permitido em produção.');
    }
    return false;
  }
  if (mode !== 'require' && mode !== 'verify-full') {
    throw new Error('DATABASE_SSL_MODE deve ser verify-full, require ou disable.');
  }

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
  if (ca && !ca.includes('BEGIN CERTIFICATE')) {
    throw new Error('DATABASE_CA_CERT não contém um certificado PEM válido.');
  }
  return {
    rejectUnauthorized: mode === 'verify-full',
    ...(mode === 'verify-full' && ca ? { ca } : {}),
  };
}

async function createOrRotateAdmin(client, options, passwordHash) {
  await client.query('BEGIN ISOLATION LEVEL SERIALIZABLE');
  try {
    await client.query('SET LOCAL search_path TO pg_catalog, public, extensions');
    const existingResult = await client.query(
      `SELECT id
         FROM public.admin_users
        WHERE lower(btrim(email)) = lower(btrim($1))
        FOR UPDATE`,
      [options.email]
    );
    const existingId = existingResult.rows[0]?.id ?? null;

    if (existingId && !options.upsert) {
      throw new Error(
        'Já existe um administrador com esse e-mail. Use --upsert explicitamente ' +
          'para rotacionar a credencial.'
      );
    }

    let result;
    if (existingId) {
      result = await client.query(
        `UPDATE public.admin_users
            SET name = $2,
                email = lower(btrim($3)),
                password_hash = $4,
                role = $5,
                active = TRUE,
                password_changed_at = NOW(),
                token_version = token_version + 1
          WHERE id = $1
          RETURNING id, email, role, token_version`,
        [existingId, options.name, options.email, passwordHash, options.role]
      );

      await client.query(
        `UPDATE public.auth_sessions
            SET revoked_at = COALESCE(revoked_at, NOW()),
                revoke_reason = COALESCE(
                  revoke_reason,
                  'admin_bootstrap_password_rotation'
                )
          WHERE admin_user_id = $1
            AND revoked_at IS NULL`,
        [existingId]
      );
      await client.query(
        `UPDATE public.auth_refresh_tokens AS refresh_token
            SET revoked_at = COALESCE(refresh_token.revoked_at, NOW())
           FROM public.auth_sessions AS session
          WHERE refresh_token.session_id = session.id
            AND session.admin_user_id = $1
            AND refresh_token.revoked_at IS NULL`,
        [existingId]
      );
    } else {
      result = await client.query(
        `INSERT INTO public.admin_users (
           name,
           email,
           password_hash,
           role,
           active,
           password_changed_at
         ) VALUES ($1, lower(btrim($2)), $3, $4, TRUE, NOW())
         RETURNING id, email, role, token_version`,
        [options.name, options.email, passwordHash, options.role]
      );
    }

    await client.query('COMMIT');
    return { ...result.rows[0], rotated: Boolean(existingId) };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) {
    console.log(usage());
    return;
  }
  validateOptions(options);

  const password = await readConfirmedPassword(options);
  const passwordHash = await hashPassword(password);

  const migrationDatabaseUrl = process.env.DATABASE_MIGRATION_URL?.trim();
  if (process.env.NODE_ENV === 'production' && !migrationDatabaseUrl) {
    throw new Error('DATABASE_MIGRATION_URL é obrigatória em produção.');
  }

  const client = new Client({
    connectionString: validateDatabaseUrl(
      migrationDatabaseUrl || requiredEnvironment('DATABASE_URL')
    ),
    ssl: tlsConfiguration(),
    application_name: 'axe-prime-admin-bootstrap',
    options: '-c search_path=pg_catalog,public,extensions',
    connectionTimeoutMillis: positiveIntegerEnvironment('DATABASE_CONNECTION_TIMEOUT_MS', 10_000),
    keepAlive: true,
  });

  try {
    await client.connect();
    const admin = await createOrRotateAdmin(client, options, passwordHash);
    console.log(
      admin.rotated
        ? `Credencial rotacionada e sessões revogadas para ${admin.email} (${admin.role}).`
        : `Administrador criado: ${admin.email} (${admin.role}).`
    );
  } finally {
    await client.end().catch(() => undefined);
  }
}

main().catch(error => {
  console.error('Falha no bootstrap administrativo.');
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
