import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { csrfInvalid, forbidden } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Эндпоинты, доступные ДО получения сессии.
 *
 * CSRF нужен, чтобы злоумышленник не заставил браузер жертвы выполнить
 * действие от её имени (сессионная cookie dh_session уходит сама).
 * У входа и регистрации сессии жертвы ещё нет — подделывать нечего, а вот
 * требовать от клиента токен значит заставить его сначала сходить за токеном
 * на отдельный эндпоинт. Именно эта зависимость ломала вход: если
 * /api/auth/csrf отвечал 404, запрос логина даже не уходил на сервер.
 *
 * Эти маршруты защищены иначе: проверка Origin ниже, authLimiter и
 * серверные секретные коды. Сессию и CSRF-токен они выдают в ответе.
 */
const CSRF_EXEMPT_PATHS = new Set([
  '/api/auth/login',
  '/api/auth/login-pin',
  '/api/auth/register',
]);

function isCsrfExempt(req: Request): boolean {
  const pathname = req.originalUrl.split('?')[0] ?? '';
  const normalized = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
  return CSRF_EXEMPT_PATHS.has(normalized);
}

/**
 * CSRF + same-origin: Origin должен совпадать с хостом запроса или быть в whitelist,
 * а для мутаций заголовок X-CSRF-Token обязан совпадать с cookie dh_csrf.
 */
export function csrfProtection(req: Request, _res: Response, next: NextFunction): void {
  const origin = req.get('origin');
  const host = req.get('host');

  if (origin) {
    let originHost: string;
    try {
      originHost = new URL(origin).host;
    } catch {
      return next(forbidden('Некорректный Origin'));
    }
    const allowed = config.allowedOrigins.some((o) => {
      try {
        return new URL(o).host === originHost;
      } catch {
        return false;
      }
    });
    if (originHost !== host && !allowed) {
      return next(forbidden('Запрос с чужого источника отклонён'));
    }
  }

  if (SAFE_METHODS.has(req.method)) return next();
  if (isCsrfExempt(req)) return next();

  const cookieToken = req.cookies?.[config.csrfCookieName];
  const headerToken = req.get(config.csrfHeader);

  // Если клиент не прислал CSRF-куку (например, curl/тест) — отклоняем мутации.
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(csrfInvalid());
  }

  next();
}
