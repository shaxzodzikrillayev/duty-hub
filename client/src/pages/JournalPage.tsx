import { useState } from 'react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { EmptyState, ErrorState, Loader, SectionTitle } from '../components/ui';
import { ACTION_LABELS, ROLE_META } from '../lib/const';
import { formatDateTime } from '../lib/dates';
import type { AuditEntry } from '../types';

const ACTION_TONE: Record<string, string> = {
  DUTY_UPDATE: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  DUTY_CREATE: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  DUTY_DELETE: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  DUTY_GENERATE: 'border-violet-400/25 bg-violet-400/10 text-violet-200',
  DUTY_BULK_ADD: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
  DUTY_BULK_REMOVE: 'border-slate-400/25 bg-slate-400/10 text-slate-200',
  USER_CREATE: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  USER_UPDATE: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  USER_DELETE: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  PASSWORD_RESET: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  REGISTER: 'border-sky-400/25 bg-sky-400/10 text-sky-200',
};

export function JournalPage() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const log = useAsync<{ items: AuditEntry[]; total: number; page: number; pages: number }>(
    () => api.audit.list(page, 40),
    [page],
  );

  return (
    <div className="flex flex-col gap-5">
      <header className="glass animate-fade-up p-4 sm:p-5">
        <h1 className="text-xl font-bold tracking-tight text-white">🗂 Журнал изменений</h1>
        <p className="mt-0.5 text-sm text-slate-400">
          Кто и когда менял статусы, назначения и список класса
          {user?.role === 'CURATOR' ? ' · доступен куратору в полном объёме' : ' · режим чтения'}
        </p>
      </header>

      <section className="glass p-4 sm:p-5">
        <SectionTitle title="История" subtitle={log.data ? `Всего записей: ${log.data.total}` : undefined} />

        {log.loading && !log.data ? <Loader /> : null}
        {log.error ? <ErrorState message={log.error} onRetry={() => void log.reload()} /> : null}

        {log.data && log.data.items.length === 0 ? (
          <EmptyState icon="🗒" title="Записей пока нет" />
        ) : null}

        {log.data && log.data.items.length > 0 ? (
          <ol className="relative flex flex-col gap-2.5 pl-4">
            <span className="absolute left-[5px] top-2 h-[calc(100%-1rem)] w-px bg-gradient-to-b from-emerald-400/40 via-white/10 to-transparent" />
            {log.data.items.map((entry) => (
              <li key={entry.id} className="relative">
                <span className="absolute -left-4 top-3 h-2.5 w-2.5 rounded-full border-2 border-ink-900 bg-emerald-400" />
                <div className="rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:border-white/15 hover:bg-white/[0.06]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm font-semibold text-white">{entry.actorName}</span>
                      <span className={`chip ${ROLE_META[entry.actorRole].chip}`}>
                        {ROLE_META[entry.actorRole].emoji} {ROLE_META[entry.actorRole].label}
                      </span>
                      <span className={`chip ${ACTION_TONE[entry.action] ?? 'border-white/10 bg-white/5 text-slate-300'}`}>
                        {ACTION_LABELS[entry.action] ?? entry.action}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500">{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <p className="mt-1.5 text-sm text-slate-300">{entry.summary}</p>
                </div>
              </li>
            ))}
          </ol>
        ) : null}

        {log.data && log.data.pages > 1 ? (
          <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/[0.07] pt-4">
            <button type="button" className="btn-ghost btn-sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              ← Назад
            </button>
            <span className="text-sm text-slate-400">
              Страница {log.data.page} из {log.data.pages}
            </span>
            <button
              type="button"
              className="btn-ghost btn-sm"
              disabled={page >= log.data.pages}
              onClick={() => setPage((p) => p + 1)}
            >
              Вперёд →
            </button>
          </div>
        ) : null}
      </section>
    </div>
  );
}
