import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import { AuthLayout, FormError } from './AuthLayout';
import { useAuth } from '../context/AuthContext';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username.trim(), password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось войти. Попробуйте ещё раз.');
    } finally {
      setBusy(false);
    }
  };

  const fill = (u: string, p: string) => {
    setUsername(u);
    setPassword(p);
  };

  return (
    <AuthLayout
      title="Вход в систему"
      subtitle="Введите логин и пароль, выданные старостой или куратором"
      footer={
        <>
          Ещё нет аккаунта?{' '}
          <Link to="/register" className="link font-semibold">
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="flex flex-col gap-4">
        <div>
          <label className="label" htmlFor="login-username">
            Логин
          </label>
          <input
            id="login-username"
            className="field"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="например shahzod"
            autoComplete="username"
            autoFocus
            required
          />
        </div>

        <div>
          <label className="label" htmlFor="login-password">
            Пароль
          </label>
          <input
            id="login-password"
            type="password"
            className="field"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            autoComplete="current-password"
            required
          />
        </div>

        <FormError message={error} />

        <button type="submit" className="btn-primary w-full" disabled={busy}>
          {busy ? 'Входим…' : 'Войти'}
        </button>

        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-xs text-slate-400">
          <p className="mb-2 font-semibold text-slate-300">Единственный готовый аккаунт</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fill('curator', 'Curator12345')}
              className="chip border-violet-400/30 bg-violet-400/10 text-violet-200 hover:bg-violet-400/20"
            >
              👩‍🏫 Куратор
            </button>
          </div>
          <p className="mt-2 leading-relaxed">
            Учеников, старосту и график добавляет куратор: класс — на странице «Класс»,
            дежурства — на странице «График».
          </p>
        </div>
      </form>
    </AuthLayout>
  );
}
