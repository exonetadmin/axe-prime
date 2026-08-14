import { redirect } from 'next/navigation';

import { getAuthenticatedUser } from '@/lib/auth';
import PortalClient from './portal-client';
import PortalShell from './portal-shell';
import PortalAutoRefresh from './portal-auto-refresh';

export const dynamic = 'force-dynamic';

export default async function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthenticatedUser();

  if (!user) {
    redirect('/auth');
  }

  const firstName = user.name?.split(' ')[0] ?? user.name;

  return (
    <PortalClient firstName={firstName}>
      <PortalAutoRefresh />
      <PortalShell>{children}</PortalShell>
    </PortalClient>
  );
}
