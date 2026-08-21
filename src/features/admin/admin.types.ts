/**
 * Admin Feature – Types & RBAC Definitions
 *
 * Isolated from the client auth feature. Admin sessions use separate signed
 * access and opaque refresh credentials and never share portal authorization.
 */

export type AdminRole = 'master' | 'financeiro' | 'suporte';

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
};

/** Identity bound to the exact credential version that passed password verification. */
export type AuthenticatedAdminUser = AdminUser & {
  tokenVersion: number;
};

/** All navigable module keys in the admin panel */
export type AdminModule =
  | 'dashboard'
  | 'usuarios'
  | 'saques'
  | 'pix'
  | 'extrato'
  | 'comissoes'
  | 'cashback'
  | 'rede'
  | 'configuracoes'
  | 'planos';

/** Which modules each role can access */
export const ROLE_PERMISSIONS: Record<AdminRole, AdminModule[]> = {
  master: [
    'dashboard',
    'usuarios',
    'saques',
    'pix',
    'extrato',
    'comissoes',
    'cashback',
    'rede',
    'configuracoes',
    'planos',
  ],
  financeiro: ['dashboard', 'saques', 'pix', 'extrato', 'planos'],
  suporte: ['dashboard', 'usuarios'],
};

export const ROLE_LABELS: Record<AdminRole, string> = {
  master: 'Master / Admin',
  financeiro: 'Financeiro',
  suporte: 'Suporte',
};

/** Check if a role has access to a given module */
export function canAccess(role: AdminRole, module: AdminModule): boolean {
  return ROLE_PERMISSIONS[role].includes(module);
}
