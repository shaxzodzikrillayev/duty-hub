import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './components/Toast';
import { AppShell } from './components/AppShell';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { TodayPage } from './pages/TodayPage';
import { SchedulePage } from './pages/SchedulePage';
import { ClassPage } from './pages/ClassPage';
import { StatsPage } from './pages/StatsPage';
import { JournalPage } from './pages/JournalPage';
import { Loader } from './components/ui';
import type { ReactNode } from 'react';
import type { Role } from './types';

function FullScreenLoader() {
  return (
    <div className="grid min-h-screen place-items-center">
      <Loader label="Duty Hub 5 «Г»…" />
    </div>
  );
}

/** Проверка авторизации на клиенте — только UX. Реальные права проверяет backend. */
function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) return <FullScreenLoader />;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <AppShell>{children}</AppShell>;
}

/** Ограничение страниц по роли. При попытке зайти напрямую — отказ. */
function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to="/" replace />;
  return <AppShell>{children}</AppShell>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <FullScreenLoader />;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

export function App() {
  return (
    <ToastProvider>
      <AuthProvider>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicOnly>
                <LoginPage />
              </PublicOnly>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnly>
                <RegisterPage />
              </PublicOnly>
            }
          />

          <Route
            path="/"
            element={
              <RequireAuth>
                <TodayPage />
              </RequireAuth>
            }
          />
          <Route
            path="/schedule"
            element={
              <RequireAuth>
                <SchedulePage />
              </RequireAuth>
            }
          />
          <Route
            path="/class"
            element={
              <RequireAuth>
                <ClassPage />
              </RequireAuth>
            }
          />
          <Route
            path="/stats"
            element={
              <RequireRole roles={['MONITOR', 'CURATOR']}>
                <StatsPage />
              </RequireRole>
            }
          />
          <Route
            path="/journal"
            element={
              <RequireRole roles={['MONITOR', 'CURATOR']}>
                <JournalPage />
              </RequireRole>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </ToastProvider>
  );
}
