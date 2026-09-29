import { getDb } from '../db/index.js';
import { nowISO } from '../lib/dates.js';
import type { AuditEntry, DutyRow, Role, UserRow } from '../lib/types.js';

export interface Actor {
  id: number;
  fullName: string;
  role: Role;
}

export function actorFrom(row: UserRow): Actor {
  return { id: row.id, fullName: `${row.last_name} ${row.first_name}`, role: row.role };
}

export function logAction(input: {
  actor: Actor;
  action: string;
  entityType: 'duty' | 'user' | 'auth';
  entityId?: number | null;
  summary: string;
  details?: Record<string, unknown> | null;
}): void {
  getDb().run(
    `INSERT INTO audit_log (actor_id, actor_name, actor_role, action, entity_type, entity_id, summary, details, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.actor.id,
    input.actor.fullName,
    input.actor.role,
    input.action,
    input.entityType,
    input.entityId ?? null,
    input.summary,
    input.details ? JSON.stringify(input.details) : null,
    nowISO(),
  );
}

export function listAudit(limit: number, offset: number): { total: number; items: AuditEntry[] } {
  const db = getDb();
  const total = db.scalar<number>('SELECT COUNT(*) FROM audit_log') ?? 0;
  const rows = db.all<Record<string, unknown>>(
    'SELECT * FROM audit_log ORDER BY datetime(created_at) DESC, id DESC LIMIT ? OFFSET ?',
    limit,
    offset,
  );
  return {
    total,
    items: rows.map((r) => ({
      id: r.id as number,
      actorId: (r.actor_id as number) ?? null,
      actorName: r.actor_name as string,
      actorRole: r.actor_role as Role,
      action: r.action as string,
      entityType: r.entity_type as string,
      entityId: (r.entity_id as number) ?? null,
      summary: r.summary as string,
      details: r.details ? (JSON.parse(r.details as string) as Record<string, unknown>) : null,
      createdAt: r.created_at as string,
    })),
  };
}
