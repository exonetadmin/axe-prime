/**
 * Script de debug — consulta cashback_payments diretamente para verificar
 * se os pagamentos do admin estão realmente chegando no banco.
 *
 * Execução: node --env-file=.env.local scripts/debug-cashback.mjs
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false },
});

async function main() {
  // 1. Lista todos os cashback_payments
  const { data: payments, error: paymentsErr } = await supabase
    .from('cashback_payments')
    .select('*')
    .order('paid_at', { ascending: false });

  if (paymentsErr) {
    console.error('❌ Erro ao consultar cashback_payments:', paymentsErr);
    return;
  }

  console.log('\n═══ CASHBACK_PAYMENTS ═══');
  console.log(`Total: ${payments?.length ?? 0} registros\n`);

  if (!payments || payments.length === 0) {
    console.log('⚠️  Nenhum pagamento encontrado na tabela cashback_payments!');
    console.log('   → O admin pode ter clicado "Pagar CB" mas o insert pode ter falhado silenciosamente.');
    console.log('   → Verifique se existe uma constraint UNIQUE em (user_id, month_number).\n');
  } else {
    for (const p of payments) {
      console.log(`  user_id: ${p.user_id} | mês: ${p.month_number} | amount_cents: ${p.amount_cents} | paid_at: ${p.paid_at}`);
    }
  }

  // 2. Para cada user_id distinto, verifica adhesion_at e plan_monthly_cents
  const userIds = [...new Set((payments ?? []).map((p) => p.user_id))];
  
  if (userIds.length > 0) {
    console.log('\n═══ DADOS DO USUÁRIO (users) ═══\n');
    const { data: users } = await supabase
      .from('users')
      .select('id, name, adhesion_at, plan_monthly_cents, cashback_pct, plan_interest, adhesion_paid')
      .in('id', userIds);

    for (const u of users ?? []) {
      const totalCbCents = (payments ?? [])
        .filter((p) => p.user_id === u.id)
        .reduce((s, p) => s + (p.amount_cents ?? 0), 0);

      console.log(`  ${u.name} (${u.id.substring(0, 8)}...)`);
      console.log(`    plan_interest:     ${u.plan_interest}`);
      console.log(`    plan_monthly_cents: ${u.plan_monthly_cents}`);
      console.log(`    cashback_pct:       ${u.cashback_pct}`);
      console.log(`    adhesion_at:        ${u.adhesion_at}`);
      console.log(`    adhesion_paid:      ${u.adhesion_paid}`);
      console.log(`    → Total CB pago:    ${totalCbCents} cents (R$ ${(totalCbCents / 100).toFixed(2)})`);
      
      if (!u.adhesion_at) {
        console.log(`    ⚠️  adhesion_at é NULL → getCashbackData retornava null (BUG ANTERIOR)`);
      }
      if (!u.plan_monthly_cents) {
        console.log(`    ⚠️  plan_monthly_cents é NULL → getCashbackData retornava null (BUG ANTERIOR)`);
      }
      console.log('');
    }
  }

  // 3. Verifica withdrawal_requests pendentes/aprovados
  console.log('═══ WITHDRAWAL_REQUESTS (pending/approved) ═══\n');
  const { data: wds } = await supabase
    .from('withdrawal_requests')
    .select('user_id, amount_cents, status')
    .in('status', ['pending', 'approved']);

  if (!wds || wds.length === 0) {
    console.log('  Nenhum saque pendente ou aprovado.\n');
  } else {
    for (const w of wds) {
      console.log(`  user: ${w.user_id.substring(0, 8)}... | ${w.amount_cents} cents | status: ${w.status}`);
    }
    console.log('');
  }

  // 4. Verifica a constraint unique
  console.log('═══ VERIFICAÇÃO DE CONSTRAINTS ═══\n');
  try {
    // Tenta um select com RPC para checar se a tabela existe
    const { data: cols } = await supabase.rpc('', {}).catch(() => ({ data: null }));
    // Fallback — só verificar se conseguimos inserir/selecionar
    const { error: testErr } = await supabase
      .from('cashback_payments')
      .select('id')
      .limit(1);
    
    if (testErr) {
      console.log(`  ❌ Erro ao acessar cashback_payments: ${testErr.message}`);
    } else {
      console.log('  ✅ Tabela cashback_payments acessível.');
    }
  } catch (e) {
    console.log(`  ⚠️  ${e}`);
  }
}

main().catch(console.error);
