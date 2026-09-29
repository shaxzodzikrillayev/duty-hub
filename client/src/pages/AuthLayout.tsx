import type { ReactNode } from 'react';

export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  footer: ReactNode;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-8">
      <div className="grid w-full max-w-5xl items-center gap-8 lg:grid-cols-[1.05fr_1fr]">
        <aside className="hidden flex-col gap-6 lg:flex">
          <div className="flex items-center gap-3">
            <span className="grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-2xl shadow-[0_10px_30px_-10px_rgba(16,185,129,0.9)]">
              🧹
            </span>
            <div>
              <p className="text-lg font-bold tracking-tight text-white">Duty Hub 5 «Г»</p>
              <p className="text-sm text-slate-400">Система управления дежурствами</p>
            </div>
          </div>

          <h1 className="max-w-md text-3xl font-bold leading-tight tracking-tight text-white xl:text-4xl">
            Дежурства класса — <span className="text-emerald-300">под контролем</span> старосты и куратора
          </h1>

          <ul className="flex flex-col gap-3 text-sm text-slate-300">
            <Feature emoji="👑" title="Староста" text="создаёт график, отмечает статусы, исправляет ошибки" />
            <Feature emoji="👩‍🏫" title="Куратор" text="полный доступ, управление классом и журнал изменений" />
            <Feature emoji="👨‍🎓" title="Ученик" text="видит только своё дежурство и статистику" />
          </ul>

          <div className="grid grid-cols-5 gap-2 pt-2">
            {(['🟢', '🔴', '🟡', '🔵', '⚪'] as const).map((e) => (
              <div key={e} className="glass grid h-12 place-items-center text-xl">
                {e}
              </div>
            ))}
          </div>
        </aside>

        <main className="glass-strong animate-scale-in p-6 sm:p-8">
          <div className="mb-6 flex items-center gap-3 lg:hidden">
            <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-xl">
              🧹
            </span>
            <div>
              <p className="text-sm font-bold text-white">Duty Hub 5 «Г»</p>
              <p className="text-xs text-slate-400">управление дежурствами</p>
            </div>
          </div>

          <h2 className="text-xl font-bold tracking-tight text-white">{title}</h2>
          <p className="mt-1 text-sm text-slate-400">{subtitle}</p>

          <div className="mt-6">{children}</div>
          <div className="mt-6 border-t border-white/[0.07] pt-4 text-center text-sm text-slate-400">{footer}</div>
        </main>
      </div>
    </div>
  );
}

function Feature({ emoji, title, text }: { emoji: string; title: string; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-base">
        {emoji}
      </span>
      <span>
        <span className="block text-sm font-semibold text-white">{title}</span>
        <span className="block text-sm text-slate-400">{text}</span>
      </span>
    </li>
  );
}

export function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p className="animate-fade-up rounded-xl border border-rose-400/25 bg-rose-500/10 px-3.5 py-2.5 text-sm text-rose-100">
      {message}
    </p>
  );
}
