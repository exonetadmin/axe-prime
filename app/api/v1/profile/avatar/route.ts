import { NextResponse } from 'next/server';
import { authService } from '@/src/features/auth';
import {
  AvatarDecodeBusyError,
  inspectDecodableAvatarImage,
} from '@/src/features/profile/avatar-validation';
import { profileRepository } from '@/src/features/profile/profile.repository';
import { authRateLimiter, type RateLimitPolicy } from '@/src/server/security/rate-limit';
import {
  assertMutationSecurity,
  noStoreHeaders,
  readRequestBodyWithLimit,
  RequestSecurityError,
} from '@/src/server/security/request';

const MAX_SIZE_BYTES = 5 * 1024 * 1024;
const MAX_MULTIPART_BODY_BYTES = MAX_SIZE_BYTES + 128 * 1024;
const AVATAR_UPLOAD_RATE_LIMITS = {
  global: { limit: 120, windowSeconds: 60, blockSeconds: 60 },
  user: { limit: 10, windowSeconds: 10 * 60, blockSeconds: 10 * 60 },
} satisfies Record<string, RateLimitPolicy>;

function securityError(error: unknown): NextResponse | null {
  if (!(error instanceof RequestSecurityError)) return null;
  return NextResponse.json(
    { error: error.message, code: error.code },
    { status: error.status, headers: noStoreHeaders() }
  );
}

async function enforceUploadRateLimit(userId: string): Promise<NextResponse | null> {
  const globalDecision = await authRateLimiter.consume(
    'avatar-upload-global',
    'all',
    AVATAR_UPLOAD_RATE_LIMITS.global
  );
  const decision = globalDecision.allowed
    ? await authRateLimiter.consume('avatar-upload-user', userId, AVATAR_UPLOAD_RATE_LIMITS.user)
    : globalDecision;
  if (decision.allowed) return null;
  return NextResponse.json(
    { error: 'Muitos envios de avatar. Aguarde e tente novamente.', code: 'RATE_LIMITED' },
    {
      status: 429,
      headers: { ...noStoreHeaders(), 'Retry-After': String(decision.retryAfterSeconds) },
    }
  );
}

export async function POST(request: Request) {
  try {
    assertMutationSecurity(request);
    const user = await authService.authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401, headers: noStoreHeaders() }
      );
    }

    const rateLimitResponse = await enforceUploadRateLimit(user.id);
    if (rateLimitResponse) return rateLimitResponse;

    const multipartContentType = request.headers.get('content-type') ?? '';
    if (!/^multipart\/form-data(?:\s*;|$)/i.test(multipartContentType)) {
      throw new RequestSecurityError(
        'Content-Type must be multipart/form-data',
        415,
        'UNSUPPORTED_MEDIA_TYPE'
      );
    }

    const body = await readRequestBodyWithLimit(request, MAX_MULTIPART_BODY_BYTES);
    let formData: FormData;
    try {
      formData = await new Request(request.url, {
        method: 'POST',
        headers: { 'content-type': multipartContentType },
        body: Uint8Array.from(body),
      }).formData();
    } catch {
      return NextResponse.json(
        { error: 'Formulário multipart inválido' },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    const file = formData.get('avatar');
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { error: 'Nenhum arquivo enviado' },
        { status: 400, headers: noStoreHeaders() }
      );
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: 'Arquivo muito grande. Máximo 5 MB.' },
        { status: 413, headers: noStoreHeaders() }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const inspection = await inspectDecodableAvatarImage(buffer);
    if (!inspection) {
      return NextResponse.json(
        {
          error: 'Imagem inválida ou fora dos limites. Use JPEG, PNG, WebP ou GIF estático.',
        },
        { status: 400, headers: noStoreHeaders() }
      );
    }

    const avatarUrl = await profileRepository.saveAvatar(user.id, inspection.contentType, buffer);
    return NextResponse.json({ avatarUrl }, { headers: noStoreHeaders() });
  } catch (error) {
    if (error instanceof AvatarDecodeBusyError) {
      return NextResponse.json(
        { error: 'Processamento de imagem ocupado. Tente novamente.', code: 'RATE_LIMITED' },
        { status: 429, headers: { ...noStoreHeaders(), 'Retry-After': '1' } }
      );
    }
    const response = securityError(error);
    if (response) return response;
    console.error('[POST /api/v1/profile/avatar]', error);
    return NextResponse.json(
      { error: 'Erro ao salvar a foto.' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}

export async function DELETE(request: Request) {
  try {
    assertMutationSecurity(request);
    const user = await authService.authenticateRequest(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Não autenticado' },
        { status: 401, headers: noStoreHeaders() }
      );
    }
    await profileRepository.deleteAvatar(user.id);
    return NextResponse.json({ ok: true }, { headers: noStoreHeaders() });
  } catch (error) {
    const response = securityError(error);
    if (response) return response;
    console.error('[DELETE /api/v1/profile/avatar]', error);
    return NextResponse.json(
      { error: 'Erro ao remover a foto.' },
      { status: 500, headers: noStoreHeaders() }
    );
  }
}
