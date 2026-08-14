'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

interface LogoutButtonProps {
  className?: string;
  variant?: 'primary' | 'secondary' | 'ghost';
}

export default function LogoutButton({
  className = '',
  variant = 'secondary',
}: LogoutButtonProps) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);

    try {
      const response = await fetch('/api/auth/logout', {
        method: 'POST',
      });

      if (response.ok) {
        router.push('/');
        router.refresh();
      }
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const variantStyles = {
    primary: 'bg-green-600 text-white hover:bg-green-700',
    secondary: 'border border-green-600 text-green-500 hover:bg-green-600/10',
    ghost: 'text-slate-400 hover:text-white',
  };

  return (
    <button
      onClick={handleLogout}
      disabled={isLoading}
      className={`
        inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium
        transition-colors focus:outline-none focus:ring-2 focus:ring-green-500
        focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50
        ${variantStyles[variant]}
        ${className}
      `}
    >
      <LogOut size={16} />
      {isLoading ? 'Saindo...' : 'Sair'}
    </button>
  );
}
