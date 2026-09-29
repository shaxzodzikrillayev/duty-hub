import express, { type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import rateLimit from 'express-rate-limit';
import path from 'node:path';
import fs from 'node:fs';
import { config, PROJECT_ROOT, SERVER_ROOT } from './config.js';
import { getDb, migrate, closeDb } from './db/index.js';
import { HttpError } from './lib/errors.js';
import { csrfProtection } from './middleware/security.js';
import { authRouter } from './routes/auth.routes.js';
import { usersRouter } from './routes/users.routes.js';
import { dutiesRouter } from './routes/duties.routes.js';
import { dashboardRouter } from './routes/dashboard.routes.js';
import { auditRouter } from './routes/audit.routes.js';

migrate();

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');

app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
  }),
);

app.use(
  cors({
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (config.allowedOrigins.includes(origin)) return cb(null, true);
      cb(null, false);
    },
    credentials: true,
  }),
);

app.use(express.json({ limit: '64kb' }));
app.use(cookieParser());

app.use(
  '/api',
  rateLimit({
    windowMs: 60 * 1000,
    limit: 300,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    message: { error: 'Слишком много запросов. Немного подождите.' },
  }),
);

/** Защита от CSRF применяется ко всем мутирующим запросам API. */
app.use('/api', csrfProtection);

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, env: config.env, time: new Date().toISOString() });
});

app.use('/api/auth', authRouter);
app.use('/api/users', usersRouter);
app.use('/api/duties', dutiesRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/audit', auditRouter);

app.use('/api', (_req, res) => {
  res.status(404).json({ error: 'Эндпоинт не найден', code: 'NOT_FOUND' });
});

/** В production сервер отдаёт собранный SPA-клиент. */
const clientDist = path.join(PROJECT_ROOT, 'client', 'dist');
if (fs.existsSync(path.join(clientDist, 'index.html'))) {
  app.use(express.static(clientDist, { index: false, maxAge: '1h' }));
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
  console.log(`[duty-hub] SPA собран и раздаётся из ${clientDist}`);
} else if (config.isProd) {
  console.warn('[duty-hub] client/dist не найден — сначала выполните `npm run build` в папке client');
}

app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message, code: err.code });
    return;
  }
  const message = err instanceof Error ? err.message : 'Неизвестная ошибка';
  console.error('[duty-hub] Ошибка:', err);
  res.status(500).json({ error: config.isProd ? 'Внутренняя ошибка сервера' : message, code: 'INTERNAL' });
});

const server = app.listen(config.port, () => {
  const db = getDb();
  const users = db.scalar<number>('SELECT COUNT(*) FROM users');
  console.log(`\n  Duty Hub 5 «Г» — API запущен`);
  console.log(`  → http://localhost:${config.port}/api/health`);
  console.log(`  → режим: ${config.env} | пользователей в базе: ${users}`);
  console.log(`  → база: ${config.databaseFile}\n`);
  if (users === 0) {
    console.log('  ! База пуста. Выполните: npm run db:reset\n');
  }
});

function shutdown(signal: string): void {
  console.log(`\n[duty-hub] Получен ${signal}, завершаю работу...`);
  server.close(() => {
    closeDb();
    process.exit(0);
  });
  setTimeout(() => process.exit(0), 3000).unref();
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

export { app, SERVER_ROOT };
