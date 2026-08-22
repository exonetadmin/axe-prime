import '@/src/server/server-only';

import type { PoolClient } from 'pg';
import { withTransaction } from '@/src/server/db/postgres';

export type SecurityAuditEvent = {
  category: 'authentication' | 'authorization' | 'account' | 'financial' | 'configuration';
  action: string;
  outcome: 'success' | 'failure' | 'denied';
  actorType: 'user' | 'admin' | 'system' | 'anonymous';
  actorId?: string | null;
  subjectType?: string | null;
  subjectId?: string | null;
  metadata?: Record<string, boolean | number | string | null>;
};

function validateEvent(event: SecurityAuditEvent): void {
  if (!/^[a-z0-9:_-]{1,80}$/.test(event.action)) {
    throw new Error('Audit action has an invalid format');
  }
  const encoded = JSON.stringify(event.metadata ?? {});
  if (Buffer.byteLength(encoded, 'utf8') > 7_500) {
    throw new Error('Audit metadata exceeds the application limit');
  }
}

export async function appendSecurityAuditEvent(
  client: PoolClient,
  event: SecurityAuditEvent
): Promise<void> {
  validateEvent(event);
  await client.query(
    `INSERT INTO public.security_audit_events (
       category, action, outcome, actor_type, actor_id,
       subject_type, subject_id, metadata
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)`,
    [
      event.category,
      event.action,
      event.outcome,
      event.actorType,
      event.actorId ?? null,
      event.subjectType ?? null,
      event.subjectId ?? null,
      JSON.stringify(event.metadata ?? {}),
    ]
  );
}

export async function recordSecurityAuditEvent(event: SecurityAuditEvent): Promise<void> {
  await withTransaction(client => appendSecurityAuditEvent(client, event));
}

/** Logging must not leak details or turn a transient sink failure into account lockout. */
export async function tryRecordSecurityAuditEvent(event: SecurityAuditEvent): Promise<boolean> {
  try {
    await recordSecurityAuditEvent(event);
    return true;
  } catch {
    console.error('[Security Audit] Failed to persist an audit event');
    return false;
  }
}
