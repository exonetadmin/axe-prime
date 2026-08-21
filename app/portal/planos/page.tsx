import { redirect } from 'next/navigation';
import { authService } from '@/src/features/auth';
import { planRequestsRepository } from '@/src/features/plans/plan-requests.repository';
import PlanosClient from './planos-client';

export const metadata = { title: 'Meus Planos | AXE PRIME' };

export default async function PlanosPage() {
  const user = await authService.getCurrentUser();
  if (!user) redirect('/auth');

  const [kycSubmitted, pendingRequest] = await Promise.all([
    planRequestsRepository.hasSubmittedKyc(user.id),
    planRequestsRepository.getUserPendingRequest(user.id),
  ]);

  return (
    <PlanosClient
      user={user}
      kycSubmitted={kycSubmitted}
      pendingRequest={pendingRequest}
    />
  );
}
