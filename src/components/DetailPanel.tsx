import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import type { Task, Goal, DetailItem } from '../types';
import type { AppStore } from '../store/useAppStore';
import { SelectCell, DateCell, TagsCell, FocusButtons } from './cells';

interface Props {
  item: DetailItem;
  store: AppStore;
  onClose: () => void;
}

function TextareaField({ value, onChange, placeholder }: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => { setDraft(value); }, [value]);

  useEffect(() => {
    if (ref.current) {
      ref.current.style.height = 'auto';
      ref.current.style.height = ref.current.scrollHeight + 'px';
    }
  }, [draft]);

  return (
    <textarea
      ref={ref}
      value={draft}
      onChange={e => setDraft(e.target.value)}
      onBlur={() => { if (draft !== value) onChange(draft); }}
      placeholder={placeholder}
      rows={3}
      className="w-full resize-none outline-none text-sm text-gray-700 leading-relaxed placeholder:text-gray-300 bg-transparent min-h-[60px]"
    />
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-4 py-2.5 border-b border-gray-100 last:border-0">
      <span className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider w-20 shrink-0 pt-0.5 leading-tight">{label}</span>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}

export function DetailPanel({ item, store, onClose }: Props) {
  const { state, updateTask, updateGoal } = store;
  const { tasks, goals, settings } = state;

  const [visible, setVisible] = useState(false);
  useEffect(() => { const id = requestAnimationFrame(() => setVisible(true)); return () => cancelAnimationFrame(id); }, []);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, [onClose]);

  const statusMap   = Object.fromEntries(settings.statuses.map(s => [s.id, s]));
  const priorityMap = Object.fromEntries(settings.priorities.map(p => [p.id, p]));
  const personMap   = Object.fromEntries(settings.people.map(p => [p.id, p]));
  const blockMap    = Object.fromEntries(settings.blocks.map(b => [b.id, b]));

  const sortedStatuses   = [...settings.statuses].sort((a, b) => a.order - b.order);
  const sortedPriorities = [...settings.priorities].sort((a, b) => a.order - b.order);

  const statusOptions = sortedStatuses.map(s => ({
    value: s.id,
    badge: (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.color + '20', color: s.color, border: `1px solid ${s.color}44` }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}
      </span>
    ),
  }));

  const priorityOptions = sortedPriorities.map(p => ({
    value: p.id,
    badge: <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: p.color + '20', color: p.color, borderColor: p.color + '44' }}>{p.label}</span>,
  }));

  const assigneeOptions = [
    { value: '', badge: <span className="text-xs text-gray-400">— unassigned —</span> },
    ...settings.people.map(p => ({ value: p.id, badge: <span className="text-xs text-gray-700">{p.name}</span> })),
  ];

  const sortedBlocks = [...settings.blocks].sort((a, b) => a.order - b.order);
  const blockOptions = [
    { value: '', badge: <span className="text-xs text-gray-400">— none —</span> },
    ...sortedBlocks.map(b => ({
      value: b.id,
      badge: <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: b.color + '22', color: b.color }}>{b.label}</span>,
    })),
  ];

  const renderBlock = (blockId: string) => {
    if (!blockId) return <span className="text-xs text-gray-300">—</span>;
    const b = blockMap[blockId];
    if (!b) return <span className="text-xs text-gray-300">—</span>;
    return <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: b.color + '22', color: b.color }}>{b.label}</span>;
  };

  const renderStatus = (statusId: string) => {
    const s = statusMap[statusId];
    if (!s) return <span className="text-xs text-gray-300">—</span>;
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: s.color + '20', color: s.color, border: `1px solid ${s.color}44` }}>
        <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}
      </span>
    );
  };

  const renderPriority = (priorityId: string) => {
    const p = priorityMap[priorityId];
    if (!p) return <span className="text-xs text-gray-300">—</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: p.color + '20', color: p.color, borderColor: p.color + '44' }}>{p.label}</span>;
  };

  const renderAssignee = (id: string) => {
    if (!id) return <span className="text-xs text-gray-300">—</span>;
    const p = personMap[id];
    return <span className="text-xs text-gray-700">{p?.name ?? id}</span>;
  };

  const isTask = item.kind === 'task';
  const task   = isTask ? tasks[item.id] : null;
  const goal   = !isTask ? goals[item.id] : null;

  if (!task && !goal) return null;

  const id        = isTask ? task!.id      : goal!.id;
  const title     = isTask ? task!.title   : goal!.title;
  const desc      = isTask ? task!.description : goal!.description;
  const statusId  = isTask ? task!.statusId  : goal!.statusId;
  const priorityId = isTask ? task!.priorityId : goal!.priorityId;
  const dueDate   = isTask ? task!.dueDate   : goal!.dueDate;
  const assignedTo = isTask ? task!.assignedTo : goal!.assignedTo;
  const tagIds    = isTask ? task!.tags      : goal!.tags;
  const createdAt = isTask ? task!.createdAt : goal!.createdAt;

  const onUpdateTitle = (v: string) => isTask ? updateTask(id, { title: v }) : updateGoal(id, { title: v });
  const onUpdateDesc  = (v: string) => isTask ? updateTask(id, { description: v }) : updateGoal(id, { description: v });

  const linkedGoal = isTask && task!.goalId ? goals[task!.goalId] : null;
  const subTasks   = !isTask ? goal!.tasks.map(tid => tasks[tid]).filter(Boolean) as Task[] : [];

  return createPortal(
    <div
      className={`fixed right-0 top-14 bottom-0 w-[440px] bg-white border-l border-gray-200 z-50 flex flex-col transition-transform duration-200 ease-out ${visible ? 'translate-x-0' : 'translate-x-full'}`}
      style={{ boxShadow: '-8px 0 32px rgba(0,0,0,0.08)' }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">{id}</span>
          <span className="text-xs font-medium text-gray-400">{isTask ? 'Task' : 'Goal'}</span>
        </div>
        <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <X size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-5 py-5">

        {/* Title */}
        <input
          value={title}
          onChange={e => onUpdateTitle(e.target.value)}
          placeholder={isTask ? 'Task title…' : 'Goal title…'}
          className="w-full text-xl font-semibold text-gray-900 outline-none border-b-2 border-transparent focus:border-indigo-300 pb-1 mb-5 placeholder:text-gray-300 bg-transparent transition"
        />

        {/* Description */}
        <div className="mb-5">
          <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-1.5">Description</div>
          <TextareaField value={desc} onChange={onUpdateDesc} placeholder="Add a description…" />
        </div>

        {/* Fields card */}
        <div className="rounded-xl border border-gray-100 bg-gray-50/40 px-3 mb-5">
          <Field label="Status">
            <SelectCell value={statusId} options={statusOptions} renderBadge={renderStatus}
              onChange={v => isTask ? updateTask(id, { statusId: v }) : updateGoal(id, { statusId: v })} />
          </Field>
          <Field label="Priority">
            <SelectCell value={priorityId} options={priorityOptions} renderBadge={renderPriority}
              onChange={v => isTask ? updateTask(id, { priorityId: v }) : updateGoal(id, { priorityId: v })} />
          </Field>
          <Field label="Due Date">
            <div className="flex items-center gap-3">
              <DateCell value={dueDate} onChange={v => isTask ? updateTask(id, { dueDate: v }) : updateGoal(id, { dueDate: v })} />
              <FocusButtons dueDate={dueDate} onChange={v => isTask ? updateTask(id, { dueDate: v }) : updateGoal(id, { dueDate: v })} size="md" />
            </div>
          </Field>
          <Field label="Assigned">
            <SelectCell value={assignedTo} options={assigneeOptions} renderBadge={renderAssignee}
              onChange={v => isTask ? updateTask(id, { assignedTo: v }) : updateGoal(id, { assignedTo: v })} />
          </Field>
          <Field label="Tags">
            <TagsCell tagIds={tagIds} allTags={settings.tags}
              onChange={v => isTask ? updateTask(id, { tags: v }) : updateGoal(id, { tags: v })} />
          </Field>

          {/* Block — editable for both tasks and goals */}
          <Field label="Block">
            <SelectCell
              value={isTask ? (task!.blockId ?? '') : (goal!.blockId ?? '')}
              options={blockOptions}
              renderBadge={renderBlock}
              onChange={v => isTask
                ? updateTask(id, { blockId: v || undefined })
                : updateGoal(id, { blockId: v || undefined })}
            />
          </Field>

          {/* Task-only: linked goal */}
          {linkedGoal && (
            <Field label="Goal">
              <span className="text-xs text-indigo-600 font-medium">{linkedGoal.title || '(untitled)'}</span>
            </Field>
          )}
        </div>

        {/* Goal-only: sub-task list */}
        {!isTask && subTasks.length > 0 && (
          <div className="mb-5">
            <div className="text-[11px] text-gray-400 font-semibold uppercase tracking-wider mb-2">
              Tasks ({subTasks.length})
            </div>
            <div className="space-y-1">
              {subTasks.map(t => (
                <div key={t.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors">
                  <span className="text-[10px] font-mono text-gray-400 shrink-0">{t.id}</span>
                  <span className="text-sm text-gray-700 flex-1 min-w-0 truncate">{t.title || '(untitled)'}</span>
                  {renderStatus(t.statusId)}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Created at */}
        <div className="text-[11px] text-gray-400">
          Created {new Date(createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}
        </div>
      </div>
    </div>,
    document.body
  );
}
