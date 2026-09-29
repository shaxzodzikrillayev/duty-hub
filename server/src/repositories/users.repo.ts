import { getDb } from '../db/index.js';
import { nowISO } from '../lib/dates.js';
import type { PublicUser, Role, UserRow } from '../lib/types.js';

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: `${row.last_name} ${row.first_name}`,
    username: row.username,
    role: row.role,
    position: row.position,
    isActive: row.is_active === 1,
    createdAt: row.created_at,
  };
}

export function findById(id: number): UserRow | undefined {
  return getDb().get<UserRow>('SELECT * FROM users WHERE id = ?', id);
}

export function findByUsername(username: string): UserRow | undefined {
  return getDb().get<UserRow>('SELECT * FROM users WHERE lower(username) = lower(?)', username);
}

export function listAll(): UserRow[] {
  return getDb().all<UserRow>(
    `SELECT * FROM users ORDER BY
       CASE role WHEN 'CURATOR' THEN 0 WHEN 'MONITOR' THEN 1 ELSE 2 END,
       position ASC, last_name COLLATE NOCASE ASC`,
  );
}

/** Активные пользователи для списка быстрого входа (без логинов и хешей). */
export function listActive(): Pick<UserRow, 'id' | 'first_name' | 'last_name' | 'role'>[] {
  return getDb().all<Pick<UserRow, 'id' | 'first_name' | 'last_name' | 'role'>>(
    `SELECT id, first_name, last_name, role FROM users WHERE is_active = 1
     ORDER BY CASE role WHEN 'CURATOR' THEN 0 WHEN 'MONITOR' THEN 1 ELSE 2 END,
       position ASC, last_name COLLATE NOCASE ASC`,
  );
}

export function listByRoles(...roles: Role[]): UserRow[] {
  if (roles.length === 0) return [];
  const placeholders = roles.map(() => '?').join(',');
  return getDb().all<UserRow>(
    `SELECT * FROM users WHERE role IN (${placeholders})
     ORDER BY CASE role WHEN 'MONITOR' THEN 0 ELSE 1 END, position ASC, last_name COLLATE NOCASE ASC`,
    ...roles,
  );
}

export function nextPosition(): number {
  const max = getDb().scalar<number | null>('SELECT MAX(position) FROM users');
  return (max ?? 0) + 1;
}

export function insertUser(input: {
  firstName: string;
  lastName: string;
  username: string;
  passwordHash: string;
  role: Role;
  position?: number;
  pinHash?: string;
}): UserRow {
  const db = getDb();
  const ts = nowISO();
  const position = input.position ?? nextPosition();
  const { lastInsertRowid } = db.run(
    `INSERT INTO users (first_name, last_name, username, password_hash, role, position, is_active, pin_hash, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    input.firstName,
    input.lastName,
    input.username,
    input.passwordHash,
    input.role,
    position,
    input.pinHash ?? null,
    ts,
    ts,
  );
  return findById(lastInsertRowid)!;
}

export function updateUser(
  id: number,
  patch: Partial<{
    firstName: string;
    lastName: string;
    username: string;
    role: Role;
    isActive: boolean;
    position: number;
  }>,
): UserRow | undefined {
  const db = getDb();
  const sets: string[] = [];
  const params: (string | number)[] = [];

  if (patch.firstName !== undefined) {
    sets.push('first_name = ?');
    params.push(patch.firstName);
  }
  if (patch.lastName !== undefined) {
    sets.push('last_name = ?');
    params.push(patch.lastName);
  }
  if (patch.username !== undefined) {
    sets.push('username = ?');
    params.push(patch.username);
  }
  if (patch.role !== undefined) {
    sets.push('role = ?');
    params.push(patch.role);
  }
  if (patch.isActive !== undefined) {
    sets.push('is_active = ?');
    params.push(patch.isActive ? 1 : 0);
  }
  if (patch.position !== undefined) {
    sets.push('position = ?');
    params.push(patch.position);
  }
  if (sets.length === 0) return findById(id);

  sets.push('updated_at = ?');
  params.push(nowISO(), id);
  db.run(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`, ...params);
  return findById(id);
}

export function updatePassword(id: number, passwordHash: string): void {
  getDb().run('UPDATE users SET password_hash = ?, updated_at = ? WHERE id = ?', passwordHash, nowISO(), id);
}

export function deleteUser(id: number): void {
  getDb().run('DELETE FROM users WHERE id = ?', id);
}

export function countByRole(role: Role): number {
  return getDb().scalar<number>('SELECT COUNT(*) FROM users WHERE role = ? AND is_active = 1', role) ?? 0;
}

export function listAdmins(): UserRow[] {
  return getDb().all<UserRow>(
    `SELECT * FROM users WHERE role IN ('MONITOR','CURATOR') ORDER BY
      CASE role WHEN 'CURATOR' THEN 0 ELSE 1 END, last_name COLLATE NOCASE`,
  );
}
