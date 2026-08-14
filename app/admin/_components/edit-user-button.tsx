'use client';

import { useState } from 'react';
import { Pencil } from 'lucide-react';
import { AdminEditUserModal, type PlanDefaults } from './admin-edit-user-modal';

type User = {
  id: string;
  name: string;
  plan_interest: string | null;
  cashback_pct: number | null;
  adhesion_value_cents: number | null;
  plan_monthly_cents: number | null;
  is_active: boolean | null;
  career: string | null;
  adhesion_paid: boolean | null;
  monthly_status: 'paid' | 'overdue' | null;
};

export function EditUserButton({
  user,
  planDefaults = {},
}: {
  user: User;
  planDefaults?: PlanDefaults;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="adm-btn-icon"
        title={`Editar ${user.name}`}
        onClick={() => setOpen(true)}
        aria-label={`Editar ${user.name}`}
      >
        <Pencil size={13} strokeWidth={1.8} />
      </button>

      {open && (
        <AdminEditUserModal
          user={user}
          onClose={() => setOpen(false)}
          planDefaults={planDefaults}
        />
      )}
    </>
  );
}
