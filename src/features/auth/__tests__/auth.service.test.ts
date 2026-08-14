import { describe, it, expect, vi, beforeEach, MockedFunction } from 'vitest';
import { AuthService } from '../services/auth.service';
import {
  InvalidCredentialsError,
  EmailExistsError,
  InvalidReferralCodeError,
  ValidationError,
  InvalidTokenError,
} from '../auth.contract';
import { UserBuilder } from '../../../../test/builders/user.builder';
import { UserRepository } from '../repositories/user.repository';
import type { UserRecord } from '../repositories/user.repository';

// Type matching UserRepository class structure
type MockUserRepo = {
  findByEmail: MockedFunction<UserRepository['findByEmail']>;
  findById: MockedFunction<UserRepository['findById']>;
  create: MockedFunction<UserRepository['create']>;
  updatePassword: MockedFunction<UserRepository['updatePassword']>;
  setResetToken: MockedFunction<UserRepository['setResetToken']>;
  findByResetToken: MockedFunction<UserRepository['findByResetToken']>;
  clearResetToken: MockedFunction<UserRepository['clearResetToken']>;
  emailExists: MockedFunction<UserRepository['emailExists']>;
  count: MockedFunction<UserRepository['count']>;
  findByReferralCode: MockedFunction<UserRepository['findByReferralCode']>;
};

/** Helper para criar um UserRecord mock com defaults seguros */
function makeUserRecord(overrides: Partial<UserRecord> = {}): UserRecord {
  return {
    id: 'user-1',
    name: 'Test User',
    email: 'test@example.com',
    password_hash:
      '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4.VTtYA.qGZvKG6G',
    plan_interest: 'prime',
    sponsor_id: null,
    referral_code: 'AP-TEST0001',
    avatar_url: null,
    cpf: null,
    reset_token: null,
    reset_token_expires: null,
    adhesion_at: null,
    plan_monthly_cents: null,
    adhesion_value_cents: null,
    kyc_submitted: false,
    is_active: true,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Mock the repository
const mockUserRepo: MockUserRepo = {
  findByEmail: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  updatePassword: vi.fn(),
  setResetToken: vi.fn(),
  findByResetToken: vi.fn(),
  clearResetToken: vi.fn(),
  emailExists: vi.fn(),
  count: vi.fn(),
  findByReferralCode: vi.fn(),
};

// Mock environment variable
process.env.SESSION_SECRET = 'test-secret-key-that-is-32-chars-long-for-testing';

describe('AuthService', () => {
  let authService: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    authService = new AuthService(mockUserRepo as unknown as UserRepository);
  });

  describe('login', () => {
    it('should authenticate valid user', async () => {
      const mockUser = makeUserRecord({ referral_code: 'AP-TEST0001' });
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      const result = await authService.login({
        email: 'test@example.com',
        password: 'password123',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('test@example.com');
      expect(result.token).toBeDefined();
    });

    it('should throw InvalidCredentialsError for wrong password', async () => {
      const mockUser = makeUserRecord({
        password_hash: '$2a$12$hashedpassword',
      });
      mockUserRepo.findByEmail.mockResolvedValue(mockUser);

      await expect(
        authService.login({
          email: 'test@example.com',
          password: 'wrongpassword',
        })
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw InvalidCredentialsError for non-existent user', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        authService.login({
          email: 'nonexistent@example.com',
          password: 'password123',
        })
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it('should throw ValidationError for missing credentials', async () => {
      await expect(
        authService.login({ email: '', password: 'password123' })
      ).rejects.toThrow(ValidationError);

      await expect(
        authService.login({ email: 'test@example.com', password: '' })
      ).rejects.toThrow(ValidationError);
    });
  });

  const validSponsorRecord = makeUserRecord({
    id: 'sponsor-1',
    name: 'Sponsor',
    email: 'sponsor@example.com',
    password_hash: 'hashed',
    referral_code: 'AP-SPONSOR1',
    sponsor_id: null,
  });

  describe('register', () => {
    it('should create new user successfully when sponsor code is valid', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.findByReferralCode.mockImplementation((code: string) =>
        code === 'AP-SPONSOR1'
          ? Promise.resolve(validSponsorRecord)
          : Promise.resolve(null)
      );
      mockUserRepo.create.mockResolvedValue(
        new UserBuilder()
          .withEmail('new@example.com')
          .withPlan('prime')
          .build()
      );

      const result = await authService.register({
        name: 'New User',
        email: 'new@example.com',
        password: 'Password123',
        phone: '(11) 99999-9999',
        planInterest: 'prime',
        referralCode: 'AP-SPONSOR1',
      });

      expect(result.user).toBeDefined();
      expect(result.user.email).toBe('new@example.com');
      expect(mockUserRepo.create).toHaveBeenCalled();
    });

    it('should throw InvalidReferralCodeError when sponsor code is invalid', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.findByReferralCode.mockResolvedValue(null);

      await expect(
        authService.register({
          name: 'New User',
          email: 'new@example.com',
          password: 'Password123',
          phone: '(11) 99999-9999',
          planInterest: 'prime',
          referralCode: 'INVALID-CODE',
        })
      ).rejects.toThrow(InvalidReferralCodeError);
    });

    it('should throw ValidationError when sponsor code is missing', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);

      await expect(
        authService.register({
          name: 'New User',
          email: 'new@example.com',
          password: 'Password123',
          phone: '(11) 99999-9999',
          planInterest: 'prime',
          referralCode: '',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw EmailExistsError for duplicate email', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(
        makeUserRecord({
          id: 'existing',
          name: 'Existing User',
          email: 'existing@example.com',
          referral_code: 'AP-EXIST001',
        })
      );
      mockUserRepo.findByReferralCode.mockResolvedValue(validSponsorRecord);

      await expect(
        authService.register({
          name: 'Test',
          email: 'existing@example.com',
          password: 'Password123',
          phone: '(11) 99999-9999',
          planInterest: 'prime',
          referralCode: 'AP-SPONSOR1',
        })
      ).rejects.toThrow(EmailExistsError);
    });

    it('should throw ValidationError for weak password', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.findByReferralCode.mockResolvedValue(validSponsorRecord);

      await expect(
        authService.register({
          name: 'Test',
          email: 'test@example.com',
          password: 'weak',
          phone: '(11) 99999-9999',
          planInterest: 'prime',
          referralCode: 'AP-SPONSOR1',
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for short name', async () => {
      mockUserRepo.findByEmail.mockResolvedValue(null);
      mockUserRepo.findByReferralCode.mockResolvedValue(validSponsorRecord);

      await expect(
        authService.register({
          name: 'A',
          email: 'test@example.com',
          password: 'Password123',
          phone: '(11) 99999-9999',
          planInterest: 'prime',
          referralCode: 'AP-SPONSOR1',
        })
      ).rejects.toThrow(ValidationError);
    });
  });

  describe('getCurrentUser', () => {
    it('should return null when no session', async () => {
      const user = await authService.getCurrentUser();
      expect(user).toBeNull();
    });
  });

  describe('isAuthenticated', () => {
    it('should return false when no session', async () => {
      const isAuth = await authService.isAuthenticated();
      expect(isAuth).toBe(false);
    });
  });

  describe('resetPassword', () => {
    it('should throw InvalidTokenError for invalid token', async () => {
      mockUserRepo.findByResetToken.mockResolvedValue(null);

      await expect(
        authService.resetPassword('invalid-token', 'NewPassword123')
      ).rejects.toThrow(InvalidTokenError);
    });

    it('should throw ValidationError for weak new password', async () => {
      await expect(
        authService.resetPassword('valid-token', 'weak')
      ).rejects.toThrow(ValidationError);
    });
  });
});
