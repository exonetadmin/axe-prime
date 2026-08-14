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
  login(credentials: LoginCredentials): Promise<AuthResult>;

  /**
   * Register a new user
   * @throws {EmailExistsError} When email is already registered
   * @throws {ValidationError} When data is invalid
   */
  register(data: RegisterData): Promise<AuthResult>;

  /**
   * Get currently authenticated user from session
   * @returns User or null if not authenticated
   */
  getCurrentUser(): Promise<User | null>;

  /**
   * Check if user is authenticated
   */
  isAuthenticated(): Promise<boolean>;

  /**
   * Sign out current user
   */
  logout(): Promise<void>;

  /**
   * Request password reset
   * @throws {UserNotFoundError} When email not found
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

export type AuthResult = {
  user: User;
  token: string;
  expiresAt: Date;
};

export type AuthEvents = {
  'auth:login': { user: User };
  'auth:logout': { userId: string };
  'auth:registered': { user: User };
  'auth:password-reset': { userId: string };
};

// Error types
export class AuthError extends Error {
  constructor(message: string, public code: string) {
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
