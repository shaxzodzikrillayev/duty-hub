import type { DutyStatus, Role } from '../types';

export const ROLE_META: Record<Role, { label: string; short: string; emoji: string; tone: string; chip: string }> = {
  STUDENT: {
    label: 'Ученик',
    short: 'Ученик',
    emoji: '👨‍🎓',
    tone: 'text-sky-300',
    chip: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
  },
  MONITOR: {
    label: 'Староста',
    short: 'Староста',
    emoji: '👑',
    tone: 'text-amber-300',
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
  },
  CURATOR: {
    label: 'Куратор',
    short: 'Куратор',
    emoji: '👩‍🏫',
    tone: 'text-violet-300',
    chip: 'border-violet-400/30 bg-violet-400/10 text-violet-200',
  },
};

interface StatusMeta {
  label: string;
  emoji: string;
  dot: string;
  text: string;
  chip: string;
  bar: string;
  ring: string;
}

export const STATUS_META: Record<DutyStatus | 'NOT_ASSIGNED', StatusMeta> = {
  DONE: {
    label: 'Дежурил',
    emoji: '🟢',
    dot: 'bg-emerald-400',
    text: 'text-emerald-300',
    chip: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
    bar: 'bg-emerald-400',
    ring: 'ring-emerald-400/40',
  },
  MISSED: {
    label: 'Не дежурил',
    emoji: '🔴',
    dot: 'bg-rose-500',
    text: 'text-rose-300',
    chip: 'border-rose-400/30 bg-rose-400/10 text-rose-200',
    bar: 'bg-rose-500',
    ring: 'ring-rose-400/40',
  },
  SICK: {
    label: 'Болел',
    emoji: '🟡',
    dot: 'bg-amber-400',
    text: 'text-amber-300',
    chip: 'border-amber-400/30 bg-amber-400/10 text-amber-200',
    bar: 'bg-amber-400',
    ring: 'ring-amber-400/40',
  },
  REPLACED: {
    label: 'Замена',
    emoji: '🔵',
    dot: 'bg-sky-400',
    text: 'text-sky-300',
    chip: 'border-sky-400/30 bg-sky-400/10 text-sky-200',
    bar: 'bg-sky-400',
    ring: 'ring-sky-400/40',
  },
  ASSIGNED: {
    label: 'Назначен',
    emoji: '⏳',
    dot: 'bg-slate-400',
    text: 'text-slate-300',
    chip: 'border-slate-400/25 bg-slate-400/10 text-slate-300',
    bar: 'bg-slate-400',
    ring: 'ring-slate-400/30',
  },
  NOT_ASSIGNED: {
    label: 'Не назначен',
    emoji: '⚪',
    dot: 'bg-slate-600',
    text: 'text-slate-500',
    chip: 'border-slate-600/40 bg-slate-600/10 text-slate-400',
    bar: 'bg-slate-700',
    ring: 'ring-slate-600/40',
  },
};

/** Статусы, которые староста может выставить одним кликом. */
export const QUICK_STATUSES: DutyStatus[] = ['DONE', 'MISSED', 'SICK', 'REPLACED'];

export const ACTION_LABELS: Record<string, string> = {
  REGISTER: 'Регистрация',
  PASSWORD_CHANGE: 'Смена пароля',
  PASSWORD_RESET: 'Сброс пароля',
  USER_CREATE: 'Добавлен ученик',
  USER_UPDATE: 'Изменение профиля',
  USER_DELETE: 'Удаление ученика',
  DUTY_CREATE: 'Назначение',
  DUTY_UPDATE: 'Смена статуса',
  DUTY_DELETE: 'Удаление назначения',
  DUTY_BULK_ADD: 'Массовое назначение',
  DUTY_BULK_REMOVE: 'Снятие назначений',
  DUTY_GENERATE: 'Генерация графика',
};
