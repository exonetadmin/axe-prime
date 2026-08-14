/**
 * Auth Service - Business Logic Layer
 * 
 * Responsibilities:
 * - Business logic for authentication
 * - Validation and security checks
 * - Session management
 * - Event emission for cross-feature communication
 * 
 * Note: Services contain NO database code - they delegate to repositories.
 */

import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { randomBytes, randomUUID } from 'node:crypto';
import type {
  AuthContract,
  AuthResult,
  LoginCredentials,
  RegisterData,
  User,
} from '../auth.contract';
import {
  InvalidCredentialsError,
  EmailExistsError,
  InvalidReferralCodeError,
  InvalidTokenError,
  ValidationError,
  AccountDisabledError,
} from '../auth.contract';
import { userRepository } from '../repositories/user.repository';

const SESSION_COOKIE = 'axeprime_session';
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days
const SALT_ROUNDS = 12;

// Password validation
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

function getSessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  if (secret.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters');
  }
  return new TextEncoder().encode(secret);
}

export class AuthService implements AuthContract {
  constructor(private userRepo: typeof userRepository) {}

  /**
   * Validate password strength
   */
  private validatePassword(password: string): void {
    if (password.length < MIN_PASSWORD_LENGTH) {
      throw new ValidationError(
        `Password must be at least ${MIN_PASSWORD_LENGTH} characters`
      );
    }
    if (!PASSWORD_REGEX.test(password)) {
      throw new ValidationError(
        'Password must contain at least one lowercase letter, one uppercase letter, and one number'
      );
    }
  }

  /**
   * Hash password securely
   */
  private async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  }

  /**
   * Verify password against hash
   */
  private async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /** Prefixo exclusivo AXE PRIME para códigos de indicação. */
  private static readonly REFERRAL_CODE_PREFIX = 'AP-';
  /** Formato válido: AP- + exatamente 8 caracteres do alfabeto (evita aceitar códigos antigos com "undefined"). */
  private static readonly REFERRAL_CODE_VALID =
    /^AP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/;

  private static isAxePrimeCode(code: string | null | undefined): boolean {
    return Boolean(
      code &&
        typeof code === 'string' &&
        AuthService.REFERRAL_CODE_VALID.test(code.trim())
    );
  }

  /**
   * Garante que o usuário tenha código exclusivo AXE PRIME (AP-). Atualiza no DB se necessário.
   */
  private async ensureAxePrimeReferralCode(
    userId: string,
    currentCode: string | null | undefined
  ): Promise<string> {
    if (AuthService.isAxePrimeCode(currentCode)) {
      return String(currentCode).trim();
    }
    const newCode = await this.generateReferralCode();
    await this.userRepo.updateReferralCode(userId, newCode);
    return newCode;
  }

  /**
   * Gera código exclusivo AXE PRIME (formato AP-XXXXXXXX). 8 caracteres após o prefixo.
   * Usa 8 bytes para evitar bytes[j] undefined (que gerava "undefined" no código).
   */
  private async generateReferralCode(): Promise<string> {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    const suffixLength = 8;
    for (let attempt = 0; attempt < 10; attempt++) {
      const bytes = randomBytes(suffixLength);
      let suffix = '';
      for (let j = 0; j < suffixLength; j++) {
        const byte = bytes[j];
        suffix += chars[(byte ?? 0) % chars.length];
      }
      const code = `${AuthService.REFERRAL_CODE_PREFIX}${suffix}`;
      const existing = await this.userRepo.findByReferralCode(code);
      if (!existing) return code;
    }
    return `${AuthService.REFERRAL_CODE_PREFIX}${randomUUID().replace(/-/g, '').slice(0, suffixLength)}`;
  }

  /**
   * Create JWT session token
   */
  private async createSessionToken(user: User): Promise<string> {
    return new SignJWT({
      email: user.email,
      name: user.name,
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(user.id)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_TTL_SECONDS}s`)
      .sign(getSessionSecret());
  }

  /**
   * Verify and decode session token
   */
  private async verifySessionToken(
    token: string | null | undefined
  ): Promise<{ sub: string; email: string; name: string } | null> {
    if (!token) return null;

    try {
      const { payload } = await jwtVerify(token, getSessionSecret());

      if (
        typeof payload.sub !== 'string' ||
        typeof payload.email !== 'string' ||
        typeof payload.name !== 'string'
      ) {
        return null;
      }

      return {
        sub: payload.sub,
        email: payload.email,
        name: payload.name,
      };
    } catch {
      return null;
    }
  }

  // ============================================================================
  // Public API Implementation
  // ============================================================================

  async login(credentials: LoginCredentials): Promise<AuthResult> {
    // 1. Validate input
    if (!credentials.email || !credentials.password) {
      throw new ValidationError('Email and password are required');
    }

    // 2. Find user
    const userRecord = await this.userRepo.findByEmail(credentials.email);
    if (!userRecord) {
      throw new InvalidCredentialsError();
    }

    // 3. Verify password
    const isValid = await this.verifyPassword(
      credentials.password,
      userRecord.password_hash
    );
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    // 4. Verificar se a conta está ativa
    if (userRecord.is_active === false) {
      throw new AccountDisabledError();
    }

    // 4. Garantir código exclusivo AXE PRIME (AP-); backfill se necessário
    const referralCode = await this.ensureAxePrimeReferralCode(
      userRecord.id,
      userRecord.referral_code
    );
    const user: User = {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      phone: (userRecord as Record<string, unknown>).phone as string | null ?? null,
      planInterest: userRecord.plan_interest as 'start' | 'prime' | 'elite' | null,
      sponsorId: userRecord.sponsor_id ?? null,
      referralCode,
      createdAt: userRecord.created_at,
      avatarUrl: userRecord.avatar_url ?? null,
      cpf: userRecord.cpf ?? null,
      adhesionValueCents: userRecord.adhesion_value_cents ?? null,
    };

    const token = await this.createSessionToken(user);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    // 5. Emit event for cross-feature communication
    console.log('[Auth] User logged in:', user.id);

    return {
      user,
      token,
      expiresAt,
    };
  }

  async register(data: RegisterData): Promise<AuthResult> {
    // 1. Validate input
    if (!data.name || !data.email || !data.password) {
      throw new ValidationError('Name, email and password are required');
    }

    const sponsorCode = data.referralCode?.trim();
    if (!sponsorCode) {
      throw new ValidationError('Código do patrocinador é obrigatório');
    }

    if (data.name.length < 2) {
      throw new ValidationError('Name must be at least 2 characters');
    }

    this.validatePassword(data.password);

    // 2. Check if email exists
    const existingUser = await this.userRepo.findByEmail(data.email);
    if (existingUser) {
      throw new EmailExistsError();
    }

    // 3. Validar código do patrocinador (obrigatório)
    const sponsor = await this.userRepo.findByReferralCode(sponsorCode);
    if (!sponsor) {
      throw new InvalidReferralCodeError(
        'Código do patrocinador inválido ou inexistente. Verifique com quem te indicou.'
      );
    }
    const sponsorId = sponsor.id;

    // 4. Hash password
    const passwordHash = await this.hashPassword(data.password);

    // 5. Generate exclusive AXE PRIME referral code for new user
    const referralCode = await this.generateReferralCode();

    // 6. Create user (com patrocinador válido)
    const user = await this.userRepo.create({
      id: randomUUID(),
      name: data.name,
      email: data.email,
      passwordHash,
      phone: data.phone ?? null,
      planInterest: data.planInterest ?? null,
      sponsorId,
      referralCode,
      createdAt: new Date().toISOString(),
    });

    // 7. Create session
    const token = await this.createSessionToken(user);
    const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000);

    // 8. Emit event
    console.log('[Auth] User registered:', user.id);

    return {
      user,
      token,
      expiresAt,
    };
  }

  async getCurrentUser(): Promise<User | null> {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    const session = await this.verifySessionToken(token);

    if (!session) {
      return null;
    }

    const userRecord = await this.userRepo.findById(session.sub);
    if (!userRecord) {
      return null;
    }

    const referralCode = await this.ensureAxePrimeReferralCode(
      userRecord.id,
      userRecord.referral_code
    );
    return {
      id: userRecord.id,
      name: userRecord.name,
      email: userRecord.email,
      phone: (userRecord as Record<string, unknown>).phone as string | null ?? null,
      planInterest: userRecord.plan_interest as 'start' | 'prime' | 'elite' | null,
      sponsorId: userRecord.sponsor_id ?? null,
      referralCode,
      createdAt: userRecord.created_at,
      avatarUrl: userRecord.avatar_url ?? null,
      cpf: userRecord.cpf ?? null,
      adhesionValueCents: userRecord.adhesion_value_cents ?? null,
    };
  }

  async isAuthenticated(): Promise<boolean> {
    const user = await this.getCurrentUser();
    return user !== null;
  }

  async logout(): Promise<void> {
    const user = await this.getCurrentUser();
    if (user) {
      console.log('[Auth] User logged out:', user.id);
    }
    // Cookie clearing is handled by the caller (API route)
  }

  async requestPasswordReset(email: string): Promise<void> {
    if (!email) {
      throw new ValidationError('Email is required');
    }

    const user = await this.userRepo.findByEmail(email);
    if (!user) {
      // Don't reveal if email exists for security
      return;
    }

    const token = randomUUID();
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await this.userRepo.setResetToken(email, token, expiresAt);

    // TODO: Send email with reset link
    // For now, just log it (in production, integrate with email service)
    console.log(`[Auth] Password reset requested for ${email}, token: ${token}`);
  }

  async resetPassword(token: string, newPassword: string): Promise<void> {
    if (!token || !newPassword) {
      throw new ValidationError('Token and new password are required');
    }

    this.validatePassword(newPassword);

    const user = await this.userRepo.findByResetToken(token);
    if (!user) {
      throw new InvalidTokenError();
    }

    const newPasswordHash = await this.hashPassword(newPassword);
    await this.userRepo.updatePassword(user.id, newPasswordHash);
    await this.userRepo.clearResetToken(user.id);

    console.log('[Auth] Password reset:', user.id);
  }

  // ============================================================================
  // HTTP Helpers (for API routes)
  // ============================================================================

  /**
   * Attach session cookie to response
   */
  async attachSessionCookie(
    response: NextResponse,
    authResult: AuthResult
  ): Promise<NextResponse> {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: authResult.token,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: SESSION_TTL_SECONDS,
    });

    return response;
  }

  /**
   * Clear session cookie
   */
  clearSessionCookie(response: NextResponse): NextResponse {
    response.cookies.set({
      name: SESSION_COOKIE,
      value: '',
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 0,
    });

    return response;
  }
}

// Export singleton instance
export const authService = new AuthService(userRepository);
