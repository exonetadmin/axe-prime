'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';

export default function LogoutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleLogout = async () => {
    setPending(true);

    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
      });

      startTransition(() => {
        router.push('/');
        router.refresh();
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <button type="button" className="secondary-button" onClick={handleLogout} disabled={pending}>
      {pending ? 'Encerrando...' : 'Sair'}
    </button>
  );
}
