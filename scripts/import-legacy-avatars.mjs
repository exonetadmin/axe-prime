#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { Resolver } from 'node:dns/promises';
import { request as requestHttps } from 'node:https';
import { BlockList, isIP } from 'node:net';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import sharp from 'sharp';

const { Client } = pg;
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const MAX_AVATAR_DIMENSION = 8_192;
const MAX_AVATAR_PIXELS = 16_777_216;
const MAX_AVATAR_METADATA_BYTES = 256 * 1024;
const MAX_ENCODED_USER_ID_LENGTH = 300;
const DOWNLOAD_TIMEOUT_MILLISECONDS = 15_000;
const nonPublicNetworks = new BlockList();

for (const [address, prefix] of [
  ['0.0.0.0', 8],
  ['10.0.0.0', 8],
  ['100.64.0.0', 10],
  ['127.0.0.0', 8],
  ['169.254.0.0', 16],
  ['172.16.0.0', 12],
  ['192.0.0.0', 24],
  ['192.168.0.0', 16],
  ['198.18.0.0', 15],
  ['224.0.0.0', 4],
  ['240.0.0.0', 4],
]) {
  nonPublicNetworks.addSubnet(address, prefix, 'ipv4');
}
for (const [address, prefix] of [
  ['::', 128],
  ['::1', 128],
  ['::ffff:0.0.0.0', 96],
  ['fc00::', 7],
  ['fe80::', 10],
  ['ff00::', 8],
]) {
  nonPublicNetworks.addSubnet(address, prefix, 'ipv6');
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
    throw new Error('A conexão de banco deve ser uma URL PostgreSQL válida.');
  }
  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error('A conexão de banco deve usar postgres:// ou postgresql://.');
  }
  const forbidden = new Set([
    'ssl',
    'sslcert',
    'sslkey',
    'sslmode',
    'sslpassword',
    'sslrootcert',
    'uselibpqcompat',
    'options',
  ]);
  for (const name of parsed.searchParams.keys()) {
    if (forbidden.has(name.toLowerCase())) {
      throw new Error(
        'Remova parâmetros SSL/options da URL; use DATABASE_SSL_MODE/DATABASE_CA_CERT.'
      );
    }
  }
  return value;
}

function databaseUsername(databaseUrl) {
  const encodedUsername = new URL(databaseUrl).username;
  if (!encodedUsername) throw new Error('A conexão de banco precisa informar o usuário.');
  try {
    return decodeURIComponent(encodedUsername);
  } catch {
    throw new Error('A conexão de banco contém um usuário com percent-encoding inválido.');
  }
}

function avatarImportDatabaseUrl() {
  const dedicatedUrl = validateDatabaseUrl(requiredEnvironment('DATABASE_AVATAR_IMPORT_URL'));
  const dedicatedUsername = databaseUsername(dedicatedUrl);
  const forbiddenUrls = [process.env.DATABASE_MIGRATION_URL, process.env.DATABASE_URL].filter(
    value => value?.trim()
  );
  for (const forbiddenUrl of forbiddenUrls) {
    if (databaseUsername(validateDatabaseUrl(forbiddenUrl.trim())) === dedicatedUsername) {
      throw new Error(
        'DATABASE_AVATAR_IMPORT_URL deve usar uma role temporária diferente das roles runtime e migradora.'
      );
    }
  }

  return dedicatedUrl;
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

function allowedAvatarHosts() {
  const hosts = new Set(
    requiredEnvironment('LEGACY_AVATAR_ALLOWED_HOSTS')
      .split(',')
      .map(value => value.trim().toLowerCase())
      .filter(Boolean)
  );
  if (hosts.size === 0) throw new Error('LEGACY_AVATAR_ALLOWED_HOSTS está vazio.');
  for (const host of hosts) {
    if (isIP(host) !== 0 || !/^(?=.{1,253}$)[a-z0-9](?:[a-z0-9.-]*[a-z0-9])?$/.test(host)) {
      throw new Error(`Host legado inválido: ${host}`);
    }
  }
  return hosts;
}

async function resolvePublicSourceAddress(hostname) {
  const resolver = new Resolver({ timeout: 5_000, tries: 2 });
  const answers = await Promise.allSettled([
    resolver.resolve4(hostname),
    resolver.resolve6(hostname),
  ]);
  const addresses = answers.flatMap((answer, index) =>
    answer.status === 'fulfilled'
      ? answer.value.map(address => ({ address, family: index === 0 ? 4 : 6 }))
      : []
  );
  if (
    addresses.length === 0 ||
    addresses.some(({ address, family }) =>
      nonPublicNetworks.check(address, family === 6 ? 'ipv6' : 'ipv4')
    )
  ) {
    throw new Error('host legado resolve para uma rede não pública');
  }
  return addresses[0];
}

function encodeAvatarUserId(userId) {
  if (
    typeof userId !== 'string' ||
    !userId ||
    userId === '.' ||
    userId === '..' ||
    /[\\/\u0000-\u001f\u007f-\u009f]/.test(userId)
  ) {
    throw new Error('identificador legado incompatível com a rota de avatar');
  }
  try {
    const encoded = encodeURIComponent(userId);
    if (encoded.length > MAX_ENCODED_USER_ID_LENGTH) {
      throw new Error('identificador legado excede o limite da rota de avatar');
    }
    return encoded;
  } catch (error) {
    if (error instanceof Error && error.message.startsWith('identificador legado')) throw error;
    throw new Error('identificador legado não pode ser codificado com segurança');
  }
}

function parseArguments(argv) {
  let dryRun = false;
  for (const argument of argv) {
    if (argument === '--dry-run') dryRun = true;
    else if (argument === '--help') {
      console.log(
        [
          'Uso: npm run avatars:migrate -- [--dry-run]',
          '',
          '--dry-run  Conta as migrações necessárias sem baixar ou alterar dados.',
        ].join('\n')
      );
      return { help: true, dryRun };
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
  }
  return { help: false, dryRun };
}

function validateSourceUrl(raw, allowedHosts) {
  let url;
  try {
    url = new URL(raw);
  } catch {
    throw new Error('URL legada inválida.');
  }
  if (
    url.protocol !== 'https:' ||
    url.username ||
    url.password ||
    url.hash ||
    (url.port && url.port !== '443') ||
    !allowedHosts.has(url.hostname.toLowerCase())
  ) {
    throw new Error('URL legada fora da allowlist HTTPS.');
  }
  return url;
}

function hasValidContainerEnvelope(data, format) {
  if (format === 'jpeg') {
    return (
      data.length >= 4 &&
      data[0] === 0xff &&
      data[1] === 0xd8 &&
      data[data.length - 2] === 0xff &&
      data[data.length - 1] === 0xd9
    );
  }
  if (format === 'png') {
    const pngSignature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const pngEnd = Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82]);
    return (
      data.length >= pngSignature.length + pngEnd.length &&
      data.subarray(0, pngSignature.length).equals(pngSignature) &&
      data.subarray(data.length - pngEnd.length).equals(pngEnd)
    );
  }
  if (format === 'gif') {
    const header = data.toString('ascii', 0, 6);
    return (
      data.length >= 14 &&
      (header === 'GIF87a' || header === 'GIF89a') &&
      data[data.length - 1] === 0x3b
    );
  }
  if (format === 'webp') {
    return (
      data.length >= 20 &&
      data.toString('ascii', 0, 4) === 'RIFF' &&
      data.toString('ascii', 8, 12) === 'WEBP' &&
      data.readUInt32LE(4) + 8 === data.length
    );
  }
  return false;
}

async function inspectAvatarData(data) {
  const contentTypes = new Map([
    ['jpeg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['gif', 'image/gif'],
  ]);
  try {
    const image = sharp(data, {
      animated: true,
      failOn: 'error',
      limitInputPixels: MAX_AVATAR_PIXELS,
      sequentialRead: true,
      unlimited: false,
    });
    const metadata = await image.metadata();
    const contentType = contentTypes.get(metadata.format);
    const width = metadata.width;
    const height = metadata.height;
    const metadataBytes = [
      metadata.exif,
      metadata.icc,
      metadata.iptc,
      metadata.xmp,
      metadata.tifftagPhotoshop,
    ].reduce((total, value) => total + (value?.byteLength ?? 0), 0);
    const commentBytes = (metadata.comments ?? []).reduce(
      (total, comment) =>
        total +
        Buffer.byteLength(comment.keyword, 'utf8') +
        Buffer.byteLength(comment.text, 'utf8'),
      0
    );
    if (
      !contentType ||
      !hasValidContainerEnvelope(data, metadata.format) ||
      !Number.isSafeInteger(width) ||
      !Number.isSafeInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      width > MAX_AVATAR_DIMENSION ||
      height > MAX_AVATAR_DIMENSION ||
      width * height > MAX_AVATAR_PIXELS ||
      (metadata.pages ?? 1) !== 1 ||
      metadataBytes + commentBytes > MAX_AVATAR_METADATA_BYTES
    ) {
      throw new Error('imagem fora dos limites estruturais');
    }

    // Force a bounded full decode so a valid-looking header cannot hide a
    // corrupt or decompression-heavy payload that browsers would later parse.
    await image.clone().raw().toBuffer();
    return contentType;
  } catch {
    throw new Error('conteúdo não é uma imagem JPEG, PNG, WebP ou GIF estática dentro dos limites');
  }
}

async function downloadAvatar(url) {
  const target = await resolvePublicSourceAddress(url.hostname);
  const data = await new Promise((resolve, reject) => {
    let settled = false;
    let timeout;
    const finish = (error, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      if (error) reject(error);
      else resolve(value);
    };

    const request = requestHttps(
      {
        protocol: 'https:',
        hostname: target.address,
        port: 443,
        family: target.family,
        method: 'GET',
        path: `${url.pathname}${url.search}`,
        servername: url.hostname,
        rejectUnauthorized: true,
        agent: false,
        headers: {
          Host: url.host,
          Accept: 'image/jpeg,image/png,image/webp,image/gif',
          'Accept-Encoding': 'identity',
        },
      },
      response => {
        const status = response.statusCode ?? 0;
        if (status < 200 || status >= 300) {
          response.resume();
          finish(new Error(`download respondeu HTTP ${status}`));
          return;
        }
        const contentEncoding = response.headers['content-encoding'];
        if (contentEncoding && contentEncoding !== 'identity') {
          response.resume();
          finish(new Error('download respondeu com Content-Encoding não permitido'));
          return;
        }
        const rawLength = response.headers['content-length'];
        if (
          Array.isArray(rawLength) ||
          (typeof rawLength === 'string' &&
            (!/^[0-9]+$/.test(rawLength) || Number(rawLength) > MAX_AVATAR_BYTES))
        ) {
          response.destroy();
          finish(new Error('arquivo excede 5 MB ou possui Content-Length inválido'));
          return;
        }

        const chunks = [];
        let size = 0;
        response.on('data', chunk => {
          if (settled) return;
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          size += buffer.byteLength;
          if (size > MAX_AVATAR_BYTES) {
            response.destroy();
            request.destroy();
            finish(new Error('arquivo excede 5 MB'));
            return;
          }
          chunks.push(buffer);
        });
        response.on('error', error => finish(error));
        response.on('end', () => {
          if (size === 0) finish(new Error('arquivo vazio'));
          else finish(null, Buffer.concat(chunks, size));
        });
      }
    );
    request.on('error', error => finish(error));
    timeout = setTimeout(() => {
      request.destroy(new Error('download excedeu 15 segundos'));
    }, DOWNLOAD_TIMEOUT_MILLISECONDS);
    request.end();
  });

  const contentType = await inspectAvatarData(data);
  return { data, contentType };
}

async function rewriteExistingAvatar(client, row) {
  const localUrl = `/api/v1/avatars/${encodeAvatarUserId(row.id)}?v=${row.sha256.slice(0, 16)}`;
  const updated = await client.query(
    `UPDATE public.users
        SET avatar_url = $3
      WHERE id = $1 AND avatar_url = $2`,
    [row.id, row.avatar_url, localUrl]
  );
  if (updated.rowCount !== 1) {
    throw new Error('o avatar foi alterado concorrentemente; tente novamente');
  }
}

async function persistAvatar(client, row, avatar) {
  const digest = createHash('sha256').update(avatar.data).digest('hex');
  const localUrl = `/api/v1/avatars/${encodeAvatarUserId(row.id)}?v=${digest.slice(0, 16)}`;
  await client.query('BEGIN');
  try {
    const inserted = await client.query(
      `INSERT INTO public.user_avatars (
         user_id, content_type, data, size_bytes, sha256, updated_at
       ) VALUES ($1, $2, $3, $4, $5, NOW())
       ON CONFLICT (user_id) DO NOTHING
       RETURNING user_id`,
      [row.id, avatar.contentType, avatar.data, avatar.data.byteLength, digest]
    );
    if (inserted.rowCount !== 1) {
      throw new Error('o avatar foi criado concorrentemente; execute novamente');
    }
    const updated = await client.query(
      `UPDATE public.users
          SET avatar_url = $3
        WHERE id = $1 AND avatar_url = $2`,
      [row.id, row.avatar_url, localUrl]
    );
    if (updated.rowCount !== 1) {
      throw new Error('o avatar foi alterado concorrentemente; tente novamente');
    }
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function assertLeastPrivilegeImporter(client) {
  const result = await client.query(
    `SELECT role.rolcanlogin,
            role.rolsuper,
            role.rolcreaterole,
            role.rolcreatedb,
            role.rolreplication,
            role.rolbypassrls,
            role.oid = database.datdba AS owns_database,
            role.oid = namespace.nspowner AS owns_schema,
            pg_catalog.has_database_privilege(role.oid, database.oid, 'CREATE')
              AS can_create_database_objects,
            pg_catalog.has_schema_privilege(role.oid, namespace.oid, 'CREATE')
              AS can_create_schema_objects,
            EXISTS (
              SELECT 1 FROM pg_catalog.pg_auth_members AS membership
               WHERE membership.member = role.oid
            ) AS has_role_membership,
            EXISTS (
              SELECT 1 FROM pg_catalog.pg_class AS relation
               WHERE relation.relnamespace = namespace.oid
                 AND relation.relowner = role.oid
            ) AS owns_relation,
            EXISTS (
              SELECT 1 FROM pg_catalog.pg_proc AS routine
               WHERE routine.pronamespace = namespace.oid
                 AND routine.proowner = role.oid
            ) AS owns_routine,
            EXISTS (
              SELECT 1 FROM pg_catalog.pg_type AS data_type
               WHERE data_type.typnamespace = namespace.oid
                 AND data_type.typowner = role.oid
            ) AS owns_type,
            pg_catalog.has_column_privilege(role.oid, 'public.users', 'id', 'SELECT')
              AS can_select_user_id,
            pg_catalog.has_column_privilege(
              role.oid, 'public.users', 'avatar_url', 'SELECT'
            ) AS can_select_user_avatar,
            pg_catalog.has_column_privilege(
              role.oid, 'public.users', 'avatar_url', 'UPDATE'
            ) AS can_update_user_avatar,
            pg_catalog.has_column_privilege(
              role.oid, 'public.user_avatars', 'user_id', 'SELECT'
            ) AS can_select_avatar_user_id,
            pg_catalog.has_column_privilege(
              role.oid, 'public.user_avatars', 'sha256', 'SELECT'
            ) AS can_select_avatar_hash,
            pg_catalog.has_table_privilege(
              role.oid, 'public.user_avatars', 'INSERT'
            ) AS can_insert_avatar,
            pg_catalog.has_table_privilege(
              role.oid,
              'public.users',
              'INSERT,DELETE,TRUNCATE,REFERENCES,TRIGGER'
            ) AS forbidden_users_table_privilege,
            pg_catalog.has_table_privilege(
              role.oid,
              'public.user_avatars',
              'SELECT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
            ) AS forbidden_avatars_table_privilege,
            EXISTS (
              SELECT 1
                FROM pg_catalog.pg_attribute AS attribute
                JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
               WHERE relation.relnamespace = namespace.oid
                 AND relation.relname = 'users'
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND (
                   (
                     attribute.attname NOT IN ('id', 'avatar_url')
                     AND pg_catalog.has_column_privilege(
                       role.oid, relation.oid, attribute.attnum, 'SELECT'
                     )
                   ) OR (
                     attribute.attname <> 'avatar_url'
                     AND pg_catalog.has_column_privilege(
                       role.oid, relation.oid, attribute.attnum, 'UPDATE'
                     )
                   ) OR pg_catalog.has_column_privilege(
                     role.oid, relation.oid, attribute.attnum, 'INSERT,REFERENCES'
                   )
                 )
            ) AS forbidden_users_column_privilege,
            EXISTS (
              SELECT 1
                FROM pg_catalog.pg_attribute AS attribute
                JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
               WHERE relation.relnamespace = namespace.oid
                 AND relation.relname = 'user_avatars'
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND (
                   (
                     attribute.attname NOT IN ('user_id', 'sha256')
                     AND pg_catalog.has_column_privilege(
                       role.oid, relation.oid, attribute.attnum, 'SELECT'
                     )
                   ) OR pg_catalog.has_column_privilege(
                     role.oid, relation.oid, attribute.attnum, 'UPDATE,REFERENCES'
                   )
                 )
            ) AS forbidden_avatars_column_privilege,
            EXISTS (
              SELECT 1
                FROM pg_catalog.pg_class AS relation
               WHERE relation.relnamespace = namespace.oid
                 AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
                 AND relation.relname NOT IN ('users', 'user_avatars')
                 AND pg_catalog.has_table_privilege(
                   role.oid,
                   relation.oid,
                   'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER'
                 )
            ) AS forbidden_other_table_privilege,
            EXISTS (
              SELECT 1
                FROM pg_catalog.pg_attribute AS attribute
                JOIN pg_catalog.pg_class AS relation ON relation.oid = attribute.attrelid
               WHERE relation.relnamespace = namespace.oid
                 AND relation.relkind IN ('r', 'p', 'v', 'm', 'f')
                 AND relation.relname NOT IN ('users', 'user_avatars')
                 AND attribute.attnum > 0
                 AND NOT attribute.attisdropped
                 AND pg_catalog.has_column_privilege(
                   role.oid,
                   relation.oid,
                   attribute.attnum,
                   'SELECT,INSERT,UPDATE,REFERENCES'
                 )
            ) AS forbidden_other_column_privilege,
            EXISTS (
              SELECT 1
                FROM pg_catalog.pg_class AS sequence
               WHERE sequence.relnamespace = namespace.oid
                 AND sequence.relkind = 'S'
                 AND pg_catalog.has_sequence_privilege(
                   role.oid, sequence.oid, 'USAGE,SELECT,UPDATE'
                 )
            ) AS forbidden_sequence_privilege
       FROM pg_catalog.pg_roles AS role
       CROSS JOIN pg_catalog.pg_database AS database
       CROSS JOIN pg_catalog.pg_namespace AS namespace
      WHERE role.rolname = current_user
        AND database.datname = current_database()
        AND namespace.nspname = 'public'`
  );
  const role = result.rows[0];
  if (!role) throw new Error('não foi possível auditar a role de importação');

  const requiredPrivileges =
    role.rolcanlogin &&
    role.can_select_user_id &&
    role.can_select_user_avatar &&
    role.can_update_user_avatar &&
    role.can_select_avatar_user_id &&
    role.can_select_avatar_hash &&
    role.can_insert_avatar;
  const forbiddenPrivilege =
    role.rolsuper ||
    role.rolcreaterole ||
    role.rolcreatedb ||
    role.rolreplication ||
    role.rolbypassrls ||
    role.owns_database ||
    role.owns_schema ||
    role.can_create_database_objects ||
    role.can_create_schema_objects ||
    role.has_role_membership ||
    role.owns_relation ||
    role.owns_routine ||
    role.owns_type ||
    role.forbidden_users_table_privilege ||
    role.forbidden_avatars_table_privilege ||
    role.forbidden_users_column_privilege ||
    role.forbidden_avatars_column_privilege ||
    role.forbidden_other_table_privilege ||
    role.forbidden_other_column_privilege ||
    role.forbidden_sequence_privilege;
  if (!requiredPrivileges || forbiddenPrivilege) {
    throw new Error(
      'a role de importação não corresponde à matriz temporária de privilégio mínimo'
    );
  }
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  if (options.help) return;
  const hosts = allowedAvatarHosts();
  const databaseUrl = avatarImportDatabaseUrl();
  const client = new Client({
    connectionString: validateDatabaseUrl(databaseUrl),
    ssl: tlsConfiguration(),
    application_name: 'axe-prime-avatar-migration',
    options: '-c search_path=pg_catalog,public',
    connectionTimeoutMillis: positiveIntegerEnvironment('DATABASE_CONNECTION_TIMEOUT_MS', 10_000),
    keepAlive: true,
  });

  await client.connect();
  try {
    await assertLeastPrivilegeImporter(client);
    const result = await client.query(
      `SELECT app_user.id,
              app_user.avatar_url,
              avatar.sha256
         FROM public.users AS app_user
         LEFT JOIN public.user_avatars AS avatar ON avatar.user_id = app_user.id
        WHERE app_user.avatar_url IS NOT NULL
          AND app_user.avatar_url NOT LIKE '/api/v1/avatars/%'
        ORDER BY app_user.id`
    );
    console.log(`${result.rowCount ?? 0} avatar(es) legado(s) encontrado(s).`);
    if (options.dryRun) return;

    let imported = 0;
    let failed = 0;
    for (const row of result.rows) {
      try {
        if (row.sha256) {
          await rewriteExistingAvatar(client, row);
        } else {
          const source = validateSourceUrl(row.avatar_url, hosts);
          const avatar = await downloadAvatar(source);
          await persistAvatar(client, row, avatar);
        }
        imported += 1;
      } catch (error) {
        failed += 1;
        console.error(
          `Falha no avatar do usuário ${row.id}:`,
          error instanceof Error ? error.message : error
        );
      }
    }

    console.log(`Avatares concluídos: ${imported} migrado(s), ${failed} falha(s).`);
    if (failed > 0) process.exitCode = 1;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Falha ao migrar avatares legados.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { assertLeastPrivilegeImporter, encodeAvatarUserId, inspectAvatarData };
