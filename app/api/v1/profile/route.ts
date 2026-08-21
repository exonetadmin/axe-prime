import { NextResponse } from 'next/server';
import { z } from 'zod';
import { authService } from '@/src/features/auth';
import { existingPasswordSchema, newPasswordSchema } from '@/lib/validators';
import {
  CurrentPasswordInvalidError,
  InvalidNewPasswordError,
  profileRepository,
} from '@/src/features/profile/profile.repository';
import {
  assertMutationSecurity,
  noStoreHeaders,
  parseJsonRequest,
  RequestSecurityError,
} from '@/src/server/security/request';

const profileMutationSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('name'),
    name: z.string().trim().min(2).max(160),
  }),
  z.object({
    action: z.literal('phone'),
    phone: z.string().trim().min(10).max(30),
  }),
  z.object({
    action: z.literal('cpf'),
    cpf: z.string().min(11).max(20),
  }),
  z.object({
    action: z.literal('password'),
    currentPassword: existingPasswordSchema,
    newPassword: newPasswordSchema,
  }),
]);

function isValidCpf(value: string): boolean {
  const digits = value.replace(/\D/g, '');
  if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;
  const check = (length: number): number => {
    let sum = 0;
    for (let index = 0; index < length; index += 1) {
      sum += Number(digits[index]) * (length + 1 - index);
    }
    const remainder = (sum * 10) % 11;
    return remainder === 10 ? 0 : remainder;
  };
  return check(9) === Number(digits[9]) && check(10) === Number(digits[10]);
}

export async function PATCH(request: Request) {
  try {
    assertMutationSecurity(request);
    const user = await authService.authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { ok: false, message: 'Não autenticado.' },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const parsed = profileMutationSchema.safeParse(await parseJsonRequest(request));
    if (!parsed.success) {
      return NextResponse.json(
        { ok: false, message: 'Dados inválidos.', issues: parsed.error.flatten() },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const mutation = parsed.data;
    if (mutation.action === 'name') {
      const ok = await profileRepository.updateName(user.id, mutation.name.normalize('NFC'));
      return NextResponse.json(
        { ok, message: ok ? 'Nome atualizado.' : 'Usuário não encontrado.' },
        { status: ok ? 200 : 404, headers: noStoreHeaders() }
      );
    }

    if (mutation.action === 'phone') {
      const digits = mutation.phone.replace(/\D/g, '');
      if (digits.length < 10 || digits.length > 11) {
        return NextResponse.json(
          { ok: false, message: 'Telefone inválido. Use DDD e número.' },
          { status: 400, headers: noStoreHeaders() }
        );
      }
      const ok = await profileRepository.updatePhone(user.id, mutation.phone);
      return NextResponse.json(
        { ok, message: ok ? 'Telefone atualizado.' : 'Usuário não encontrado.' },
        { status: ok ? 200 : 404, headers: noStoreHeaders() }
      );
    }

    if (mutation.action === 'cpf') {
      if (!isValidCpf(mutation.cpf)) {
        return NextResponse.json(
          { ok: false, message: 'CPF inválido.' },
          { status: 400, headers: noStoreHeaders() }
        );
      }
      const ok = await profileRepository.updateCpf(user.id, mutation.cpf.replace(/\D/g, ''));
      return NextResponse.json(
        { ok, message: ok ? 'CPF salvo.' : 'Usuário não encontrado.' },
        { status: ok ? 200 : 404, headers: noStoreHeaders() }
      );
    }

    const normalizedPassword = mutation.newPassword.normalize('NFC');
    await profileRepository.changePassword(user.id, mutation.currentPassword, normalizedPassword);
    const response = NextResponse.json(
      {
        ok: true,
        message: 'Senha alterada. Entre novamente com a nova senha.',
        reauthenticationRequired: true,
      },
      { headers: noStoreHeaders() }
    );
    return authService.clearSessionCookies(response);
  } catch (error) {
    if (error instanceof CurrentPasswordInvalidError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    if (error instanceof InvalidNewPasswordError) {
      return NextResponse.json(
        { ok: false, message: error.message },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    if (error instanceof RequestSecurityError) {
      return NextResponse.json(
        { ok: false, message: error.message, code: error.code },
        { status: error.status, headers: noStoreHeaders() }
      );
    }
    console.error('[PATCH /api/v1/profile]', error);
    return NextResponse.json(
      { ok: false, message: 'Erro ao atualizar o perfil.' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
