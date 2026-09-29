/**
 * Vercel Functions: единственная серверная точка проекта.
 * Все маршруты Express смонтированы на /api, поэтому любой /api/* запрос
 * попадает сюда. Клиент (Vite) обращается к /api/* относительно домена,
 * поэтому отдельный API-домен не нужен.
 */
import { app } from '../server/src/app.js';
import type { Request, Response, NextFunction } from 'express';

type Handler = (req: Request, res: Response) => void;

/**
 * Vercel обычно передаёт исходный путь, но при rewrite вида /api -> /api/index
 * путь может прийти с префиксом /api/index. Нормализуем оба случая.
 */
function normalizePath(req: Request, _res: Response, next: NextFunction): void {
  if (req.url === '/api/index' || req.url === '/api/index/') req.url = '/api';
  else if (req.url.startsWith('/api/index/')) req.url = `/api${req.url.slice('/api/index'.length)}`;
  if (req.url === '/' || req.url === '') req.url = '/api/health';
  next();
}

const handler: Handler = (req, res) => {
  app(req, res);
};

export default function vercelHandler(req: Request, res: Response): void {
  normalizePath(req, res, () => handler(req, res));
}
