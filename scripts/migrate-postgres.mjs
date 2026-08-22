#!/usr/bin/env node

import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Client } = pg;

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDirectory, '..');
const databaseDirectory = path.join(projectRoot, 'database');
const schemaDirectories = ['data', 'function', 'view'];
const schemaFilePattern = /^(\d{2,})_([a-z0-9][a-z0-9_-]*)\.sql$/;
const initialSchemaMigration = {
  version: '001',
  numericVersion: 1n,
  filename: '001_initial_schema.sql',
};

// Identificador estável e exclusivo desta aplicação. O lock é de sessão para
// serializar inclusive a criação da tabela de controle de migrations.
const advisoryLockId = BigInt.asIntN(
  64,
  createHash('sha256').update('axe-prime:postgres:migrations:v1').digest().readBigUInt64BE(0)
).toString();

function requiredEnvironment(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`Variável de ambiente obrigatória ausente: ${name}`);
  }
  return value;
}

function parsePositiveInteger(name, fallback) {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;

  const value = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} deve ser um inteiro positivo.`);
  }
  return value;
}

function validateDatabaseUrl(value, environmentName = 'DATABASE_URL') {
  let parsed;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`${environmentName} deve ser uma URL PostgreSQL válida.`);
  }

  if (parsed.protocol !== 'postgres:' && parsed.protocol !== 'postgresql:') {
    throw new Error(`${environmentName} deve usar o protocolo postgres:// ou postgresql://.`);
  }

  const forbiddenTlsNames = new Set([
    'ssl',
    'sslcert',
    'sslkey',
    'sslmode',
    'sslpassword',
    'sslrootcert',
    'uselibpqcompat',
    'options',
  ]);
  const forbiddenTlsParameters = [...parsed.searchParams.keys()].filter(parameter =>
    forbiddenTlsNames.has(parameter.toLowerCase())
  );

  if (forbiddenTlsParameters.length > 0) {
    throw new Error(
      `Remova parâmetros proibidos de ${environmentName}: ${forbiddenTlsParameters.join(', ')}. ` +
        'Configure TLS somente com DATABASE_SSL_MODE/DATABASE_CA_CERT.'
    );
  }

  return value;
}

function buildTlsConfiguration() {
  const mode = (process.env.DATABASE_SSL_MODE ?? 'verify-full').trim().toLowerCase();

  if (mode === 'disable') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('DATABASE_SSL_MODE=disable não é permitido em produção.');
    }
    return false;
  }

  if (mode !== 'require' && mode !== 'verify-full') {
    throw new Error('DATABASE_SSL_MODE deve ser "verify-full", "require" ou "disable".');
  }

  const ca = process.env.DATABASE_CA_CERT?.replace(/\\n/g, '\n').trim();
  if (ca && !ca.includes('BEGIN CERTIFICATE')) {
    throw new Error('DATABASE_CA_CERT não contém um certificado PEM válido.');
  }

  return {
    // `require` cifra o transporte e aceita CA privada/autossinada; use somente
    // em rede privada confiável. `verify-full` valida cadeia e hostname.
    rejectUnauthorized: mode === 'verify-full',
    ...(mode === 'verify-full' && ca ? { ca } : {}),
  };
}

async function loadMigrations() {
  const buffers = [];

  for (const [directoryPosition, directoryName] of schemaDirectories.entries()) {
    const directory = path.join(databaseDirectory, directoryName);
    let entries;
    try {
      entries = await readdir(directory, { withFileTypes: true });
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
        throw new Error(`A pasta obrigatória database/${directoryName}/ não existe.`);
      }
      throw error;
    }

    const fragments = entries
      .filter(entry => entry.name !== '.gitkeep')
      .map(entry => {
        if (!entry.isFile()) {
          throw new Error(
            `database/${directoryName}/ aceita somente arquivos SQL: remova ou mova ${entry.name}.`
          );
        }

        const match = schemaFilePattern.exec(entry.name);
        if (!match) {
          throw new Error(
            `Nome de arquivo SQL inválido: database/${directoryName}/${entry.name}. ` +
              'Use NN_nome_em_snake_case.sql.'
          );
        }

        const position = BigInt(match[1]);
        const canonicalPosition = position.toString().padStart(2, '0');
        if (match[1] !== canonicalPosition) {
          throw new Error(
            `Posição de arquivo inválida em ${entry.name}. ` +
              'Use ao menos dois dígitos, sem zeros excedentes.'
          );
        }

        return { position, filename: entry.name };
      })
      .sort((left, right) => {
        if (left.position < right.position) return -1;
        if (left.position > right.position) return 1;
        return left.filename.localeCompare(right.filename, 'en');
      });

    for (const fragment of fragments) {
      buffers.push(
        await readFile(
          path.join(databaseDirectory, schemaDirectories[directoryPosition], fragment.filename)
        )
      );
    }
  }

  const sqlBuffer = Buffer.concat(buffers);
  const sql = sqlBuffer.toString('utf8');
  if (!sql.trim()) {
    throw new Error('O schema em database/data, database/function e database/view está vazio.');
  }

  return [
    {
      ...initialSchemaMigration,
      sql,
      checksum: createHash('sha256').update(sqlBuffer).digest('hex'),
    },
  ];
}

async function ensureMigrationTable(client) {
  await client.query('BEGIN');
  try {
    await client.query(`
      CREATE TABLE IF NOT EXISTS public.schema_migrations (
        version       TEXT PRIMARY KEY,
        filename      TEXT NOT NULL UNIQUE,
        checksum      VARCHAR(64) NOT NULL,
        execution_ms  INTEGER NOT NULL,
        applied_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        CONSTRAINT schema_migrations_version_check
          CHECK (version ~ '^[0-9]{3,}$'),
        CONSTRAINT schema_migrations_checksum_check
          CHECK (checksum ~ '^[0-9a-f]{64}$'),
        CONSTRAINT schema_migrations_execution_ms_check
          CHECK (execution_ms >= 0)
      )
    `);
    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function readAppliedMigration(client, version) {
  const result = await client.query(
    `
      SELECT version, filename, checksum, applied_at
      FROM public.schema_migrations
      WHERE version = $1
    `,
    [version]
  );
  return result.rows[0] ?? null;
}

async function applyMigration(client, migration, settings) {
  const startedAt = process.hrtime.bigint();

  await client.query('BEGIN');
  try {
    // Instalações legadas podem manter pgcrypto no schema "extensions";
    // instalações convencionais usam "public". Ambos ficam explícitos.
    await client.query('SET LOCAL search_path TO pg_catalog, public, extensions');
    await client.query(`SET LOCAL lock_timeout = '${settings.lockTimeoutMs}ms'`);
    await client.query(`SET LOCAL statement_timeout = '${settings.statementTimeoutMs}ms'`);
    await client.query(migration.sql);

    const elapsedMilliseconds = Number((process.hrtime.bigint() - startedAt) / 1_000_000n);

    await client.query(
      `
        INSERT INTO public.schema_migrations (
          version,
          filename,
          checksum,
          execution_ms
        ) VALUES ($1, $2, $3, $4)
      `,
      [migration.version, migration.filename, migration.checksum, elapsedMilliseconds]
    );
    await client.query('COMMIT');

    return elapsedMilliseconds;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  }
}

async function main() {
  const configuredMigrationUrl = process.env.DATABASE_MIGRATION_URL?.trim();

  if (process.env.NODE_ENV === 'production') {
    if (!configuredMigrationUrl) {
      throw new Error('DATABASE_MIGRATION_URL é obrigatória em produção.');
    }
  }

  const databaseUrl = validateDatabaseUrl(
    configuredMigrationUrl || requiredEnvironment('DATABASE_URL'),
    configuredMigrationUrl ? 'DATABASE_MIGRATION_URL' : 'DATABASE_URL'
  );
  const settings = {
    lockTimeoutMs: parsePositiveInteger('DATABASE_MIGRATION_LOCK_TIMEOUT_MS', 10_000),
    statementTimeoutMs: parsePositiveInteger('DATABASE_MIGRATION_STATEMENT_TIMEOUT_MS', 300_000),
  };
  const migrations = await loadMigrations();

  if (migrations.length === 0) {
    console.log('Nenhuma migration SQL encontrada.');
    return;
  }

  const client = new Client({
    connectionString: databaseUrl,
    ssl: buildTlsConfiguration(),
    application_name: 'axe-prime-migrations',
    options: '-c search_path=pg_catalog,public,extensions',
    connectionTimeoutMillis: parsePositiveInteger('DATABASE_CONNECTION_TIMEOUT_MS', 10_000),
    keepAlive: true,
  });

  let connected = false;
  let locked = false;

  try {
    await client.connect();
    connected = true;

    await client.query(`SET lock_timeout = '${settings.lockTimeoutMs}ms'`);
    await client.query(`SET statement_timeout = '${settings.lockTimeoutMs}ms'`);
    await client.query('SELECT pg_advisory_lock($1::bigint)', [advisoryLockId]);
    locked = true;
    await client.query("SET lock_timeout = '0'");
    await client.query("SET statement_timeout = '0'");

    await ensureMigrationTable(client);

    let appliedCount = 0;
    let skippedCount = 0;

    for (const migration of migrations) {
      const applied = await readAppliedMigration(client, migration.version);

      if (applied) {
        if (applied.filename !== migration.filename || applied.checksum !== migration.checksum) {
          throw new Error(
            [
              `Migration aplicada foi alterada: versão ${migration.version}.`,
              `Banco: ${applied.filename} (${applied.checksum}).`,
              `Disco: ${migration.filename} (${migration.checksum}).`,
              'Crie uma nova migration; nunca edite uma migration já aplicada.',
            ].join(' ')
          );
        }

        console.log(`- ${migration.filename}: já aplicada`);
        skippedCount += 1;
        continue;
      }

      const elapsedMilliseconds = await applyMigration(client, migration, settings);
      console.log(`✓ ${migration.filename}: aplicada em ${elapsedMilliseconds} ms`);
      appliedCount += 1;
    }

    console.log(`Migrations concluídas: ${appliedCount} aplicada(s), ${skippedCount} ignorada(s).`);
  } finally {
    if (locked) {
      try {
        await client.query('SELECT pg_advisory_unlock($1::bigint)', [advisoryLockId]);
      } catch (error) {
        console.error('Não foi possível liberar o advisory lock:', error);
      }
    }
    if (connected) await client.end();
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch(error => {
    console.error('Falha ao executar migrations PostgreSQL.');
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}

export { loadMigrations };
