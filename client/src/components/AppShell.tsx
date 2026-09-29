import { useState, type ReactNode } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLE_META } from '../lib/const';
import { formatDateLong, todayISO } from '../lib/dates';
import { ChangePasswordModal } from './ChangePasswordModal';

interface NavItem {
  to: string;
  label: string;
  icon: ReactNode;
  roles: ('STUDENT' | 'MONITOR' | 'CURATOR')[];
}

const icon = (path: ReactNode) => (
  <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    {path}
  </svg>
);

const NAV: NavItem[] = [
  {
    to: '/',
    label: 'Сегодня',
    icon: icon(<><path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" /><circle cx="12" cy="12" r="4" /></>),
    roles: ['STUDENT', 'MONITOR', 'CURATOR'],
  },
  {
    to: '/schedule',
    label: 'График',
    icon: icon(<><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></>),
    roles: ['STUDENT', 'MONITOR', 'CURATOR'],
  },
  {
    to: '/class',
    label: 'Класс',
    icon: icon(<><path d="M16 19v-1.5A3.5 3.5 0 0 0 12.5 14h-5A3.5 3.5 0 0 0 4 17.5V19" /><circle cx="10" cy="8" r="3.2" /><path d="M17 11.5a2.6 2.6 0 1 0-1.6-4.7M20 19v-1.3a3.2 3.2 0 0 0-2.4-3.1" /></>),
    roles: ['STUDENT', 'MONITOR', 'CURATOR'],
  },
  {
    to: '/stats',
    label: 'Статистика',
    icon: icon(<><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>),
    roles: ['MONITOR', 'CURATOR'],
  },
  {
    to: '/journal',
    label: 'Журнал',
    icon: icon(<><path d="M5 3h9l5 5v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /><path d="M14 3v5h5M8 13h8M8 17h5" /></>),
    roles: ['MONITOR', 'CURATOR'],
  },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [menuOpen, setMenuOpen] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  if (!user) return null;
  const role = ROLE_META[user.role];
  const items = NAV.filter((n) => n.roles.includes(user.role));

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 z-40 hidden h-screen w-64 shrink-0 flex-col border-r border-white/[0.07] bg-ink-950/70 px-4 py-5 backdrop-blur-xl lg:flex">
        <Logo />
        <nav className="mt-7 flex flex-1 flex-col gap-1">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? 'bg-emerald-400/10 text-white ring-1 ring-inset ring-emerald-400/25'
                    : 'text-slate-400 hover:bg-white/[0.05] hover:text-slate-100'
                }`
              }
            >
              <span className="opacity-80 transition group-hover:opacity-100">{item.icon}</span>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
          <div className="flex items-center gap-3">
            <Avatar name={user.fullName} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-white">{user.fullName}</p>
              <p className={`text-xs ${role.tone}`}>{role.emoji} {role.label}</p>
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="btn-ghost btn-sm"
            >
              🔑 Пароль
            </button>
            <button type="button" onClick={handleLogout} className="btn-ghost btn-sm">
              Выйти
            </button>
          </div>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-white/[0.07] bg-ink-950/80 px-4 py-3 backdrop-blur-xl lg:px-8">
          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-lg border border-white/10 p-2 text-slate-300 lg:hidden"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="Меню"
            >
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            </button>
            <div className="lg:hidden">
              <Logo compact />
            </div>
            <div className="hidden sm:block">
              <p className="text-sm font-semibold text-white">
                {items.find((i) => (i.to === '/' ? location.pathname === '/' : location.pathname.startsWith(i.to)))?.label ?? 'Duty Hub'}
              </p>
              <p className="text-xs text-slate-500">{formatDateLong(todayISO())}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className={`chip hidden sm:inline-flex ${role.chip}`}>
              {role.emoji} {role.label}
            </span>
            <div className="lg:hidden">
              <Avatar name={user.fullName} />
            </div>
            <button
              type="button"
              onClick={() => setPasswordOpen(true)}
              className="btn-ghost btn-sm lg:hidden"
            >
              🔑 Пароль
            </button>
            <button type="button" onClick={handleLogout} className="btn-ghost btn-sm lg:hidden">
              Выйти
            </button>
          </div>
        </header>

        {menuOpen ? (
          <nav className="animate-fade-up border-b border-white/[0.07] bg-ink-950/95 px-4 py-2 backdrop-blur-xl lg:hidden">
            {items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/'}
                onClick={() => setMenuOpen(false)}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition ${
                    isActive ? 'bg-emerald-400/10 text-white' : 'text-slate-400 hover:bg-white/5'
                  }`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>
        ) : null}

        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5 lg:px-8 lg:py-7">{children}</main>

        <ChangePasswordModal open={passwordOpen} onClose={() => setPasswordOpen(false)} />

        <footer className="px-4 pb-6 text-center text-[11px] text-slate-600 lg:px-8">
          Duty Hub 5 «Г» · дежурства класса без лишней бумаги
        </footer>
      </div>
    </div>
  );
}

function Logo({ compact = false }: { compact?: boolean }) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-lg shadow-[0_8px_24px_-10px_rgba(16,185,129,0.9)]">
        🧹
      </span>
      {!compact ? (
        <div className="leading-tight">
          <p className="text-sm font-bold tracking-tight text-white">Duty Hub</p>
          <p className="text-[11px] text-slate-500">класс 5 «Г»</p>
        </div>
      ) : null}
    </div>
  );
}

function Avatar({ name }: { name: string }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((w) => w.charAt(0))
    .join('')
    .toUpperCase();
  return (
    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-slate-600/60 to-slate-800/60 text-xs font-bold text-white">
      {initials}
    </span>
  );
}
