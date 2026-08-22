// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  appendAudit: vi.fn(),
  clientQuery: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/src/server/db/postgres', () => ({
  postgresIntegerToSafeNumber: (value: string | number | null | undefined) => Number(value ?? 0),
  query: vi.fn(),
  queryOne: vi.fn(),
  withTransaction: async <T>(operation: (client: { query: typeof mocks.clientQuery }) => Promise<T>) =>
    operation({ query: mocks.clientQuery }),
}));
vi.mock('@/src/server/security/audit-log', () => ({
  appendSecurityAuditEvent: mocks.appendAudit,
}));

import { WalletRepository, WalletRuleError } from '../wallet.repository';

const HASH = 'a'.repeat(64);
const FINGERPRINT = 'b'.repeat(64);

describe('WalletRepository idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the original result without checking balance or inserting on replay', async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ cpf: '52998224725' }] })
      .mockResolvedValueOnce({
        rows: [{ amount_cents: 10_000, request_fingerprint: FINGERPRINT }],
      });

    const result = await new WalletRepository().createWithdrawal(
      'user-1',
      10_000,
      HASH,
      FINGERPRINT
    );

    expect(result).toEqual({ netCents: 9_400, replayed: true });
    expect(mocks.clientQuery).toHaveBeenCalledTimes(2);
    expect(mocks.appendAudit).not.toHaveBeenCalled();
  });

  it('rejects reuse of one key with a different financial payload', async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ cpf: '52998224725' }] })
      .mockResolvedValueOnce({
        rows: [{ amount_cents: 20_000, request_fingerprint: 'c'.repeat(64) }],
      });

    await expect(
      new WalletRepository().createWithdrawal('user-1', 10_000, HASH, FINGERPRINT)
    ).rejects.toMatchObject({ code: 'IDEMPOTENCY_CONFLICT' } satisfies Partial<WalletRuleError>);
  });

  it('inserts and audits a new withdrawal in the same transaction', async () => {
    mocks.clientQuery
      .mockResolvedValueOnce({ rows: [{ cpf: '52998224725' }] })
      .mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ available_cents: '50000' }] })
      .mockResolvedValueOnce({ rows: [{ id: 'withdrawal-1' }] });

    const result = await new WalletRepository().createWithdrawal(
      'user-1',
      10_000,
      HASH,
      FINGERPRINT
    );

    expect(result).toEqual({ netCents: 9_400, replayed: false });
    expect(mocks.appendAudit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        action: 'withdrawal_requested',
        actorId: 'user-1',
        subjectId: 'withdrawal-1',
      })
    );
  });
});
