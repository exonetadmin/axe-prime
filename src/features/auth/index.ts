/**
 * Auth Feature - Public API
 *
 * ONLY export public API - implementation details stay private.
 * Other features should import ONLY from this file.
 */

// Contracts and Types
export type {
  AuthContract,
  AuthResult,
  AuthEvents,
  User,
  LoginCredentials,
  RegisterData,
  AuthSessionContext,
} from './auth.contract';

// Errors
export {
  AuthError,
  InvalidCredentialsError,
  EmailExistsError,
  UserNotFoundError,
  InvalidTokenError,
  ValidationError,
  InvalidReferralCodeError,
  AccountDisabledError,
  RefreshTokenReplayError,
  RefreshTokenAlreadyRotatedError,
  PasswordResetUnavailableError,
} from './auth.contract';

// Services
export { AuthService, authService } from './services/auth.service';

// Repositories (only if needed by other features - usually not)
// export { UserRepository, userRepository } from './repositories/user.repository';
