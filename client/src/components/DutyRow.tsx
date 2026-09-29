import { useState } from 'react';
import { api, ApiError } from '../api/client';
import { useToast } from './Toast';
import { Modal } from './Modal';
import { StatusChip } from './ui';
import { StatusPicker, ReplacementSelect } from './StatusPicker';
import { formatDateShort, weekdayShort } from '../lib/dates';
import type { Duty, DutyStatus, User } from '../types';

interface Props {
  duty: Duty;
  roster: User[];
  canEdit: boolean;
  showDate?: boolean;
  busy?: boolean;
  onChanged: (duty: Duty) => void;
  onDeleted: (duty: Duty) => void;
}

export function DutyRow({ duty, roster, canEdit, showDate = false, busy = false, onChanged, onDeleted }: Props) {
  const toast = useToast();
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [replacementId, setReplacementId] = useState<number | null>(duty.replacementUserId);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const applyStatus = async (status: DutyStatus) => {
    if (status === 'REPLACED') {
      setReplacementId(duty.replacementUserId);
      setReplaceOpen(true);
      return;
    }
    try {
      const { duty: updated } = await api.duties.update(duty.id, { status });
      onChanged(updated);
      toast.push(`${duty.user.fullName}: ${status === 'DONE' ? 'дежурство отмечено' : 'статус обновлён'}`);
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Не удалось изменить статус', 'error');
    }
  };

  const saveReplacement = async () => {
    if (!replacementId) return;
    setSaving(true);
    try {
      const { duty: updated } = await api.duties.update(duty.id, {
        status: 'REPLACED',
        replacementUserId: replacementId,
      });
      onChanged(updated);
      setReplaceOpen(false);
      toast.push('Замена сохранена');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Не удалось сохранить замену', 'error');
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    try {
      await api.duties.remove(duty.id);
      onDeleted(duty);
      toast.push('Назначение удалено', 'info');
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Не удалось удалить', 'error');
    } finally {
      setConfirmDelete(false);
    }
  };

  return (
    <>
      <div
        className={`glass card-hover animate-fade-up p-3.5 transition-opacity ${busy ? 'opacity-60' : ''}`}
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-sm font-bold ${
                duty.user.role === 'MONITOR'
                  ? 'bg-amber-400/15 text-amber-200'
                  : duty.user.role === 'CURATOR'
                    ? 'bg-violet-400/15 text-violet-200'
                    : 'bg-white/[0.07] text-slate-200'
              }`}
            >
              {duty.user.firstName.charAt(0)}
              {duty.user.lastName.charAt(0)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-white">
                {duty.user.fullName}
                {duty.user.role === 'MONITOR' ? <span className="ml-1.5 text-xs text-amber-300">👑</span> : null}
              </p>
              <p className="truncate text-xs text-slate-500">
                {showDate ? `${weekdayShort(duty.date)} · ${formatDateShort(duty.date)}` : null}
                {duty.replacementName ? ` Замена: ${duty.replacementName}` : ''}
                {duty.comment ? ` · ${duty.comment}` : ''}
                {duty.updatedBy && showDate ? ` · изм. ${duty.updatedBy.fullName}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <StatusChip status={duty.status} size="sm" animate={duty.status === 'ASSIGNED'} />
            {canEdit ? (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-white/10 p-1.5 text-slate-500 transition hover:border-rose-400/40 hover:bg-rose-500/10 hover:text-rose-300"
                title="Удалить назначение"
              >
                <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                </svg>
              </button>
            ) : null}
          </div>
        </div>

        {canEdit ? (
          <div className="mt-3 border-t border-white/[0.06] pt-3">
            <StatusPicker value={duty.status} onSelect={applyStatus} size="sm" />
          </div>
        ) : null}
      </div>

      <Modal
        open={replaceOpen}
        onClose={() => setReplaceOpen(false)}
        title={`Замена: ${duty.user.fullName}`}
        size="sm"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setReplaceOpen(false)}>
              Отмена
            </button>
            <button type="button" className="btn-primary" onClick={saveReplacement} disabled={!replacementId || saving}>
              {saving ? 'Сохраняем…' : 'Сохранить замену'}
            </button>
          </>
        }
      >
        <ReplacementSelect
          roster={roster.filter((u) => u.id !== duty.userId && u.role === 'STUDENT')}
          value={replacementId}
          onChange={setReplacementId}
        />
      </Modal>

      <Modal
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title="Удалить назначение?"
        size="sm"
        footer={
          <>
            <button type="button" className="btn-ghost" onClick={() => setConfirmDelete(false)}>
              Отмена
            </button>
            <button type="button" className="btn-danger" onClick={remove}>
              Удалить
            </button>
          </>
        }
      >
        <p className="text-sm text-slate-300">
          {duty.user.fullName} будет убран из дежурства {showDate ? `на ${formatDateShort(duty.date)}` : 'на выбранный день'}.
          Действие попадёт в журнал изменений.
        </p>
      </Modal>
    </>
  );
}
