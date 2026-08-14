'use client';

import { useState } from 'react';
import { UserPlus } from 'lucide-react';
import { AdminCreateUserModal } from './admin-create-user-modal';

export function CreateUserButton() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className="adm-btn adm-btn--accent"
        onClick={() => setOpen(true)}
      >
        <UserPlus size={15} />
        Novo Usuário
      </button>
      {open && <AdminCreateUserModal onClose={() => setOpen(false)} />}
    </>
  );
}
