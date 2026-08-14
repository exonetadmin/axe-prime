/**
 * run-migration.mjs — Executa uma migration SQL no Supabase
 * Uso: node scripts/run-migration.mjs supabase/migrations/20260329_cashback_payments.sql
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
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
if (!url || !key) { console.error('❌ Faltam variáveis SUPABASE.'); process.exit(1); }

const sqlFile = process.argv[2];
if (!sqlFile) { console.error('❌ Uso: node scripts/run-migration.mjs <arquivo.sql>'); process.exit(1); }

const sql = readFileSync(resolve(process.cwd(), sqlFile), 'utf-8');
const supabase = createClient(url, key);

console.log(`🔧 Executando: ${sqlFile}\n`);
const { error } = await supabase.rpc('exec_sql', { query: sql }).maybeSingle();

if (error) {
  // Fallback: tentar via REST diretamente
  console.log('⚠️  rpc exec_sql não disponível, tentando via fetch...');
  const res = await fetch(`${url}/rest/v1/rpc/exec_sql`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': key,
      'Authorization': `Bearer ${key}`,
    },
    body: JSON.stringify({ query: sql }),
  });
  if (!res.ok) {
    console.error('❌ Erro:', await res.text());
    console.log('\n📋 Execute manualmente no SQL Editor do Supabase:\n');
    console.log(sql);
    process.exit(1);
  }
}

console.log('✅ Migration executada com sucesso!');
