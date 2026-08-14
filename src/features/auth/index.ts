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
} from './auth.contract';

// Errors
export {
  AuthError,
  InvalidCredentialsError,
  EmailExistsError,
  UserNotFoundError,
  InvalidTokenError,
  ValidationError,
} from './auth.contract';

// Services
export { AuthService, authService } from './services/auth.service';

// Repositories (only if needed by other features - usually not)
// export { UserRepository, userRepository } from './repositories/user.repository';

// React Components
export { default as LoginForm } from './components/LoginForm';
export { default as RegisterForm } from './components/RegisterForm';
export { default as LogoutButton } from './components/LogoutButton';
