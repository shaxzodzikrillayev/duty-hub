/**
 * Обработка голого пути /api (например, проверка живости).
 * Всё остальное обслуживает catch-all: api/[...path].ts
 */
import { app } from '../server/src/app.js';
import type { Request, Response } from 'express';

export default function vercelHandler(req: Request, res: Response): void {
  req.url = req.url === '/' || req.url === '' ? '/api/health' : req.url;
  app(req, res);
}
