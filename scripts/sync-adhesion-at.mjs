/**
 * sync-adhesion-at.mjs
 * --------------------
 * Preenche adhesion_at para usuários que têm adhesion_paid=true mas adhesion_at é NULL.
 * Isso corrige dados desconectados do factory reset.
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Load .env + .env.local manually
for (const envFile of ['.env', '.env.local']) {
  const p = resolve(process.cwd(), envFile);
  try {
    const content = readFileSync(p, 'utf-8');
    for (const line of content.split('\n')) {
      const match = line.match(/^([^#=]+)=(.*)$/);
      if (match) process.env[match[1].trim()] = match[2].trim();
    }
  } catch { /* ignore if missing */ }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

if (!url || !key) {
  console.error('❌ Faltam variáveis SUPABASE.');
  process.exit(1);
}

const supabase = createClient(url, key);

async function main() {
  // Busca usuários com adhesion_paid=true mas sem adhesion_at
  const { data: users, error } = await supabase
    .from('users')
    .select('id, name, adhesion_paid, adhesion_at')
    .eq('adhesion_paid', true)
    .is('adhesion_at', null);

  if (error) {
    console.error('❌ Erro ao buscar:', error.message);
    process.exit(1);
  }

  if (!users || users.length === 0) {
    console.log('✅ Todos os usuários com adhesion_paid=true já possuem adhesion_at.');
    return;
  }

  console.log(`🔧 Encontrados ${users.length} usuários para sincronizar:\n`);

  const now = new Date().toISOString();
  for (const u of users) {
    const { error: upErr } = await supabase
      .from('users')
      .update({ adhesion_at: now })
      .eq('id', u.id);

    if (upErr) {
      console.error(`  ❌ ${u.name}: ${upErr.message}`);
    } else {
      console.log(`  ✅ ${u.name} — adhesion_at = ${now}`);
    }
  }

  console.log('\n🎉 Sincronização concluída!');
}

main().catch(console.error);
