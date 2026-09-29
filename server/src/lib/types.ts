/** Доменные типы, общие для всех слоёв сервера. */

export const ROLES = ['STUDENT', 'MONITOR', 'CURATOR'] as const;
export type Role = (typeof ROLES)[number];

export const DUTY_STATUSES = ['ASSIGNED', 'DONE', 'MISSED', 'SICK', 'REPLACED'] as const;
export type DutyStatus = (typeof DUTY_STATUSES)[number];

/** «Не назначен» — виртуальный статус, записи в БД не имеет. */
export const NOT_ASSIGNED = 'NOT_ASSIGNED' as const;
export type DisplayStatus = DutyStatus | typeof NOT_ASSIGNED;

export const ROLE_LABELS: Record<Role, string> = {
  STUDENT: 'Ученик',
  MONITOR: 'Староста',
  CURATOR: 'Куратор',
};

export const STATUS_LABELS: Record<DisplayStatus, string> = {
  ASSIGNED: 'Назначен',
  DONE: 'Дежурил',
  MISSED: 'Не дежурил',
  SICK: 'Болел',
  REPLACED: 'Замена',
  NOT_ASSIGNED: 'Не назначен',
};

export interface UserRow {
  id: number;
  first_name: string;
  last_name: string;
  username: string;
  password_hash: string;
  role: Role;
  position: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

export interface DutyRow {
  id: number;
  date: string;
  user_id: number;
  status: DutyStatus;
  replacement_user_id: number | null;
  comment: string | null;
  created_by: number | null;
  updated_by: number | null;
  created_at: string;
  updated_at: string;
}

/** Публичный DTO пользователя — никогда не содержит password_hash. */
export interface PublicUser {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  username: string;
  role: Role;
  position: number;
  isActive: boolean;
  createdAt: string;
}

export interface PublicDuty {
  id: number;
  date: string;
  userId: number;
  status: DutyStatus;
  replacementUserId: number | null;
  replacementName: string | null;
  comment: string | null;
  createdAt: string;
  updatedAt: string;
  updatedBy: { id: number; fullName: string; role: Role } | null;
  user: { id: number; firstName: string; lastName: string; fullName: string; role: Role };
}

export interface AuditEntry {
  id: number;
  actorId: number | null;
  actorName: string;
  actorRole: Role;
  action: string;
  entityType: string;
  entityId: number | null;
  summary: string;
  details: Record<string, unknown> | null;
  createdAt: string;
}
