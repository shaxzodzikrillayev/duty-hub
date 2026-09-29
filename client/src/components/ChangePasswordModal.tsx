import { useState, type FormEvent } from 'react';
import { api, ApiError } from '../api/client';
import { Modal } from './Modal';
import { useToast } from './Toast';

const inputClass =
  'w-full rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none transition placeholder:text-slate-600 focus:border-emerald-400/50 focus:bg-white/[0.06]';

export function ChangePasswordModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const toast = useToast();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [repeatPassword, setRepeatPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const reset = () => {
    setCurrentPassword('');
    setNewPassword('');
    setRepeatPassword('');
    setError('');
  };

  const close = () => {
    if (saving) return;
    reset();
    onClose();
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < 6) {
      setError('Новый пароль: минимум 6 символов');
      return;
    }
    if (newPassword !== repeatPassword) {
      setError('Новые пароли не совпадают');
      return;
    }

    setSaving(true);
    try {
      await api.auth.changePassword(currentPassword, newPassword);
      toast.push('Пароль изменён 🔐', 'success');
      reset();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Не удалось изменить пароль');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title="Смена пароля"
      footer={
        <>
          <button type="button" onClick={close} className="btn-ghost btn-sm" disabled={saving}>
            Отмена
          </button>
          <button type="submit" form="change-password-form" className="btn-primary btn-sm" disabled={saving}>
            {saving ? 'Сохраняем…' : 'Изменить пароль'}
          </button>
        </>
      }
    >
      <form id="change-password-form" onSubmit={submit} className="space-y-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Текущий пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClass}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Новый пароль</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className={inputClass}
            minLength={6}
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-400">Повторите новый пароль</span>
          <input
            type="password"
            autoComplete="new-password"
            value={repeatPassword}
            onChange={(e) => setRepeatPassword(e.target.value)}
            className={inputClass}
            minLength={6}
            required
          />
        </label>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <p className="text-xs text-slate-500">
          Пароль хранится только в виде хеша, а сама смена попадёт в журнал изменений.
        </p>
      </form>
    </Modal>
  );
}
