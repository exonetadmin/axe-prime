/**
 * create-cashback-table.mjs — Cria tabela cashback_payments via SQL no Supabase
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load env
for (const envFile of ['.env', '.env.local']) {
  try {
    const content = readFileSync(resolve(process.cwd(), envFile), 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  } catch { /* ignore */ }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) { console.error('❌ Faltam variáveis SUPABASE (precisa de SERVICE_ROLE_KEY).'); process.exit(1); }

console.log('🔧 Criando tabela cashback_payments...\n');

// Use postgrest-compatible approach: try inserting into cashback_payments first  
// If table doesn't exist, we need to use the SQL editor or pg-meta API
const supabase = createClient(url, key);

// Test if table already exists by trying to select
const { error: testErr } = await supabase.from('cashback_payments').select('id').limit(1);

if (!testErr) {
  console.log('✅ Tabela cashback_payments já existe!');
  process.exit(0);
}

if (testErr.message.includes('does not exist') || testErr.code === '42P01') {
  console.log('📋 Tabela não existe. Tentando criar via pg-meta...\n');
  
  const sql = `
CREATE TABLE IF NOT EXISTS cashback_payments (
  id            TEXT PRIMARY KEY,
  user_id       TEXT NOT NULL REFERENCES users(id),
  month_number  INTEGER NOT NULL CHECK (month_number BETWEEN 1 AND 12),
  amount_cents  INTEGER NOT NULL,
  paid_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  paid_by       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id, month_number)
);
CREATE INDEX IF NOT EXISTS idx_cashback_payments_user ON cashback_payments (user_id);
  `.trim();

  // Try via pg-meta endpoint (Supabase Dashboard API)
  const pgMetaUrl = `${url}/pg/query`;
  const res = await fetch(pgMetaUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });

  if (res.ok) {
    console.log('✅ Tabela criada com sucesso via pg-meta!');
  } else {
    const body = await res.text();
    console.error('⚠️  Erro ao criar via pg-meta:', body);
    console.log('\n📋 Execute MANUALMENTE no SQL Editor do Supabase (https://app.supabase.com):\n');
    console.log(sql);
    console.log('\n⚠️  Após executar, rode novamente para confirmar.');
  }
} else {
  console.error('❌ Erro inesperado:', testErr.message);
}
