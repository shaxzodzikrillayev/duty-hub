import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { AuthLayout, FormError } from './AuthLayout';
import { useAuth } from '../context/AuthContext';
import { ROLE_META } from '../lib/const';
import type { Role } from '../types';

const ROLES: Role[] = ['STUDENT', 'MONITOR', 'CURATOR'];

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [role, setRole] = useState<Role>('STUDENT');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await register({
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        username: username.trim(),
        password,
        role,
      });
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось зарегистрироваться');
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthLayout
      title="Регистрация"
      subtitle="Четыре поля и роль — аккаунт готов сразу"
      footer={
        <>
          Уже есть аккаунт?{' '}
          <Link to="/login" className="link font-semibold">
            Войти
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <span className="label">Кем вы являетесь?</span>
          <div className="grid grid-cols-3 gap-2">
            {ROLES.map((r) => {
              const meta = ROLE_META[r];
              const active = role === r;
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  className={`flex flex-col items-center gap-1 rounded-xl border px-2 py-3 text-xs font-semibold transition ${
                    active
                      ? 'border-emerald-400/50 bg-emerald-400/10 text-white shadow-glow'
                      : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:text-slate-200'
                  }`}
                >
                  <span className="text-lg" aria-hidden>
                    {meta.emoji}
                  </span>
                  {meta.short}
                </button>
              );
            })}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="reg-first">
              Имя
            </label>
            <input
              id="reg-first"
              className="field"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Шахзод"
              required
            />
          </div>
          <div>
            <label className="label" htmlFor="reg-last">
              Фамилия
            </label>
            <input
              id="reg-last"
              className="field"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Зикриллаев"
              required
            />
          </div>
        </div>

        <div>
          <label className="label" htmlFor="reg-username">
            Логин
          </label>
          <input
            id="reg-username"
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase())}
            placeholder="латиница, 3–24 символа"
            autoComplete="username"
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="reg-password">
            Пароль
          </label>
          <input
            id="reg-password"
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="минимум 6 символов"
            autoComplete="new-password"
            required
            minLength={6}
          />
        </div>

        <FormError message={error} />

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Создаём аккаунт…' : 'Зарегистрироваться'}
        </button>
      </form>
    </AuthLayout>
  );
}
