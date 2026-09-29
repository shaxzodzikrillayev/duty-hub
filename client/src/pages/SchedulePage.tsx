import { useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useIsStaff } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DutyRow } from '../components/DutyRow';
import { AddDutyModal } from '../components/AddDutyModal';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, Loader, SectionTitle } from '../components/ui';
import {
  addDays,
  formatDateLong,
  monthGrid,
  monthTitle,
  shiftMonth,
  todayISO,
  weekdayShort,
} from '../lib/dates';
import { STATUS_META } from '../lib/const';
import type { Duty, User } from '../types';

const WEEK_HEAD = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];

export function SchedulePage() {
  const isStaff = useIsStaff();
  const toast = useToast();
  const today = todayISO();

  const [month, setMonth] = useState(today.slice(0, 8) + '01');
  const [selected, setSelected] = useState(today);
  const [addOpen, setAddOpen] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [perDay, setPerDay] = useState(4);

  const range = useMemo(() => {
    const from = shiftMonth(month, -1);
    const to = addDays(shiftMonth(month, 2), 0);
    return { from, to };
  }, [month]);

  const duties = useAsync<{ duties: Duty[]; canEdit: boolean }>(
    () => api.duties.list(range.from, range.to),
    [range.from, range.to],
  );
  const roster = useAsync<{ users: User[] }>(() => api.users.list(), []);

  const byDate = useMemo(() => {
    const map = new Map<string, Duty[]>();
    for (const d of duties.data?.duties ?? []) {
      const list = map.get(d.date) ?? [];
      list.push(d);
      map.set(d.date, list);
    }
    return map;
  }, [duties.data]);

  const selectedDuties = byDate.get(selected) ?? [];
  const selectedUsers = roster.data?.users ?? [];

  const patchDuty = (updated: Duty) =>
    duties.setData((prev) =>
      prev ? { ...prev, duties: prev.duties.map((d) => (d.id === updated.id ? updated : d)) } : prev,
    );

  const dropDuty = (removed: Duty) =>
    duties.setData((prev) =>
      prev ? { ...prev, duties: prev.duties.filter((d) => d.id !== removed.id) } : prev,
    );

  const generate = async () => {
    try {
      const { created } = await api.duties.generate(month, addDays(shiftMonth(month, 1), -1), perDay);
      toast.push(created > 0 ? `Добавлено назначений: ${created}` : 'Все дни уже заполнены');
      setGenOpen(false);
      await duties.reload();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Не удалось построить график', 'error');
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <header className="glass animate-fade-up flex flex-wrap items-center justify-between gap-3 p-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">📅 График дежурств</h1>
          <p className="mt-0.5 text-sm text-slate-400">6-дневная учебная неделя, включая субботу</p>
        </div>
        {isStaff ? (
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-ghost" onClick={() => setGenOpen(true)}>
              ⚡ Заполнить месяц
            </button>
            <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
              + Добавить дежурного
            </button>
          </div>
        ) : null}
      </header>

      <div className="grid gap-4 lg:grid-cols-[1.35fr_1fr]">
        <section className="glass p-4 sm:p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">{monthTitle(month)}</h2>
            <div className="flex items-center gap-1">
              <button type="button" className="btn-ghost btn-sm" onClick={() => setMonth(shiftMonth(month, -1))} aria-label="Предыдущий месяц">
                ←
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setMonth(today.slice(0, 8) + '01')}>
                Сегодня
              </button>
              <button type="button" className="btn-ghost btn-sm" onClick={() => setMonth(shiftMonth(month, 1))} aria-label="Следующий месяц">
                →
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            {WEEK_HEAD.map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>

          <div className="mt-1 grid grid-cols-7 gap-1">
            {monthGrid(month).map((cell) => {
              const dayDuties = byDate.get(cell.date) ?? [];
              const isToday = cell.date === today;
              const isSelected = cell.date === selected;
              const hasDuty = dayDuties.length > 0;

              return (
                <button
                  key={cell.date}
                  type="button"
                  onClick={() => setSelected(cell.date)}
                  className={`group relative flex aspect-square flex-col items-center justify-center gap-1 rounded-xl border text-xs transition sm:text-sm ${
                    isSelected
                      ? 'border-emerald-400/60 bg-emerald-400/10 text-white'
                      : cell.inMonth
                        ? 'border-white/[0.07] bg-white/[0.03] text-slate-300 hover:border-white/20 hover:bg-white/[0.07]'
                        : 'border-transparent bg-transparent text-slate-700 hover:bg-white/[0.03]'
                  } ${!cell.isSchoolDay ? 'opacity-60' : ''}`}
                >
                  <span className={`font-semibold ${isToday ? 'text-emerald-300' : ''}`}>
                    {Number(cell.date.slice(-2))}
                  </span>
                  <span className="flex h-1.5 items-center gap-0.5">
                    {hasDuty
                      ? dayDuties.slice(0, 4).map((d) => (
                          <span
                            key={d.id}
                            className={`h-1.5 w-1.5 rounded-full ${STATUS_META[d.status].dot}`}
                            title={`${d.user.fullName} — ${STATUS_META[d.status].label}`}
                          />
                        ))
                      : null}
                  </span>
                  {isToday ? (
                    <span className="absolute inset-x-3 bottom-1 h-px bg-emerald-400/60" aria-hidden />
                  ) : null}
                </button>
              );
            })}
          </div>

          <div className="mt-4 flex flex-wrap gap-3 border-t border-white/[0.07] pt-3 text-[11px] text-slate-400">
            {(Object.keys(STATUS_META) as (keyof typeof STATUS_META)[])
              .filter((s) => s !== 'NOT_ASSIGNED')
              .map((s) => (
                <span key={s} className="flex items-center gap-1.5">
                  <span className={`h-2 w-2 rounded-full ${STATUS_META[s].dot}`} />
                  {STATUS_META[s].label}
                </span>
              ))}
          </div>
        </section>

        <section className="glass flex flex-col p-4 sm:p-5">
          <SectionTitle
            title={`${weekdayShort(selected)} · ${formatDateLong(selected)}`}
            subtitle={
              selectedDuties.length > 0
                ? `Дежурных: ${selectedDuties.length}`
                : isStaff
                  ? 'Никого не назначено'
                  : 'Дежурных нет'
            }
            action={
              isStaff ? (
                <button type="button" className="btn-ghost btn-sm" onClick={() => setAddOpen(true)}>
                  + Добавить
                </button>
              ) : null
            }
          />

          {duties.loading ? <Loader label="Загружаем график…" /> : null}
          {duties.error ? <ErrorState message={duties.error} onRetry={() => void duties.reload()} /> : null}

          {!duties.loading && selectedDuties.length === 0 ? (
            <EmptyState
              icon="🌤️"
              title="На этот день дежурных нет"
              hint={
                isStaff
                  ? roster.data && roster.data.users.length <= 1
                    ? 'Сначала добавьте учеников в разделе «Класс», потом назначайте дежурных.'
                    : 'Добавьте ученика кнопкой выше или откройте другой день.'
                  : 'Дежурств пока нет — график ещё не составлен.'
              }
            />
          ) : (
            <div className="flex flex-col gap-2.5">
              {selectedDuties.map((d) => (
                <DutyRow
                  key={d.id}
                  duty={d}
                  roster={selectedUsers}
                  canEdit={isStaff}
                  showDate
                  onChanged={patchDuty}
                  onDeleted={dropDuty}
                />
              ))}
            </div>
          )}
        </section>
      </div>

      <AddDutyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        date={selected}
        roster={selectedUsers}
        existingIds={selectedDuties.map((d) => d.userId)}
        onCreated={() => void duties.reload()}
      />

      <Modal
        open={genOpen}
        onClose={() => setGenOpen(false)}
        title="Заполнить график на месяц"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setGenOpen(false)}>
              Отмена
            </button>
            <button type="button" className="btn-primary" onClick={generate}>
              Заполнить
            </button>
          </>
        }
      >
        <p className="mb-4 text-sm text-slate-400">
          Ученики назначаются по кругу на {monthTitle(month)}. Уже существующие назначения не трогаются,
          пропускаются только воскресенья.
        </p>
        <label className="label">Дежурных в день</label>
        <div className="flex gap-2">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setPerDay(n)}
              className={`btn flex-1 ${perDay === n ? 'btn-primary' : 'btn-ghost'}`}
            >
              {n}
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}
