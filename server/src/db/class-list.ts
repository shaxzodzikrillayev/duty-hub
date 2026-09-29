import fs from 'node:fs';
import path from 'node:path';
import { SERVER_ROOT } from '../config.js';
import type { Role } from '../lib/types.js';

export interface ClassMember {
  lastName: string;
  firstName: string;
  role: Role;
  position: number;
  /** PIN для быстрого входа: 1001, 1002, ... */
  pin: string;
}

export const CLASS_LIST_FILE = path.join(SERVER_ROOT, 'class-list.txt');

const PIN_START = 1001;

function translit(value: string): string {
  const map: Record<string, string> = {
    а: 'a', б: 'b', в: 'v', г: 'g', д: 'd', е: 'e', ё: 'e', ж: 'zh', з: 'z',
    и: 'i', й: 'y', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p', р: 'r',
    с: 's', т: 't', у: 'u', ф: 'f', х: 'h', ц: 'c', ч: 'ch', ш: 'sh', щ: 'sch',
    ъ: '', ы: 'y', ь: '', э: 'e', ю: 'yu', я: 'ya',
  };
  return [...value.toLowerCase()]
    .map((ch) => map[ch] ?? ch)
    .join('')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Читает список класса из server/class-list.txt.
 * Формат строки: «Фамилия Имя», звёздочка в начале делает человек старостой.
 */
export function readClassList(): ClassMember[] {
  if (!fs.existsSync(CLASS_LIST_FILE)) return [];

  const members: ClassMember[] = [];
  const lines = fs.readFileSync(CLASS_LIST_FILE, 'utf8').split(/\r?\n/);

  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;

    const isStarosta = line.startsWith('*');
    const body = (isStarosta ? line.slice(1) : line).trim();
    const parts = body.split(/\s+/);
    if (parts.length < 2) continue;

    const [lastName = '', ...rest] = parts;
    const firstName = rest.join(' ');
    const position = members.length + 1;

    members.push({
      lastName,
      firstName,
      role: isStarosta ? 'MONITOR' : 'STUDENT',
      position,
      pin: String(PIN_START + members.length),
    });
  }

  // Староста всегда первый в списке — так его проще найти на экране входа.
  return members.sort((a, b) => {
    if (a.role !== b.role) return a.role === 'MONITOR' ? -1 : 1;
    return a.position - b.position;
  });
}

/** Логин для парольного входа: латиница от фамилии и имени. */
export function makeUsername(lastName: string, firstName: string): string {
  const base = `${translit(lastName)}.${translit(firstName).slice(0, 1) || 'x'}`;
  return base.slice(0, 24) || `user${Math.floor(Math.random() * 1000)}`;
}
