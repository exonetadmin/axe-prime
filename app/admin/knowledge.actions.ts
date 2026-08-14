'use server';

import { revalidatePath } from 'next/cache';
import { configRepository } from '@/src/features/admin/config.repository';

const REVALIDATE = () => revalidatePath('/admin/conhecimento');

export async function createKnowledgeAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const category = (formData.get('category') as string | null)?.trim();
  const customCat = (formData.get('customCategory') as string | null)?.trim();
  const title   = (formData.get('title')   as string | null)?.trim();
  const content = (formData.get('content') as string | null)?.trim();

  const resolvedCategory = (customCat || category || '').trim();

  if (!resolvedCategory) return { ok: false, message: 'Categoria obrigatória.' };
  if (!title)   return { ok: false, message: 'Título obrigatório.' };
  if (!content) return { ok: false, message: 'Conteúdo obrigatório.' };
  if (content.length > 8000) return { ok: false, message: 'Conteúdo máximo: 8.000 caracteres.' };

  try {
    await configRepository.createKnowledge(resolvedCategory, title, content);
    REVALIDATE();
    return { ok: true, message: 'Conhecimento criado com sucesso.' };
  } catch (err) {
    console.error('[createKnowledgeAction]', err);
    return { ok: false, message: 'Erro ao salvar. Tente novamente.' };
  }
}

export async function updateKnowledgeAction(
  _prev: { ok: boolean; message: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; message: string }> {
  const id      = (formData.get('id')       as string | null)?.trim();
  const category = (formData.get('category') as string | null)?.trim();
  const customCat = (formData.get('customCategory') as string | null)?.trim();
  const title   = (formData.get('title')   as string | null)?.trim();
  const content = (formData.get('content') as string | null)?.trim();
  const active  = formData.get('active') === '1' ? 1 : 0;

  const resolvedCategory = (customCat || category || '').trim();

  if (!id)               return { ok: false, message: 'ID inválido.' };
  if (!resolvedCategory) return { ok: false, message: 'Categoria obrigatória.' };
  if (!title)            return { ok: false, message: 'Título obrigatório.' };
  if (!content)          return { ok: false, message: 'Conteúdo obrigatório.' };

  try {
    await configRepository.updateKnowledge(id, resolvedCategory, title, content, active === 1);
    REVALIDATE();
    return { ok: true, message: 'Conhecimento atualizado.' };
  } catch (err) {
    console.error('[updateKnowledgeAction]', err);
    return { ok: false, message: 'Erro ao salvar. Tente novamente.' };
  }
}

export async function deleteKnowledgeAction(id: string): Promise<void> {
  await configRepository.deleteKnowledge(id);
  REVALIDATE();
}

export async function toggleKnowledgeAction(id: string, active: number): Promise<void> {
  await configRepository.toggleKnowledge(id, active === 1);
  REVALIDATE();
}
