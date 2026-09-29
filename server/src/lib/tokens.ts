import jwt from 'jsonwebtoken';
import type { Response } from 'express';
import { config } from '../config.js';
import type { Role } from './types.js';
import { randomToken } from './crypto.js';

export interface SessionPayload {
  sub: number;
  role: Role;
  username: string;
}

/** Сессия хранится в httpOnly-cookie: доступна из JS только через CSRF-токен. */
export function issueSession(res: Response, payload: SessionPayload): void {
  const token = jwt.sign(payload, config.jwtSecret, {
    expiresIn: config.jwtTtl as jwt.SignOptions['expiresIn'],
    issuer: 'duty-hub',
  });
  res.cookie(config.cookieName, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearSession(res: Response): void {
  res.clearCookie(config.cookieName, { path: '/' });
  res.clearCookie(config.csrfCookieName, { path: '/' });
}

export function readSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  try {
    const decoded = jwt.verify(token, config.jwtSecret, { issuer: 'duty-hub' });
    if (typeof decoded === 'string') return null;
    const { sub, role, username } = decoded as Record<string, unknown>;
    if (typeof sub !== 'number' || typeof role !== 'string' || typeof username !== 'string') return null;
    if (role !== 'STUDENT' && role !== 'MONITOR' && role !== 'CURATOR') return null;
    return { sub, role, username };
  } catch {
    return null;
  }
}

/**
 * CSRF по схеме double submit: значение в cookie сверяется с заголовком.
 * Cookie намеренно httpOnly=false — его должен уметь прочитать JS.
 */
export function issueCsrfToken(res: Response): string {
  const token = randomToken(24);
  res.cookie(config.csrfCookieName, token, {
    httpOnly: false,
    sameSite: 'lax',
    secure: config.isProd,
    path: '/',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
  return token;
}
