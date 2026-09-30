import 'dotenv/config';
import path from 'node:path';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
/** Корень папки server/ (работает и в tsx, и в собранном dist/) */
export const SERVER_ROOT = path.resolve(here, '..');
/** Корень всего проекта */
export const PROJECT_ROOT = path.resolve(SERVER_ROOT, '..');

/** Ищет .env в корне проекта, затем в корне server/ */
function loadEnvFile(): void {
  const candidates = [path.join(PROJECT_ROOT, '.env'), path.join(SERVER_ROOT, '.env')];
  for (const file of candidates) {
    if (fs.existsSync(file)) {
      process.env.DOTENV_CONFIG_PATH = file;
      // dotenv уже вызван импортом выше, поэтому перечитываем файл вручную
      const content = fs.readFileSync(file, 'utf8');
      for (const rawLine of content.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;
        const eq = line.indexOf('=');
        if (eq === -1) continue;
        const key = line.slice(0, eq).trim();
        let value = line.slice(eq + 1).trim();
        if (
          (value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))
        ) {
          value = value.slice(1, -1);
        }
        if (process.env[key] === undefined) process.env[key] = value;
      }
      return;
    }
  }
}

loadEnvFile();

function required(name: string): string {
  const value = process.env[name];
  if (!value || value.trim() === '') {
    throw new Error(`Переменная окружения ${name} обязательна. Создайте .env на основе .env.example`);
  }
  return value.trim();
}

const NODE_ENV = process.env.NODE_ENV ?? 'development';
const isProd = NODE_ENV === 'production';
const isVercel = Boolean(process.env.VERCEL) || Boolean(process.env.VERCEL_ENV);

const jwtSecret = process.env.JWT_SECRET?.trim() || '';
if (isProd && (jwtSecret.length < 32 || jwtSecret === 'dev-only-secret-change-me-3f9a1c7b52e8461d')) {
  throw new Error('В production необходимо задать случайный JWT_SECRET длиной не менее 32 символов');
}

/**
 * Секретных кодов регистрации больше нет: роль выбирается при регистрации
 * свободно, поэтому MONITOR_SECRET и CURATOR_SECRET не нужны ни серверу,
 * ни переменным окружения на хостинге.
 */

const databasePathRaw = process.env.DATABASE_PATH?.trim() || (isVercel ? '/tmp/dutyhub/dutyhub.db' : './data/dutyhub.db');
const databaseFile = path.isAbsolute(databasePathRaw)
  ? databasePathRaw
  : path.resolve(SERVER_ROOT, databasePathRaw);

fs.mkdirSync(path.dirname(databaseFile), { recursive: true });

export const config = {
  env: NODE_ENV,
  isProd,
  isVercel,
  port: Number(process.env.PORT ?? 4000),
  jwtSecret: jwtSecret || crypto.randomBytes(32).toString('hex'),
  jwtTtl: process.env.JWT_TTL?.trim() || '7d',
  cookieName: 'dh_session',
  csrfCookieName: 'dh_csrf',
  csrfHeader: 'x-csrf-token',
  databaseFile,
  allowedOrigins: (process.env.ALLOWED_ORIGINS ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean),
  bcryptRounds: isProd ? 12 : 10,
  /** Учётные данные стартового аккаунта (только для первичного заполнения БД) */
  seedCurator: {
    firstName: process.env.SEED_CURATOR_FIRST_NAME?.trim() || 'Нилюфар',
    lastName: process.env.SEED_CURATOR_LAST_NAME?.trim() || 'Абдусаматова',
    password: process.env.SEED_CURATOR_PASSWORD?.trim() || 'Curator12345',
  },
} as const;

export type AppConfig = typeof config;
