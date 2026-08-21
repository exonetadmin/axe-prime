import { describe, it, expect } from 'vitest';
import {
  loginSchema,
  registerSchema,
  resetRequestSchema,
  resetPasswordSchema,
  resetPasswordConfirmSchema,
} from '../lib/validators';

describe('Login Schema', () => {
  it('should validate correct login data', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: 'password123',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'password123',
    });
    expect(result.success).toBe(false);
  });

  it('should reject an empty password', () => {
    const result = loginSchema.safeParse({
      email: 'test@example.com',
      password: '',
    });
    expect(result.success).toBe(false);
  });
});

describe('Register Schema', () => {
  it('should validate correct register data', () => {
    const result = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'uma frase senha bem longa',
      phone: '(11) 99999-9999',
      referralCode: 'AP-ABCDEFGH',
      planInterest: 'prime',
    });
    expect(result.success).toBe(true);
  });

  it('should reject short name', () => {
    const result = registerSchema.safeParse({
      name: 'J',
      email: 'john@example.com',
      password: 'uma frase senha bem longa',
      phone: '(11) 99999-9999',
      referralCode: 'AP-ABCDEFGH',
    });
    expect(result.success).toBe(false);
  });

  it('should default planInterest to null', () => {
    const result = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'uma frase senha bem longa',
      phone: '(11) 99999-9999',
      referralCode: 'AP-ABCDEFGH',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planInterest).toBeNull();
    }
  });
});

describe('Reset Request Schema', () => {
  it('should validate correct email', () => {
    const result = resetRequestSchema.safeParse({
      email: 'test@example.com',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = resetRequestSchema.safeParse({
      email: 'invalid-email',
    });
    expect(result.success).toBe(false);
  });
});

describe('Reset Password Schema', () => {
  it('should validate matching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'uma nova frase senha longa',
      confirmPassword: 'uma nova frase senha longa',
    });
    expect(result.success).toBe(true);
  });

  it('should reject mismatching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'uma nova frase senha longa',
      confirmPassword: 'outra frase senha bem longa',
    });
    expect(result.success).toBe(false);
  });

  it('counts Unicode code points after NFC normalization', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: '🔐'.repeat(8),
        confirmPassword: '🔐'.repeat(8),
      }).success
    ).toBe(false);
    expect(
      resetPasswordSchema.safeParse({
        password: '🔐'.repeat(15),
        confirmPassword: '🔐'.repeat(15),
      }).success
    ).toBe(true);
  });

  it('requires a fixed-format opaque token for reset confirmation', () => {
    expect(
      resetPasswordConfirmSchema.safeParse({
        token: 'r'.repeat(64),
        password: 'uma nova frase senha longa',
        confirmPassword: 'uma nova frase senha longa',
      }).success
    ).toBe(true);
    expect(
      resetPasswordConfirmSchema.safeParse({
        token: 'token-curto',
        password: 'uma nova frase senha longa',
        confirmPassword: 'uma nova frase senha longa',
      }).success
    ).toBe(false);
  });
});
