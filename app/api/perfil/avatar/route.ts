/**
 * POST /api/perfil/avatar  — upload de foto de perfil (Supabase Storage)
 * DELETE /api/perfil/avatar — remove foto de perfil
 */

import { NextRequest, NextResponse } from 'next/server';
import { authService } from '@/src/features/auth';
import { supabase } from '@/lib/supabase';

const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

async function getUser() {
  return authService.getCurrentUser();
}

export async function POST(req: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get('avatar') as File | null;

  if (!file || file.size === 0) {
    return NextResponse.json({ error: 'Nenhum arquivo enviado' }, { status: 400 });
  }
  if (!ALLOWED_TYPES.includes(file.type)) {
    return NextResponse.json({ error: 'Formato inválido. Use JPEG, PNG, WebP ou GIF.' }, { status: 400 });
  }
  if (file.size > MAX_SIZE_BYTES) {
    return NextResponse.json({ error: 'Arquivo muito grande. Máximo 5 MB.' }, { status: 400 });
  }

  // Determina extensão
  const ext =
    file.type === 'image/png' ? 'png'
    : file.type === 'image/webp' ? 'webp'
    : file.type === 'image/gif' ? 'gif'
    : 'jpg';
  const storagePath = `${user.id}.${ext}`;

  // Upload para Supabase Storage (bucket: avatars)
  const bytes = await file.arrayBuffer();
  const buffer = Buffer.from(bytes);

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(storagePath, buffer, {
      contentType: file.type,
      upsert: true,
    });

  if (uploadError) {
    console.error('[POST /api/perfil/avatar] upload error:', uploadError);
    return NextResponse.json(
      { error: 'Erro ao fazer upload da foto. Verifique se o bucket "avatars" existe no Supabase.' },
      { status: 500 }
    );
  }

  // Gera URL pública com cache buster
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(storagePath);
  const avatarUrl = urlData?.publicUrl
    ? `${urlData.publicUrl}?v=${Date.now()}`
    : null;

  if (avatarUrl) {
    await supabase
      .from('users')
      .update({ avatar_url: avatarUrl })
      .eq('id', user.id);
  }

  return NextResponse.json({ avatarUrl });
}

export async function DELETE() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Não autenticado' }, { status: 401 });
  }

  // Tenta remover possíveis extensões
  const extensions = ['jpg', 'png', 'webp', 'gif'];
  for (const ext of extensions) {
    await supabase.storage.from('avatars').remove([`${user.id}.${ext}`]);
  }

  await supabase
    .from('users')
    .update({ avatar_url: null })
    .eq('id', user.id);

  return NextResponse.json({ ok: true });
}
