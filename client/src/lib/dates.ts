const WEEKDAY_SHORT = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'] as const;
const MONTHS_GEN = [
  'января', 'февраля', 'марта', 'апреля', 'мая', 'июня',
  'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря',
] as const;
const MONTHS_SHORT = [
  'янв', 'фев', 'мар', 'апр', 'май', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек',
] as const;

export function todayISO(): string {
  return toISO(new Date());
}

export function toISO(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function parseISO(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return new Date(y, m - 1, d);
}

export function addDays(iso: string, days: number): string {
  const date = parseISO(iso);
  date.setDate(date.getDate() + days);
  return toISO(date);
}

export function getDay(iso: string): number {
  return parseISO(iso).getDay();
}

export function isSchoolDay(iso: string): boolean {
  const day = getDay(iso);
  return day >= 1 && day <= 6;
}

export function weekdayShort(iso: string): string {
  return WEEKDAY_SHORT[getDay(iso)] ?? '';
}

export function formatDate(iso: string): string {
  const d = parseISO(iso);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()}`;
}

export function formatDateLong(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_GEN[d.getMonth()]} ${d.getFullYear()}`;
}

export function formatDateShort(iso: string): string {
  const d = parseISO(iso);
  return `${d.getDate()} ${MONTHS_SHORT[d.getMonth()]}`;
}

export function monthTitle(iso: string): string {
  const d = parseISO(iso);
  const title = d.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Сетка месяца: 6 недель × 7 дней, начиная с понедельника. */
export function monthGrid(iso: string): { date: string; inMonth: boolean; isSchoolDay: boolean }[] {
  const anchor = parseISO(iso);
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const offset = (first.getDay() + 6) % 7;
  const start = new Date(first);
  start.setDate(first.getDate() - offset);

  const cells: { date: string; inMonth: boolean; isSchoolDay: boolean }[] = [];
  for (let i = 0; i < 42; i += 1) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    const isoDay = toISO(d);
    cells.push({
      date: isoDay,
      inMonth: d.getMonth() === anchor.getMonth(),
      isSchoolDay: isSchoolDay(isoDay),
    });
  }
  return cells;
}

export function shiftMonth(iso: string, delta: number): string {
  const d = parseISO(iso);
  return toISO(new Date(d.getFullYear(), d.getMonth() + delta, 1));
}

export function formatTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return d.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(isoDateTime: string): string {
  const d = new Date(isoDateTime);
  return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}.${d.getFullYear()} ${formatTime(isoDateTime)}`;
}

export function relativeDay(iso: string): string {
  const today = todayISO();
  if (iso === today) return 'Сегодня';
  if (iso === addDays(today, 1)) return 'Завтра';
  if (iso === addDays(today, -1)) return 'Вчера';
  if (iso === addDays(today, 2)) return 'Послезавтра';
  return `${weekdayShort(iso)} · ${formatDateShort(iso)}`;
}

export function plural(n: number, forms: [string, string, string]): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return forms[0];
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1];
  return forms[2];
}
