import type { Priority } from '../types';

export function PriorityBadge({ priority }: { priority: Priority | undefined }) {
  if (!priority) return null;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border"
      style={{
        backgroundColor: priority.color + '20',
        color: priority.color,
        borderColor: priority.color + '44',
      }}
    >
      {priority.label}
    </span>
  );
}
