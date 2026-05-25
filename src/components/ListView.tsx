import { useState, useRef, useCallback, useEffect, useMemo, createContext, useContext } from 'react';
import { createPortal } from 'react-dom';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { ChevronDown, ChevronRight, Plus, Trash2, Search, X, Check, SlidersHorizontal, Unlink, GripVertical, ArrowUp, ArrowDown, CalendarPlus } from 'lucide-react';
import type { Goal, Task, Tag, DetailItem } from '../types';
import type { AppStore } from '../store/useAppStore';
import { EditableText, SelectCell, DateCell, TagsCell, FocusButtons, computeFocusLevel, usePortalPos, useOutsideClose } from './cells';
import { useConfirm } from './ConfirmDialog';
import { buildCalendarUrl } from '../utils/googleCalendar';
import { toast } from 'sonner';

// ─── Column layout ────────────────────────────────────────────────────────────

const GRID = 'list-row grid';

type GroupByKey = '' | 'status' | 'priority' | 'assignee' | 'block';
type SortField = 'title' | 'priority' | 'status' | 'dueDate' | 'assignee' | 'block';
type SortDir   = 'asc' | 'desc';

function ColHeader({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`text-[10px] font-bold text-gray-400 dark:text-gray-500 uppercase tracking-widest select-none ${className}`}>{children}</div>;
}

function ResizeHandle({ onMouseDown, active }: { onMouseDown: (e: React.MouseEvent) => void; active: boolean }) {
  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute -right-1.5 top-0 h-full w-3 cursor-col-resize z-10 select-none flex items-stretch py-1"
    >
      <div className={`mx-auto w-0.5 rounded-full transition-colors ${active ? 'bg-indigo-500' : 'bg-transparent group-hover:bg-gray-300'}`} />
    </div>
  );
}

// ─── Shared context (avoids prop drilling into DnD sub-components) ────────────

interface ListCtxType {
  statusOptions: { value: string; badge: React.ReactNode }[];
  priorityOptions: { value: string; badge: React.ReactNode }[];
  assigneeOptions: { value: string; badge: React.ReactNode }[];
  blockOptions: { value: string; badge: React.ReactNode }[];
  sortedStatusIds: string[];
  blockColorMap: Record<string, string>;
  renderStatus: (id: string) => React.ReactNode;
  renderPriority: (id: string) => React.ReactNode;
  renderAssignedTo: (id: string) => React.ReactNode;
  renderBlock: (id: string) => React.ReactNode;
  allTags: Tag[];
  focusId: string | null;
  activeTaskId: string | null;
  ask: (title: string, msg: string, cb: () => void) => void;
  onOpenDetail: (item: DetailItem) => void;
}
const ListCtx = createContext<ListCtxType>(null!);

// ─── Filter dropdown ──────────────────────────────────────────────────────────

function FilterDropdown({ label, options, selected, onChange }: {
  label: string;
  options: { value: string; content: React.ReactNode }[];
  selected: string[];
  onChange: (v: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = usePortalPos(triggerRef, open);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose([triggerRef, menuRef], open, close);
  const toggle = (val: string) => onChange(selected.includes(val) ? selected.filter(v => v !== val) : [...selected, val]);
  const active = selected.length > 0;
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-indigo-50 dark:bg-indigo-900/40 border-indigo-300 dark:border-indigo-700 text-indigo-700 dark:text-indigo-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-800 dark:hover:text-gray-200'}`}>
        {label}
        {active && <span className="w-4 h-4 rounded-full bg-indigo-600 text-white text-[9px] flex items-center justify-center font-bold leading-none">{selected.length}</span>}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[160px]">
          {options.map(opt => (
            <button key={opt.value} onClick={() => toggle(opt.value)} className="w-full flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
              <span className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${selected.includes(opt.value) ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600'}`}>
                {selected.includes(opt.value) && <Check size={9} className="text-white" strokeWidth={3} />}
              </span>
              {opt.content}
            </button>
          ))}
        </div>, document.body
      )}
    </>
  );
}

// ─── Group-by dropdown ────────────────────────────────────────────────────────

const GROUP_OPTIONS: { value: GroupByKey; label: string }[] = [
  { value: '',         label: 'None' },
  { value: 'status',   label: 'Status' },
  { value: 'priority', label: 'Priority' },
  { value: 'assignee', label: 'Assignee' },
  { value: 'block',    label: 'Block' },
];

function GroupByDropdown({ value, onChange }: { value: GroupByKey; onChange: (v: GroupByKey) => void }) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const pos = usePortalPos(triggerRef, open);
  const close = useCallback(() => setOpen(false), []);
  useOutsideClose([triggerRef, menuRef], open, close);
  const active = value !== '';
  const currentLabel = GROUP_OPTIONS.find(o => o.value === value)?.label ?? 'Group';
  return (
    <>
      <button ref={triggerRef} onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${active ? 'bg-violet-50 dark:bg-violet-900/40 border-violet-300 dark:border-violet-700 text-violet-700 dark:text-violet-300' : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:border-gray-300 dark:hover:border-gray-600 hover:text-gray-800 dark:hover:text-gray-200'}`}>
        {active ? currentLabel : 'Group by'}
        <ChevronDown size={11} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && createPortal(
        <div ref={menuRef} style={{ position: 'fixed', top: pos.top, left: pos.left, zIndex: 9999 }} className="bg-white dark:bg-gray-800 shadow-2xl rounded-xl border border-gray-100 dark:border-gray-700 py-1 min-w-[140px]">
          {GROUP_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => { onChange(opt.value); setOpen(false); }}
              className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-left">
              <span className={`w-3.5 h-3.5 rounded-full border-2 shrink-0 flex items-center justify-center ${value === opt.value ? 'bg-violet-600 border-violet-600' : 'border-gray-300 dark:border-gray-600'}`}>
                {value === opt.value && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
              </span>
              <span className="text-xs text-gray-700 dark:text-gray-300">{opt.label}</span>
            </button>
          ))}
        </div>,
        document.body
      )}
    </>
  );
}

// ─── Draggable task row ───────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  variant: 'subtask' | 'standalone';
  onUpdate: (data: Partial<Task>) => void;
  onDelete: () => void;
  onDetach?: () => void;
  onPromoteAndAdd?: () => void;
  onShiftEnter?: () => void;
}

function TaskRow({ task, variant, onUpdate, onDelete, onDetach, onPromoteAndAdd, onShiftEnter }: TaskRowProps) {
  const { statusOptions, priorityOptions, assigneeOptions, blockOptions, sortedStatusIds, blockColorMap, renderStatus, renderPriority, renderAssignedTo, renderBlock, allTags, focusId, activeTaskId, ask, onOpenDetail } = useContext(ListCtx);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 } : undefined;
  const isBeingDragged = activeTaskId === task.id;
  const blockColor = blockColorMap[task.blockId ?? ''] ?? 'transparent';

  const indent = variant === 'subtask';

  return (
    <div
      ref={setNodeRef}
      style={{ ...style, borderLeft: `3px solid ${blockColor}` }}
      className={`${GRID} items-center px-3 py-1 border-b border-gray-100 dark:border-gray-800 group transition-colors ${indent ? 'bg-gray-50/60 dark:bg-gray-800/30 hover:bg-gray-100/60 dark:hover:bg-gray-800/60' : 'hover:bg-gray-50/60 dark:hover:bg-gray-800/40'} ${isBeingDragged ? 'opacity-30' : ''}`}
    >
      {/* Drag handle in first column */}
      <button
        {...listeners}
        {...attributes}
        className="flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors"
        tabIndex={-1}
      >
        <GripVertical size={13} />
      </button>

      {/* Title */}
      <div className={`flex items-center gap-2 min-w-0 pr-4 ${indent ? 'pl-5' : ''}`}>
        {indent && (
          <a
            href={buildCalendarUrl(task.title, task.description || undefined, task.dueDate || undefined)}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => e.stopPropagation()}
            title="Add to Google Calendar"
            className="shrink-0 text-gray-300 hover:text-blue-400 transition-colors"
          ><CalendarPlus size={12} /></a>
        )}
        <button
          onClick={() => onOpenDetail({ kind: 'task', id: task.id })}
          className="text-[10px] font-mono shrink-0 leading-none px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
        >{task.id}</button>
        <EditableText value={task.title} onChange={v => onUpdate({ title: v })} placeholder="Task title..." autoFocus={focusId === task.id} onShiftEnter={onShiftEnter} />
      </div>

      <div className="pr-2 flex items-center gap-1">
        <SelectCell value={task.statusId} options={statusOptions} renderBadge={renderStatus} onChange={v => onUpdate({ statusId: v })} />
        <button
          onClick={e => { e.stopPropagation(); const i = sortedStatusIds.indexOf(task.statusId); onUpdate({ statusId: sortedStatusIds[(i + 1) % sortedStatusIds.length] }); }}
          title="Next status"
          className="shrink-0 flex items-center justify-center w-5 h-5 rounded border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-400 hover:border-gray-400 dark:hover:border-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
        ><ChevronRight size={10} /></button>
      </div>
      <div className="pr-2"><SelectCell value={task.priorityId} options={priorityOptions} renderBadge={renderPriority} onChange={v => onUpdate({ priorityId: v })} /></div>
      <div className="pr-2"><DateCell value={task.dueDate} onChange={v => onUpdate({ dueDate: v })} /></div>
      <div className="flex items-center"><FocusButtons dueDate={task.dueDate} onChange={v => onUpdate({ dueDate: v })} /></div>
      <div className="pr-2"><SelectCell value={task.assignedTo} options={assigneeOptions} renderBadge={renderAssignedTo} onChange={v => onUpdate({ assignedTo: v })} /></div>
      <div className="pr-2"><SelectCell value={task.blockId ?? ''} options={blockOptions} renderBadge={renderBlock} onChange={v => onUpdate({ blockId: v || undefined })} /></div>
      <div className="pr-2"><TagsCell tagIds={task.tags} allTags={allTags} onChange={v => onUpdate({ tags: v })} /></div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onDetach && (
          <button onClick={onDetach} title="Detach from goal" className="p-1.5 rounded-lg hover:bg-amber-50 text-amber-500 transition-colors"><Unlink size={13} /></button>
        )}
        {onPromoteAndAdd && (
          <button onClick={onPromoteAndAdd} title="Add sub-task (converts to goal)" className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-500 transition-colors"><Plus size={13} /></button>
        )}
        <a href={buildCalendarUrl(task.title, task.description || undefined, task.dueDate || undefined)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Add to Google Calendar" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 transition-colors"><CalendarPlus size={13} /></a>
        <button onClick={() => ask('Delete Task', `"${task.title || 'Untitled'}" will be permanently deleted.`, onDelete)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={13} /></button>
      </div>
    </div>
  );
}

// ─── Droppable goal section ───────────────────────────────────────────────────

interface GoalSectionProps {
  goal: Goal;
  subTasks: Task[];
  open: boolean;
  showAddRow: boolean;
  onToggle: () => void;
  onAddSubTask: () => void;
  onUpdateGoal: (data: Partial<Goal>) => void;
  onDeleteGoal: () => void;
  onUpdateTask: (taskId: string, data: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onDetachTask: (taskId: string) => void;
  accentColor: string;
}

function GoalSection({ goal, subTasks, open, showAddRow, onToggle, onAddSubTask, onUpdateGoal, onDeleteGoal, onUpdateTask, onDeleteTask, onDetachTask, accentColor }: GoalSectionProps) {
  const { statusOptions, priorityOptions, assigneeOptions, blockOptions, sortedStatusIds, renderStatus, renderPriority, renderAssignedTo, renderBlock, allTags, focusId, activeTaskId, ask, onOpenDetail } = useContext(ListCtx);
  const { setNodeRef, isOver } = useDroppable({ id: 'goal:' + goal.id });

  return (
    <div ref={setNodeRef}>
      {/* Goal header row — highlighted when a task is dragged over this goal */}
      <div
        className={`${GRID} items-center px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 group transition-colors ${isOver && activeTaskId ? 'bg-indigo-100/60 dark:bg-indigo-900/40 ring-1 ring-inset ring-indigo-300 dark:ring-indigo-700' : 'hover:bg-indigo-50/25 dark:hover:bg-indigo-900/10'}`}
        style={{ borderLeft: `3px solid ${accentColor}` }}
      >
        <button onClick={onToggle} className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
          {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <div className="flex items-center gap-2 min-w-0 pr-4">
          <button onClick={() => onOpenDetail({ kind: 'goal', id: goal.id })} className="text-[10px] font-mono shrink-0 leading-none px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">{goal.id}</button>
          <EditableText value={goal.title} onChange={v => onUpdateGoal({ title: v })} placeholder="Goal title..." bold autoFocus={focusId === goal.id} />
        </div>
        <div className="pr-2 flex items-center gap-1">
          <SelectCell value={goal.statusId} options={statusOptions} renderBadge={renderStatus} onChange={v => onUpdateGoal({ statusId: v })} />
          <button
            onClick={e => { e.stopPropagation(); const i = sortedStatusIds.indexOf(goal.statusId); onUpdateGoal({ statusId: sortedStatusIds[(i + 1) % sortedStatusIds.length] }); }}
            title="Next status"
            className="shrink-0 text-gray-300 hover:text-gray-500 transition-colors"
          ><ChevronRight size={11} /></button>
        </div>
        <div className="pr-2"><SelectCell value={goal.priorityId} options={priorityOptions} renderBadge={renderPriority} onChange={v => onUpdateGoal({ priorityId: v })} /></div>
        <div className="pr-2"><DateCell value={goal.dueDate} onChange={v => onUpdateGoal({ dueDate: v })} /></div>
        <div className="flex items-center"><FocusButtons dueDate={goal.dueDate} onChange={v => onUpdateGoal({ dueDate: v })} /></div>
        <div className="pr-2"><SelectCell value={goal.assignedTo} options={assigneeOptions} renderBadge={renderAssignedTo} onChange={v => onUpdateGoal({ assignedTo: v })} /></div>
        <div className="pr-2"><SelectCell value={goal.blockId ?? ''} options={blockOptions} renderBadge={renderBlock} onChange={v => onUpdateGoal({ blockId: v || undefined })} /></div>
        <div className="pr-2"><TagsCell tagIds={goal.tags} allTags={allTags} onChange={v => onUpdateGoal({ tags: v })} /></div>
        <div className="flex items-center justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onAddSubTask} title="Add task" className="p-1.5 rounded-lg hover:bg-indigo-100 text-indigo-500 transition-colors"><Plus size={13} /></button>
          <a href={buildCalendarUrl(goal.title, goal.description || undefined, goal.dueDate || undefined)} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} title="Add to Google Calendar" className="p-1.5 rounded-lg hover:bg-blue-50 text-blue-400 transition-colors"><CalendarPlus size={13} /></a>
          <button onClick={() => ask('Delete Goal', `"${goal.title || 'Untitled'}" and all its tasks will be permanently deleted.`, onDeleteGoal)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={13} /></button>
        </div>
      </div>

      {/* Sub-tasks */}
      {open && subTasks.map(task => (
        <TaskRow
          key={task.id}
          task={task}
          variant="subtask"
          onUpdate={data => onUpdateTask(task.id, data)}
          onDelete={() => onDeleteTask(task.id)}
          onDetach={() => onDetachTask(task.id)}
          onShiftEnter={onAddSubTask}
        />
      ))}

      {/* Add sub-task row */}
      {open && showAddRow && (
        <button onClick={onAddSubTask} className="w-full flex items-center gap-2 pl-14 pr-4 py-2 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 border-b border-gray-100 dark:border-gray-800 transition-colors">
          <Plus size={12} /> Add task
        </button>
      )}
    </div>
  );
}

// ─── Standalone drop zone (shown during drag to allow detaching) ──────────────

function StandaloneDropZone() {
  const { setNodeRef, isOver } = useDroppable({ id: 'standalone' });
  return (
    <div ref={setNodeRef} className={`mx-3 mb-2 rounded-xl border-2 border-dashed py-2.5 text-center text-xs font-medium transition-colors ${isOver ? 'border-amber-400 bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400' : 'border-gray-200 dark:border-gray-700 text-gray-400'}`}>
      <Unlink size={11} className="inline mr-1.5 mb-0.5" />
      Drop here to detach from goal
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

type TopItem = { kind: 'goal'; goal: Goal } | { kind: 'task'; task: Task };

interface Props { store: AppStore; onOpenDetail: (item: DetailItem) => void; }

export function ListView({ store, onOpenDetail }: Props) {
  const { state, addGoal, updateGoal, deleteGoal, addTask, updateTask, deleteTask, detachTask, moveTaskToGoal, promoteTaskToGoal } = store;
  const { goals, tasks, settings } = state;

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [focusId, setFocusId] = useState<string | null>(null);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);

  const COL_MIN = [28, 120, 80, 70, 90, 60, 80, 70, 100, 88];
  const [colWidths, setColWidths] = useState<number[]>(() => {
    try { const s = localStorage.getItem('jason-col-widths'); return s ? JSON.parse(s) : [28, 240, 140, 110, 130, 76, 170, 110, 190, 88]; }
    catch { return [28, 240, 140, 110, 130, 76, 170, 110, 190, 88]; }
  });
  const gridTemplate = colWidths.map((w, i) => i === 1 ? `minmax(${w}px, 1fr)` : `${w}px`).join(' ');
  const [resizingCol, setResizingCol] = useState<number | null>(null);
  const [resizingX, setResizingX] = useState<number | null>(null);

  const startResize = (colIdx: number, e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startW = colWidths[colIdx];
    setResizingCol(colIdx);
    setResizingX(e.clientX);
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
    const onMove = (me: MouseEvent) => {
      const newW = Math.max(COL_MIN[colIdx], startW + me.clientX - startX);
      setColWidths(prev => { const a = [...prev]; a[colIdx] = newW; return a; });
      setResizingX(me.clientX);
    };
    const onUp = () => {
      setResizingCol(null);
      setResizingX(null);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };
  const { ask, dialog } = useConfirm();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  // ── Filter + group state ───────────────────────────────────────────────────
  const [searchText, setSearchText] = useState('');
  const [filterStatuses, setFilterStatuses] = useState<string[]>([]);
  const [filterPriorities, setFilterPriorities] = useState<string[]>([]);
  const [filterAssignees, setFilterAssignees] = useState<string[]>([]);
  const [filterFocus, setFilterFocus] = useState<string[]>([]);
  const [filterInFocus, setFilterInFocus] = useState(false);
  const [delegationFilter, setDelegationFilter] = useState<'all' | 'mine' | 'delegated'>('all');
  const [showDone, setShowDone] = useState(false);
  const [groupBy, setGroupBy] = useState<GroupByKey>(() => (localStorage.getItem('jason-group-by') as GroupByKey) || '');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [sortField, setSortField] = useState<SortField>(() => (localStorage.getItem('jason-sort-field') as SortField) || 'priority');
  const [sortDir, setSortDir] = useState<SortDir>(() => (localStorage.getItem('jason-sort-dir') as SortDir) || 'asc');

  useEffect(() => { localStorage.setItem('jason-col-widths', JSON.stringify(colWidths)); }, [colWidths]);
  useEffect(() => { localStorage.setItem('jason-sort-field', sortField); }, [sortField]);
  useEffect(() => { localStorage.setItem('jason-sort-dir', sortDir); }, [sortDir]);
  useEffect(() => { localStorage.setItem('jason-group-by', groupBy); }, [groupBy]);

  const handleSort = (field: SortField) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const hasFilters = searchText || filterStatuses.length || filterPriorities.length || filterAssignees.length || filterFocus.length || filterInFocus || delegationFilter !== 'all';
  const clearFilters = () => { setSearchText(''); setFilterStatuses([]); setFilterPriorities([]); setFilterAssignees([]); setFilterFocus([]); setFilterInFocus(false); setDelegationFilter('all'); };

  const allGoalIds = Object.keys(goals);
  const allExpanded = allGoalIds.length > 0 && allGoalIds.every(id => expanded[id]);
  const toggleExpandAll = () => {
    if (allExpanded) setExpanded({});
    else setExpanded(Object.fromEntries(allGoalIds.map(id => [id, true])));
  };

  const toggle = (id: string) => setExpanded(e => ({ ...e, [id]: !e[id] }));

  // ── Derived lookups ───────────────────────────────────────────────────────
  const statusMap   = Object.fromEntries(settings.statuses.map(s => [s.id, s]));
  const priorityMap = Object.fromEntries(settings.priorities.map(p => [p.id, p]));
  const personMap   = Object.fromEntries(settings.people.map(p => [p.id, p]));
  const blockMap    = Object.fromEntries(settings.blocks.map(b => [b.id, b]));
  const sortedStatuses   = [...settings.statuses].sort((a, b) => a.order - b.order);
  const sortedPriorities = [...settings.priorities].sort((a, b) => a.order - b.order);
  const sortedBlocks     = [...settings.blocks].sort((a, b) => a.order - b.order);
  const blockColorMap    = useMemo(() => Object.fromEntries(settings.blocks.map(b => [b.id, b.color])), [settings.blocks]);

  const statusOptions = sortedStatuses.map(s => ({ value: s.id, badge: <span className="inline-flex items-center gap-1.5"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} /><span className="text-xs text-gray-700">{s.label}</span></span> }));
  const priorityOptions = sortedPriorities.map(p => ({ value: p.id, badge: <span className="px-2 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: p.color + '20', color: p.color, borderColor: p.color + '44' }}>{p.label}</span> }));
  const assigneeOptions = [
    { value: '', badge: <span className="text-xs text-gray-400">— none —</span> },
    ...settings.people.map(p => ({ value: p.id, badge: <span className="text-xs text-gray-700">{p.name}</span> })),
  ];

  const blockOptions = [
    { value: '', badge: <span className="text-xs text-gray-300">—</span> },
    ...sortedBlocks.map(b => ({
      value: b.id,
      badge: <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: b.color + '22', color: b.color }}>{b.label}</span>,
    })),
  ];

  const renderStatus = useCallback((statusId: string) => {
    const s = statusMap[statusId];
    if (!s) return <span className="text-xs text-gray-300">—</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap" style={{ backgroundColor: s.color + '20', color: s.color, border: `1px solid ${s.color}44` }}><span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}</span>;
  }, [JSON.stringify(statusMap)]);

  const renderPriority = useCallback((priorityId: string) => {
    const p = priorityMap[priorityId];
    if (!p) return <span className="text-xs text-gray-300">—</span>;
    return <span className="inline-flex px-2 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: p.color + '20', color: p.color, borderColor: p.color + '44' }}>{p.label}</span>;
  }, [JSON.stringify(priorityMap)]);

  const renderAssignedTo = useCallback((assignedTo: string) => {
    if (!assignedTo) return <span className="text-xs text-gray-300">—</span>;
    const person = personMap[assignedTo];
    return <span className="text-xs text-gray-600 truncate">{person ? person.name : assignedTo}</span>;
  }, [JSON.stringify(personMap)]);

  const renderBlock = useCallback((blockId: string) => {
    if (!blockId) return <span className="text-xs text-gray-300">—</span>;
    const b = blockMap[blockId];
    if (!b) return <span className="text-xs text-gray-300">—</span>;
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: b.color + '22', color: b.color }}>{b.label}</span>;
  }, [JSON.stringify(blockMap)]);

  // ── Filter logic ──────────────────────────────────────────────────────────
  const doneStatusIds = new Set(settings.statuses.filter(s => s.label.toLowerCase() === 'done').map(s => s.id));

  const q = searchText.toLowerCase();
  const matchesSearch = (text: string) => !q || text.toLowerCase().includes(q);

  const passesDelegation = (assignedTo: string) =>
    delegationFilter === 'all' ||
    (delegationFilter === 'mine' ? !assignedTo : !!assignedTo);

  const passesDropdown = (item: { statusId: string; priorityId: string; assignedTo: string; dueDate: string }) =>
    (showDone || !doneStatusIds.has(item.statusId)) &&
    (!filterStatuses.length || filterStatuses.includes(item.statusId)) &&
    (!filterPriorities.length || filterPriorities.includes(item.priorityId)) &&
    (!filterAssignees.length || filterAssignees.includes(item.assignedTo)) &&
    (!filterFocus.length || filterFocus.includes(computeFocusLevel(item.dueDate) ?? '')) &&
    (!filterInFocus || computeFocusLevel(item.dueDate) !== undefined);

  type Sortable = { title: string; statusId: string; priorityId: string; dueDate: string; assignedTo: string; createdAt: string; blockId?: string };
  const sortFn = (a: Sortable, b: Sortable): number => {
    let cmp = 0;
    switch (sortField) {
      case 'title':    cmp = (a.title || '').localeCompare(b.title || ''); break;
      case 'status':   cmp = (statusMap[a.statusId]?.order ?? 99) - (statusMap[b.statusId]?.order ?? 99); break;
      case 'priority': cmp = (priorityMap[a.priorityId]?.order ?? 99) - (priorityMap[b.priorityId]?.order ?? 99); break;
      case 'dueDate':  cmp = (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz'); break;
      case 'assignee': cmp = (a.assignedTo || '').localeCompare(b.assignedTo || ''); break;
      case 'block':    cmp = (a.blockId || '').localeCompare(b.blockId || ''); break;
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return dir * (cmp || a.createdAt.localeCompare(b.createdAt));
  };

  const visibleGoals = Object.values(goals)
    .filter(g =>
      passesDropdown(g) &&
      passesDelegation(g.assignedTo) &&
      (!q || matchesSearch(g.title) || matchesSearch(g.description) || g.tasks.some(tid => tasks[tid] && matchesSearch(tasks[tid].title))))
    .sort(sortFn);

  const visibleStandalone = Object.values(tasks)
    .filter(t => !t.goalId && passesDropdown(t) && passesDelegation(t.assignedTo) && (!q || matchesSearch(t.title) || matchesSearch(t.description)))
    .sort(sortFn);

  const topItems: TopItem[] = [
    ...visibleGoals.map(g => ({ kind: 'goal' as const, goal: g })),
    ...visibleStandalone.map(t => ({ kind: 'task' as const, task: t })),
  ].sort((a, b) => sortFn(a.kind === 'goal' ? a.goal : a.task, b.kind === 'goal' ? b.goal : b.task));

  const getVisibleSubTasks = (goal: Goal): Task[] => {
    const all = (goal.tasks.map(tid => tasks[tid]).filter(Boolean) as Task[])
      .filter(t => showDone || !doneStatusIds.has(t.statusId))
      .filter(t => delegationFilter === 'all' || (delegationFilter === 'mine' ? !t.assignedTo : !!t.assignedTo))
      .filter(t => !filterInFocus || computeFocusLevel(t.dueDate) !== undefined);
    if (!q) return all;
    return matchesSearch(goal.title) || matchesSearch(goal.description) ? all : all.filter(t => matchesSearch(t.title));
  };

  const isGoalOpen = (goal: Goal) => {
    if (expanded[goal.id]) return true;
    if (q && !matchesSearch(goal.title) && !matchesSearch(goal.description) && goal.tasks.some(tid => tasks[tid] && matchesSearch(tasks[tid].title))) return true;
    return false;
  };

  // ── Handlers ──────────────────────────────────────────────────────────────
  const defaultPriorityId = settings.priorities.find(p => p.id === 'medium')?.id ?? sortedPriorities[Math.floor(sortedPriorities.length / 2)]?.id ?? sortedPriorities[0]?.id ?? '';
  const defaultStatusId = settings.statuses.find(s => s.id === 'todo')?.id ?? settings.statuses[0]?.id ?? '';

  const handleAddGoal = (groupKey?: string) => {
    const newId = `G-${String(state.goalCounter + 1).padStart(3, '0')}`;
    const overrides = groupKey !== undefined ? {
      ...(groupBy === 'status'   && { statusId: groupKey || defaultStatusId }),
      ...(groupBy === 'priority' && { priorityId: groupKey || defaultPriorityId }),
      ...(groupBy === 'assignee' && { assignedTo: groupKey }),
      ...(groupBy === 'block'    && { blockId: groupKey || undefined }),
    } : {};
    addGoal({ title: '', description: '', priorityId: defaultPriorityId, statusId: defaultStatusId, dueDate: '', tags: [], assignedTo: '', ...overrides });
    setFocusId(newId);
    if (groupKey !== undefined) setCollapsedGroups(prev => ({ ...prev, [groupKey]: false }));
  };

  const handleAddStandaloneTask = (groupKey?: string) => {
    const newId = `T-${String(state.taskCounter + 1).padStart(3, '0')}`;
    const overrides = groupKey !== undefined ? {
      ...(groupBy === 'status'   && { statusId: groupKey || defaultStatusId }),
      ...(groupBy === 'priority' && { priorityId: groupKey || defaultPriorityId }),
      ...(groupBy === 'assignee' && { assignedTo: groupKey }),
      ...(groupBy === 'block'    && { blockId: groupKey || undefined }),
    } : {};
    addTask({ goalId: '', title: '', description: '', priorityId: defaultPriorityId, statusId: defaultStatusId, dueDate: '', tags: [], assignedTo: '', ...overrides });
    setFocusId(newId);
    if (groupKey !== undefined) setCollapsedGroups(prev => ({ ...prev, [groupKey]: false }));
  };

  const handleAddSubTask = (goalId: string) => {
    const newId = `T-${String(state.taskCounter + 1).padStart(3, '0')}`;
    addTask({ goalId, title: '', description: '', priorityId: defaultPriorityId, statusId: defaultStatusId, dueDate: '', tags: [], assignedTo: '' });
    setExpanded(e => ({ ...e, [goalId]: true }));
    setFocusId(newId);
  };

  const handlePromoteAndAddSubTask = (task: Task) => {
    const newGoalId = `G-${String(state.goalCounter + 1).padStart(3, '0')}`;
    const newTaskId = `T-${String(state.taskCounter + 1).padStart(3, '0')}`;
    promoteTaskToGoal(task.id);
    addTask({ goalId: newGoalId, title: '', description: '', priorityId: defaultPriorityId, statusId: defaultStatusId, dueDate: '', tags: [], assignedTo: '' });
    setExpanded(e => ({ ...e, [newGoalId]: true }));
    setFocusId(newTaskId);
  };

  // ── DnD handlers ──────────────────────────────────────────────────────────
  function handleDragStart({ active }: DragStartEvent) {
    setActiveTaskId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTaskId(null);
    if (!over) return;
    const taskId = String(active.id);
    const overId = String(over.id);
    if (overId.startsWith('goal:')) {
      const targetGoalId = overId.slice(5);
      const task = tasks[taskId];
      if (task && task.goalId !== targetGoalId) moveTaskToGoal(taskId, targetGoalId);
    } else if (overId === 'standalone') {
      const task = tasks[taskId];
      if (task?.goalId) detachTask(taskId);
    }
  }

  const activeTask = activeTaskId ? tasks[activeTaskId] : null;

  const totalItems = Object.keys(goals).length + Object.values(tasks).filter(t => !t.goalId).length;

  // ── Grouping ──────────────────────────────────────────────────────────────

  const getItemGroupKey = (item: TopItem): string => {
    const obj = item.kind === 'goal' ? item.goal : item.task;
    switch (groupBy) {
      case 'status':   return obj.statusId || '';
      case 'priority': return obj.priorityId || '';
      case 'assignee': return obj.assignedTo || '';
      case 'block':    return (item.kind === 'task' ? item.task.blockId : item.goal.blockId) || '';
      default:         return '__all__';
    }
  };

  const groupDefs: { key: string; label: React.ReactNode }[] = groupBy === ''
    ? [{ key: '__all__', label: null }]
    : groupBy === 'status'   ? [...sortedStatuses.map(s => ({ key: s.id, label: renderStatus(s.id) })), { key: '', label: <span className="text-xs text-gray-500 font-medium">No status</span> }]
    : groupBy === 'priority' ? [...sortedPriorities.map(p => ({ key: p.id, label: renderPriority(p.id) })), { key: '', label: <span className="text-xs text-gray-500 font-medium">No priority</span> }]
    : groupBy === 'assignee' ? [...settings.people.map(p => ({ key: p.id, label: <span className="text-sm font-medium text-gray-700">{p.name}</span> })), { key: '', label: <span className="text-xs text-gray-500 font-medium">Unassigned</span> }]
    : /* block */ [...sortedBlocks.map(b => ({ key: b.id, label: <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium" style={{ backgroundColor: b.color + '22', color: b.color }}>{b.label}</span> })), { key: '', label: <span className="text-xs text-gray-500 font-medium">No block</span> }];

  const renderItems = (items: TopItem[]) => items.map(item => {
    if (item.kind === 'goal') {
      const { goal } = item;
      return (
        <GoalSection
          key={goal.id}
          goal={goal}
          subTasks={getVisibleSubTasks(goal)}
          open={isGoalOpen(goal)}
          showAddRow={!q}
          onToggle={() => toggle(goal.id)}
          onAddSubTask={() => handleAddSubTask(goal.id)}
          onUpdateGoal={data => updateGoal(goal.id, data)}
          onDeleteGoal={() => { deleteGoal(goal.id); toast.success('Goal deleted'); }}
          onUpdateTask={(tid, data) => updateTask(tid, data)}
          onDeleteTask={tid => { deleteTask(tid); toast.success('Task deleted'); }}
          onDetachTask={tid => detachTask(tid)}
          accentColor={blockMap[goal.blockId ?? '']?.color ?? '#e5e7eb'}
        />
      );
    }
    const { task } = item;
    return (
      <TaskRow
        key={task.id}
        task={task}
        variant="standalone"
        onUpdate={data => updateTask(task.id, data)}
        onDelete={() => { deleteTask(task.id); toast.success('Task deleted'); }}
        onPromoteAndAdd={() => handlePromoteAndAddSubTask(task)}
        onShiftEnter={handleAddStandaloneTask}
      />
    );
  });

  const renderGroups = (items: TopItem[]) => {
    const groups = groupDefs
      .map(def => ({ ...def, items: items.filter(i => getItemGroupKey(i) === def.key) }))
      .filter(g => g.items.length > 0);

    return groups.map(group => (
      <div key={group.key}>
        {groupBy && (
          <div className="flex items-center gap-3 px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 select-none">
            <div
              className="flex items-center gap-3 cursor-pointer flex-1 min-w-0"
              onClick={() => setCollapsedGroups(prev => ({ ...prev, [group.key]: !prev[group.key] }))}
            >
              {collapsedGroups[group.key]
                ? <ChevronRight size={13} className="text-gray-400 shrink-0" />
                : <ChevronDown size={13} className="text-gray-400 shrink-0" />}
              {group.label}
              <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-200/70 dark:bg-gray-700 px-1.5 py-0.5 rounded-full">
                {group.items.length}
              </span>
            </div>
            {!q && (
              <div className="flex items-center gap-1 shrink-0">
                <button
                  onClick={() => handleAddGoal(group.key)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-indigo-500 hover:bg-indigo-100 hover:text-indigo-700 transition-colors"
                ><Plus size={11} /> Goal</button>
                <button
                  onClick={() => handleAddStandaloneTask(group.key)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-gray-500 hover:bg-gray-200 hover:text-gray-700 transition-colors"
                ><Plus size={11} /> Task</button>
              </div>
            )}
          </div>
        )}
        {!collapsedGroups[group.key] && renderItems(group.items)}
      </div>
    ));
  };

  const ctxValue: ListCtxType = {
    statusOptions, priorityOptions, assigneeOptions, blockOptions,
    sortedStatusIds: sortedStatuses.map(s => s.id),
    blockColorMap,
    renderStatus, renderPriority, renderAssignedTo, renderBlock,
    allTags: settings.tags,
    focusId, activeTaskId, ask, onOpenDetail,
  };

  return (
    <>
    {dialog}
    {resizingX !== null && createPortal(
      <div className="fixed inset-y-0 w-0.5 bg-indigo-500/50 pointer-events-none z-[9999]" style={{ left: resizingX }} />,
      document.body
    )}
    <ListCtx.Provider value={ctxValue}>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 shadow-sm" style={{ overflow: 'clip', '--list-cols': gridTemplate } as React.CSSProperties}>

      {/* ── Sticky filter bar + column headers ── */}
      <div className="sticky top-14 z-30 bg-white dark:bg-gray-900">
        <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 flex-wrap">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
            <input type="text" value={searchText} onChange={e => setSearchText(e.target.value)} placeholder="Search goals & tasks..."
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800 focus:bg-white dark:focus:bg-gray-700 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 focus:border-transparent placeholder:text-gray-400 dark:placeholder:text-gray-500 transition" />
            {searchText && <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={11} /></button>}
          </div>
          <div className="flex items-center gap-1.5">
            <SlidersHorizontal size={12} className="text-gray-400 shrink-0" />
            <FilterDropdown label="Status" options={sortedStatuses.map(s => ({ value: s.id, content: <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} /><span className="text-xs text-gray-700">{s.label}</span></span> }))} selected={filterStatuses} onChange={setFilterStatuses} />
            <FilterDropdown label="Priority" options={sortedPriorities.map(p => ({ value: p.id, content: <span className="px-2 py-0.5 rounded-full text-xs font-medium border" style={{ backgroundColor: p.color + '20', color: p.color, borderColor: p.color + '44' }}>{p.label}</span> }))} selected={filterPriorities} onChange={setFilterPriorities} />
            {settings.people.length > 0 && <FilterDropdown label="Assignee" options={settings.people.map(p => ({ value: p.id, content: <span className="text-xs text-gray-700">{p.name}</span> }))} selected={filterAssignees} onChange={setFilterAssignees} />}
            <div className="flex items-center gap-1">
              <button
                title="Show all focused items"
                onClick={() => setFilterInFocus(v => !v)}
                className={`px-2 h-6 rounded text-[11px] font-semibold flex items-center justify-center transition-all ${filterInFocus ? 'bg-amber-500 text-white' : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600'}`}
              >Focus</button>
              {([['today','T','Today','#ef4444'],['3d','3','3 days','#f97316'],['5d','5','5 days','#3b82f6']] as [string,string,string,string][]).map(([val,label,title,color]) => {
                const active = filterFocus.includes(val);
                return (
                  <button
                    key={val}
                    title={title}
                    onClick={() => setFilterFocus(prev => prev.includes(val) ? prev.filter(v => v !== val) : [...prev, val])}
                    className="w-6 h-6 rounded text-xs font-bold flex items-center justify-center transition-all"
                    style={active ? { backgroundColor: color, color: '#fff' } : { color: '#9ca3af', background: 'transparent' }}
                    onMouseEnter={e => { if (!active) e.currentTarget.style.background = '#f3f4f6'; }}
                    onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent'; }}
                  >{label}</button>
                );
              })}
            </div>
            <div className="flex items-center rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden shrink-0">
              {(['all', 'mine', 'delegated'] as const).map((val, i) => {
                const label = val === 'all' ? 'All' : val === 'mine' ? 'Mine' : 'Delegated';
                const active = delegationFilter === val;
                return (
                  <button
                    key={val}
                    onClick={() => setDelegationFilter(active && val !== 'all' ? 'all' : val)}
                    className={`px-2.5 py-1 text-[11px] font-medium transition-colors ${i > 0 ? 'border-l border-gray-200 dark:border-gray-700' : ''} ${active ? 'bg-indigo-600 text-white' : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-gray-700 dark:hover:text-gray-200'}`}
                  >{label}</button>
                );
              })}
            </div>
            {hasFilters && <button onClick={clearFilters} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors border border-transparent"><X size={11} /> Clear</button>}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <label className="flex items-center gap-1.5 cursor-pointer select-none">
              <div className={`w-4 h-4 rounded border-2 shrink-0 flex items-center justify-center transition-colors ${showDone ? 'bg-indigo-600 border-indigo-600' : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'}`}
                onClick={() => setShowDone(v => !v)}>
                {showDone && <Check size={9} className="text-white" strokeWidth={3} />}
              </div>
              <span className="text-xs text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 transition-colors" onClick={() => setShowDone(v => !v)}>Show done</span>
            </label>
            <div className="w-px h-4 bg-gray-200 dark:bg-gray-700" />
            <GroupByDropdown value={groupBy} onChange={v => { setGroupBy(v); setCollapsedGroups({}); }} />
          </div>
        </div>
        <div className={`${GRID} items-center px-3 py-2 border-b-2 border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/60`} style={{ borderLeft: '3px solid transparent' }}>
          <div className="flex items-center">
            <button
              title={allExpanded ? 'Collapse all' : 'Expand all'}
              onClick={toggleExpandAll}
              className="p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
            >
              {allExpanded ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </button>
          </div>
          {([['title','Title','pl-7',1],['status','Status','',2],['priority','Priority','',3],['dueDate','Due Date','',4]] as [SortField,string,string,number][]).map(([f,lbl,cls,ci]) => (
            <div key={f} className="relative group">
              <button onClick={() => handleSort(f)}
                className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest select-none transition-colors ${cls} ${sortField === f ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                {lbl}
                {sortField === f && (sortDir === 'asc' ? <ArrowUp size={9} strokeWidth={3} /> : <ArrowDown size={9} strokeWidth={3} />)}
              </button>
              <ResizeHandle onMouseDown={(e) => startResize(ci, e)} active={resizingCol === ci} />
            </div>
          ))}
          <div className="relative group">
            <ColHeader>Focus</ColHeader>
            <ResizeHandle onMouseDown={(e) => startResize(5, e)} active={resizingCol === 5} />
          </div>
          {([['assignee','Assigned To','',6],['block','Block','',7]] as [SortField,string,string,number][]).map(([f,lbl,cls,ci]) => (
            <div key={f} className="relative group">
              <button onClick={() => handleSort(f)}
                className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest select-none transition-colors ${cls} ${sortField === f ? 'text-indigo-500' : 'text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300'}`}>
                {lbl}
                {sortField === f && (sortDir === 'asc' ? <ArrowUp size={9} strokeWidth={3} /> : <ArrowDown size={9} strokeWidth={3} />)}
              </button>
              <ResizeHandle onMouseDown={(e) => startResize(ci, e)} active={resizingCol === ci} />
            </div>
          ))}
          <div className="relative group">
            <ColHeader>Tags</ColHeader>
            <ResizeHandle onMouseDown={(e) => startResize(8, e)} active={resizingCol === 8} />
          </div>
          <div />
        </div>
      </div>

      {/* Empty states */}
      {totalItems === 0 && (
        <div className="py-16 text-center">
          <p className="text-sm text-gray-400 dark:text-gray-500 mb-4">No goals or tasks yet</p>
          <div className="flex items-center justify-center gap-3">
            <button onClick={handleAddGoal} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-50 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 text-sm font-medium hover:bg-indigo-100 dark:hover:bg-indigo-900/60 transition-colors"><Plus size={14} /> Add goal</button>
            <button onClick={handleAddStandaloneTask} className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 text-sm font-medium hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"><Plus size={14} /> Add task</button>
          </div>
        </div>
      )}
      {totalItems > 0 && topItems.length === 0 && (
        <div className="py-12 text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-1">No results match your filters</p>
          <button onClick={clearFilters} className="text-xs text-indigo-600 dark:text-indigo-400 hover:underline">Clear filters</button>
        </div>
      )}

      {renderGroups(topItems)}

      {/* Detach drop zone — only visible during an active drag of a sub-task */}
      {activeTaskId && tasks[activeTaskId]?.goalId && <StandaloneDropZone />}

      {/* Bottom add bar */}
      {!q && (
        <div className="flex border-t border-gray-100 dark:border-gray-800" style={{ borderLeft: '3px solid transparent' }}>
          <button onClick={handleAddGoal} className="flex-1 flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors border-r border-gray-100 dark:border-gray-800">
            <Plus size={14} /> Add goal
          </button>
          <button onClick={handleAddStandaloneTask} className="flex-1 flex items-center gap-2 px-4 py-3 text-sm text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/30 dark:hover:bg-indigo-900/20 transition-colors">
            <Plus size={14} /> Add task
          </button>
        </div>
      )}
    </div>

    {/* Drag overlay */}
    <DragOverlay>
      {activeTask && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border-2 border-indigo-400 px-3 py-2 shadow-xl max-w-xs rotate-1 opacity-95">
          <p className="text-xs font-mono text-gray-400 mb-0.5">{activeTask.id}</p>
          <p className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-snug">{activeTask.title || 'Untitled'}</p>
        </div>
      )}
    </DragOverlay>

    </DndContext>
    </ListCtx.Provider>
    </>
  );
}
