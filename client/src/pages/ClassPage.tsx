import { useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import { Modal } from '../components/Modal';
import { EmptyState, ErrorState, Loader, ProgressBar, SectionTitle, StatCard } from '../components/ui';
import { ROLE_META, STATUS_META } from '../lib/const';
import { formatDateShort, relativeDay, todayISO } from '../lib/dates';
import type { Duty, Role, User } from '../types';

export function ClassPage() {
  const { user } = useAuth();
  const toast = useToast();
  const [query, setQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<Role | 'ALL'>('ALL');
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [removing, setRemoving] = useState<User | null>(null);
  const [historyFor, setHistoryFor] = useState<User | null>(null);

  const canManage = user?.role === 'MONITOR' || user?.role === 'CURATOR';
  const canEdit = user?.role === 'CURATOR';

  const users = useAsync<{ users: User[]; meta: { canManage: boolean; canEdit: boolean } }>(
    () => api.users.list(),
    [],
  );
  const duties = useAsync<{ duties: Duty[] }>(() => api.duties.list(todayISO(), todayISO()), []);

  const todayByUser = useMemo(() => {
    const map = new Map<number, Duty>();
    for (const d of duties.data?.duties ?? []) map.set(d.userId, d);
    return map;
  }, [duties.data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return (users.data?.users ?? [])
      .filter((u) => (roleFilter === 'ALL' ? true : u.role === roleFilter))
      .filter((u) => (q ? u.fullName.toLowerCase().includes(q) : true));
  }, [users.data, query, roleFilter]);

  const counts = useMemo(() => {
    const all = users.data?.users ?? [];
    return {
      total: all.length,
      students: all.filter((u) => u.role === 'STUDENT').length,
      monitor: all.filter((u) => u.role === 'MONITOR').length,
      curator: all.filter((u) => u.role === 'CURATOR').length,
    };
  }, [users.data]);

  if (users.loading && !users.data) return <Loader label="Загружаем класс…" />;
  if (users.error) return <ErrorState message={users.error} onRetry={() => void users.reload()} />;

  return (
    <div className="flex flex-col gap-5">
      <header className="glass animate-fade-up flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-white">Класс 5 «Г»</h1>
          <p className="mt-0.5 text-sm text-slate-400">Список учеников, староста и куратор</p>
        </div>
        {canManage ? (
          <button type="button" className="btn-primary" onClick={() => setAddOpen(true)}>
            + Добавить ученика
          </button>
        ) : null}
      </header>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard index={0} label="Всего" value={counts.total} icon="🎒" tone="slate" />
        <StatCard index={1} label="Учеников" value={counts.students} icon="👨‍🎓" tone="blue" />
        <StatCard index={2} label="Староста" value={counts.monitor} icon="👑" tone="yellow" />
        <StatCard index={3} label="Куратор" value={counts.curator} icon="👩‍🏫" tone="violet" />
      </div>

      <section className="glass p-4 sm:p-5">
        <SectionTitle
          title="Список класса"
          subtitle={canEdit ? 'Куратор может редактировать карточки и удалять учеников' : canManage ? 'Староста может добавлять учеников' : 'Список виден в режиме просмотра'}
          action={
            <div className="flex flex-wrap items-center gap-2">
              <input
                className="field h-9 w-44 py-1.5 text-sm"
                placeholder="Поиск…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
              <select
                className="field h-9 w-auto py-1.5 text-sm"
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as Role | 'ALL')}
              >
                <option value="ALL">Все роли</option>
                <option value="STUDENT">Ученики</option>
                <option value="MONITOR">Староста</option>
                <option value="CURATOR">Куратор</option>
              </select>
            </div>
          }
        />

        {filtered.length === 0 ? (
          <EmptyState
            icon="🎒"
            title={query || roleFilter !== 'ALL' ? 'Никого не нашли' : 'В классе пока нет учеников'}
            hint={
              query || roleFilter !== 'ALL'
                ? 'Измените запрос или фильтр роли.'
                : canManage
                  ? 'Добавьте учеников кнопкой «+ Добавить ученик» — они сразу появятся в списке.'
                  : 'Куратор ещё не добавил учеников.'
            }
          />
        ) : (
          <ul className="grid gap-2.5 md:grid-cols-2">
            {filtered.map((u, i) => {
              const todayDuty = todayByUser.get(u.id);
              const canSeeHistory = user?.role !== 'STUDENT' || u.id === user?.id;
              return (
                <li
                  key={u.id}
                  className="animate-fade-up flex items-center justify-between gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3 transition hover:border-white/20 hover:bg-white/[0.06]"
                  style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[0.07] text-sm font-bold text-slate-200">
                      {u.position > 0 ? u.position : '—'}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">
                        {u.fullName}
                        {u.id === user?.id ? <span className="ml-1.5 text-[10px] text-emerald-300">это вы</span> : null}
                      </p>
                      <p className="truncate text-xs text-slate-500">
                        @{u.username} ·{' '}
                        <span className={ROLE_META[u.role].tone}>{ROLE_META[u.role].emoji} {ROLE_META[u.role].label}</span>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {todayDuty ? (
                      <span
                        className={`chip ${STATUS_META[todayDuty.status].chip}`}
                        title={`Дежурство ${relativeDay(todayDuty.date)}`}
                      >
                        <span aria-hidden>{STATUS_META[todayDuty.status].emoji}</span>
                      </span>
                    ) : (
                      <span className="chip border-slate-600/40 bg-slate-600/10 text-slate-500" title="Сегодня не дежурит">
                        <span aria-hidden>⚪</span>
                      </span>
                    )}

                    {canSeeHistory ? (
                      <button
                        type="button"
                        onClick={() => setHistoryFor(u)}
                        className="rounded-lg border border-white/10 p-1.5 text-slate-500 transition hover:border-white/25 hover:text-slate-200"
                        title="История дежурств"
                      >
                        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                          <circle cx="12" cy="12" r="8" /><path d="M12 8v4l3 2" />
                        </svg>
                      </button>
                    ) : null}

                    {canEdit && u.id !== user?.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setEditing(u)}
                          className="rounded-lg border border-white/10 p-1.5 text-slate-500 transition hover:border-white/25 hover:text-slate-200"
                          title="Редактировать"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M4 20h4l10-10-4-4L4 16v4Z" />
                          </svg>
                        </button>
                        <button
                          type="button"
                          onClick={() => setRemoving(u)}
                          className="rounded-lg border border-white/10 p-1.5 text-slate-500 transition hover:border-rose-400/40 hover:text-rose-300"
                          title="Удалить"
                        >
                          <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                            <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13" />
                          </svg>
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <UserFormModal
        open={addOpen || editing !== null}
        user={editing}
        onClose={() => {
          setAddOpen(false);
          setEditing(null);
        }}
        onSaved={() => {
          void users.reload();
          setEditing(null);
        }}
      />

      <HistoryModal user={historyFor} onClose={() => setHistoryFor(null)} />

      <Modal
        open={removing !== null}
        onClose={() => setRemoving(null)}
        title="Удалить из класса?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setRemoving(null)}>
              Отмена
            </button>
            <button
              type="button"
              className="btn-danger"
              onClick={async () => {
                if (!removing) return;
                try {
                  await api.users.remove(removing.id);
                  toast.push('Ученик удалён из класса', 'info');
                  await users.reload();
                } catch (err) {
                  toast.push(err instanceof ApiError ? err.message : 'Не удалось удалить', 'error');
                } finally {
                  setRemoving(null);
                }
              }}
            >
              Удалить
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {removing?.fullName} будет удалён вместе со своими назначениями и отметками. Действие попадёт в журнал изменений.
        </p>
      </Modal>
    </div>
  );
}

function UserFormModal({
  open,
  user,
  onClose,
  onSaved,
}: {
  open: boolean;
  user: User | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { user: me } = useAuth();
  const toast = useToast();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [role, setRole] = useState<Role>('STUDENT');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialPassword, setInitialPassword] = useState<string | null>(null);

  // Сброс полей при открытии
  const key = `${open}-${user?.id ?? 'new'}`;
  const [lastKey, setLastKey] = useState('');
  if (key !== lastKey) {
    setLastKey(key);
    setFirstName(user?.firstName ?? '');
    setLastName(user?.lastName ?? '');
    setUsername(user?.username ?? '');
    setRole(user?.role ?? 'STUDENT');
    setError(null);
    setInitialPassword(null);
  }

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (user) {
        await api.users.update(user.id, { firstName, lastName, username, role });
        toast.push('Профиль обновлён');
      } else {
        const res = await api.users.create({ firstName, lastName, username, role });
        if (res.initialPassword) setInitialPassword(res.initialPassword);
        toast.push('Ученик добавлен в класс');
      }
      onSaved();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось сохранить');
    } finally {
      setBusy(false);
    }
  };

  const resetPassword = async () => {
    if (!user) return;
    try {
      const { initialPassword: pwd } = await api.users.resetPassword(user.id);
      setInitialPassword(pwd);
      toast.push('Пароль сброшен');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Не удалось сбросить пароль', 'error');
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={user ? 'Редактировать профиль' : 'Новый ученик'}
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Закрыть
          </button>
          {user ? (
            <button type="button" className="btn-ghost" onClick={resetPassword}>
              Сбросить пароль
            </button>
          ) : null}
          <button type="button" className="btn-primary" onClick={submit} disabled={busy}>
            {busy ? 'Сохраняем…' : 'Сохранить'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label">Имя</label>
            <input className="field" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
          </div>
          <div>
            <label className="label">Фамилия</label>
            <input className="field" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>

        <div>
          <label className="label">Логин</label>
          <input
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            required
          />
        </div>

        <div>
          <label className="label">Роль</label>
          <select className="field" value={role} onChange={(e) => setRole(e.target.value as Role)} disabled={me?.role !== 'CURATOR'}>
            <option value="STUDENT">👨‍🎓 Ученик</option>
            {me?.role === 'CURATOR' ? (
              <>
                <option value="MONITOR">👑 Староста</option>
                <option value="CURATOR">👩‍🏫 Куратор</option>
              </>
            ) : null}
          </select>
          {me?.role !== 'CURATOR' ? (
            <p className="mt-1.5 text-xs text-slate-500">Роль может менять только куратор.</p>
          ) : null}
        </div>

        {initialPassword ? (
          <div className="rounded-xl border border-emerald-400/25 bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-100">
            Временный пароль: <span className="font-mono font-semibold">{initialPassword}</span>
            <p className="mt-1 text-xs text-emerald-200/70">Передайте его ученику — пароль хранится только в виде хеша.</p>
          </div>
        ) : null}

        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      </div>
    </Modal>
  );
}

function HistoryModal({ user, onClose }: { user: User | null; onClose: () => void }) {
  const { user: me } = useAuth();
  const mine = me?.id === user?.id;
  const history = useAsync<{ duties: Duty[] }>(
    () => api.duties.history(user?.id ?? 0, '2000-01-01', todayISO()),
    [user?.id],
    user === null,
  );

  const list = history.data?.duties ?? [];
  const stats = useMemo(
    () => ({
      assigned: list.length,
      done: list.filter((d) => d.status === 'DONE').length,
      missed: list.filter((d) => d.status === 'MISSED').length,
      sick: list.filter((d) => d.status === 'SICK').length,
      replaced: list.filter((d) => d.status === 'REPLACED').length,
    }),
    [list],
  );

  return (
    <Modal open={user !== null} onClose={onClose} title={`Дежурства: ${user?.fullName ?? ''}`} size="lg">
      {!mine && me?.role === 'STUDENT' ? (
        <p className="text-sm text-slate-400">Ученик видит только свою историю дежурств.</p>
      ) : null}

      {history.loading ? <Loader /> : null}
      {history.error ? <ErrorState message={history.error} onRetry={() => void history.reload()} /> : null}

      {!history.loading && !history.error ? (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-5">
            {[
              { label: 'Назначено', value: stats.assigned, tone: 'text-slate-200' },
              { label: 'Выполнено', value: stats.done, tone: 'text-emerald-300' },
              { label: 'Пропущено', value: stats.missed, tone: 'text-rose-300' },
              { label: 'Болел', value: stats.sick, tone: 'text-amber-300' },
              { label: 'Замен', value: stats.replaced, tone: 'text-sky-300' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                <p className="text-[11px] uppercase tracking-wide text-slate-500">{s.label}</p>
                <p className={`text-xl font-bold ${s.tone}`}>{s.value}</p>
              </div>
            ))}
          </div>

          <ProgressBar value={stats.done} max={Math.max(stats.assigned, 1)} className="mb-4" />

          {list.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-500">Дежурств пока не было</p>
          ) : (
            <ul className="max-h-80 space-y-1.5 overflow-y-auto pr-1">
              {[...list].reverse().map((d) => (
                <li
                  key={d.id}
                  className="flex items-center justify-between gap-3 rounded-lg border border-white/[0.07] bg-white/[0.02] px-3 py-2 text-sm"
                >
                  <span className="text-slate-300">{formatDateShort(d.date)}</span>
                  <span className="flex items-center gap-2">
                    {d.replacementName ? <span className="text-xs text-slate-500">замена: {d.replacementName}</span> : null}
                    <span className={`chip ${STATUS_META[d.status].chip}`}>
                      <span aria-hidden>{STATUS_META[d.status].emoji}</span>
                      {STATUS_META[d.status].label}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </>
      ) : null}
    </Modal>
  );
}
