import 'server-only';

import { createSupabaseServerClient } from '@/lib/supabase/server';
import type { Json, UserRole } from '@/types/database';

export interface AuditEntry {
  actorId: string;
  actorRole: UserRole;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Record<string, Json>;
}

/**
 * Appends an audit row (§37). Deliberately best-effort: an audit failure must
 * never roll back the action the teacher actually asked for, so the error is
 * logged server-side and swallowed.
 *
 * Never pass passwords, tokens or answer content in `metadata`.
 */
export async function recordAudit(entry: AuditEntry): Promise<void> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from('audit_logs').insert({
      actor_id: entry.actorId,
      actor_role: entry.actorRole,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      summary: entry.summary,
      metadata: (entry.metadata ?? {}) as Json,
    });
    if (error) console.error('[audit] insert failed', error.message);
  } catch (cause) {
    console.error('[audit] insert threw', cause);
  }
}
