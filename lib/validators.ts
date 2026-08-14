import { z } from 'zod';

export const registerSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Informe seu nome completo.')
    .max(80, 'Use um nome com no máximo 80 caracteres.'),
  email: z
    .string()
    .email('Informe um e-mail válido.')
    .transform(value => value.trim().toLowerCase()),
  password: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .max(120, 'A senha excede o limite permitido.'),
  planInterest: z.enum(['start', 'prime', 'elite']).optional().default('prime'),
});

export const loginSchema = z.object({
  email: z
    .string()
    .email('Informe um e-mail válido.')
    .transform(value => value.trim().toLowerCase()),
  password: z
    .string()
    .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
    .max(120, 'A senha excede o limite permitido.'),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;

export const resetRequestSchema = z.object({
  email: z
    .string()
    .email('Informe um e-mail válido.')
    .transform(value => value.trim().toLowerCase()),
});

export const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, 'A senha precisa ter pelo menos 8 caracteres.')
      .max(120, 'A senha excede o limite permitido.'),
    confirmPassword: z.string(),
  })
  .refine(data => data.password === data.confirmPassword, {
    message: 'As senhas não coincidem.',
    path: ['confirmPassword'],
  });

export type ResetRequestInput = z.infer<typeof resetRequestSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
