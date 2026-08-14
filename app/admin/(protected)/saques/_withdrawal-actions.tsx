'use client';

import { useTransition } from 'react';
import { approveWithdrawalAction, rejectWithdrawalAction } from '@/app/admin/actions';

export default function WithdrawalActions({ id }: { id: string }) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="adm-action-row">
      <button
        disabled={isPending}
        className="adm-btn adm-btn--success adm-btn--sm"
        onClick={() => startTransition(() => approveWithdrawalAction(id))}
      >
        Aprovar
      </button>
      <button
        disabled={isPending}
        className="adm-btn adm-btn--danger adm-btn--sm"
        onClick={() => startTransition(() => rejectWithdrawalAction(id))}
      >
        Rejeitar
      </button>
    </div>
  );
}
