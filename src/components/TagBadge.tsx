import type { Tag } from '../types';

export function TagBadge({ tag }: { tag: Tag }) {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ backgroundColor: tag.color + '22', color: tag.color, border: `1px solid ${tag.color}44` }}
    >
      {tag.label}
    </span>
  );
}
