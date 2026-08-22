import { z } from 'zod';
import { validatePasswordPolicy } from './password-policy';

function passwordLength(value: string): number {
  return Array.from(value.normalize('NFC')).length;
}

export const newPasswordSchema = z
  .string()
  .refine(value => validatePasswordPolicy(value) === null, {
    message:
      'A senha deve ter de 8 a 128 caracteres e incluir pelo menos uma letra, um número e um caractere especial.',
  })
  .refine(value => passwordLength(value) <= 128, {
    message: 'A senha excede o limite permitido.',
  });

export const existingPasswordSchema = z
  .string()
  .min(1, 'Informe sua senha.')
  .refine(value => passwordLength(value) <= 128, {
    message: 'A senha excede o limite permitido.',
  });

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe seu nome completo.')
    .max(80, 'Use um nome com no máximo 80 caracteres.'),
  email: z
    .string()
    .max(320, 'Informe um e-mail válido.')
    .email('Informe um e-mail válido.')
    .transform(value => value.trim().toLowerCase()),
  password: newPasswordSchema,
  phone: z
    .string()
    .trim()
    .refine(value => value.replace(/\D/g, '').length >= 10, {
      message: 'Informe um telefone celular válido.',
    }),
  referralCode: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^AP-[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{8}$/, 'Código do patrocinador inválido.'),
  planInterest: z.enum(['start', 'prime', 'elite']).nullable().optional().default(null),
});

export const loginSchema = z.object({
  email: z
    .string()
    .max(320, 'Informe um e-mail válido.')
    .email('Informe um e-mail válido.')
    .transform(value => value.trim().toLowerCase()),
  password: existingPasswordSchema,
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const resetRequestSchema = z.object({
  email: z
    .string()
    .max(320, 'Informe um e-mail válido.')
    .email('Informe um e-mail válido.')
    .transform(value => value.trim().toLowerCase()),
});

export const resetPasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string().refine(value => passwordLength(value) <= 128),
  })
  .refine(data => data.password.normalize('NFC') === data.confirmPassword.normalize('NFC'), {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export const resetPasswordConfirmSchema = resetPasswordSchema.and(
  z.object({
    email: z
      .string()
      .max(320, 'Informe um e-mail válido.')
      .email('Informe um e-mail válido.')
      .transform(value => value.trim().toLowerCase()),
    emailConfirmationCode: z.string().regex(/^\d{6}$/, 'Código inválido.'),
    token: z.string().regex(/^(?:[A-Za-z0-9_-]{64}|[0-9a-fA-F-]{36})$/, 'Token inválido.'),
  })
);

export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
export type ResetPasswordConfirmInput = z.infer<typeof resetPasswordConfirmSchema>;
