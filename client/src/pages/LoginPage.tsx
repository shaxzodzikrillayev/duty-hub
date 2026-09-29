import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { api, ApiError } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { ROLE_META } from '../lib/const';
import type { Role } from '../types';

interface Person {
  id: number;
  firstName: string;
  lastName: string;
  fullName: string;
  role: Role;
}

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50 focus:bg-white/[0.06]';

export function LoginPage() {
  const { user, loading, login, loginPin } = useAuth();
  const navigate = useNavigate();

  const [people, setPeople] = useState<Person[]>([]);
  const [loadingPeople, setLoadingPeople] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<Person | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'pin' | 'password'>('pin');

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    api.auth
      .people()
      .then((r) => setPeople(r.people))
      .catch(() => setError('Не удалось загрузить список класса'))
      .finally(() => setLoadingPeople(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return people;
    return people.filter((p) => p.fullName.toLowerCase().includes(q));
  }, [people, search]);

  if (!loading && user) return <Navigate to="/" replace />;

  const submitPin = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError('');
    if (pin.length !== 4) {
      setError('PIN состоит из 4 цифр');
      return;
    }
    setBusy(true);
    try {
      await loginPin(selected.id, pin);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
      setPin('');
    } finally {
      setBusy(false);
    }
  };

  const submitPassword = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти');
    } finally {
      setBusy(false);
    }
  };

  const pick = (p: Person) => {
    setSelected(p);
    setPin('');
    setError('');
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden border-r border-white/[0.07] bg-ink-950 p-10 lg:flex">
        <div className="pointer-events-none absolute -left-24 top-10 h-72 w-72 rounded-full bg-emerald-500/10 blur-3xl" />
        <div className="pointer-events-none absolute bottom-0 right-0 h-80 w-80 rounded-full bg-sky-500/10 blur-3xl" />
        <Logo />
        <div className="relative">
          <h1 className="text-3xl font-bold leading-tight text-white">
            Выбери себя —
            <br />
            и входи двумя нажатиями
          </h1>
          <p className="mt-3 max-w-md text-sm text-slate-400">
            Никаких логинов: нажми на свою фамилию и введи свой PIN из четырёх цифр. PIN выдал куратор.
          </p>
          <div className="mt-6 flex flex-wrap gap-2 text-xs text-slate-500">
            <span className="chip">🧹 дежурства</span>
            <span className="chip">🗓 график</span>
            <span className="chip">📈 статистика</span>
            <span className="chip">📓 журнал изменений</span>
          </div>
        </div>
        <p className="relative text-[11px] text-slate-600">Duty Hub 5 «Г»</p>
      </section>

      <section className="flex items-center justify-center p-5 sm:p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden">
            <Logo />
          </div>

          <div className="mt-6 flex gap-1 rounded-xl border border-white/10 bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => {
                setMode('pin');
                setError('');
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                mode === 'pin' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400 hover:text-white'
              }`}
            >
              По фамилии и PIN
            </button>
            <button
              type="button"
              onClick={() => {
                setMode('password');
                setError('');
              }}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold transition ${
                mode === 'password' ? 'bg-emerald-400/15 text-emerald-200' : 'text-slate-400 hover:text-white'
              }`}
            >
              Логин и пароль
            </button>
          </div>

          {mode === 'pin' ? (
            <div className="mt-4">
              {selected ? (
                <form onSubmit={submitPin} className="glass p-5">
                  <div className="flex items-center gap-3">
                    <span className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-slate-600/60 to-slate-800/60 text-sm font-bold text-white">
                      {initials(selected.fullName)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-white">{selected.fullName}</p>
                      <p className={`text-xs ${ROLE_META[selected.role].tone}`}>
                        {ROLE_META[selected.role].emoji} {ROLE_META[selected.role].label}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setSelected(null);
                        setPin('');
                        setError('');
                      }}
                      className="rounded-lg p-1.5 text-slate-400 transition hover:bg-white/10 hover:text-white"
                      aria-label="Сменить человека"
                    >
                      ✕
                    </button>
                  </div>

                  <input
                    inputMode="numeric"
                    autoFocus
                    maxLength={4}
                    value={pin}
                    onChange={(e) => {
                      setError('');
                      setPin(e.target.value.replace(/\D/g, '').slice(0, 4));
                    }}
                    placeholder="••••"
                    className={`${inputClass} mt-4 text-center text-2xl tracking-[0.6em]`}
                  />
                  {error ? <p className="mt-2 text-center text-sm text-rose-300">{error}</p> : null}
                  <button type="submit" disabled={busy || pin.length !== 4} className="btn-primary mt-4 w-full">
                    {busy ? 'Проверяем…' : 'Войти'}
                  </button>
                </form>
              ) : (
                <>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Поиск по фамилии…"
                    className={inputClass}
                  />
                  {error ? <p className="mt-2 text-sm text-rose-300">{error}</p> : null}
                  <div className="mt-3 max-h-[46vh] space-y-1.5 overflow-y-auto pr-1">
                    {loadingPeople ? (
                      <p className="py-6 text-center text-sm text-slate-500">Загружаем класс…</p>
                    ) : filtered.length === 0 ? (
                      <p className="py-6 text-center text-sm text-slate-500">
                        {people.length === 0
                          ? 'Список класса пока пуст — куратор добавит учеников'
                          : 'Никого не нашли'}
                      </p>
                    ) : (
                      filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => pick(p)}
                          className="flex w-full items-center gap-3 rounded-xl border border-white/[0.07] bg-white/[0.03] px-3 py-2.5 text-left transition hover:border-emerald-400/30 hover:bg-emerald-400/10"
                        >
                          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-gradient-to-br from-slate-600/60 to-slate-800/60 text-xs font-bold text-white">
                            {initials(p.fullName)}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-sm font-medium text-white">{p.fullName}</span>
                            <span className={`text-[11px] ${ROLE_META[p.role].tone}`}>
                              {ROLE_META[p.role].emoji} {ROLE_META[p.role].label}
                            </span>
                          </span>
                          <span className="text-slate-600">→</span>
                        </button>
                      ))
                    )}
                  </div>
                </>
              )}
            </div>
          ) : (
            <form onSubmit={submitPassword} className="glass mt-4 space-y-3 p-5">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Логин</span>
                <input
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  autoComplete="username"
                  className={inputClass}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-slate-400">Пароль</span>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  className={inputClass}
                  required
                />
              </label>
              {error ? <p className="text-sm text-rose-300">{error}</p> : null}
              <button type="submit" disabled={busy} className="btn-primary w-full">
                {busy ? 'Входим…' : 'Войти'}
              </button>
              <p className="text-center text-xs text-slate-500">
                Куратор: <span className="text-slate-400">curator</span> · PIN и пароль выдаёт куратор
              </p>
            </form>
          )}
        </div>
      </section>
    </div>
  );
}

function initials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
}

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg shadow-[0_8px_24px_-10px_rgba(16,185,129,0.9)]">
        🧹
      </span>
      <div className="leading-tight">
        <p className="text-sm font-bold tracking-tight text-white">Duty Hub</p>
        <p className="text-[11px] text-slate-500">класс 5 «Г»</p>
      </div>
    </div>
  );
}
