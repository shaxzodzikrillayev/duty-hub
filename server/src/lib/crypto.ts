import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { config } from '../config.js';

/** Хеширование пароля (bcrypt, соль на каждый пароль). */
export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, config.bcryptRounds);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(plain, hash);
  } catch {
    return false;
  }
}

export function randomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('base64url');
}
