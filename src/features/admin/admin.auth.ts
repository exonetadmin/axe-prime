/**
 * Admin Auth – Server-Side Session Helpers
 *
 * Uses an isolated `admin_session` cookie — completely separate from the
 * client portal session.
 *
 * Credentials are now stored in the `admin_users` table (via configRepository).
 * Use the Configurações > Administradores panel to manage users.
 */

import { cookies } from 'next/headers';
import type { AdminUser, AdminRole } from './admin.types';

const ADMIN_SESSION_COOKIE = 'admin_session';
const ADMIN_SESSION_MAX_AGE = 60 * 60 * 8; // 8 hours

/** Minimal session payload stored in signed cookie */
type AdminSessionPayload = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  issuedAt: number;
};

function encode(payload: AdminSessionPayload): string {
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

function decode(token: string): AdminSessionPayload | null {
  try {
    return JSON.parse(Buffer.from(token, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

/** Validate credentials against the admin_users DB table */
export async function validateAdminCredentials(
  email: string,
  password: string
): Promise<AdminUser | null> {
  const { configRepository } = await import('./config.repository');
  const row = await configRepository.validateCredentials(email, password);
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role as AdminRole,
  };
}

/** Write admin session cookie (call from a Server Action) */
export async function createAdminSession(user: AdminUser): Promise<void> {
  const payload: AdminSessionPayload = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    issuedAt: Date.now(),
  };
  const jar = await cookies();
  jar.set(ADMIN_SESSION_COOKIE, encode(payload), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: ADMIN_SESSION_MAX_AGE,
    path: '/admin',
  });
}

/** Read and validate the admin session cookie */
export async function getAdminSession(): Promise<AdminUser | null> {
  const jar = await cookies();
  const raw = jar.get(ADMIN_SESSION_COOKIE)?.value;
  if (!raw) return null;

  const payload = decode(raw);
  if (!payload) return null;

  const maxMs = ADMIN_SESSION_MAX_AGE * 1000;
  if (Date.now() - payload.issuedAt > maxMs) return null;

  return { id: payload.id, name: payload.name, email: payload.email, role: payload.role };
}

/** Destroy the admin session cookie (Server Action) */
export async function destroyAdminSession(): Promise<void> {
  const jar = await cookies();
  jar.delete(ADMIN_SESSION_COOKIE);
}
