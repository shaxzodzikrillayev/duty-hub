import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { readSession } from '../lib/tokens.js';
import { forbidden, unauthorized } from '../lib/errors.js';
import type { Role } from '../lib/types.js';
import * as usersRepo from '../repositories/users.repo.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      /** Данные аутентифицированной сессии, заполняются requireAuth */
      user?: { id: number; role: Role; username: string; fullName: string };
      /** Готовая запись актора для журнала изменений */
      actor?: { id: number; role: Role; fullName: string };
    }
  }
}

/**
 * Проверка авторизации. Роль берётся ТОЛЬКО из подписанного JWT,
 * а не из тела запроса, query или заголовков клиента.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const session = readSession(req.cookies?.[config.cookieName]);
  if (!session) return next(unauthorized('Сессия не найдена или истекла'));

  const row = usersRepo.findById(session.sub);
  if (!row || row.is_active !== 1) return next(unauthorized('Пользователь не найден или отключён'));
  if (row.role !== session.role) return next(unauthorized('Роль изменилась. Войдите заново.'));

  req.user = {
    id: row.id,
    role: row.role,
    username: row.username,
    fullName: `${row.last_name} ${row.first_name}`,
  };
  req.actor = { id: row.id, role: row.role, fullName: `${row.last_name} ${row.first_name}` };
  next();
}

/**
 * Проверка роли на backend. Это единственный источник истины о правах:
 * фронтенд не может «подделать» роль, максимум — скрыть кнопку.
 */
export function requireRole(...allowed: Role[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(unauthorized());
    if (!allowed.includes(req.user.role)) {
      return next(
        forbidden(
          `Доступ запрещён. Требуется роль: ${allowed.join(' или ')}`,
        ),
      );
    }
    next();
  };
}

/** Минимально необходимые права на изменение данных. */
export const requireStaff = requireRole('MONITOR', 'CURATOR');
