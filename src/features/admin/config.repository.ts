/**
 * Config Repository — Supabase Postgres
 * Tabelas: platform_config, plans, admin_users, knowledge_entries, copiloto_persona
 */

import { supabase } from '@/lib/supabase';

// ── Types ──────────────────────────────────────────────────────────────────────

export type KnowledgeEntry = {
  id: string; category: string; title: string; content: string;
  active: boolean; sort_order: number; created_at: string; updated_at: string;
};

export type CopiloPersona = {
  user_id: string; display_name: string; style: string; tone: string; updated_at: string;
};

export type PlanRow = {
  id: string; name: string; monthly_cents: number;
};

export type AdminUserRow = {
  id: string; name: string; email: string; password: string; role: string; active: boolean; created_at: string;
};

export type CommissionConfig = {
  direct_pct: number; level1_pct: number; level2_pct: number;
  level3_pct: number; level4_pct: number; level5_pct: number;
};

export type CashbackConfig = {
  standard_pct: number; premium_pct: number; premium_threshold_cents: number;
  duration_months: number; credit_day: number;
};

// ── Repository ─────────────────────────────────────────────────────────────────

class ConfigRepository {
  private async getConfig(key: string, fallback: number): Promise<number> {
    const { data } = await supabase
      .from('platform_config')
      .select('value')
      .eq('key', key)
      .maybeSingle();
    return parseFloat(data?.value ?? String(fallback));
  }

  private async setConfig(key: string, value: string): Promise<void> {
    await supabase.from('platform_config').upsert({
      key,
      value,
      updated_at: new Date().toISOString(),
    });
  }

  // ── Plans ───────────────────────────────────────────────────────────────────

  async getPlans(): Promise<PlanRow[]> {
    const { data } = await supabase
      .from('plans')
      .select('id, name, monthly_cents')
      .order('monthly_cents', { ascending: true });
    return (data ?? []) as PlanRow[];
  }

  async updatePlan(id: string, name: string, monthly_cents: number): Promise<void> {
    await supabase.from('plans').update({ name, monthly_cents }).eq('id', id);
  }

  // ── Commission rules ────────────────────────────────────────────────────────

  async getCommissionConfig(): Promise<CommissionConfig> {
    return {
      direct_pct:  await this.getConfig('commission_direct_pct', 10),
      level1_pct:  await this.getConfig('commission_level1_pct', 2),
      level2_pct:  await this.getConfig('commission_level2_pct', 1),
      level3_pct:  await this.getConfig('commission_level3_pct', 0.5),
      level4_pct:  await this.getConfig('commission_level4_pct', 0),
      level5_pct:  await this.getConfig('commission_level5_pct', 0),
    };
  }

  async setCommissionConfig(cfg: CommissionConfig): Promise<void> {
    await Promise.all([
      this.setConfig('commission_direct_pct', String(cfg.direct_pct)),
      this.setConfig('commission_level1_pct', String(cfg.level1_pct)),
      this.setConfig('commission_level2_pct', String(cfg.level2_pct)),
      this.setConfig('commission_level3_pct', String(cfg.level3_pct)),
      this.setConfig('commission_level4_pct', String(cfg.level4_pct)),
      this.setConfig('commission_level5_pct', String(cfg.level5_pct)),
    ]);
  }

  // ── Cashback rules ──────────────────────────────────────────────────────────

  async getCashbackConfig(): Promise<CashbackConfig> {
    return {
      standard_pct:            await this.getConfig('cashback_standard_pct', 40),
      premium_pct:             await this.getConfig('cashback_premium_pct', 50),
      premium_threshold_cents: await this.getConfig('cashback_premium_threshold_cents', 1_000_000),
      duration_months:         await this.getConfig('cashback_duration_months', 12),
      credit_day:              await this.getConfig('cashback_credit_day', 16),
    };
  }

  async setCashbackConfig(cfg: CashbackConfig): Promise<void> {
    await Promise.all([
      this.setConfig('cashback_standard_pct',            String(cfg.standard_pct)),
      this.setConfig('cashback_premium_pct',             String(cfg.premium_pct)),
      this.setConfig('cashback_premium_threshold_cents', String(cfg.premium_threshold_cents)),
      this.setConfig('cashback_duration_months',         String(cfg.duration_months)),
      this.setConfig('cashback_credit_day',              String(cfg.credit_day)),
    ]);
  }

  // ── Admin users ─────────────────────────────────────────────────────────────

  async getAdminUsers(): Promise<AdminUserRow[]> {
    const { data } = await supabase
      .from('admin_users')
      .select('id, name, email, password, role, active, created_at')
      .order('created_at', { ascending: true });
    return (data ?? []) as AdminUserRow[];
  }

  async addAdminUser(name: string, email: string, password: string, role: string): Promise<void> {
    await supabase.from('admin_users').insert({
      id: `adm-${Date.now()}`,
      name, email, password, role,
    });
  }

  async updateAdminUser(id: string, name: string, email: string, password: string, role: string, active: boolean): Promise<void> {
    await supabase.from('admin_users').update({ name, email, password, role, active }).eq('id', id);
  }

  async deleteAdminUser(id: string): Promise<void> {
    await supabase.from('admin_users').delete().eq('id', id);
  }

  async validateCredentials(email: string, password: string): Promise<{ id: string; name: string; email: string; role: string } | null> {
    const { data } = await supabase
      .from('admin_users')
      .select('id, name, email, role')
      .eq('email', email)
      .eq('password', password)
      .eq('active', true)
      .maybeSingle();
    return data ?? null;
  }

  // ── Knowledge entries ───────────────────────────────────────────────────────

  async listKnowledge(onlyActive = false): Promise<KnowledgeEntry[]> {
    let q = supabase.from('knowledge_entries').select('*').order('category').order('sort_order').order('created_at');
    if (onlyActive) q = q.eq('active', true);
    const { data } = await q;
    return (data ?? []) as KnowledgeEntry[];
  }

  async getKnowledge(id: string): Promise<KnowledgeEntry | null> {
    const { data } = await supabase.from('knowledge_entries').select('*').eq('id', id).maybeSingle();
    return data ?? null;
  }

  async createKnowledge(category: string, title: string, content: string): Promise<void> {
    const id = `kb-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    await supabase.from('knowledge_entries').insert({ id, category: category.trim(), title: title.trim(), content: content.trim() });
  }

  async updateKnowledge(id: string, category: string, title: string, content: string, active: boolean): Promise<void> {
    await supabase.from('knowledge_entries').update({
      category: category.trim(), title: title.trim(), content: content.trim(),
      active, updated_at: new Date().toISOString(),
    }).eq('id', id);
  }

  async toggleKnowledge(id: string, active: boolean): Promise<void> {
    await supabase.from('knowledge_entries').update({ active, updated_at: new Date().toISOString() }).eq('id', id);
  }

  async deleteKnowledge(id: string): Promise<void> {
    await supabase.from('knowledge_entries').delete().eq('id', id);
  }

  async buildKnowledgeContext(): Promise<string> {
    const entries = await this.listKnowledge(true);
    if (entries.length === 0) return '';
    const grouped = entries.reduce<Record<string, KnowledgeEntry[]>>((acc, e) => {
      if (!acc[e.category]) acc[e.category] = [];
      acc[e.category].push(e);
      return acc;
    }, {});
    const lines: string[] = [];
    for (const [cat, items] of Object.entries(grouped)) {
      lines.push(`[${cat.toUpperCase()}]`);
      for (const item of items) lines.push(`• ${item.title}: ${item.content}`);
      lines.push('');
    }
    return lines.join('\n').trim();
  }

  buildCopilotoContext(): Promise<string> {
    return this.buildKnowledgeContext();
  }

  // ── Copiloto Persona ────────────────────────────────────────────────────────

  async getPersona(userId: string): Promise<CopiloPersona> {
    const { data } = await supabase.from('copiloto_persona').select('*').eq('user_id', userId).maybeSingle();
    return data ?? { user_id: userId, display_name: 'Copiloto', style: 'empatico', tone: 'informal', updated_at: '' };
  }

  async savePersona(userId: string, displayName: string, style: string, tone: string): Promise<void> {
    await supabase.from('copiloto_persona').upsert({
      user_id: userId,
      display_name: displayName.trim(),
      style: style.trim(),
      tone: tone.trim(),
      updated_at: new Date().toISOString(),
    });
  }
}

export const configRepository = new ConfigRepository();
