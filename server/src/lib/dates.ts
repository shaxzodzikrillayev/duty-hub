/** Работа с датами в формате YYYY-MM-DD без timezone-ловушек. */

/** Сегодня по локальному времени сервера. */
export function todayISO(now = new Date()): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function isValidISODate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  if (m < 1 || m > 12 || d < 1 || d > 31) return false;
  const dt = new Date(y, m - 1, d);
  return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
}

export function parseISODate(value: string): Date {
  const [y, m, d] = value.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const dt = parseISODate(iso);
  dt.setDate(dt.getDate() + days);
  return todayISO(dt);
}

/** 0 = воскресенье … 6 = суббота */
export function getDay(iso: string): number {
  return parseISODate(iso).getDay();
}

export const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
export const WEEKDAY_FULL = [
  'Воскресенье',
  'Понедельник',
  'Вторник',
  'Среда',
  'Четверг',
  'Пятница',
  'Суббота',
] as const;

/** Учебная неделя 6-дневная: понедельник — суббота. */
export const SCHOOL_DAYS = [1, 2, 3, 4, 5, 6] as const;

export function isSchoolDay(iso: string): boolean {
  return (SCHOOL_DAYS as readonly number[]).includes(getDay(iso));
}

export function formatRu(iso: string): string {
  const dt = parseISODate(iso);
  return `${String(dt.getDate()).padStart(2, '0')}.${String(dt.getMonth() + 1).padStart(2, '0')}.${dt.getFullYear()}`;
}

export function nowISO(): string {
  return new Date().toISOString();
}
