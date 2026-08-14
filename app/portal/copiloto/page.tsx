import { getAuthenticatedUser } from '@/lib/auth';
import { configRepository } from '@/src/features/admin/config.repository';
import CopiloClient from './copiloto-client';

export const dynamic = 'force-dynamic';

export default async function CopiloPage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  const persona = await configRepository.getPersona(user.id);

  return (
    <CopiloClient
      userName={user.name ?? 'você'}
      userId={user.id}
      initialPersona={{
        display_name: persona.display_name,
        style: persona.style,
        tone: persona.tone,
      }}
    />
  );
}
