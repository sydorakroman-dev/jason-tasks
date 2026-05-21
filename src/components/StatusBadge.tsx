import type { Status } from '../types';

export function StatusBadge({ status }: { status: Status }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: status.color + '20', color: status.color, border: `1px solid ${status.color}40` }}
    >
      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ backgroundColor: status.color }} />
      {status.label}
    </span>
  );
}
