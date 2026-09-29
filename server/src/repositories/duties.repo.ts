import { getDb } from '../db/index.js';
import { nowISO } from '../lib/dates.js';
import type { DutyRow, DutyStatus, PublicDuty, Role } from '../lib/types.js';

export interface DutyJoinRow extends DutyRow {
  u_first_name: string;
  u_last_name: string;
  u_role: Role;
  r_first_name: string | null;
  r_last_name: string | null;
  ub_id: number | null;
  ub_first_name: string | null;
  ub_last_name: string | null;
  ub_role: Role | null;
}

const SELECT_WITH_NAMES = `
  SELECT d.*,
         u.first_name AS u_first_name,
         u.last_name  AS u_last_name,
         u.role       AS u_role,
         r.first_name AS r_first_name,
         r.last_name  AS r_last_name,
         ub.id        AS ub_id,
         ub.first_name AS ub_first_name,
         ub.last_name AS ub_last_name,
         ub.role      AS ub_role
  FROM duties d
  JOIN users u ON u.id = d.user_id
  LEFT JOIN users r ON r.id = d.replacement_user_id
  LEFT JOIN users ub ON ub.id = d.updated_by
`;

function map(row: DutyJoinRow): PublicDuty {
  return {
    id: row.id,
    date: row.date,
    userId: row.user_id,
    status: row.status,
    replacementUserId: row.replacement_user_id,
    replacementName: row.r_first_name ? `${row.r_last_name} ${row.r_first_name}` : null,
    comment: row.comment,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    updatedBy:
      row.ub_id && row.ub_first_name
        ? {
            id: row.ub_id,
            fullName: `${row.ub_last_name} ${row.ub_first_name}`,
            role: row.ub_role as Role,
          }
        : null,
    user: {
      id: row.user_id,
      firstName: row.u_first_name,
      lastName: row.u_last_name,
      fullName: `${row.u_last_name} ${row.u_first_name}`,
      role: row.u_role,
    },
  };
}

export interface ListFilter {
  from?: string;
  to?: string;
  userId?: number;
}

export function listDuties(filter: ListFilter = {}): PublicDuty[] {
  const where: string[] = [];
  const params: (string | number)[] = [];

  if (filter.from) {
    where.push('d.date >= ?');
    params.push(filter.from);
  }
  if (filter.to) {
    where.push('d.date <= ?');
    params.push(filter.to);
  }
  if (filter.userId !== undefined) {
    where.push('d.user_id = ?');
    params.push(filter.userId);
  }

  const sql = `${SELECT_WITH_NAMES} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY d.date ASC, u.last_name COLLATE NOCASE ASC`;
  return getDb().all<DutyJoinRow>(sql, ...params).map(map);
}

export function findDutyById(id: number): PublicDuty | undefined {
  const row = getDb().get<DutyJoinRow>(`${SELECT_WITH_NAMES} WHERE d.id = ?`, id);
  return row ? map(row) : undefined;
}

export function findDuty(date: string, userId: number): PublicDuty | undefined {
  const row = getDb().get<DutyJoinRow>(`${SELECT_WITH_NAMES} WHERE d.date = ? AND d.user_id = ?`, date, userId);
  return row ? map(row) : undefined;
}

export function createDuty(input: {
  date: string;
  userId: number;
  status?: DutyStatus;
  replacementUserId?: number | null;
  comment?: string | null;
  actorId: number;
}): PublicDuty {
  const db = getDb();
  const ts = nowISO();
  const status = input.status ?? 'ASSIGNED';
  const { lastInsertRowid } = db.run(
    `INSERT INTO duties (date, user_id, status, replacement_user_id, comment, created_by, updated_by, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    input.date,
    input.userId,
    status,
    input.replacementUserId ?? null,
    input.comment ?? null,
    input.actorId,
    input.actorId,
    ts,
    ts,
  );
  return findDutyById(lastInsertRowid)!;
}

export function updateDuty(
  id: number,
  patch: {
    status?: DutyStatus;
    replacementUserId?: number | null;
    comment?: string | null;
    userId?: number;
    date?: string;
  },
  actorId: number,
): PublicDuty | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: (string | number | null)[] = [];

  if (patch.status !== undefined) {
    sets.push('status = ?');
    params.push(patch.status);
  }
  if (patch.replacementUserId !== undefined) {
    sets.push('replacement_user_id = ?');
    params.push(patch.replacementUserId);
  }
  if (patch.comment !== undefined) {
    sets.push('comment = ?');
    params.push(patch.comment);
  }
  if (patch.userId !== undefined) {
    sets.push('user_id = ?');
    params.push(patch.userId);
  }
  if (patch.date !== undefined) {
    sets.push('date = ?');
    params.push(patch.date);
  }
  if (sets.length === 0) return findDutyById(id);

  sets.push('updated_at = ?', 'updated_by = ?');
  params.push(nowISO(), actorId, id);
  db.run(`UPDATE duties SET ${sets.join(', ')} WHERE id = ?`, ...params);
  return findDutyById(id);
}

export function deleteDuty(id: number): number {
  return getDb().run('DELETE FROM duties WHERE id = ?', id).changes;
}

export function countByStatusForDate(date: string): Record<string, number> {
  const rows = getDb().all<{ status: string; n: number }>(
    'SELECT status, COUNT(*) AS n FROM duties WHERE date = ? GROUP BY status',
    date,
  );
  const acc: Record<string, number> = {};
  for (const r of rows) acc[r.status] = r.n;
  return acc;
}

export function studentStats(userId: number): {
  assigned: number;
  done: number;
  missed: number;
  sick: number;
  replaced: number;
  planned: number;
} {
  const row = getDb().get<Record<string, number>>(
    `SELECT
       COUNT(*) AS assigned,
       SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done,
       SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) AS missed,
       SUM(CASE WHEN status = 'SICK' THEN 1 ELSE 0 END) AS sick,
       SUM(CASE WHEN status = 'REPLACED' THEN 1 ELSE 0 END) AS replaced,
       SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) AS planned
     FROM duties WHERE user_id = ?`,
    userId,
  );
  return {
    assigned: row?.assigned ?? 0,
    done: row?.done ?? 0,
    missed: row?.missed ?? 0,
    sick: row?.sick ?? 0,
    replaced: row?.replaced ?? 0,
    planned: row?.planned ?? 0,
  };
}

export function classStats(from: string, to: string): {
  totalAssignments: number;
  done: number;
  missed: number;
  sick: number;
  replaced: number;
  planned: number;
} {
  const row = getDb().get<Record<string, number>>(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done,
       SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) AS missed,
       SUM(CASE WHEN status = 'SICK' THEN 1 ELSE 0 END) AS sick,
       SUM(CASE WHEN status = 'REPLACED' THEN 1 ELSE 0 END) AS replaced,
       SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) AS planned
     FROM duties WHERE date BETWEEN ? AND ?`,
    from,
    to,
  );
  return {
    totalAssignments: row?.total ?? 0,
    done: row?.done ?? 0,
    missed: row?.missed ?? 0,
    sick: row?.sick ?? 0,
    replaced: row?.replaced ?? 0,
    planned: row?.planned ?? 0,
  };
}

export function perStudentStats(from: string, to: string): {
  userId: number;
  assigned: number;
  done: number;
  missed: number;
  sick: number;
  replaced: number;
  planned: number;
}[] {
  return getDb().all<{
    user_id: number;
    assigned: number;
    done: number;
    missed: number;
    sick: number;
    replaced: number;
    planned: number;
  }>(
    `SELECT user_id,
            COUNT(*) AS assigned,
            SUM(CASE WHEN status = 'DONE' THEN 1 ELSE 0 END) AS done,
            SUM(CASE WHEN status = 'MISSED' THEN 1 ELSE 0 END) AS missed,
            SUM(CASE WHEN status = 'SICK' THEN 1 ELSE 0 END) AS sick,
            SUM(CASE WHEN status = 'REPLACED' THEN 1 ELSE 0 END) AS replaced,
            SUM(CASE WHEN status = 'ASSIGNED' THEN 1 ELSE 0 END) AS planned
     FROM duties WHERE date BETWEEN ? AND ?
     GROUP BY user_id`,
    from,
    to,
  ).map((r) => ({
    userId: r.user_id,
    assigned: r.assigned,
    done: r.done,
    missed: r.missed,
    sick: r.sick,
    replaced: r.replaced,
    planned: r.planned,
  }));
}

export function nextDutyFor(userId: number, fromDate: string): PublicDuty | undefined {
  const row = getDb().get<DutyJoinRow>(
    `${SELECT_WITH_NAMES} WHERE d.user_id = ? AND d.date >= ? ORDER BY d.date ASC LIMIT 1`,
    userId,
    fromDate,
  );
  return row ? map(row) : undefined;
}

export function lastDutyFor(userId: number, beforeDate: string): PublicDuty | undefined {
  const row = getDb().get<DutyJoinRow>(
    `${SELECT_WITH_NAMES} WHERE d.user_id = ? AND d.date < ? ORDER BY d.date DESC LIMIT 1`,
    userId,
    beforeDate,
  );
  return row ? map(row) : undefined;
}

/** Замены: назначение, где фактически дежурил другой человек */
export function findReplacementConflict(date: string, userId: number, excludeDutyId?: number): boolean {
  const row = getDb().get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM duties
     WHERE date = ? AND (user_id = ? OR replacement_user_id = ?)
       AND (? IS NULL OR id != ?)`,
    date,
    userId,
    userId,
    excludeDutyId ?? null,
    excludeDutyId ?? null,
  );
  return (row?.n ?? 0) > 0;
}
