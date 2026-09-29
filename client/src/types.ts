export type Role = 'STUDENT' | 'MONITOR' | 'CURATOR';

export type DutyStatus = 'ASSIGNED' | 'DONE' | 'MISSED' | 'SICK' | 'REPLACED';
export type DisplayStatus = DutyStatus | 'NOT_ASSIGNED';

export interface User {
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

export interface Duty {
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

export interface DayInfo {
  date: string;
  formatted: string;
  weekday: string;
  isSchoolDay: boolean;
}

export interface DayCounts {
  classSize: number;
  totalStudents: number;
  onDuty: number;
  done: number;
  missed: number;
  sick: number;
  replaced: number;
  planned: number;
  unassigned: number;
  reported: number;
}

export interface DayPayload {
  day: DayInfo;
  duties: Duty[];
  counts: DayCounts;
  notOnDuty: Pick<User, 'id' | 'firstName' | 'lastName' | 'fullName' | 'role'>[];
}

export interface StudentStats {
  assigned: number;
  done: number;
  missed: number;
  sick: number;
  replaced: number;
  planned: number;
}

export interface StudentDashboard {
  role: 'STUDENT';
  user: User;
  today: DayPayload & { myDuty: Duty | null; onDutyWithMe: Duty[] };
  nextDuty: Duty | null;
  previousDuty: Duty | null;
  myStats: StudentStats;
  history: Duty[];
}

export interface StaffDashboard {
  role: 'MONITOR' | 'CURATOR';
  user: User;
  today: DayPayload;
  monitors: User[];
  classStats: {
    totalAssignments: number;
    done: number;
    missed: number;
    sick: number;
    replaced: number;
    planned: number;
  };
}

export type DashboardPayload = StudentDashboard | StaffDashboard;

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

export interface PerStudentRow {
  user: User;
  assigned: number;
  done: number;
  missed: number;
  sick: number;
  replaced: number;
  planned: number;
}

export interface StatsPayload {
  range: { from: string; to: string };
  overview: {
    totalAssignments: number;
    done: number;
    missed: number;
    sick: number;
    replaced: number;
    planned: number;
  };
  totalStudents: number;
  perStudent: PerStudentRow[] | null;
  myStats: StudentStats | null;
}
