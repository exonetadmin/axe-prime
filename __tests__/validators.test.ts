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
      password: 'Abcdef1!',
    });
    expect(result.success).toBe(true);
  });

  it('should reject invalid email', () => {
    const result = loginSchema.safeParse({
      email: 'not-an-email',
      password: 'Abcdef1!',
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
      password: 'Abe123!x',
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
      password: 'Abe123!x',
      phone: '(11) 99999-9999',
      referralCode: 'AP-ABCDEFGH',
    });
    expect(result.success).toBe(false);
  });

  it('should default planInterest to null', () => {
    const result = registerSchema.safeParse({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'Abe123!x',
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
  it('rejects common long passwords that satisfy the length requirement', () => {
    expect(
      resetPasswordSchema.safeParse({
        password: 'passwordpassword',
        confirmPassword: 'passwordpassword',
      }).success
    ).toBe(false);
  });

  it('should validate matching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Abe123!x',
      confirmPassword: 'Abe123!x',
    });
    expect(result.success).toBe(true);
  });

  it('should reject mismatching passwords', () => {
    const result = resetPasswordSchema.safeParse({
      password: 'Abe123!x',
      confirmPassword: 'Abe123!y',
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
        password: '🔐'.repeat(8) + 'A1!',
        confirmPassword: '🔐'.repeat(8) + 'A1!',
      }).success
    ).toBe(true);
    const variedUnicode = '😀😁😂😃😄😅😆😉😊😋😎😍😘🥰🤩';
    expect(
      resetPasswordSchema.safeParse({
        password: `${variedUnicode}A1!`,
        confirmPassword: `${variedUnicode}A1!`,
      }).success
    ).toBe(true);
  });

  it('requires a fixed-format opaque token for reset confirmation', () => {
    expect(
      resetPasswordConfirmSchema.safeParse({
        token: 'r'.repeat(64),
        email: 'user@example.com',
        emailConfirmationCode: '123456',
        password: 'Abe123!x',
        confirmPassword: 'Abe123!x',
      }).success
    ).toBe(true);
    expect(
      resetPasswordConfirmSchema.safeParse({
        token: 'token-curto',
        email: 'user@example.com',
        emailConfirmationCode: '123456',
        password: 'Abe123!x',
        confirmPassword: 'Abe123!x',
      }).success
    ).toBe(false);
    expect(
      resetPasswordConfirmSchema.safeParse({
        token: 'r'.repeat(64),
        email: 'bad email',
        emailConfirmationCode: '123456',
        password: 'Abe123!x',
        confirmPassword: 'Abe123!x',
      }).success
    ).toBe(false);
    expect(
      resetPasswordConfirmSchema.safeParse({
        token: 'r'.repeat(64),
        email: 'user@example.com',
        emailConfirmationCode: '12345',
        password: 'Abe123!x',
        confirmPassword: 'Abe123!x',
      }).success
    ).toBe(false);
  });
});
