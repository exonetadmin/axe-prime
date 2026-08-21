// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  consumeGlobal: vi.fn(),
  consumeIdentity: vi.fn(),
  validateCredentials: vi.fn(),
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));
vi.mock('next/navigation', () => ({ redirect: vi.fn() }));
vi.mock('next/headers', () => ({ headers: async () => new Headers() }));
vi.mock('@/src/server/security/request', () => ({
  getSessionContextFromHeaders: () => ({ ipAddress: null, userAgentHash: null }),
}));
vi.mock('@/src/features/admin/admin.repository', () => ({ adminRepository: {} }));
vi.mock('@/src/features/admin/admin.auth', () => ({
  clearAdminLoginRateLimit: vi.fn(),
  consumeAdminLoginGlobalRateLimit: mocks.consumeGlobal,
  consumeAdminLoginRateLimit: mocks.consumeIdentity,
  createAdminSession: vi.fn(),
  destroyAdminSession: vi.fn(),
  requireAdmin: vi.fn(),
  validateAdminCredentials: mocks.validateCredentials,
}));

import { adminLoginAction } from '../app/admin/actions';

describe('adminLoginAction input limits', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.consumeGlobal.mockResolvedValue(true);
    mocks.consumeIdentity.mockResolvedValue(true);
  });

  it.each([
    ['oversized e-mail', `${'a'.repeat(310)}@example.com`, 'valid password phrase'],
    ['oversized password', 'admin@example.com', '🔐'.repeat(129)],
  ])('rejects %s before rate limiting or password hashing', async (_label, email, password) => {
    const form = new FormData();
    form.set('email', email);
    form.set('password', password);

    await expect(adminLoginAction(form)).resolves.toEqual({
      error: 'E-mail ou senha inválidos.',
    });
    expect(mocks.consumeGlobal).not.toHaveBeenCalled();
    expect(mocks.consumeIdentity).not.toHaveBeenCalled();
    expect(mocks.validateCredentials).not.toHaveBeenCalled();
  });
});
