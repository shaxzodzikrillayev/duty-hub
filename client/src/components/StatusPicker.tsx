import { QUICK_STATUSES, STATUS_META } from '../lib/const';
import type { DutyStatus, User } from '../types';

interface Props {
  value: DutyStatus;
  onSelect: (status: DutyStatus) => void;
  disabled?: boolean;
  size?: 'sm' | 'md';
}

export function StatusPicker({ value, onSelect, disabled = false, size = 'md' }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {QUICK_STATUSES.map((status) => {
        const meta = STATUS_META[status];
        const active = value === status;
        return (
          <button
            key={status}
            type="button"
            disabled={disabled}
            title={meta.label}
            onClick={() => onSelect(status)}
            className={`chip transition ${
              size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1'
            } ${
              active
                ? `${meta.chip} ring-2 ${meta.ring} scale-[1.02]`
                : 'border-white/10 bg-white/[0.03] text-slate-400 hover:border-white/25 hover:bg-white/[0.07] hover:text-slate-200'
            } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
          >
            <span aria-hidden>{meta.emoji}</span>
            <span className={size === 'sm' ? 'hidden sm:inline' : ''}>{meta.label}</span>
          </button>
        );
      })}
    </div>
  );
}

export function ReplacementSelect({
  roster,
  value,
  onChange,
}: {
  roster: User[];
  value: number | null;
  onChange: (id: number | null) => void;
}) {
  return (
    <div>
      <label className="label">Кто дежурил вместо ученика</label>
      <select
        className="field"
        value={value ?? ''}
        onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
      >
        <option value="">— выберите ученика —</option>
        {roster.map((u) => (
          <option key={u.id} value={u.id}>
            {u.fullName}
          </option>
        ))}
      </select>
    </div>
  );
}
