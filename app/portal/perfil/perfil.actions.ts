'use server';

/**
 * Portal Profile Actions — Salva alterações de perfil no banco.
 * Avatar (upload Supabase Storage), nome, CPF, senha.
 */

import { revalidatePath } from 'next/cache';
import bcrypt from 'bcryptjs';
import { supabase } from '@/lib/supabase';
import { getAuthenticatedUser } from '@/lib/auth';

export async function updateProfileNameAction(
  name: string
): Promise<{ ok: boolean; message: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Não autenticado.' };
  if (!name || name.trim().length < 2) return { ok: false, message: 'Nome deve ter ao menos 2 caracteres.' };

  const { error } = await supabase
    .from('users')
    .update({ name: name.trim() })
    .eq('id', user.id);

  if (error) {
    console.error('[updateProfileNameAction]', error);
    return { ok: false, message: 'Erro ao salvar nome.' };
  }

  revalidatePath('/portal', 'layout');
  revalidatePath('/portal/perfil');
  return { ok: true, message: 'Nome atualizado.' };
}

export async function updateProfilePhoneAction(
  phone: string
): Promise<{ ok: boolean; message: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Não autenticado.' };

  const digits = phone.replace(/\D/g, '');
  if (digits.length < 10 || digits.length > 11) {
    return { ok: false, message: 'Telefone inválido. Use (XX) XXXXX-XXXX.' };
  }

  const { error } = await supabase
    .from('users')
    .update({ phone: phone.trim() })
    .eq('id', user.id);

  if (error) {
    console.error('[updateProfilePhoneAction]', error);
    return { ok: false, message: 'Erro ao salvar telefone.' };
  }

  revalidatePath('/portal/perfil');
  return { ok: true, message: 'Telefone atualizado.' };
}

export async function updateProfileCpfAction(
  cpf: string
): Promise<{ ok: boolean; message: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Não autenticado.' };

  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return { ok: false, message: 'CPF inválido.' };

  const { error } = await supabase
    .from('users')
    .update({ cpf: digits })
    .eq('id', user.id);

  if (error) {
    console.error('[updateProfileCpfAction]', error);
    return { ok: false, message: 'Erro ao salvar CPF.' };
  }

  revalidatePath('/portal/perfil');
  return { ok: true, message: 'CPF salvo.' };
}

export async function updateProfilePasswordAction(
  currentPassword: string,
  newPassword: string
): Promise<{ ok: boolean; message: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Não autenticado.' };
  if (newPassword.length < 8) return { ok: false, message: 'Senha deve ter ao menos 8 caracteres.' };

  // Busca hash atual
  const { data } = await supabase
    .from('users')
    .select('password_hash')
    .eq('id', user.id)
    .maybeSingle();

  if (!data?.password_hash) return { ok: false, message: 'Usuário não encontrado.' };

  const valid = await bcrypt.compare(currentPassword, data.password_hash);
  if (!valid) return { ok: false, message: 'Senha atual incorreta.' };

  const newHash = await bcrypt.hash(newPassword, 12);
  const { error } = await supabase
    .from('users')
    .update({ password_hash: newHash })
    .eq('id', user.id);

  if (error) {
    console.error('[updateProfilePasswordAction]', error);
    return { ok: false, message: 'Erro ao alterar senha.' };
  }

  return { ok: true, message: 'Senha alterada com sucesso.' };
}

export async function updateProfileAvatarAction(
  avatarBase64: string,
  mimeType: string
): Promise<{ ok: boolean; message: string; url?: string }> {
  const user = await getAuthenticatedUser();
  if (!user) return { ok: false, message: 'Não autenticado.' };

  // Decode base64
  const buffer = Buffer.from(avatarBase64, 'base64');
  if (buffer.byteLength > 5 * 1024 * 1024) {
    return { ok: false, message: 'Arquivo muito grande. Máximo 5 MB.' };
  }

  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  const path = `avatars/${user.id}.${ext}`;

  // Upload para Supabase Storage
  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, buffer, {
      contentType: mimeType,
      upsert: true,
    });

  if (uploadError) {
    console.error('[updateProfileAvatarAction] upload error:', uploadError);
    return { ok: false, message: 'Erro ao fazer upload da foto.' };
  }

  // Gera URL pública
  const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
  const publicUrl = urlData?.publicUrl
    ? `${urlData.publicUrl}?v=${Date.now()}`
    : null;

  if (publicUrl) {
    await supabase
      .from('users')
      .update({ avatar_url: publicUrl })
      .eq('id', user.id);
  }

  revalidatePath('/portal', 'layout');
  revalidatePath('/portal/perfil');
  return { ok: true, message: 'Foto atualizada.', url: publicUrl ?? undefined };
}
