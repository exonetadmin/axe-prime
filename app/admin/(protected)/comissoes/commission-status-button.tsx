'use client';

import { useActionState } from 'react';
import {
  markCommissionPaidAction,
  markCommissionAvailableAction,
} from '@/app/admin/admin.actions';

export default function CommissionStatusButton({
  commissionId,
  currentStatus,
}: {
  commissionId: string;
  currentStatus: string;
}) {
  const isAvailable = currentStatus === 'available';
  const action = isAvailable ? markCommissionPaidAction : markCommissionAvailableAction;
  const label = isAvailable ? 'Pagar' : 'Reverter';
  const color = isAvailable ? 'var(--success)' : 'var(--text-soft)';

  const [state, formAction, pending] = useActionState(action, null);

  if (currentStatus === 'withdrawn') {
    return (
      <span style={{ color: 'var(--text-soft)', fontSize: '0.7rem' }}>
        Sacado
      </span>
    );
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="commissionId" value={commissionId} />
      <button
        type="submit"
        disabled={pending}
        className="adm-btn-mini"
        style={{
          color,
          borderColor: `${color}40`,
          opacity: pending ? 0.5 : 1,
          cursor: pending ? 'wait' : 'pointer',
        }}
        title={state?.message ?? ''}
      >
        {pending ? '...' : label}
      </button>
    </form>
  );
}
