import { NextResponse } from 'next/server';
import { getAdminFromBearer, getAdminSession } from '@/src/features/admin/admin.auth';
import { canAccess } from '@/src/features/admin/admin.types';
import { validAvatarRouteUserId } from '@/src/features/profile/avatar-url';
import { profileRepository } from '@/src/features/profile/profile.repository';
import { noStoreHeaders } from '@/src/server/security/request';

export async function GET(request: Request, context: { params: Promise<{ userId: string }> }) {
  const admin = (await getAdminSession()) ?? (await getAdminFromBearer(request));
  if (!admin) {
    return NextResponse.json(
      { error: 'Não autenticado' },
      {
        status: 401,
        headers: {
          ...noStoreHeaders(),
          'WWW-Authenticate': 'Bearer realm="axe-prime-admin"',
        },
      }
    );
  }
  if (!canAccess(admin.role, 'rede')) {
    return NextResponse.json(
      { error: 'Sem permissão' },
      { status: 403, headers: noStoreHeaders() }
    );
  }

  const params = await context.params;
  const userId = validAvatarRouteUserId(params.userId);
  if (!userId) {
    return new NextResponse(null, { status: 404, headers: noStoreHeaders() });
  }
  const avatar = await profileRepository.getAvatar(userId);
  if (!avatar) return new NextResponse(null, { status: 404, headers: noStoreHeaders() });

  const etag = `"${avatar.sha256}"`;
  const protectedCacheHeaders = {
    'Cache-Control': 'private, no-cache',
    'Content-Security-Policy': "default-src 'none'; sandbox",
    'X-Content-Type-Options': 'nosniff',
    Vary: 'Cookie, Authorization',
    ETag: etag,
  };
  if (request.headers.get('if-none-match') === etag) {
    return new NextResponse(null, { status: 304, headers: protectedCacheHeaders });
  }
  return new NextResponse(new Uint8Array(avatar.data), {
    headers: {
      ...protectedCacheHeaders,
      'Content-Type': avatar.content_type,
      'Content-Length': String(avatar.data.byteLength),
    },
  });
}
