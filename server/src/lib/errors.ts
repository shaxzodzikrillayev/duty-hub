import type { NextFunction, Request, Response } from 'express';

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly code = 'ERROR',
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const badRequest = (m: string, c = 'BAD_REQUEST') => new HttpError(400, m, c);
export const unauthorized = (m = 'Требуется авторизация') => new HttpError(401, m, 'UNAUTHORIZED');
export const forbidden = (m = 'Недостаточно прав') => new HttpError(403, m, 'FORBIDDEN');
export const notFound = (m = 'Не найдено') => new HttpError(404, m, 'NOT_FOUND');
export const conflict = (m: string) => new HttpError(409, m, 'CONFLICT');
/** Отдельный код: клиент по нему понимает, что нужно обновить CSRF-токен и повторить запрос. */
export const csrfInvalid = (m = 'Отсутствует или неверный CSRF-токен') =>
  new HttpError(403, m, 'CSRF_INVALID');

/** Обёртка для async-обработчиков, чтобы не дублировать try/catch. */
export function asyncHandler<T extends Request = Request>(
  fn: (req: T, res: Response, next: NextFunction) => Promise<unknown>,
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    void fn(req as T, res, next).catch(next);
  };
}
