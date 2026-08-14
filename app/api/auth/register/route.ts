import { NextResponse } from 'next/server';
import { authService } from '../../../../src/features/auth';
import {
  EmailExistsError,
  InvalidReferralCodeError,
  ValidationError,
} from '../../../../src/features/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { name, email, password, phone, planInterest, referralCode } = body;

    // Validate required fields
    if (!name || !email || !password) {
      return NextResponse.json(
        { error: 'Nome, e-mail e senha são obrigatórios.' },
        { status: 400 }
      );
    }

    if (!phone || typeof phone !== 'string' || phone.replace(/\D/g, '').length < 10) {
      return NextResponse.json(
        { error: 'Telefone celular é obrigatório.' },
        { status: 400 }
      );
    }

    if (!referralCode || typeof referralCode !== 'string' || !referralCode.trim()) {
      return NextResponse.json(
        { error: 'Código do patrocinador é obrigatório.' },
        { status: 400 }
      );
    }

    // planInterest is now optional — selected during KYC step
    const validPlans = ['start', 'prime', 'elite'] as const;
    const safePlan = planInterest && validPlans.includes(planInterest) ? planInterest : null;

    const authResult = await authService.register({
      name,
      email,
      password,
      phone: phone.trim(),
      planInterest: safePlan,
      referralCode: referralCode.trim(),
    });

    // Create response with session cookie
    const response = NextResponse.json({
      success: true,
      message: 'Cadastro realizado com sucesso.',
      user: authResult.user,
    });

    // Attach session cookie
    await authService.attachSessionCookie(response, authResult);

    return response;
  } catch (error: unknown) {
    if (error instanceof EmailExistsError) {
      return NextResponse.json(
        { error: 'Este e-mail já está cadastrado.' },
        { status: 409 }
      );
    }

    if (error instanceof InvalidReferralCodeError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    if (error instanceof ValidationError) {
      return NextResponse.json(
        { error: error.message },
        { status: 400 }
      );
    }

    console.error('[Auth] Registration error:', error);
    return NextResponse.json(
      { error: 'Erro interno do servidor.' },
      { status: 500 }
    );
  }
}
