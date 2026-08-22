// @vitest-environment node

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/src/server/security/password', () => ({
  hashPassword: vi.fn(async () => 'scrypt$mock'),
  verifyPassword: vi.fn(async () => true),
  passwordNeedsRehash: vi.fn(() => false),
}));

import { AuthService } from '../services/auth.service';
import {
  EmailExistsError,
  InvalidCredentialsError,
  InvalidReferralCodeError,
  InvalidTokenError,
  PasswordResetUnavailableError,
  RefreshTokenReplayError,
  ValidationError,
} from '../auth.contract';
import type { UserRecord, UserRepository } from '../repositories/user.repository';
import type { SessionRepository } from '../repositories/session.repository';
import type { PasswordResetDelivery } from '../services/password-reset-delivery';
import { passwordNeedsRehash, verifyPassword } from '@/src/server/security/password';

process.env.JWT_ACCESS_SECRET = Buffer.alloc(32, 7).toString('base64');
process.env.AUTH_TOKEN_PEPPER = Buffer.alloc(32, 9).toString('base64');

function makeUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password_hash: '$2a$12$legacy',
    phone: '(11) 99999-9999',
    plan_interest: 'prime',
    sponsor_id: 'sponsor-1',
    referral_code: 'AP-ABCDEFGH',
    avatar_url: null,
    cpf: null,
    adhesion_at: null,
    plan_monthly_cents: null,
    adhesion_value_cents: null,
    kyc_submitted: false,
    is_active: true,
    token_version: 2,
    password_changed_at: null,
    last_login_at: null,
    created_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

function domainUser(record: UserRecord) {
  return {
    id: record.id,
    name: record.name,
    email: record.email,
    phone: record.phone,
    planInterest: record.plan_interest as 'start' | 'prime' | 'elite' | null,
    sponsorId: record.sponsor_id,
    referralCode: record.referral_code ?? '',
    createdAt: record.created_at,
    avatarUrl: record.avatar_url,
    cpf: record.cpf,
    adhesionValueCents: record.adhesion_value_cents,
  };
}

describe('AuthService', () => {
  const record = makeUserRecord();
  const userRepo = {
    findByEmail: vi.fn(),
    findById: vi.fn(),
    create: vi.fn(),
    findByReferralCode: vi.fn(),
    updatePasswordHash: vi.fn(),
    markLogin: vi.fn(),
    updateReferralCode: vi.fn(),
  };
  const sessionRepo = {
    createUserSession: vi.fn(),
    validateAccessSession: vi.fn(),
    validateRefreshSession: vi.fn(),
    rotateRefreshToken: vi.fn(),
    findRefreshSessionId: vi.fn(),
    revokeSession: vi.fn(),
    revokeByRefreshToken: vi.fn(),
    createPasswordResetToken: vi.fn(),
    invalidatePasswordResetToken: vi.fn(),
    consumePasswordResetToken: vi.fn(),
  };
  const resetDelivery = {
    isConfigured: vi.fn(),
    deliver: vi.fn(),
  };
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(verifyPassword).mockResolvedValue(true);
    vi.mocked(passwordNeedsRehash).mockReturnValue(false);
    userRepo.findByEmail.mockResolvedValue(record);
    userRepo.findById.mockResolvedValue(record);
    userRepo.findByReferralCode.mockImplementation(async (code: string) =>
      code === 'AP-SPONSOR1'
        ? makeUserRecord({
            id: 'sponsor-1',
            email: 'sponsor@example.com',
            referral_code: 'AP-SPONSOR1',
          })
        : null
    );
    userRepo.create.mockResolvedValue(domainUser(record));
    userRepo.updatePasswordHash.mockResolvedValue(true);
    userRepo.markLogin.mockResolvedValue(undefined);
    sessionRepo.createUserSession.mockResolvedValue({
      sessionId: '11111111-1111-4111-8111-111111111111',
      refreshToken: 'refresh-secret',
      refreshTokenExpiresAt: new Date('2026-02-01T00:00:00.000Z'),
      userId: record.id,
      tokenVersion: record.token_version,
    });
    sessionRepo.validateAccessSession.mockResolvedValue(true);
    sessionRepo.findRefreshSessionId.mockResolvedValue('11111111-1111-4111-8111-111111111111');
    sessionRepo.createPasswordResetToken.mockResolvedValue('r'.repeat(64));
    sessionRepo.consumePasswordResetToken.mockResolvedValue(record.id);
    resetDelivery.isConfigured.mockReturnValue(true);
    resetDelivery.deliver.mockResolvedValue(undefined);
    service = new AuthService(
      userRepo as unknown as UserRepository,
      sessionRepo as unknown as SessionRepository,
      resetDelivery as unknown as PasswordResetDelivery
    );
  });

  it('issues a short access token and an opaque refresh token on login', async () => {
    const result = await service.login({
      email: ' TEST@EXAMPLE.COM ',
      password: 'Abcdef1!',
    });

    expect(result.user.email).toBe('test@example.com');
    expect(result.accessToken.split('.')).toHaveLength(3);
    expect(result.refreshToken).toBe('refresh-secret');
    expect(userRepo.findByEmail).toHaveBeenCalledWith('test@example.com');
  });

  it('rejects a wrong password with a generic credentials error', async () => {
    vi.mocked(verifyPassword).mockResolvedValue(false);
    await expect(
      service.login({ email: 'test@example.com', password: 'wrong password' })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('does not restore a legacy password when a reset wins the rehash race', async () => {
    vi.mocked(passwordNeedsRehash).mockReturnValue(true);
    userRepo.updatePasswordHash.mockResolvedValue(false);
    userRepo.findById.mockResolvedValue(
      makeUserRecord({
        password_hash: 'scrypt$131072$8$1$new-salt$new-password-hash',
        token_version: record.token_version + 1,
      })
    );

    await expect(
      service.login({
        email: record.email,
        password: 'the previously valid legacy password',
      })
    ).rejects.toThrow(InvalidCredentialsError);
    expect(sessionRepo.createUserSession).not.toHaveBeenCalled();
  });

  it('rejects a missing user without revealing whether the email exists', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    await expect(
      service.login({ email: 'missing@example.com', password: 'some password' })
    ).rejects.toThrow(InvalidCredentialsError);
  });

  it('requires all login fields', async () => {
    await expect(service.login({ email: '', password: 'password' })).rejects.toThrow(
      ValidationError
    );
  });

  it('registers only with a valid sponsor and a long password', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.findByReferralCode.mockImplementation(async (code: string) => {
      if (code === 'AP-SPONSOR1') {
        return makeUserRecord({ id: 'sponsor-1', referral_code: code });
      }
      return null;
    });
    userRepo.create.mockImplementation(async data => ({
      ...domainUser(record),
      id: data.id,
      email: data.email,
      referralCode: data.referralCode,
    }));
    userRepo.findById.mockImplementation(async (id: string) =>
      makeUserRecord({ id, email: 'new@example.com' })
    );

    const result = await service.register({
      name: 'New User',
      email: 'NEW@example.com',
      password: 'Abc123!x',
      phone: '(11) 99999-9999',
      planInterest: null,
      referralCode: 'AP-SPONSOR1',
    });

    expect(result.user.email).toBe('new@example.com');
    expect(userRepo.create).toHaveBeenCalledTimes(1);
  });

  it('rejects an invalid sponsor', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    userRepo.findByReferralCode.mockResolvedValue(null);
    await expect(
      service.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'Abc123!x',
        phone: '(11) 99999-9999',
        referralCode: 'AP-ZZZZZZZZ',
      })
    ).rejects.toThrow(InvalidReferralCodeError);
  });

  it('rejects duplicate email', async () => {
    await expect(
      service.register({
        name: 'New User',
        email: 'test@example.com',
        password: 'Abc123!x',
        phone: '(11) 99999-9999',
        referralCode: 'AP-SPONSOR1',
      })
    ).rejects.toThrow(EmailExistsError);
  });

  it('rejects new passwords shorter than 8 characters', async () => {
    userRepo.findByEmail.mockResolvedValue(null);
    await expect(
      service.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'A1!x',
        phone: '(11) 99999-9999',
        referralCode: 'AP-SPONSOR1',
      })
    ).rejects.toThrow(ValidationError);
  });

  it('rotates refresh tokens and preserves the database session id', async () => {
    sessionRepo.rotateRefreshToken.mockResolvedValue({
      status: 'ok',
      credentials: {
        sessionId: '11111111-1111-4111-8111-111111111111',
        refreshToken: 'next-refresh-secret',
        refreshTokenExpiresAt: new Date('2026-02-01T00:00:00.000Z'),
        userId: record.id,
        tokenVersion: record.token_version,
      },
    });

    const result = await service.refresh('current-refresh-secret');
    expect(result.refreshToken).toBe('next-refresh-secret');
    expect(result.sessionId).toBe('11111111-1111-4111-8111-111111111111');
  });

  it('revokes a rotated session when access-token signing fails', async () => {
    sessionRepo.rotateRefreshToken.mockResolvedValue({
      status: 'ok',
      credentials: {
        sessionId: '11111111-1111-4111-8111-111111111111',
        refreshToken: 'next-refresh-secret',
        refreshTokenExpiresAt: new Date('2026-02-01T00:00:00.000Z'),
        userId: record.id,
        tokenVersion: record.token_version,
      },
    });
    const signingSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = Buffer.from('too-short').toString('base64');
    try {
      await expect(service.refresh('current-refresh-secret')).rejects.toThrow('JWT_ACCESS_SECRET');
    } finally {
      process.env.JWT_ACCESS_SECRET = signingSecret;
    }
    expect(sessionRepo.revokeSession).toHaveBeenCalledWith(
      '11111111-1111-4111-8111-111111111111',
      'token_issuance_failed'
    );
  });

  it('revokes the logical session when refresh replay is detected', async () => {
    sessionRepo.rotateRefreshToken.mockResolvedValue({ status: 'replayed' });
    await expect(service.refresh('replayed')).rejects.toThrow(RefreshTokenReplayError);
  });

  it('resolves a stable session subject for refresh rate limiting', async () => {
    await expect(service.getRefreshRateLimitSubject('rotating-secret')).resolves.toBe(
      '11111111-1111-4111-8111-111111111111'
    );
    expect(sessionRepo.findRefreshSessionId).toHaveBeenCalledWith('rotating-secret');
  });

  it('validates both JWT and revocable sid for backend requests', async () => {
    const login = await service.login({
      email: 'test@example.com',
      password: 'Abcdef1!',
    });
    const request = new Request('https://axe.example/api/private', {
      headers: { Authorization: `Bearer ${login.accessToken}` },
    });
    const user = await service.authenticateRequest(request);
    expect(user?.id).toBe(record.id);
    expect(sessionRepo.validateAccessSession).toHaveBeenCalledWith(
      login.sessionId,
      record.id,
      record.token_version
    );
  });

  it('requires the e-mail and confirmation code to reset the password', async () => {
    sessionRepo.consumePasswordResetToken.mockResolvedValue(record.id);
    await expect(
      service.resetPassword(
        'r'.repeat(64),
        record.email,
        '123456',
        'Abc123!x'
      )
    ).resolves.toBeUndefined();

    sessionRepo.consumePasswordResetToken.mockResolvedValue(null);
    await expect(
      service.resetPassword(
        'r'.repeat(64),
        record.email,
        '123456',
        'Abc123!x'
      )
    ).rejects.toThrow(InvalidTokenError);
  });

  it('returns unavailable before account lookup when reset delivery is not configured', async () => {
    resetDelivery.isConfigured.mockReturnValue(false);
    await expect(service.requestPasswordReset('test@example.com')).rejects.toThrow(
      PasswordResetUnavailableError
    );
    expect(userRepo.findByEmail).not.toHaveBeenCalled();
  });

  it('delivers a reset token only through the server-side adapter', async () => {
    await service.requestPasswordReset('test@example.com');
    expect(resetDelivery.deliver).toHaveBeenCalledWith({
      email: record.email,
      name: record.name,
      resetToken: 'r'.repeat(64),
      emailConfirmationCode: expect.stringMatching(/^\d{6}$/),
    });
  });

  it('invalidates a reset token when delivery fails', async () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    resetDelivery.deliver.mockRejectedValue(new Error('provider unavailable'));
    await expect(service.requestPasswordReset('test@example.com')).resolves.toBeUndefined();
    expect(sessionRepo.invalidatePasswordResetToken).toHaveBeenCalledWith('r'.repeat(64));
    consoleError.mockRestore();
  });
});
