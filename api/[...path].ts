/**
 * Vercel Functions: все маршруты Express собраны на /api, поэтому любой
 * /api/* запрос должен попадать сюда. Клиент (Vite) обращается к /api/*
 * относительно домена — отдельный API-домен не нужен.
 *
 * Имя файла [..path] — catch-all: /api/auth/csrf, /api/users, /api/audit
 * и любые будущие маршруты работают без изменений и без rewrites.
 */
import { app } from '../server/src/app.js';
import type { Request, Response, NextFunction } from 'express';

/**
 * Если маршрутизация всё же отдала путь от назначения реврайта,
 * приводим его к исходному виду.
 */
function normalizePath(req: Request, _res: Response, next: NextFunction): void {
  if (req.url === '/' || req.url === '') req.url = '/api/health';
  else if (req.url === '/api/index' || req.url === '/api/index/') req.url = '/api';
  else if (req.url.startsWith('/api/index/')) req.url = `/api${req.url.slice('/api/index'.length)}`;
  else if (!req.url.startsWith('/api')) req.url = `/api${req.url.startsWith('/') ? req.url : `/${req.url}`}`;
  next();
}

export default function vercelHandler(req: Request, res: Response): void {
  normalizePath(req, res, () => app(req, res));
}
