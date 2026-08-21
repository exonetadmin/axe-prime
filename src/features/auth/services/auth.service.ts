import '@/src/server/server-only';

import { randomBytes, randomUUID } from 'node:crypto';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import type {
  AuthContract,
  AuthResult,
  AuthSessionContext,
  LoginCredentials,
  RegisterData,
  User,
} from '../auth.contract';
import {
  AccountDisabledError,
  EmailExistsError,
  InvalidCredentialsError,
  InvalidReferralCodeError,
  InvalidTokenError,
  PasswordResetUnavailableError,
  RefreshTokenAlreadyRotatedError,
  RefreshTokenReplayError,
  ValidationError,
} from '../auth.contract';
import {
  mapUserRecordToDomain,
  userRepository,
  type UserRecord,
  type UserRepository,
} from '../repositories/user.repository';
import { sessionRepository, type SessionRepository } from '../repositories/session.repository';
import { passwordResetDelivery, type PasswordResetDelivery } from './password-reset-delivery';
import { hashPassword, passwordNeedsRehash, verifyPassword } from '@/src/server/security/password';
import {
  ACCESS_TOKEN_COOKIE,
  ACCESS_TOKEN_TTL_SECONDS,
  createCsrfToken,
  CSRF_TOKEN_COOKIE,
  readBearerToken,
  REFRESH_TOKEN_COOKIE,
  signAccessToken,
  verifyAccessToken,
} from '@/src/server/security/tokens';
import { readCookieToken } from '@/src/server/security/request';

const LEGACY_SESSION_COOKIE = 'axeprime_session';
const MIN_NEW_PASSWORD_LENGTH = 15;
const MAX_PASSWORD_LENGTH = 128;
const REFERRAL_CODE_PREFIX = 'AP-';
const REFERRAL_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_VALID = /^AP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

type PgError = Error & { code?: string; constraint?: string };

function isUniqueViolation(error: unknown): error is PgError {
  return error instanceof Error && (error as PgError).code === '23505';
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function normalizePassword(password: string): string {
  return password.normalize('NFC');
}

function validateNewPassword(password: string): string {
  const normalized = normalizePassword(password);
  const length = Array.from(normalized).length;
  if (length < MIN_NEW_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha deve ter pelo menos ${MIN_NEW_PASSWORD_LENGTH} caracteres.`);
  }
  if (length > MAX_PASSWORD_LENGTH) {
    throw new ValidationError(`A senha deve ter no máximo ${MAX_PASSWORD_LENGTH} caracteres.`);
  }
  return normalized;
}

function isAxePrimeReferralCode(code: string | null | undefined): boolean {
  return Boolean(code && REFERRAL_CODE_VALID.test(code.trim().toUpperCase()));
}

function publicUser(record: UserRecord): User {
  return mapUserRecordToDomain(record);
}

export class AuthService implements AuthContract {
  constructor(
    private readonly userRepo: UserRepository = userRepository,
    private readonly sessionRepo: SessionRepository = sessionRepository,
    private readonly resetDelivery: PasswordResetDelivery = passwordResetDelivery
  ) {}

  private async compensateFailedSession(sessionId: string): Promise<void> {
    try {
      await this.sessionRepo.revokeSession(sessionId, 'token_issuance_failed');
    } catch {
      console.error('[Auth] Failed to compensate an unusable session');
    }
  }

  private async generateReferralCode(): Promise<string> {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const bytes = randomBytes(8);
      let suffix = '';
      for (let index = 0; index < bytes.length; index += 1) {
        suffix += REFERRAL_CHARS[(bytes[index] ?? 0) % REFERRAL_CHARS.length];
      }
      const code = `${REFERRAL_CODE_PREFIX}${suffix}`;
      if (!(await this.userRepo.findByReferralCode(code))) return code;
    }
    throw new Error('Unable to allocate a unique referral code');
  }

  private async ensureReferralCode(record: UserRecord): Promise<UserRecord> {
    if (isAxePrimeReferralCode(record.referral_code)) {
      return { ...record, referral_code: record.referral_code?.toUpperCase() ?? null };
    }
    const referralCode = await this.generateReferralCode();
    const updated = await this.userRepo.updateReferralCode(record.id, referralCode);
    if (!updated) throw new Error('Failed to persist referral code');
    return { ...record, referral_code: referralCode };
  }

  private async issueSession(
    record: UserRecord,
    context: AuthSessionContext = {}
  ): Promise<AuthResult> {
    const credentials = await this.sessionRepo.createUserSession(
      record.id,
      record.token_version,
      context
    );
    let access: Awaited<ReturnType<typeof signAccessToken>>;
    try {
      access = await signAccessToken({
        subject: record.id,
        sessionId: credentials.sessionId,
        principalType: 'user',
        tokenVersion: record.token_version,
      });
    } catch (error) {
      await this.compensateFailedSession(credentials.sessionId);
      throw error;
    }
    return {
      user: publicUser(record),
      accessToken: access.token,
      refreshToken: credentials.refreshToken,
      sessionId: credentials.sessionId,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: credentials.refreshTokenExpiresAt,
    };
  }

  async login(
    credentials: LoginCredentials,
    context: AuthSessionContext = {}
  ): Promise<AuthResult> {
    if (!credentials.email || !credentials.password) {
      throw new ValidationError('E-mail e senha são obrigatórios.');
    }
    const password = normalizePassword(credentials.password);
    if (Array.from(password).length > MAX_PASSWORD_LENGTH) {
      throw new InvalidCredentialsError();
    }

    let record = await this.userRepo.findByEmail(normalizeEmail(credentials.email));
    if (!record) {
      // Equalize the expensive path without persisting or logging any secret.
      await hashPassword(password);
      throw new InvalidCredentialsError();
    }

    let passwordValid = await verifyPassword(password, record.password_hash);
    if (!passwordValid && password !== credentials.password) {
      // Preserve compatibility with pre-normalization Unicode passwords.
      passwordValid = await verifyPassword(credentials.password, record.password_hash);
    }
    if (!passwordValid) throw new InvalidCredentialsError();
    if (!record.is_active) throw new AccountDisabledError();

    if (passwordNeedsRehash(record.password_hash)) {
      const upgradedHash = await hashPassword(password);
      const upgraded = await this.userRepo.updatePasswordHash(
        record.id,
        record.password_hash,
        record.token_version,
        upgradedHash
      );
      if (upgraded) {
        record = { ...record, password_hash: upgradedHash };
      } else {
        // A reset, account-state change, or parallel rehash won the race. Only
        // continue if the latest unchanged identity still accepts this password.
        const latest = await this.userRepo.findById(record.id);
        if (
          !latest ||
          !latest.is_active ||
          latest.token_version !== record.token_version ||
          !(await verifyPassword(password, latest.password_hash))
        ) {
          throw new InvalidCredentialsError();
        }
        record = latest;
      }
    }

    const completeRecord = await this.ensureReferralCode(record);
    const result = await this.issueSession(completeRecord, context);
    try {
      await this.userRepo.markLogin(record.id);
    } catch {
      console.error('[Auth] Failed to update last login timestamp');
    }
    return result;
  }

  async register(data: RegisterData, context: AuthSessionContext = {}): Promise<AuthResult> {
    const name = data.name?.trim().normalize('NFC');
    const email = normalizeEmail(data.email ?? '');
    const sponsorCode = data.referralCode?.trim().toUpperCase();
    if (!name || !email || !data.password) {
      throw new ValidationError('Nome, e-mail e senha são obrigatórios.');
    }
    if (name.length < 2 || name.length > 80) {
      throw new ValidationError('O nome deve ter entre 2 e 80 caracteres.');
    }
    if (!sponsorCode) {
      throw new ValidationError('Código do patrocinador é obrigatório.');
    }

    const password = validateNewPassword(data.password);
    if (await this.userRepo.findByEmail(email)) throw new EmailExistsError();
    const sponsor = await this.userRepo.findByReferralCode(sponsorCode);
    if (!sponsor) {
      throw new InvalidReferralCodeError(
        'Código do patrocinador inválido ou inexistente. Verifique com quem te indicou.'
      );
    }

    const passwordHash = await hashPassword(password);
    let user: User | null = null;
    for (let attempt = 0; attempt < 5 && !user; attempt += 1) {
      const referralCode = await this.generateReferralCode();
      try {
        user = await this.userRepo.create({
          id: randomUUID(),
          name,
          email,
          passwordHash,
          phone: data.phone?.trim() || null,
          planInterest: data.planInterest ?? null,
          sponsorId: sponsor.id,
          referralCode,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        if (!isUniqueViolation(error)) throw error;
        const constraint = error.constraint ?? '';
        if (constraint.includes('email')) throw new EmailExistsError();
        if (!constraint.includes('referral')) throw error;
      }
    }
    if (!user) throw new Error('Unable to create user with a unique referral code');

    const record = await this.userRepo.findById(user.id);
    if (!record) throw new Error('Created user could not be loaded');
    return this.issueSession(record, context);
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    if (!refreshToken) throw new InvalidTokenError();
    const rotation = await this.sessionRepo.rotateRefreshToken(refreshToken);
    if (rotation.status === 'replayed') throw new RefreshTokenReplayError();
    if (rotation.status === 'already_rotated') {
      throw new RefreshTokenAlreadyRotatedError();
    }
    if (rotation.status !== 'ok') throw new InvalidTokenError();

    const { credentials } = rotation;
    const record = await this.userRepo.findById(credentials.userId);
    if (!record || !record.is_active || record.token_version !== credentials.tokenVersion) {
      await this.sessionRepo.revokeSession(credentials.sessionId, 'identity_changed');
      throw new InvalidTokenError();
    }
    let access: Awaited<ReturnType<typeof signAccessToken>>;
    try {
      access = await signAccessToken({
        subject: record.id,
        sessionId: credentials.sessionId,
        principalType: 'user',
        tokenVersion: credentials.tokenVersion,
      });
    } catch (error) {
      await this.compensateFailedSession(credentials.sessionId);
      throw error;
    }
    return {
      user: publicUser(record),
      accessToken: access.token,
      refreshToken: credentials.refreshToken,
      sessionId: credentials.sessionId,
      accessTokenExpiresAt: access.expiresAt,
      refreshTokenExpiresAt: credentials.refreshTokenExpiresAt,
    };
  }

  async getRefreshRateLimitSubject(refreshToken: string): Promise<string | null> {
    if (!refreshToken) return null;
    return this.sessionRepo.findRefreshSessionId(refreshToken);
  }

  /** Public authorization helper for Route Handlers and backend APIs. */
  async authenticateRequest(request: Request): Promise<User | null> {
    const bearer = readBearerToken(request);
    const cookieToken = readCookieToken(request, ACCESS_TOKEN_COOKIE);
    if (bearer && cookieToken && bearer !== cookieToken) return null;
    return this.authenticateAccessToken(bearer ?? cookieToken);
  }

  async authenticateAccessToken(accessToken: string | null | undefined): Promise<User | null> {
    const token = await verifyAccessToken(accessToken);
    if (!token || token.principalType !== 'user') return null;
    const sessionValid = await this.sessionRepo.validateAccessSession(
      token.sessionId,
      token.subject,
      token.tokenVersion
    );
    if (!sessionValid) return null;
    const record = await this.userRepo.findById(token.subject);
    if (!record || !record.is_active || record.token_version !== token.tokenVersion) {
      return null;
    }
    return publicUser(await this.ensureReferralCode(record));
  }

  async getCurrentUser(request?: Request): Promise<User | null> {
    const accessUser = await this.getCurrentAccessUser(request);
    if (accessUser) return accessUser;

    if (request) {
      const refresh = readCookieToken(request, REFRESH_TOKEN_COOKIE);
      return this.getUserFromRefreshToken(refresh);
    }

    const jar = await cookies();
    return this.getUserFromRefreshToken(jar.get(REFRESH_TOKEN_COOKIE)?.value);
  }

  async getCurrentAccessUser(request?: Request): Promise<User | null> {
    if (request) return this.authenticateRequest(request);
    const jar = await cookies();
    return this.authenticateAccessToken(jar.get(ACCESS_TOKEN_COOKIE)?.value);
  }

  private async getUserFromRefreshToken(
    refreshToken: string | null | undefined
  ): Promise<User | null> {
    if (!refreshToken) return null;
    const session = await this.sessionRepo.validateRefreshSession(refreshToken);
    if (!session) return null;
    const record = await this.userRepo.findById(session.userId);
    if (!record || !record.is_active || record.token_version !== session.tokenVersion) {
      return null;
    }
    return publicUser(await this.ensureReferralCode(record));
  }

  async isAuthenticated(): Promise<boolean> {
    return (await this.getCurrentUser()) !== null;
  }

  async logout(
    input: {
      accessToken?: string | null;
      refreshToken?: string | null;
    } = {}
  ): Promise<void> {
    const access = await verifyAccessToken(input.accessToken);
    if (access?.principalType === 'user') {
      await this.sessionRepo.revokeSession(access.sessionId, 'logout');
    }
    if (input.refreshToken) {
      await this.sessionRepo.revokeByRefreshToken(input.refreshToken, 'logout');
    }
  }

  async requestPasswordReset(email: string): Promise<void> {
    const normalizedEmail = normalizeEmail(email);
    if (!normalizedEmail) throw new ValidationError('E-mail é obrigatório.');
    // Check configuration before looking up the account so 503 cannot reveal
    // whether the submitted e-mail exists.
    if (!this.resetDelivery.isConfigured()) {
      throw new PasswordResetUnavailableError();
    }
    const user = await this.userRepo.findByEmail(normalizedEmail);
    if (!user || !user.is_active) return;

    const token = await this.sessionRepo.createPasswordResetToken(user.id);
    try {
      await this.resetDelivery.deliver({
        email: user.email,
        name: user.name,
        resetToken: token,
      });
    } catch {
      try {
        await this.sessionRepo.invalidatePasswordResetToken(token);
      } catch {
        console.error('[Auth] Failed to invalidate an undelivered reset token');
      }
      // Never log recipient identity, reset URL, raw token, or provider body.
      console.error('[Auth] Password reset delivery failed');
    }
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) {
      throw new ValidationError('Token e nova senha são obrigatórios.');
    }
    if (!/^(?:[A-Za-z0-9_-]{64}|[0-9a-fA-F-]{36})$/.test(token)) {
      throw new InvalidTokenError();
    }
    const resetUserId = await this.sessionRepo.findActivePasswordResetUser(token);
    if (!resetUserId) throw new InvalidTokenError();
    const passwordHash = await hashPassword(validateNewPassword(newPassword));
    const userId = await this.sessionRepo.consumePasswordResetToken(token, passwordHash);
    if (!userId || userId !== resetUserId) throw new InvalidTokenError();
  }

  async attachSessionCookies(
    response: NextResponse,
    authResult: AuthResult
  ): Promise<NextResponse> {
    try {
      const secure = process.env.NODE_ENV === 'production';
      const refreshMaxAge = Math.max(
        0,
        Math.floor((authResult.refreshTokenExpiresAt.getTime() - Date.now()) / 1000)
      );
      const common = {
        httpOnly: true,
        sameSite: 'lax' as const,
        secure,
        path: '/',
      };
      response.cookies.set({
        ...common,
        name: ACCESS_TOKEN_COOKIE,
        value: authResult.accessToken,
        maxAge: ACCESS_TOKEN_TTL_SECONDS,
        expires: authResult.accessTokenExpiresAt,
      });
      response.cookies.set({
        ...common,
        name: REFRESH_TOKEN_COOKIE,
        value: authResult.refreshToken,
        maxAge: refreshMaxAge,
        expires: authResult.refreshTokenExpiresAt,
      });
      response.cookies.set({
        name: CSRF_TOKEN_COOKIE,
        value: createCsrfToken(authResult.refreshToken),
        httpOnly: false,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: refreshMaxAge,
        expires: authResult.refreshTokenExpiresAt,
      });
      response.cookies.set({
        name: LEGACY_SESSION_COOKIE,
        value: '',
        httpOnly: true,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 0,
      });
      return response;
    } catch (error) {
      await this.compensateFailedSession(authResult.sessionId);
      throw error;
    }
  }

  clearSessionCookies(response: NextResponse): NextResponse {
    const secure = process.env.NODE_ENV === 'production';
    for (const [name, httpOnly] of [
      [ACCESS_TOKEN_COOKIE, true],
      [REFRESH_TOKEN_COOKIE, true],
      [CSRF_TOKEN_COOKIE, false],
      [LEGACY_SESSION_COOKIE, true],
    ] as const) {
      response.cookies.set({
        name,
        value: '',
        httpOnly,
        sameSite: 'lax',
        secure,
        path: '/',
        maxAge: 0,
      });
    }
    return response;
  }
}

export const authService = new AuthService();
