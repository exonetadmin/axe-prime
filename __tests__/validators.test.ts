import { describe, it, expect } from "vitest";
import { loginSchema, registerSchema, resetRequestSchema, resetPasswordSchema } from "../lib/validators";

describe("Login Schema", () => {
  it("should validate correct login data", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = loginSchema.safeParse({
      email: "not-an-email",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should reject short password", () => {
    const result = loginSchema.safeParse({
      email: "test@example.com",
      password: "123",
    });
    expect(result.success).toBe(false);
  });
});

describe("Register Schema", () => {
  it("should validate correct register data", () => {
    const result = registerSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
      planInterest: "prime",
    });
    expect(result.success).toBe(true);
  });

  it("should reject short name", () => {
    const result = registerSchema.safeParse({
      name: "J",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(false);
  });

  it("should default planInterest to prime", () => {
    const result = registerSchema.safeParse({
      name: "John Doe",
      email: "john@example.com",
      password: "password123",
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.planInterest).toBe("prime");
    }
  });
});

describe("Reset Request Schema", () => {
  it("should validate correct email", () => {
    const result = resetRequestSchema.safeParse({
      email: "test@example.com",
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid email", () => {
    const result = resetRequestSchema.safeParse({
      email: "invalid-email",
    });
    expect(result.success).toBe(false);
  });
});

describe("Reset Password Schema", () => {
  it("should validate matching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "newpassword123",
      confirmPassword: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("should reject mismatching passwords", () => {
    const result = resetPasswordSchema.safeParse({
      password: "newpassword123",
      confirmPassword: "differentpassword",
    });
    expect(result.success).toBe(false);
  });
});
