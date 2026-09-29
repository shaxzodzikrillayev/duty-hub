import type { ReactNode } from 'react';
import { STATUS_META } from '../lib/const';
import type { DutyStatus } from '../types';

export function StatusChip({
  status,
  size = 'md',
  animate = false,
}: {
  status: DutyStatus | 'NOT_ASSIGNED';
  size?: 'sm' | 'md';
  animate?: boolean;
}) {
  const meta = STATUS_META[status];
  return (
    <span
      className={`chip ${meta.chip} ${size === 'sm' ? 'px-2 py-0.5 text-[11px]' : ''} ${animate ? 'animate-pulse-soft' : ''}`}
    >
      <span aria-hidden>{meta.emoji}</span>
      <span>{meta.label}</span>
    </span>
  );
}

export function StatusDot({ status, className = '' }: { status: DutyStatus | 'NOT_ASSIGNED'; className?: string }) {
  return <span className={`inline-block h-2 w-2 rounded-full ${STATUS_META[status].dot} ${className}`} aria-hidden />;
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'slate',
  index = 0,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon: ReactNode;
  tone?: 'slate' | 'green' | 'red' | 'yellow' | 'blue' | 'violet';
  index?: number;
}) {
  const tones: Record<string, string> = {
    slate: 'from-slate-400/20 to-slate-500/5 text-slate-200',
    green: 'from-emerald-400/25 to-emerald-500/5 text-emerald-200',
    red: 'from-rose-500/25 to-rose-600/5 text-rose-200',
    yellow: 'from-amber-400/25 to-amber-500/5 text-amber-200',
    blue: 'from-sky-400/25 to-sky-500/5 text-sky-200',
    violet: 'from-violet-400/25 to-violet-500/5 text-violet-200',
  };

  return (
    <div
      className="glass card-hover animate-fade-up relative overflow-hidden p-4"
      style={{ animationDelay: `${index * 45}ms` }}
    >
      <div
        className={`pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-gradient-to-br ${tones[tone]} blur-2xl`}
      />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
          <p className="mt-1.5 text-3xl font-bold tracking-tight text-white">{value}</p>
          {hint ? <p className="mt-1 truncate text-xs text-slate-500">{hint}</p> : null}
        </div>
        <span className="text-2xl opacity-90" aria-hidden>
          {icon}
        </span>
      </div>
    </div>
  );
}

export function SectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h2 className="text-lg font-semibold tracking-tight text-white">{title}</h2>
        {subtitle ? <p className="mt-0.5 text-sm text-slate-400">{subtitle}</p> : null}
      </div>
      {action}
    </div>
  );
}

export function ProgressBar({
  value,
  max,
  tone = 'bg-emerald-400',
  className = '',
}: {
  value: number;
  max: number;
  tone?: string;
  className?: string;
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-white/[0.07] ${className}`}>
      <div className={`h-full rounded-full ${tone} transition-all duration-500`} style={{ width: `${pct}%` }} />
    </div>
  );
}

export function EmptyState({ icon = '📭', title, hint }: { icon?: string; title: string; hint?: string }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center">
      <span className="text-4xl opacity-60" aria-hidden>
        {icon}
      </span>
      <p className="mt-3 text-sm font-medium text-slate-300">{title}</p>
      {hint ? <p className="mt-1 max-w-sm text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

export function Loader({ label = 'Загрузка…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-slate-400">
      <span className="h-5 w-5 animate-spin rounded-full border-2 border-emerald-400/30 border-t-emerald-400" />
      {label}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="rounded-2xl border border-rose-400/25 bg-rose-500/10 px-5 py-4 text-sm text-rose-100">
      <p className="font-medium">Не удалось загрузить данные</p>
      <p className="mt-1 text-rose-200/80">{message}</p>
      {onRetry ? (
        <button type="button" onClick={onRetry} className="btn-ghost btn-sm mt-3">
          Повторить
        </button>
      ) : null}
    </div>
  );
}
