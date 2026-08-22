// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  markCashbackMonthPaid: vi.fn(),
  requireAdmin: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock('@/src/features/admin/admin.repository', () => ({
  adminRepository: {
    markCashbackMonthPaid: mocks.markCashbackMonthPaid,
  },
}));
vi.mock('@/src/features/admin/admin.auth', () => ({ requireAdmin: mocks.requireAdmin }));
vi.mock('@/src/features/auth/repositories/user.repository', () => ({ userRepository: {} }));
vi.mock('@/src/server/security/password', () => ({ hashPassword: vi.fn() }));

import { markCashbackMonthAction } from '@/app/admin/admin.actions';

describe('admin cashback action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAdmin.mockResolvedValue({
      id: 'admin-1',
      email: 'admin@example.test',
      role: 'master',
    });
    mocks.markCashbackMonthPaid.mockResolvedValue(undefined);
  });

  it('derives the amount on the server instead of accepting a client amount', async () => {
    const form = new FormData();
    form.set('userId', 'user-1');
    form.set('monthNumber', '3');
    form.set('amountCents', '999999999');

    const result = await markCashbackMonthAction(null, form);

    expect(result.ok).toBe(true);
    expect(mocks.markCashbackMonthPaid).toHaveBeenCalledWith(
      'user-1',
      3,
      'admin@example.test',
      'admin-1'
    );
  });

  it('rejects partially numeric month values', async () => {
    const form = new FormData();
    form.set('userId', 'user-1');
    form.set('monthNumber', '3anything');

    const result = await markCashbackMonthAction(null, form);

    expect(result.ok).toBe(false);
    expect(mocks.markCashbackMonthPaid).not.toHaveBeenCalled();
  });
});
