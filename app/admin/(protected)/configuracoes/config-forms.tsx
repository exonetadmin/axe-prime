'use client';

import { useTransition, useState, type FormEvent } from 'react';
import type {
  updatePlanAction,
  updateCommissionConfigAction,
  updateCashbackConfigAction,
  addAdminUserAction,
  updateAdminUserAction,
  deleteAdminUserAction,
} from '@/app/admin/actions';
import type {
  PlanRow,
  AdminUserRow,
  CommissionConfig,
  CashbackConfig,
} from '@/src/features/admin/config.repository';

type ActionFn = (fd: FormData) => Promise<{ error?: string }>;

// ─── Reusable helpers ─────────────────────────────────────────────────────────

function Err({ msg }: { msg: string | undefined }) {
  if (!msg) return null;
  return (
    <p className="adm-cfg-error" role="alert">
      {msg}
    </p>
  );
}

function Ok({ done }: { done: boolean }) {
  if (!done) return null;
  return <p className="adm-cfg-ok">✓ Salvo com sucesso!</p>;
}

function useAction(action: ActionFn) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | undefined>();
  const [done, setDone] = useState(false);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(undefined);
    setDone(false);
    const fd = new FormData(e.currentTarget);
    start(async () => {
      const res = await action(fd);
      if (res.error) setError(res.error);
      else setDone(true);
    });
  }

  return { pending, error, done, submit };
}

// ─── Plan edit row ─────────────────────────────────────────────────────────────

export function PlanEditRow({ plan, action }: { plan: PlanRow; action: typeof updatePlanAction }) {
  const [open, setOpen] = useState(false);
  const { pending, error, done, submit } = useAction(action);

  return (
    <tr>
      <td>
        <span className={`adm-badge adm-badge--${plan.id}`}>{plan.name}</span>
      </td>
      <td className="adm-table-value">
        R$ {(plan.monthly_cents / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
      </td>
      <td>
        <button
          type="button"
          className="adm-btn adm-btn--ghost adm-btn--sm"
          onClick={() => setOpen(!open)}
        >
          {open ? 'Cancelar' : 'Editar'}
        </button>
      </td>
      {open && (
        <td colSpan={3} style={{ padding: '0.75rem 1rem', background: 'rgba(255,255,255,0.02)' }}>
          <form onSubmit={submit} className="adm-cfg-inline-form">
            <input type="hidden" name="id" value={plan.id} />
            <input
              className="adm-input adm-cfg-input-md"
              name="name"
              defaultValue={plan.name}
              placeholder="Nome do plano"
              required
            />
            <input
              className="adm-input adm-cfg-input-md"
              name="monthly_brl"
              type="number"
              step="0.01"
              min="1"
              defaultValue={(plan.monthly_cents / 100).toFixed(2)}
              placeholder="Mensalidade R$"
              required
            />
            <button
              className="adm-btn adm-btn--primary adm-btn--sm"
              type="submit"
              disabled={pending}
            >
              {pending ? 'Salvando…' : 'Salvar'}
            </button>
          </form>
          <Err msg={error} />
          <Ok done={done} />
        </td>
      )}
    </tr>
  );
}

// ─── Commission config form ───────────────────────────────────────────────────

export function CommissionConfigForm({
  cfg,
  action,
}: {
  cfg: CommissionConfig;
  action: typeof updateCommissionConfigAction;
}) {
  const { pending, error, done, submit } = useAction(action);
  return (
    <form onSubmit={submit}>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Tipo</th>
            <th>Percentual (%)</th>
          </tr>
        </thead>
        <tbody>
          {(
            [
              { label: 'Direto (N1)', key: 'direct_pct', val: cfg.direct_pct },
              { label: 'Rede N2', key: 'level1_pct', val: cfg.level1_pct },
              { label: 'Rede N3', key: 'level2_pct', val: cfg.level2_pct },
              { label: 'Rede N4', key: 'level3_pct', val: cfg.level3_pct },
              { label: 'Rede N5', key: 'level4_pct', val: cfg.level4_pct },
            ] as const
          ).map(row => (
            <tr key={row.key}>
              <td className="adm-table-muted">{row.label}</td>
              <td>
                <input
                  className="adm-input adm-cfg-input-sm"
                  name={row.key}
                  type="number"
                  step="0.1"
                  min="0"
                  max="100"
                  defaultValue={row.val}
                  required
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="adm-cfg-form-footer">
        <button className="adm-btn adm-btn--primary adm-btn--sm" type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar comissões'}
        </button>
        <Err msg={error} />
        <Ok done={done} />
      </div>
    </form>
  );
}

// ─── Cashback config form ────────────────────────────────────────────────────

export function CashbackConfigForm({
  cfg,
  action,
}: {
  cfg: CashbackConfig;
  action: typeof updateCashbackConfigAction;
}) {
  const { pending, error, done, submit } = useAction(action);
  return (
    <form onSubmit={submit}>
      <table className="adm-table">
        <thead>
          <tr>
            <th>Parâmetro</th>
            <th>Valor</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="adm-table-muted">Cashback padrão (%)</td>
            <td>
              <input
                className="adm-input adm-cfg-input-sm"
                name="standard_pct"
                type="number"
                step="1"
                min="0"
                max="100"
                defaultValue={cfg.standard_pct}
                required
              />
            </td>
          </tr>
          <tr>
            <td className="adm-table-muted">Cashback premium (%)</td>
            <td>
              <input
                className="adm-input adm-cfg-input-sm"
                name="premium_pct"
                type="number"
                step="1"
                min="0"
                max="100"
                defaultValue={cfg.premium_pct}
                required
              />
            </td>
          </tr>
          <tr>
            <td className="adm-table-muted">Limite premium (R$)</td>
            <td>
              <input
                className="adm-input adm-cfg-input-md"
                name="premium_threshold_brl"
                type="number"
                step="0.01"
                min="0"
                defaultValue={(cfg.premium_threshold_cents / 100).toFixed(2)}
                required
              />
            </td>
          </tr>
          <tr>
            <td className="adm-table-muted">Duração (meses)</td>
            <td>
              <input
                className="adm-input adm-cfg-input-sm"
                name="duration_months"
                type="number"
                step="1"
                min="1"
                max="12"
                defaultValue={cfg.duration_months}
                required
              />
            </td>
          </tr>
          <tr>
            <td className="adm-table-muted">Crédito (dia do mês)</td>
            <td>
              <input
                className="adm-input adm-cfg-input-sm"
                name="credit_day"
                type="number"
                step="1"
                min="1"
                max="31"
                defaultValue={cfg.credit_day}
                required
              />
            </td>
          </tr>
        </tbody>
      </table>
      <div className="adm-cfg-form-footer">
        <button className="adm-btn adm-btn--primary adm-btn--sm" type="submit" disabled={pending}>
          {pending ? 'Salvando…' : 'Salvar cashback'}
        </button>
        <Err msg={error} />
        <Ok done={done} />
      </div>
    </form>
  );
}

// ─── Admin users table ────────────────────────────────────────────────────────

const ROLES = ['master', 'financeiro', 'suporte'];

export function AdminUsersPanel({
  users,
  currentId,
  addAction,
  updateAction,
  deleteAction,
}: {
  users: AdminUserRow[];
  currentId: string;
  addAction: typeof addAdminUserAction;
  updateAction: typeof updateAdminUserAction;
  deleteAction: typeof deleteAdminUserAction;
}) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Existing users */}
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>E-mail</th>
              <th>Cargo</th>
              <th>Status</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {users.map(u => (
              <AdminUserRow
                key={u.id}
                user={u}
                isSelf={u.id === currentId}
                updateAction={updateAction}
                deleteAction={deleteAction}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Add new admin */}
      <AddAdminForm action={addAction} />
    </div>
  );
}

function AdminUserRow({
  user,
  isSelf,
  updateAction,
  deleteAction,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  updateAction: typeof updateAdminUserAction;
  deleteAction: typeof deleteAdminUserAction;
}) {
  const [open, setOpen] = useState(false);
  const { pending, error, done, submit } = useAction(updateAction);
  const [delPending, startDel] = useTransition();
  const [delError, setDelError] = useState<string | undefined>();

  function onDelete() {
    if (!confirm(`Remover administrador "${user.name}"?`)) return;
    startDel(async () => {
      const r = await deleteAction(user.id);
      if (r.error) setDelError(r.error);
    });
  }

  return (
    <>
      <tr>
        <td className="adm-table-name">{user.name}</td>
        <td className="adm-table-muted">{user.email}</td>
        <td>
          <span
            className={`adm-badge adm-badge--${user.role === 'master' ? 'elite' : user.role === 'financeiro' ? 'prime' : 'start'}`}
          >
            {user.role}
          </span>
        </td>
        <td>
          <span className={`adm-badge adm-badge--${user.active ? 'success' : 'danger'}`}>
            {user.active ? 'ativo' : 'inativo'}
          </span>
        </td>
        <td>
          <div className="adm-action-row">
            <button
              className="adm-btn adm-btn--ghost adm-btn--sm"
              type="button"
              onClick={() => setOpen(!open)}
            >
              {open ? 'Cancelar' : 'Editar'}
            </button>
            {!isSelf && (
              <button
                className="adm-btn adm-btn--danger adm-btn--sm"
                type="button"
                onClick={onDelete}
                disabled={delPending}
              >
                {delPending ? '…' : 'Remover'}
              </button>
            )}
          </div>
          {delError && <p className="adm-cfg-error">{delError}</p>}
        </td>
      </tr>
      {open && (
        <tr>
          <td colSpan={5} style={{ background: 'rgba(255,255,255,0.02)', padding: '0.75rem 1rem' }}>
            <form onSubmit={submit} className="adm-cfg-inline-form" style={{ flexWrap: 'wrap' }}>
              <input type="hidden" name="id" value={user.id} />
              <input
                className="adm-input adm-cfg-input-md"
                name="name"
                defaultValue={user.name}
                placeholder="Nome"
                required
              />
              <input
                className="adm-input adm-cfg-input-md"
                name="email"
                type="email"
                defaultValue={user.email}
                placeholder="E-mail"
                required
              />
              <input
                className="adm-input adm-cfg-input-md"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={128}
                placeholder="Nova senha (opcional)"
              />
              <select className="adm-input adm-cfg-input-md" name="role" defaultValue={user.role}>
                {ROLES.map(r => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
              <select
                className="adm-input adm-cfg-input-sm"
                name="active"
                defaultValue={String(user.active)}
              >
                <option value="1">Ativo</option>
                <option value="0">Inativo</option>
              </select>
              <button
                className="adm-btn adm-btn--primary adm-btn--sm"
                type="submit"
                disabled={pending}
              >
                {pending ? '…' : 'Salvar'}
              </button>
            </form>
            <Err msg={error} />
            <Ok done={done} />
          </td>
        </tr>
      )}
    </>
  );
}

function AddAdminForm({ action }: { action: typeof addAdminUserAction }) {
  const { pending, error, done, submit } = useAction(action);
  return (
    <div className="adm-card">
      <h3 className="adm-card-title">Adicionar Administrador</h3>
      <form onSubmit={submit} className="adm-cfg-inline-form" style={{ flexWrap: 'wrap' }}>
        <input
          className="adm-input adm-cfg-input-md"
          name="name"
          placeholder="Nome completo"
          required
        />
        <input
          className="adm-input adm-cfg-input-md"
          name="email"
          type="email"
          placeholder="E-mail"
          required
        />
        <input
          className="adm-input adm-cfg-input-md"
          name="password"
          type="password"
          autoComplete="new-password"
          minLength={8}
          maxLength={128}
          placeholder="Senha inicial (8–128 caracteres)"
          required
        />
        <select className="adm-input adm-cfg-input-md" name="role">
          {ROLES.map(r => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
        <button className="adm-btn adm-btn--success adm-btn--sm" type="submit" disabled={pending}>
          {pending ? 'Adicionando…' : '+ Adicionar'}
        </button>
      </form>
      <Err msg={error} />
      <Ok done={done} />
    </div>
  );
}
