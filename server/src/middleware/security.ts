import type { NextFunction, Request, Response } from 'express';
import { config } from '../config.js';
import { forbidden } from '../lib/errors.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

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

  const cookieToken = req.cookies?.[config.csrfCookieName];
  const headerToken = req.get(config.csrfHeader);

  // Если клиент не прислал CSRF-куку (например, curl/тест) — отклоняем мутации.
  if (!cookieToken || !headerToken || cookieToken !== headerToken) {
    return next(forbidden('Отсутствует или неверный CSRF-токен'));
  }

  next();
}
