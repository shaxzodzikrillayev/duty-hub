import { useMemo, useState } from 'react';
import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useToast } from '../components/Toast';
import { EmptyState, ErrorState, Loader, ProgressBar, SectionTitle, StatCard } from '../components/ui';
import { addDays, todayISO } from '../lib/dates';
import { ROLE_META } from '../lib/const';
import type { StatsPayload } from '../types';

const RANGES = [
  { label: 'Неделя', days: 7 },
  { label: 'Месяц', days: 30 },
  { label: 'Квартал', days: 90 },
];

export function StatsPage() {
  const toast = useToast();
  const [span, setSpan] = useState(30);
  const to = todayISO();
  const from = addDays(to, -span);

  const stats = useAsync<StatsPayload>(() => api.dashboard.stats(from, to), [from, to]);

  const rows = useMemo(
    () =>
      [...(stats.data?.perStudent ?? [])].sort((a, b) => {
        if (b.assigned !== a.assigned) return b.assigned - a.assigned;
        return b.done - a.done;
      }),
    [stats.data],
  );

  const overview = stats.data?.overview;

  if (stats.loading && !stats.data) return <Loader label="Считаем статистику…" />;
  if (stats.error) return <ErrorState message={stats.error} onRetry={() => void stats.reload()} />;

  return (
    <div className="flex flex-col gap-5">
      <header className="glass animate-fade-up flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">📊 Статистика класса</h1>
          <p className="mt-0.5 text-sm text-slate-400">
            Период: {from.split('-').reverse().join('.')} — {to.split('-').reverse().join('.')}
          </p>
        </div>
        <div className="flex gap-2">
          {RANGES.map((r) => (
            <button
              key={r.days}
              type="button"
              onClick={() => setSpan(r.days)}
              className={span === r.days ? 'btn-primary' : 'btn-ghost'}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {overview ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard index={0} label="Назначений" value={overview.totalAssignments} icon="📋" tone="slate" />
          <StatCard index={1} label="Выполнено" value={overview.done} icon="🟢" tone="green" />
          <StatCard index={2} label="Не выполнено" value={overview.missed} icon="🔴" tone="red" />
          <StatCard index={3} label="Болели" value={overview.sick} icon="🟡" tone="yellow" />
          <StatCard index={4} label="Замены" value={overview.replaced} icon="🔵" tone="blue" />
        </div>
      ) : null}

      <section className="glass p-4 sm:p-5">
        <SectionTitle
          title="По ученикам"
          subtitle="Количество выполненных дежурств за выбранный период"
        />

        {rows.length === 0 ? (
          <EmptyState
            icon="📈"
            title="Статистика появится после отметок"
            hint="Когда староста начнёт отмечать дежурства, здесь появятся цифры по каждому ученику."
          />
        ) : (
          <div className="flex flex-col gap-2">
            {rows.map((row) => {
              const pct = row.assigned > 0 ? Math.round((row.done / row.assigned) * 100) : 0;
              return (
                <div
                  key={row.user.id}
                  className="flex flex-wrap items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.02] px-3 py-2.5 transition hover:border-white/15 hover:bg-white/[0.05]"
                >
                  <div className="flex min-w-[180px] flex-1 items-center gap-2.5">
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/[0.07] text-xs font-bold text-slate-200">
                      {row.user.position || '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-white">{row.user.fullName}</p>
                      <p className="text-[11px] text-slate-500">
                        {ROLE_META[row.user.role].emoji} {ROLE_META[row.user.role].label} ·{' '}
                        {row.assigned} назначений
                      </p>
                    </div>
                  </div>

                  <div className="flex min-w-[120px] flex-1 items-center gap-2">
                    <ProgressBar
                      value={row.done}
                      max={Math.max(row.assigned, 1)}
                      tone={pct >= 80 ? 'bg-emerald-400' : pct >= 50 ? 'bg-amber-400' : 'bg-rose-500'}
                    />
                    <span className="w-10 shrink-0 text-right text-xs font-semibold text-slate-300">{pct}%</span>
                  </div>

                  <div className="flex gap-1.5 text-[11px]">
                    <Mini value={row.done} tone="text-emerald-300" title="Выполнено" />
                    <Mini value={row.missed} tone="text-rose-300" title="Не выполнено" />
                    <Mini value={row.sick} tone="text-amber-300" title="Болел" />
                    <Mini value={row.replaced} tone="text-sky-300" title="Замена" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      <button
        type="button"
        className="btn-ghost self-start"
        onClick={async () => {
          const header = 'Фамилия;Назначено;Выполнено;Не выполнено;Болел;Замены\n';
          const body = rows
            .map((r) => `${r.user.fullName};${r.assigned};${r.done};${r.missed};${r.sick};${r.replaced}`)
            .join('\n');
          const blob = new Blob([`\uFEFF${header}${body}`], { type: 'text/csv;charset=utf-8' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `statistika-5g-${from}_${to}.csv`;
          a.click();
          URL.revokeObjectURL(url);
          toast.push('CSV-файл сохранён');
        }}
      >
        ⬇ Скачать CSV
      </button>
    </div>
  );
}

function Mini({ value, tone, title }: { value: number; tone: string; title: string }) {
  return (
    <span className={`rounded-md border border-white/10 bg-white/[0.04] px-1.5 py-0.5 ${tone}`} title={title}>
      {value}
    </span>
  );
}
