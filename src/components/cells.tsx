import { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { Check } from 'lucide-react';
import type { Tag } from '../types';

// ─── Tooltip ──────────────────────────────────────────────────────────────────

function TooltipPopup({ text, rect }: { text: string; rect: DOMRect }) {
  const [opacity, setOpacity] = useState(0);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOpacity(1));
    return () => cancelAnimationFrame(id);
  }, []);
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - 340);
  return createPortal(
    <div
      className="fixed z-[99999] pointer-events-none max-w-xs"
      style={{ top: rect.bottom + 10, left, opacity, transition: 'opacity 0.12s ease-out' }}
    >
      {/* Arrow */}
      <div className="absolute -top-1 left-3 w-2.5 h-2.5 bg-gray-900 rotate-45 rounded-sm" />
      <div className="relative bg-gray-900 text-white text-xs leading-relaxed rounded-lg px-3 py-2 shadow-2xl">
        {text}
      </div>
    </div>,
    document.body
  );
}

// ─── Shared hooks ─────────────────────────────────────────────────────────────

export function usePortalPos(triggerRef: React.RefObject<HTMLElement | null>, open: boolean) {
  const [pos, setPos] = useState({ top: 0, left: 0 });
  useEffect(() => {
    if (open && triggerRef.current) {
      const r = triggerRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
  }, [open]);
  return pos;
}

export function useOutsideClose(
  refs: React.RefObject<HTMLElement | null>[],
  open: boolean,
  close: () => void,
) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (refs.every(r => !r.current?.contains(e.target as Node))) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);
}

// ─── Cell components ──────────────────────────────────────────────────────────

export function EditableText({
  value, onChange, placeholder, bold, autoFocus: initFocus = false, onShiftEnter,
}: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; bold?: boolean; autoFocus?: boolean;
  onShiftEnter?: () => void;
}) {
  const [editing, setEditing] = useState(initFocus);
  const [draft, setDraft] = useState(value);
  const [tooltipRect, setTooltipRect] = useState<DOMRect | null>(null);
  const spanRef = useRef<HTMLSpanElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => { setDraft(value); }, [value]);

  const commit = useCallback(() => {
    if (draft !== value) onChange(draft);
    setEditing(false);
  }, [draft, value, onChange]);

  const autoResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  };

  const showTooltip = () => {
    const el = spanRef.current;
    if (!el || !value || el.scrollWidth <= el.offsetWidth) return;
    timerRef.current = setTimeout(() => setTooltipRect(el.getBoundingClientRect()), 1000);
  };
  const hideTooltip = () => {
    if (timerRef.current) { clearTimeout(timerRef.current); timerRef.current = null; }
    setTooltipRect(null);
  };
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  if (editing) {
    return (
      <textarea
        autoFocus
        rows={1}
        value={draft}
        onChange={e => { setDraft(e.target.value); autoResize(e.currentTarget); }}
        onFocus={e => autoResize(e.currentTarget)}
        onBlur={commit}
        onKeyDown={e => {
          if (e.key === 'Enter' && e.shiftKey && onShiftEnter) { e.preventDefault(); commit(); onShiftEnter(); }
          else if (e.key === 'Enter') { e.preventDefault(); commit(); }
          else if (e.key === 'Escape') { setDraft(value); setEditing(false); }
        }}
        className={`w-full bg-transparent outline-none border-b-2 border-indigo-400 py-0 leading-snug resize-none overflow-hidden ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-gray-300 text-sm'}`}
      />
    );
  }
  return (
    <>
      {tooltipRect && <TooltipPopup text={value} rect={tooltipRect} />}
      <span
        ref={spanRef}
        onClick={() => setEditing(true)}
        onMouseEnter={showTooltip}
        onMouseLeave={hideTooltip}
        className={`block w-full cursor-text rounded px-1 -mx-1 truncate leading-snug
          hover:bg-black/[0.04] transition
          ${bold ? 'font-semibold text-gray-900 dark:text-white' : 'text-sm text-gray-700 dark:text-gray-300'}
          ${!value ? 'text-gray-300 dark:text-gray-600' : ''}`}
      >
        {value || placeholder || ''}
      </span>
    </>
  );
}

export function SelectCell<T extends string | number>({
  value, options, renderBadge, onChange,
}: {
  value: T;
  options: { value: T; badge: React.ReactNode }[];
  renderBadge: (v: T) => React.ReactNode;
  onChange: (v: T) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = usePortalPos(triggerRef, open);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose([triggerRef, menuRef], open, close);

  return (
    <>
      <button
        ref={triggerRef}
        onClick={() => setOpen(o => !o)}
        className="w-full text-left hover:opacity-80 transition"
      >
        {renderBadge(value)}
      </button>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-100 dark:border-gray-700 py-1 min-w-max"
        >
          {options.map(opt => (
            <button
              key={String(opt.value)}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              {opt.badge}
              {opt.value === value && <Check size={10} className="ml-auto text-indigo-500 shrink-0" />}
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

export function DateCell({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const overdue = value && new Date(value + 'T00:00:00') < new Date(new Date().toDateString());
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`text-xs border-0 outline-none bg-transparent cursor-pointer
        hover:bg-black/[0.04] dark:hover:bg-white/[0.06] rounded px-1 w-full transition
        ${overdue ? 'text-red-500' : 'text-gray-600 dark:text-gray-400'}
        ${!value ? 'text-gray-300 dark:text-gray-600' : ''}`}
    />
  );
}

// ─── Focus buttons ────────────────────────────────────────────────────────────

export type FocusLevel = 'today' | '3d' | '5d';

export function getFocusDate(level: FocusLevel): string {
  const d = new Date();
  if (level === '3d') d.setDate(d.getDate() + 3);
  if (level === '5d') d.setDate(d.getDate() + 5);
  return d.toLocaleDateString('en-CA'); // YYYY-MM-DD in local time, not UTC
}

export function computeFocusLevel(dueDate: string): FocusLevel | undefined {
  if (!dueDate) return undefined;
  const today = getFocusDate('today');
  const d3    = getFocusDate('3d');
  const d5    = getFocusDate('5d');
  if (dueDate <= today) return 'today';
  if (dueDate <= d3)    return '3d';
  if (dueDate <= d5)    return '5d';
  return undefined;
}

function getFocusTitle(level: FocusLevel): string {
  const d = new Date();
  if (level === '3d') d.setDate(d.getDate() + 3);
  if (level === '5d') d.setDate(d.getDate() + 5);
  const dateStr = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  if (level === 'today') return `Today — ${dateStr}`;
  if (level === '3d')    return `3 days — ${dateStr}`;
  return `5 days — ${dateStr}`;
}

const FOCUS_OPTS: { level: FocusLevel; label: string; color: string }[] = [
  { level: 'today', label: 'T', color: '#ef4444' },
  { level: '3d',    label: '3', color: '#f97316' },
  { level: '5d',    label: '5', color: '#3b82f6' },
];

export function FocusButtons({ dueDate, onChange, size = 'sm' }: {
  dueDate: string;
  onChange: (v: string) => void;
  size?: 'sm' | 'md';
}) {
  const active = computeFocusLevel(dueDate);
  const btnCls = size === 'md'
    ? 'w-7 h-7 rounded-lg text-xs font-bold'
    : 'w-5 h-5 rounded text-[9px] font-bold';
  return (
    <div className="flex items-center gap-1">
      {FOCUS_OPTS.map(o => {
        const isActive = active === o.level;
        return (
          <button
            key={o.level}
            title={getFocusTitle(o.level)}
            onClick={e => { e.stopPropagation(); onChange(isActive ? '' : getFocusDate(o.level)); }}
            className={`${btnCls} transition-all flex items-center justify-center shrink-0 ${isActive ? 'text-white shadow-sm' : 'text-gray-400 hover:text-gray-700 bg-transparent hover:bg-gray-100'}`}
            style={isActive ? { backgroundColor: o.color } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function TagsCell({ tagIds, allTags, onChange }: {
  tagIds: string[]; allTags: Tag[]; onChange: (ids: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = usePortalPos(triggerRef, open);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose([triggerRef, menuRef], open, close);
  const selected = tagIds.map(id => allTags.find(t => t.id === id)).filter(Boolean) as Tag[];

  return (
    <>
      <div
        ref={triggerRef}
        className="flex flex-wrap gap-1 cursor-pointer min-h-[22px] hover:bg-black/[0.04] rounded px-1 -mx-1 transition"
        onClick={() => setOpen(o => !o)}
      >
        {selected.length === 0
          ? <span className="text-xs text-gray-300 leading-snug">+ tag</span>
          : selected.map(t => (
            <span
              key={t.id}
              className="px-1.5 py-0.5 rounded-full text-xs leading-none font-medium"
              style={{ backgroundColor: t.color + '22', color: t.color }}
            >
              {t.label}
            </span>
          ))}
      </div>
      {open && createPortal(
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }}
          className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[160px]"
        >
          {allTags.length === 0
            ? <p className="px-3 py-2 text-xs text-gray-400 dark:text-gray-500">Configure tags in Settings</p>
            : allTags.map(tag => (
              <button
                key={tag.id}
                onClick={() => {
                  onChange(tagIds.includes(tag.id)
                    ? tagIds.filter(id => id !== tag.id)
                    : [...tagIds, tag.id]);
                }}
                className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                <span className="text-xs text-gray-700 dark:text-gray-300">{tag.label}</span>
                {tagIds.includes(tag.id) && <Check size={10} className="ml-auto text-indigo-500" />}
              </button>
            ))}
        </div>,
        document.body
      )}
    </>
  );
}
