/**
 * Auth Contract - Public API for Authentication Feature
 *
 * This contract defines the interface between the auth feature and other features.
 * Other features should ONLY import from this contract, never from implementation details.
 *
 * @example
 * ```ts
 * import type { AuthContract, User } from '@/features/auth';
 *
 * class SomeService {
 *   constructor(private auth: AuthContract) {}
 *
 *   async doSomething() {
 *     const user = await this.auth.getCurrentUser();
 *     // ...
 *   }
 * }
 * ```
 */

export interface AuthContract {
  /**
   * Authenticate user with email and password
   * @throws {InvalidCredentialsError} When credentials are incorrect
   * @throws {AccountBlockedError} When user account is blocked
   */
  login(credentials: LoginCredentials, context?: AuthSessionContext): Promise<AuthResult>;

  /**
   * Register a new user
   * @throws {EmailExistsError} When email is already registered
   * @throws {ValidationError} When data is invalid
   */
  register(data: RegisterData, context?: AuthSessionContext): Promise<AuthResult>;

  /** Rotate a one-time refresh token and issue a new access token pair. */
  refresh(refreshToken: string): Promise<AuthResult>;

  /** Authenticate a backend API request via Bearer header or access cookie. */
  authenticateRequest(request: Request): Promise<User | null>;

  /** Validate an access JWT and its revocable database session. */
  authenticateAccessToken(accessToken: string | null | undefined): Promise<User | null>;

  /**
   * Get a user for read-only server rendering. May accept an active refresh
   * session when the short access token has just expired.
   * @returns User or null if not authenticated
   */
  getCurrentUser(request?: Request): Promise<User | null>;

  /** Access-token-only principal for mutations and other sensitive actions. */
  getCurrentAccessUser(request?: Request): Promise<User | null>;

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Sign out current user
   */
  logout(input?: { accessToken?: string | null; refreshToken?: string | null }): Promise<void>;

  /**
   * Request password reset
   * Unknown e-mails intentionally return normally to prevent enumeration.
   * @throws {PasswordResetUnavailableError} When secure delivery is unavailable
   */
  requestPasswordReset(email: string): Promise<void>;

  /**
   * Reset password with token
   * @throws {InvalidTokenError} When token is invalid or expired
   */
  resetPassword(token: string, newPassword: string): Promise<void>;
}

export type User = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  planInterest: 'start' | 'prime' | 'elite' | null;
  sponsorId: string | null;
  referralCode: string;
  createdAt: string;
  avatarUrl: string | null;
  cpf: string | null;
  adhesionValueCents: number | null;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type RegisterData = {
  name: string;
  email: string;
  password: string;
  phone: string;
  planInterest?: 'start' | 'prime' | 'elite' | null;
  /** Código do patrocinador — obrigatório; só é possível cadastrar com código válido. */
  referralCode: string;
};

export type AuthSessionContext = {
  userAgentHash?: string | null;
  ipAddress?: string | null;
};

export type AuthResult = {
  user: User;
  accessToken: string;
  refreshToken: string;
  sessionId: string;
  accessTokenExpiresAt: Date;
  refreshTokenExpiresAt: Date;
};

export type AuthEvents = {
  'auth:login': { user: User };
  'auth:logout': { userId: string };
  'auth:registered': { user: User };
  'auth:password-reset': { userId: string };
};

// Error types
export class AuthError extends Error {
  constructor(
    message: string,
    public code: string
  ) {
    super(message);
    this.name = 'AuthError';
  }
}

export class InvalidCredentialsError extends AuthError {
  constructor(message = 'Invalid credentials') {
    super(message, 'INVALID_CREDENTIALS');
    this.name = 'InvalidCredentialsError';
  }
}

export class EmailExistsError extends AuthError {
  constructor(message = 'Email already registered') {
    super(message, 'EMAIL_EXISTS');
    this.name = 'EmailExistsError';
  }
}

export class UserNotFoundError extends AuthError {
  constructor(message = 'User not found') {
    super(message, 'USER_NOT_FOUND');
    this.name = 'UserNotFoundError';
  }
}

export class InvalidTokenError extends AuthError {
  constructor(message = 'Invalid or expired token') {
    super(message, 'INVALID_TOKEN');
    this.name = 'InvalidTokenError';
  }
}

export class ValidationError extends AuthError {
  constructor(message = 'Validation failed') {
    super(message, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

export class InvalidReferralCodeError extends AuthError {
  constructor(message = 'Código do patrocinador inválido ou inexistente') {
    super(message, 'INVALID_REFERRAL_CODE');
    this.name = 'InvalidReferralCodeError';
  }
}

export class AccountDisabledError extends AuthError {
  constructor(message = 'Seu cadastro foi excluído do sistema.') {
    super(message, 'ACCOUNT_DISABLED');
    this.name = 'AccountDisabledError';
  }
}

export class RefreshTokenReplayError extends AuthError {
  constructor(message = 'Refresh token replay detected') {
    super(message, 'REFRESH_TOKEN_REPLAY');
    this.name = 'RefreshTokenReplayError';
  }
}

export class RefreshTokenAlreadyRotatedError extends AuthError {
  constructor(message = 'Refresh token was already rotated') {
    super(message, 'REFRESH_TOKEN_ALREADY_ROTATED');
    this.name = 'RefreshTokenAlreadyRotatedError';
  }
}

export class PasswordResetUnavailableError extends AuthError {
  constructor(message = 'Password reset delivery is unavailable') {
    super(message, 'PASSWORD_RESET_UNAVAILABLE');
    this.name = 'PasswordResetUnavailableError';
  }
}
