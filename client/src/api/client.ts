import type {
  AuditEntry,
  DashboardPayload,
  Duty,
  DutyStatus,
  Role,
  StatsPayload,
  User,
} from '../types';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code: string = 'ERROR',
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

const CSRF_COOKIE = 'dh_csrf';

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]!) : null;
}

let csrfReady: Promise<void> | null = null;

/** Клиент всегда запрашивает CSRF-токен перед первой мутацией. */
async function ensureCsrf(): Promise<void> {
  if (readCookie(CSRF_COOKIE)) return;
  if (!csrfReady) {
    csrfReady = fetch('/api/auth/csrf', { credentials: 'same-origin' })
      .then((r) => (r.ok ? undefined : Promise.reject(new ApiError(r.status, 'Не удалось получить CSRF-токен'))))
      .finally(() => {
        csrfReady = null;
      });
  }
  await csrfReady;
}

async function request<T>(method: string, url: string, body?: unknown): Promise<T> {
  if (method !== 'GET' && method !== 'HEAD') {
    await ensureCsrf();
  }

  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const csrf = readCookie(CSRF_COOKIE);
  if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;

  const res = await fetch(url, {
    method,
    headers,
    credentials: 'same-origin',
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  if (res.status === 204) return null as T;

  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }

  if (!res.ok) {
    const payload = (data ?? {}) as { error?: string; code?: string };
    throw new ApiError(res.status, payload.error ?? 'Ошибка запроса', payload.code ?? 'ERROR');
  }

  return data as T;
}

export const api = {
  auth: {
    me: () => request<{ user: User }>('GET', '/api/auth/me'),
    login: (username: string, password: string) =>
      request<{ user: User }>('POST', '/api/auth/login', { username, password }),
    register: (payload: {
      firstName: string;
      lastName: string;
      username: string;
      password: string;
      role: Role;
      secret?: string;
    }) => request<{ user: User }>('POST', '/api/auth/register', payload),
    people: () => request<{ people: { id: number; firstName: string; lastName: string; fullName: string; role: Role }[] }>('GET', '/api/auth/people'),
    loginPin: (userId: number, pin: string) =>
      request<{ user: User }>('POST', '/api/auth/login-pin', { userId, pin }),
    logout: () => request<{ ok: boolean }>('POST', '/api/auth/logout', {}),
    changePassword: (currentPassword: string, newPassword: string) =>
      request<{ ok: boolean }>('POST', '/api/auth/change-password', { currentPassword, newPassword }),
  },

  dashboard: {
    get: (date?: string) => request<DashboardPayload>('GET', `/api/dashboard${date ? `?date=${date}` : ''}`),
    stats: (from?: string, to?: string) =>
      request<StatsPayload>('GET', `/api/dashboard/stats?from=${from ?? ''}&to=${to ?? ''}`),
  },

  duties: {
    list: (from: string, to: string, userId?: number) =>
      request<{ duties: Duty[]; canEdit: boolean }>(
        'GET',
        `/api/duties?from=${from}&to=${to}${userId ? `&userId=${userId}` : ''}`,
      ),
    create: (payload: { date: string; userId: number; status?: DutyStatus; comment?: string | null }) =>
      request<{ duty: Duty }>('POST', '/api/duties', payload),
    update: (
      id: number,
      payload: { status?: DutyStatus; replacementUserId?: number | null; comment?: string | null; userId?: number; date?: string },
    ) => request<{ duty: Duty }>('PATCH', `/api/duties/${id}`, payload),
    remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/duties/${id}`),
    bulk: (date: string, userIds: number[], mode: 'add' | 'remove') =>
      request<{ duties: Duty[] }>('POST', '/api/duties/bulk', { date, userIds, mode }),
    generate: (from: string, to: string, perDay: number) =>
      request<{ created: number; duties: Duty[] }>('POST', '/api/duties/generate', { from, to, perDay }),
    history: (userId: number, from?: string, to?: string) =>
      request<{ duties: Duty[] }>('GET', `/api/duties/history/${userId}?from=${from ?? ''}&to=${to ?? ''}`),
  },

  users: {
    list: (role?: Role) => request<{ users: User[]; meta: { canManage: boolean; canEdit: boolean } }>(
      'GET',
      `/api/users${role ? `?role=${role}` : ''}`,
    ),
    create: (payload: { firstName: string; lastName: string; username: string; role: Role; password?: string }) =>
      request<{ user: User; initialPassword?: string }>('POST', '/api/users', payload),
    update: (id: number, patch: Partial<{ firstName: string; lastName: string; username: string; role: Role; isActive: boolean }>) =>
      request<{ user: User }>('PATCH', `/api/users/${id}`, patch),
    remove: (id: number) => request<{ ok: boolean }>('DELETE', `/api/users/${id}`),
    resetPassword: (id: number) => request<{ initialPassword: string }>('POST', `/api/users/${id}/reset-password`, {}),
  },

  audit: {
    list: (page = 1, limit = 50) =>
      request<{ items: AuditEntry[]; total: number; page: number; pages: number }>(
        'GET',
        `/api/audit?page=${page}&limit=${limit}`,
      ),
  },
};
