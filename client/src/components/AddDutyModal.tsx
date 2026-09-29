import { useMemo, useState } from 'react';
import { api, ApiError } from '../api/client';
import { Modal } from './Modal';
import { useToast } from './Toast';

interface Props {
  open: boolean;
  onClose: () => void;
  date: string;
  roster: { id: number; fullName: string; role: string }[];
  existingIds: number[];
  onCreated: () => void;
}

export function AddDutyModal({ open, onClose, date, roster, existingIds, onCreated }: Props) {
  const toast = useToast();
  const [selected, setSelected] = useState<number[]>([]);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');

  const candidates = useMemo(() => {
    const q = query.trim().toLowerCase();
    return roster
      .filter((u) => !existingIds.includes(u.id))
      .filter((u) => (q ? u.fullName.toLowerCase().includes(q) : true))
      .slice(0, 60);
  }, [roster, existingIds, query]);

  const toggle = (id: number) =>
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const submit = async () => {
    if (selected.length === 0) return;
    setBusy(true);
    try {
      if (selected.length === 1) {
        await api.duties.create({ date, userId: selected[0]! });
      } else {
        await api.duties.bulk(date, selected, 'add');
      }
      toast.push(
        selected.length === 1 ? 'Дежурный назначен' : `Назначено дежурных: ${selected.length}`,
      );
      setSelected([]);
      onCreated();
      onClose();
    } catch (err) {
      toast.push(err instanceof ApiError ? err.message : 'Не удалось назначить', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Добавить дежурного"
      footer={
        <>
          <button type="button" className="btn-ghost" onClick={onClose}>
            Отмена
          </button>
          <button type="button" className="btn-primary" onClick={submit} disabled={selected.length === 0 || busy}>
            {busy ? 'Назначаем…' : `Назначить${selected.length ? ` (${selected.length})` : ''}`}
          </button>
        </>
      }
    >
      <p className="mb-3 text-sm text-slate-400">
        Дата: <span className="font-semibold text-slate-200">{date}</span>. Можно выбрать нескольких учеников.
      </p>

      <input
        className="field mb-3"
        placeholder="Поиск по фамилии…"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />

      <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
        {candidates.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Все подходящие ученики уже назначены</p>
        ) : (
          candidates.map((u) => {
            const active = selected.includes(u.id);
            return (
              <button
                key={u.id}
                type="button"
                onClick={() => toggle(u.id)}
                className={`flex w-full items-center justify-between gap-3 rounded-xl border px-3 py-2 text-left text-sm transition ${
                  active
                    ? 'border-emerald-400/40 bg-emerald-400/10 text-white'
                    : 'border-white/10 bg-white/[0.03] text-slate-300 hover:border-white/25 hover:bg-white/[0.06]'
                }`}
              >
                <span className="truncate">{u.fullName}</span>
                <span
                  className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border text-[10px] ${
                    active ? 'border-emerald-400 bg-emerald-400 text-emerald-950' : 'border-white/20'
                  }`}
                >
                  {active ? '✓' : ''}
                </span>
              </button>
            );
          })
        )}
      </div>
    </Modal>
  );
}
