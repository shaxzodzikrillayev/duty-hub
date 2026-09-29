import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useAuth, useIsStaff } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { DutyRow } from '../components/DutyRow';
import { AddDutyModal } from '../components/AddDutyModal';
import { EmptyState, ErrorState, Loader, ProgressBar, SectionTitle, StatCard, StatusChip } from '../components/ui';
import { addDays, formatDateLong, todayISO } from '../lib/dates';
import type { Duty, StaffDashboard, StudentDashboard, User } from '../types';

export function TodayPage() {
  const { user } = useAuth();
  const isStaff = useIsStaff();
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [addOpen, setAddOpen] = useState(false);

  const dash = useAsync<StaffDashboard | StudentDashboard>(() => api.dashboard.get(date), [date]);
  const roster = useAsync<{ users: User[] }>(() => api.users.list(), []);

  if (dash.loading && !dash.data) return <Loader label="Загружаем дежурства…" />;
  if (dash.error) return <ErrorState message={dash.error} onRetry={() => void dash.reload()} />;
  if (!dash.data) return null;

  const patchDuty = (updated: Duty) =>
    dash.setData((prev) =>
      prev
        ? ({ ...prev, today: { ...prev.today, duties: prev.today.duties.map((d) => (d.id === updated.id ? updated : d)) } } as typeof prev)
        : prev,
    );

  const quickAdd = async (userId: number) => {
    try {
      const { duty } = await api.duties.create({ date, userId });
      dash.setData(
        (prev) =>
          prev
            ? ({ ...prev, today: { ...prev.today, duties: [...prev.today.duties, duty] } } as typeof prev)
            : prev,
      );
      toast.push('Дежурный назначен');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Не удалось назначить', 'error');
    }
  };

  const dropDuty = (removed: Duty) =>
    dash.setData((prev) =>
      prev
        ? ({ ...prev, today: { ...prev.today, duties: prev.today.duties.filter((d) => d.id !== removed.id) } } as typeof prev)
        : prev,
    );

  return (
    <div className="flex flex-col gap-5">
      <header className="glass animate-fade-up flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-300/80">
            {isStaff ? 'Панель старосты' : 'Кабинет ученика'}
          </p>
          <h1 className="mt-1 truncate text-xl font-bold tracking-tight text-white sm:text-2xl">
            {isStaff ? <>Добро пожаловать, {user?.firstName} 👋</> : <>Привет, {user?.firstName}! 👋</>}
          </h1>
          <p className="mt-0.5 text-sm text-slate-400">
            {formatDateLong(date)}
            {dash.data.today.day.isSchoolDay ? '' : ' · выходной'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/[0.04] p-1">
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Предыдущий день">
              ←
            </button>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value || todayISO())}
              className="bg-transparent px-1 text-sm text-slate-200 outline-none [color-scheme:dark]"
            />
            <button type="button" className="btn-ghost btn-sm" onClick={() => setDate(addDays(date, 1))} aria-label="Следующий день">
              →
            </button>
          </div>
          {isStaff ? (
            <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
              + Добавить дежурного
            </button>
          ) : null}
        </div>
      </header>

      {dash.data.role === 'STUDENT' ? (
        <StudentToday data={dash.data} />
      ) : (
        <StaffToday
          data={dash.data}
          roster={roster.data?.users ?? []}
          onPatch={patchDuty}
          onDelete={dropDuty}
          onQuickAdd={quickAdd}
        />
      )}

      <AddDutyModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        date={date}
        roster={roster.data?.users ?? []}
        existingIds={dash.data.today.duties.map((d) => d.userId)}
        onCreated={() => void dash.reload()}
      />
    </div>
  );
}

function StaffToday({
  data,
  roster,
  onPatch,
  onDelete,
  onQuickAdd,
}: {
  data: StaffDashboard;
  roster: User[];
  onPatch: (duty: Duty) => void;
  onDelete: (duty: Duty) => void;
  onQuickAdd: (userId: number) => void;
}) {
  const { counts, duties, notOnDuty, day } = data.today;
  const reported = counts.reported;
  const emptyClass = counts.classSize <= 1;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <StatCard index={0} label="Учеников" value={counts.classSize} icon="👥" tone="slate" />
        <StatCard index={1} label="Дежурных" value={counts.onDuty} icon="🧹" tone="violet" />
        <StatCard index={2} label="Выполнили" value={counts.done} icon="🟢" tone="green" />
        <StatCard index={3} label="Не выполнили" value={counts.missed} icon="🔴" tone="red" />
        <StatCard index={4} label="Болели" value={counts.sick} icon="🟡" tone="yellow" />
      </div>

      {emptyClass ? (
        <section className="glass animate-fade-up p-6 text-center">
          <p className="text-3xl">🎒</p>
          <h2 className="mt-2 text-base font-semibold text-white">В классе пока нет учеников</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-400">
            Куратор добавляет учеников на странице «Класс», затем староста назначает дежурных в разделе «График».
          </p>
          <Link to="/class" className="btn-primary mt-4">
            Перейти в класс
          </Link>
        </section>
      ) : null}

      <section className="glass p-4 sm:p-5">
        <SectionTitle
          title="Отметки за день"
          subtitle={
            emptyClass
              ? 'Отмечать будет некого, пока класс пуст'
              : `Отмечено ${reported} из ${counts.onDuty}. Нажмите на статус, чтобы изменить его.`
          }
          action={
            counts.onDuty > 0 ? (
              <div className="w-40">
                <ProgressBar value={reported} max={counts.onDuty} />
              </div>
            ) : undefined
          }
        />

        {duties.length === 0 ? (
          <EmptyState
            icon="🗓"
            title="На этот день дежурных нет"
            hint={!day.isSchoolDay ? 'Воскресенье — выходной.' : 'Используйте «Добавить дежурного» или «Заполнить месяц» в графике.'}
          />
        ) : (
          <div className="grid gap-2.5 md:grid-cols-2">
            {duties.map((duty) => (
              <DutyRow
                key={duty.id}
                duty={duty}
                roster={roster}
                canEdit
                onChanged={onPatch}
                onDeleted={onDelete}
              />
            ))}
          </div>
        )}
      </section>

      <section className="glass p-4 sm:p-5">
        <SectionTitle
          title="Не назначены"
          subtitle={
            notOnDuty.length > 0
              ? `${notOnDuty.length} из ${counts.totalStudents} учеников сегодня не дежурят`
              : counts.totalStudents > 0
                ? 'Все ученики назначены'
                : 'Класс пока пуст'
          }
          action={
            <Link to="/schedule" className="btn-ghost btn-sm">
              К графику
            </Link>
          }
        />
        {notOnDuty.length === 0 ? (
          <p className="text-sm text-slate-400">
            {counts.totalStudents > 0 ? 'Весь класс назначен 🏆' : 'Добавьте учеников, чтобы назначать дежурства.'}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {notOnDuty.map((u) => (
              <button
                key={u.id}
                type="button"
                onClick={() => onQuickAdd(u.id)}
                className="chip border-white/10 bg-white/[0.04] text-slate-300 transition hover:border-emerald-400/40 hover:bg-emerald-400/10 hover:text-white"
                title="Назначить на этот день"
              >
                <span className="text-slate-500">+</span>
                {u.fullName}
              </button>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

function StudentToday({ data }: { data: StudentDashboard }) {
  const { myDuty, onDutyWithMe, counts } = data.today;
  const myStatus = useMemo(() => myDuty?.status ?? 'NOT_ASSIGNED', [myDuty]);
  const onDuty = myDuty !== null;

  return (
    <>
      <div
        className={`glass animate-fade-up relative overflow-hidden p-5 sm:p-6 ${
          onDuty ? 'ring-1 ring-inset ring-emerald-400/25' : ''
        }`}
      >
        <div
          className={`pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full blur-3xl ${
            onDuty ? 'bg-emerald-400/20' : 'bg-slate-500/10'
          }`}
        />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
              {formatDateLong(data.today.day.date)}
            </p>
            <h2 className="mt-1.5 text-2xl font-bold tracking-tight text-white">
              {onDuty ? '🧹 Сегодня ты дежуришь' : '☀️ Сегодня ты свободен'}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {onDuty
                ? myDuty?.status === 'ASSIGNED'
                  ? 'Отметься, когда выполнишь дежурство — это сделает староста.'
                  : 'Дежурство уже отмечено. Спасибо за порядок!'
                : 'У тебя сегодня нет дежурства. Можно отдохнуть 🙂'}
            </p>
          </div>
          <div className="text-right">
            <StatusChip status={myStatus} />
            {myDuty?.replacementName ? (
              <p className="mt-2 text-xs text-slate-400">Дежурил за тебя: {myDuty.replacementName}</p>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard index={0} label="Назначено" value={data.myStats.assigned} icon="📋" tone="slate" />
        <StatCard index={1} label="Выполнено" value={data.myStats.done} icon="🟢" tone="green" />
        <StatCard index={2} label="Болел" value={data.myStats.sick} icon="🟡" tone="yellow" />
        <StatCard index={3} label="Замен" value={data.myStats.replaced} icon="🔵" tone="blue" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="glass p-4 sm:p-5">
          <SectionTitle title="Кто ещё дежурит сегодня" subtitle={`Всего дежурных: ${counts.onDuty}`} />
          {onDutyWithMe.length === 0 ? (
            <p className="text-sm text-slate-400">Ты дежуришь один(а) сегодня</p>
          ) : (
            <ul className="flex flex-col gap-2">
              {onDutyWithMe.map((d) => (
                <li key={d.id} className="flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2">
                  <span className="truncate text-sm text-slate-200">{d.user.fullName}</span>
                  <StatusChip status={d.status} size="sm" />
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="glass p-4 sm:p-5">
          <SectionTitle title="Ближайшее дежурство" />
          {data.nextDuty ? (
            <div className="flex items-center justify-between gap-3 rounded-xl border border-emerald-400/20 bg-emerald-400/[0.07] px-3.5 py-3">
              <div>
                <p className="text-sm font-semibold text-white">{formatDateLong(data.nextDuty.date)}</p>
                <p className="mt-0.5 text-xs text-slate-400">
                  {data.nextDuty.date === data.today.day.date ? 'сегодня' : `через ${relativeDays(data.nextDuty.date, data.today.day.date)} дн.`}
                </p>
              </div>
              <StatusChip status={data.nextDuty.status} size="sm" />
            </div>
          ) : (
            <p className="text-sm text-slate-400">Назначений пока нет</p>
          )}

          {data.history.length > 0 ? (
            <div className="mt-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Мои прошлые дежурства</p>
              <ul className="flex flex-col gap-1.5">
                {data.history.slice(0, 6).map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="text-slate-400">{d.date.split('-').reverse().join('.')}</span>
                    <StatusChip status={d.status} size="sm" />
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      </div>
    </>
  );
}

function relativeDays(target: string, from: string): number {
  const a = new Date(`${target}T00:00:00`).getTime();
  const b = new Date(`${from}T00:00:00`).getTime();
  return Math.max(0, Math.round((a - b) / 86_400_000));
}
