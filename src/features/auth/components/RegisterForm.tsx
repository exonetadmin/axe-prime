'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface RegisterFormProps {
  onSuccess?: () => void;
  redirectTo?: string;
  defaultPlan?: 'start' | 'prime' | 'elite';
}

export default function RegisterForm({
  onSuccess,
  redirectTo = '/portal',
  defaultPlan = 'prime',
}: RegisterFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    planInterest: defaultPlan,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        setError(data?.error ?? 'Não foi possível concluir o cadastro.');
        return;
      }

      onSuccess?.();
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError('Erro de conexão. Tente novamente.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-slate-300">
          Nome completo
        </label>
        <input
          id="name"
          type="text"
          value={formData.name}
          onChange={(e) => handleChange('name', e.target.value)}
          placeholder="Seu nome"
          required
          minLength={2}
          className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-300">
          E-mail
        </label>
        <input
          id="email"
          type="email"
          value={formData.email}
          onChange={(e) => handleChange('email', e.target.value)}
          placeholder="voce@axeprime.com.br"
          required
          className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
      </div>

      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-300">
          Senha
        </label>
        <input
          id="password"
          type="password"
          value={formData.password}
          onChange={(e) => handleChange('password', e.target.value)}
          placeholder="Crie uma senha segura"
          required
          minLength={8}
          className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white placeholder-slate-500 focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        />
        <p className="mt-1 text-xs text-slate-500">
          Mínimo 8 caracteres, com letra maiúscula, minúscula e número
        </p>
      </div>

      <div>
        <label htmlFor="planInterest" className="block text-sm font-medium text-slate-300">
          Interesse inicial
        </label>
        <select
          id="planInterest"
          value={formData.planInterest}
          onChange={(e) => handleChange('planInterest', e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-white focus:border-green-500 focus:outline-none focus:ring-1 focus:ring-green-500"
        >
          <option value="start">Start (R$ 100.000)</option>
          <option value="prime">Prime (R$ 200.000)</option>
          <option value="elite">Carreira de Elite</option>
        </select>
      </div>

      {error && (
        <div className="rounded-md bg-red-900/50 px-3 py-2 text-sm text-red-200">
          {error}
        </div>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="w-full rounded-md bg-green-600 px-4 py-2 font-medium text-white hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:ring-offset-slate-900 disabled:opacity-50"
      >
        {isLoading ? 'Criando acesso...' : 'Criar conta'}
      </button>
    </form>
  );
}
