// Returns true if hex color is light enough to need dark text
function isLight(hex: string) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 130;
}

import { useState, useCallback, createContext, useContext } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDroppable, useDraggable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Plus, Trash2, GripVertical, ChevronDown, ChevronRight, Unlink, ArrowUp, ArrowDown } from 'lucide-react';
import type { Goal, Task, Block, DetailItem } from '../types';
import type { AppStore } from '../store/useAppStore';
import { EditableText, SelectCell, DateCell, FocusButtons } from './cells';
import { useConfirm } from './ConfirmDialog';

interface Props { store: AppStore; onOpenDetail: (item: DetailItem) => void; }

// ─── Column layout ────────────────────────────────────────────────────────────
// drag/chevron | title | priority | status | due date | actions
const GRID = 'grid grid-cols-[18px_minmax(120px,1fr)_100px_110px_94px_76px_28px]';

type SortField = 'title' | 'priority' | 'status' | 'dueDate';
type SortDir   = 'asc' | 'desc';

function ColHeader({ children }: { children: React.ReactNode }) {
  return <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest select-none">{children}</div>;
}

// ─── Shared context ───────────────────────────────────────────────────────────

interface BlockCtxType {
  statusOptions: { value: string; badge: React.ReactNode }[];
  priorityOptions: { value: string; badge: React.ReactNode }[];
  renderStatus: (id: string) => React.ReactNode;
  renderPriority: (id: string) => React.ReactNode;
  focusId: string | null;
  activeTaskId: string | null;
  ask: (title: string, msg: string, cb: () => void) => void;
  onOpenDetail: (item: DetailItem) => void;
  sortField: SortField;
  sortDir: SortDir;
  onSort: (f: SortField) => void;
}
const BlockCtx = createContext<BlockCtxType>(null!);

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

function DraggableBlockTaskRow({ task, variant, onUpdate, onDelete, onDetach, onPromoteAndAdd, onShiftEnter }: TaskRowProps) {
  const { statusOptions, priorityOptions, renderStatus, renderPriority, focusId, activeTaskId, ask, onOpenDetail } = useContext(BlockCtx);
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: task.id });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 } : undefined;
  const isBeingDragged = activeTaskId === task.id;
  const indent = variant === 'subtask';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${GRID} items-center px-2 py-0.5 border-b border-gray-100 group transition-colors ${indent ? 'bg-gray-50/60 hover:bg-gray-100/60' : 'hover:bg-gray-50/50'} ${isBeingDragged ? 'opacity-30' : ''}`}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        className="flex items-center justify-center text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors"
        tabIndex={-1}
      >
        <GripVertical size={12} />
      </button>

      {/* Title */}
      <div className={`flex items-center gap-1.5 min-w-0 pr-2 ${indent ? 'pl-4' : ''}`}>
        {indent && <div className="w-2.5 h-2.5 rounded border-2 border-gray-300 shrink-0" />}
        <button onClick={() => onOpenDetail({ kind: 'task', id: task.id })} className="text-[9px] font-mono text-gray-300 shrink-0 hover:text-indigo-400 transition-colors leading-none">{task.id}</button>
        <EditableText value={task.title} onChange={v => onUpdate({ title: v })} placeholder="Task title..." autoFocus={focusId === task.id} onShiftEnter={onShiftEnter} />
      </div>

      {/* Priority */}
      <div className="pr-1">
        <SelectCell value={task.priorityId} options={priorityOptions} renderBadge={renderPriority} onChange={v => onUpdate({ priorityId: v })} />
      </div>

      {/* Status */}
      <div className="pr-1">
        <SelectCell value={task.statusId} options={statusOptions} renderBadge={renderStatus} onChange={v => onUpdate({ statusId: v })} />
      </div>

      {/* Due date */}
      <DateCell value={task.dueDate} onChange={v => onUpdate({ dueDate: v })} />

      {/* Focus */}
      <div className="flex items-center"><FocusButtons dueDate={task.dueDate} onChange={v => onUpdate({ dueDate: v })} /></div>

      {/* Actions */}
      <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
        {onDetach && (
          <button onClick={onDetach} title="Detach from goal" className="p-0.5 rounded hover:bg-amber-50 text-amber-400 transition-colors"><Unlink size={11} /></button>
        )}
        {onPromoteAndAdd && (
          <button onClick={onPromoteAndAdd} title="Add sub-task (converts to goal)" className="p-0.5 rounded hover:bg-indigo-50 text-indigo-400 transition-colors"><Plus size={11} /></button>
        )}
        <button onClick={() => ask('Delete Task', `"${task.title || 'Untitled'}" will be permanently deleted.`, onDelete)} className="p-0.5 rounded hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={11} /></button>
      </div>
    </div>
  );
}

// ─── Goal section within a block ─────────────────────────────────────────────

interface BlockGoalSectionProps {
  goal: Goal;
  blockTasks: Task[];          // only tasks of this goal that are in this block
  onUpdateGoal: (data: Partial<Goal>) => void;
  onDeleteGoal: () => void;
  onUpdateTask: (taskId: string, data: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onDetachTask: (taskId: string) => void;
  onAddSubTask: () => void;    // add task to this goal + current block
}

function BlockGoalSection({ goal, blockTasks, onUpdateGoal, onDeleteGoal, onUpdateTask, onDeleteTask, onDetachTask, onAddSubTask }: BlockGoalSectionProps) {
  const { statusOptions, priorityOptions, renderStatus, renderPriority, focusId, ask, onOpenDetail } = useContext(BlockCtx);
  const [open, setOpen] = useState(false);

  return (
    <div>
      {/* Goal header row */}
      <div className={`${GRID} items-center px-2 py-1.5 border-b border-gray-100 group transition-colors hover:bg-indigo-50/20 bg-gray-50/40`}>
        {/* Expand chevron */}
        <button onClick={() => setOpen(o => !o)} className="flex items-center justify-center text-gray-400 hover:text-gray-700 transition-colors">
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>

        {/* Title */}
        <div className="flex items-center gap-1.5 min-w-0 pr-2">
          <button onClick={() => onOpenDetail({ kind: 'goal', id: goal.id })} className="text-[9px] font-mono text-gray-300 shrink-0 hover:text-indigo-400 transition-colors leading-none">{goal.id}</button>
          <EditableText value={goal.title} onChange={v => onUpdateGoal({ title: v })} placeholder="Goal title..." bold autoFocus={focusId === goal.id} />
        </div>

        <div className="pr-1">
          <SelectCell value={goal.priorityId} options={priorityOptions} renderBadge={renderPriority} onChange={v => onUpdateGoal({ priorityId: v })} />
        </div>
        <div className="pr-1">
          <SelectCell value={goal.statusId} options={statusOptions} renderBadge={renderStatus} onChange={v => onUpdateGoal({ statusId: v })} />
        </div>
        <DateCell value={goal.dueDate} onChange={v => onUpdateGoal({ dueDate: v })} />
        <div className="flex items-center"><FocusButtons dueDate={goal.dueDate} onChange={v => onUpdateGoal({ dueDate: v })} /></div>

        <div className="flex items-center justify-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onAddSubTask} title="Add task" className="p-0.5 rounded hover:bg-indigo-50 text-indigo-400 transition-colors"><Plus size={11} /></button>
          <button onClick={() => ask('Delete Goal', `"${goal.title || 'Untitled'}" and all its tasks will be permanently deleted.`, onDeleteGoal)} className="p-0.5 rounded hover:bg-red-50 text-red-400 transition-colors"><Trash2 size={11} /></button>
        </div>
      </div>

      {/* Sub-tasks (only those in this block) */}
      {open && blockTasks.map(task => (
        <DraggableBlockTaskRow
          key={task.id}
          task={task}
          variant="subtask"
          onUpdate={data => onUpdateTask(task.id, data)}
          onDelete={() => onDeleteTask(task.id)}
          onDetach={() => onDetachTask(task.id)}
          onShiftEnter={onAddSubTask}
        />
      ))}

      {/* Add sub-task inline */}
      {open && (
        <button onClick={onAddSubTask} className="w-full flex items-center gap-1.5 pl-10 pr-3 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/30 border-b border-gray-100 transition-colors">
          <Plus size={11} /> Add task
        </button>
      )}
    </div>
  );
}

// ─── Droppable block column ───────────────────────────────────────────────────

interface BlockColumnProps {
  block: Block;
  goalsWithTasks: { goal: Goal; blockTasks: Task[] }[];
  standaloneTasks: Task[];
  activeTaskId: string | null;
  onAddTask: () => void;
  onAddSubTaskToGoal: (goalId: string) => void;
  onPromoteAndAdd: (task: Task) => void;
  onUpdateGoal: (goalId: string, data: Partial<Goal>) => void;
  onDeleteGoal: (goalId: string) => void;
  onUpdateTask: (taskId: string, data: Partial<Task>) => void;
  onDeleteTask: (taskId: string) => void;
  onDetachTask: (taskId: string) => void;
}

function DroppableBlockColumn({ block, goalsWithTasks, standaloneTasks, activeTaskId, onAddTask, onAddSubTaskToGoal, onPromoteAndAdd, onUpdateGoal, onDeleteGoal, onUpdateTask, onDeleteTask, onDetachTask }: BlockColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: block.id });
  const { sortField, sortDir, onSort } = useContext(BlockCtx);
  const light = isLight(block.color);
  const textColor = light ? '#1f2937' : '#ffffff';
  const mutedColor = light ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.65)';
  const hoverBg = light ? 'rgba(0,0,0,0.08)' : 'rgba(255,255,255,0.18)';
  const taskCount = goalsWithTasks.reduce((n, { blockTasks }) => n + blockTasks.length, 0) + standaloneTasks.length;

  return (
    <div className="flex flex-col min-h-0 bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Section header */}
      <div className="flex items-center justify-between px-3 py-2.5" style={{ backgroundColor: block.color }}>
        <div className="flex items-center gap-2">
          <span className="text-sm font-bold" style={{ color: textColor }}>{block.label}</span>
          <span className="text-xs rounded-full px-1.5 py-0.5 font-medium" style={{ color: mutedColor, backgroundColor: light ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)' }}>
            {taskCount}
          </span>
        </div>
        <button
          onClick={onAddTask}
          className="p-1 rounded-lg transition"
          style={{ color: textColor }}
          onMouseEnter={e => (e.currentTarget.style.backgroundColor = hoverBg)}
          onMouseLeave={e => (e.currentTarget.style.backgroundColor = 'transparent')}
          title="Add task"
        >
          <Plus size={13} />
        </button>
      </div>

      {/* Column headers */}
      <div className={`${GRID} items-center px-2 py-1 border-b border-gray-200 bg-gray-50`}>
        <div />
        {([['title','Title'],['priority','Priority'],['status','Status'],['dueDate','Due']] as [SortField,string][]).map(([f,lbl]) => (
          <button key={f} onClick={() => onSort(f)}
            className={`flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest select-none transition-colors ${sortField === f ? 'text-indigo-500' : 'text-gray-400 hover:text-gray-600'}`}>
            {lbl}
            {sortField === f && (sortDir === 'asc' ? <ArrowUp size={8} strokeWidth={3} /> : <ArrowDown size={8} strokeWidth={3} />)}
          </button>
        ))}
        <ColHeader>Focus</ColHeader>
        <div />
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={`flex-1 flex flex-col min-h-[60px] transition-colors ${isOver && activeTaskId ? 'bg-indigo-50/40' : ''}`}
      >
        {/* Goals */}
        {goalsWithTasks.map(({ goal, blockTasks }) => (
          <BlockGoalSection
            key={goal.id}
            goal={goal}
            blockTasks={blockTasks}
            onUpdateGoal={data => onUpdateGoal(goal.id, data)}
            onDeleteGoal={() => onDeleteGoal(goal.id)}
            onUpdateTask={onUpdateTask}
            onDeleteTask={onDeleteTask}
            onDetachTask={onDetachTask}
            onAddSubTask={() => onAddSubTaskToGoal(goal.id)}
          />
        ))}

        {/* Standalone tasks */}
        {standaloneTasks.map(task => (
          <DraggableBlockTaskRow
            key={task.id}
            task={task}
            variant="standalone"
            onUpdate={data => onUpdateTask(task.id, data)}
            onDelete={() => onDeleteTask(task.id)}
            onPromoteAndAdd={() => onPromoteAndAdd(task)}
            onShiftEnter={onAddTask}
          />
        ))}

        {taskCount === 0 && (
          <div className="flex-1 flex items-center justify-center py-4">
            <p className="text-xs text-gray-300 italic">No tasks — drop here or click +</p>
          </div>
        )}
      </div>

      {/* Add task footer */}
      <button onClick={onAddTask} className="w-full flex items-center gap-1.5 px-3 py-2 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/30 border-t border-gray-100 transition-colors">
        <Plus size={12} /> Add task
      </button>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function BlockView({ store, onOpenDetail }: Props) {
  const { state, updateTask, addTask, deleteTask, updateGoal, deleteGoal, detachTask, moveTaskToGoal, promoteTaskToGoal } = store;
  const { tasks, goals, settings } = state;
  const blocks = [...settings.blocks].sort((a, b) => a.order - b.order);

  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const [sortField, setSortField] = useState<SortField>('priority');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const { ask, dialog } = useConfirm();

  const handleSort = (f: SortField) => {
    if (sortField === f) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(f); setSortDir('asc'); }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const statusMap   = Object.fromEntries(settings.statuses.map(s => [s.id, s]));
  const priorityMap = Object.fromEntries(settings.priorities.map(p => [p.id, p]));
  const sortedStatuses   = [...settings.statuses].sort((a, b) => a.order - b.order);
  const sortedPriorities = [...settings.priorities].sort((a, b) => a.order - b.order);

  const statusOptions = sortedStatuses.map(s => ({ value: s.id, badge: <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: s.color + '20', color: s.color, border: `1px solid ${s.color}44` }}><span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}</span> }));
  const priorityOptions = sortedPriorities.map(p => ({ value: p.id, badge: <span className="px-1.5 py-0 rounded-full text-[10px] font-medium border" style={{ backgroundColor: p.color + '20', color: p.color, borderColor: p.color + '44' }}>{p.label}</span> }));

  const renderStatus = useCallback((statusId: string) => {
    const s = statusMap[statusId];
    if (!s) return <span className="text-xs text-gray-300">—</span>;
    return <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium whitespace-nowrap" style={{ backgroundColor: s.color + '20', color: s.color, border: `1px solid ${s.color}44` }}><span className="w-1 h-1 rounded-full shrink-0" style={{ backgroundColor: s.color }} />{s.label}</span>;
  }, [JSON.stringify(statusMap)]);

  const renderPriority = useCallback((priorityId: string) => {
    const p = priorityMap[priorityId];
    if (!p) return <span className="text-xs text-gray-300">—</span>;
    return <span className="px-1.5 py-0 rounded-full text-[10px] font-medium border" style={{ backgroundColor: p.color + '20', color: p.color, borderColor: p.color + '44' }}>{p.label}</span>;
  }, [JSON.stringify(priorityMap)]);

  // ── Sort + content per block ───────────────────────────────────────────────

  const sortTasksFn = (a: Task, b: Task): number => {
    let cmp = 0;
    switch (sortField) {
      case 'title':    cmp = (a.title || '').localeCompare(b.title || ''); break;
      case 'priority': cmp = (priorityMap[a.priorityId]?.order ?? 99) - (priorityMap[b.priorityId]?.order ?? 99); break;
      case 'status':   cmp = (statusMap[a.statusId]?.order ?? 99) - (statusMap[b.statusId]?.order ?? 99); break;
      case 'dueDate':  cmp = (a.dueDate || 'zzz').localeCompare(b.dueDate || 'zzz'); break;
    }
    const dir = sortDir === 'asc' ? 1 : -1;
    return dir * (cmp || a.createdAt.localeCompare(b.createdAt));
  };

  const contentForBlock = (blockId: string) => {
    const blockTasks = Object.values(tasks).filter(t => t.blockId === blockId);
    const goalIdsFromTasks = new Set(blockTasks.filter(t => t.goalId).map(t => t.goalId));
    const goalIdsFromGoals = Object.values(goals).filter(g => g.blockId === blockId).map(g => g.id);
    const allGoalIds = [...new Set([...goalIdsFromTasks, ...goalIdsFromGoals])];
    const goalsInBlock = allGoalIds.map(gid => goals[gid]).filter(Boolean) as Goal[];
    const standaloneTasks = blockTasks.filter(t => !t.goalId).sort(sortTasksFn);
    return { goalsInBlock, standaloneTasks };
  };

  const goalTasksInBlock = (goal: Goal, blockId: string): Task[] =>
    (goal.tasks.map(tid => tasks[tid]).filter(t => t && t.blockId === blockId) as Task[]).sort(sortTasksFn);

  // ── Handlers ──────────────────────────────────────────────────────────────

  const defaultPriorityId = settings.priorities.find(p => p.id === 'medium')?.id ?? sortedPriorities[Math.floor(sortedPriorities.length / 2)]?.id ?? sortedPriorities[0]?.id ?? '';
  const defaultStatusId = settings.statuses.find(s => s.id === 'todo')?.id ?? settings.statuses[0]?.id ?? '';

  const handleAddTask = (blockId: string) => {
    const newId = `T-${String(state.taskCounter + 1).padStart(3, '0')}`;
    addTask({ goalId: '', title: '', description: '', priorityId: defaultPriorityId, statusId: defaultStatusId, dueDate: '', tags: [], assignedTo: '', blockId });
    setFocusId(newId);
  };

  const handleAddSubTaskToGoal = (goalId: string, blockId: string) => {
    const newId = `T-${String(state.taskCounter + 1).padStart(3, '0')}`;
    addTask({ goalId, title: '', description: '', priorityId: defaultPriorityId, statusId: defaultStatusId, dueDate: '', tags: [], assignedTo: '', blockId });
    setFocusId(newId);
  };

  const handlePromoteAndAdd = (task: Task, blockId: string) => {
    const newGoalId = `G-${String(state.goalCounter + 1).padStart(3, '0')}`;
    const newTaskId = `T-${String(state.taskCounter + 1).padStart(3, '0')}`;
    promoteTaskToGoal(task.id);
    addTask({ goalId: newGoalId, title: '', description: '', priorityId: defaultPriorityId, statusId: defaultStatusId, dueDate: '', tags: [], assignedTo: '', blockId });
    setFocusId(newTaskId);
  };

  // ── DnD ───────────────────────────────────────────────────────────────────

  function handleDragStart({ active }: DragStartEvent) {
    setActiveTaskId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveTaskId(null);
    if (!over) return;
    const taskId = String(active.id);
    const targetBlockId = String(over.id);
    if (blocks.find(b => b.id === targetBlockId) && tasks[taskId]) {
      updateTask(taskId, { blockId: targetBlockId });
    }
  }

  const activeTask = activeTaskId ? tasks[activeTaskId] : null;

  const ctxValue: BlockCtxType = {
    statusOptions, priorityOptions, renderStatus, renderPriority,
    focusId, activeTaskId, ask, onOpenDetail,
    sortField, sortDir, onSort: handleSort,
  };

  return (
    <>
    {dialog}
    <BlockCtx.Provider value={ctxValue}>
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="grid grid-cols-2 grid-rows-2 gap-4 h-full">
        {blocks.slice(0, 4).map(block => {
          const { goalsInBlock, standaloneTasks } = contentForBlock(block.id);
          const goalsWithTasks = goalsInBlock.map(g => ({ goal: g, blockTasks: goalTasksInBlock(g, block.id) }));
          return (
            <DroppableBlockColumn
              key={block.id}
              block={block}
              goalsWithTasks={goalsWithTasks}
              standaloneTasks={standaloneTasks}
              activeTaskId={activeTaskId}
              onAddTask={() => handleAddTask(block.id)}
              onAddSubTaskToGoal={goalId => handleAddSubTaskToGoal(goalId, block.id)}
              onPromoteAndAdd={task => handlePromoteAndAdd(task, block.id)}
              onUpdateGoal={(goalId, data) => updateGoal(goalId, data)}
              onDeleteGoal={goalId => deleteGoal(goalId)}
              onUpdateTask={(taskId, data) => updateTask(taskId, data)}
              onDeleteTask={taskId => deleteTask(taskId)}
              onDetachTask={taskId => detachTask(taskId)}
            />
          );
        })}
      </div>

      <DragOverlay>
        {activeTask && (
          <div className="bg-white rounded-lg border-2 border-indigo-400 px-3 py-2 shadow-xl max-w-[220px] rotate-1 opacity-95">
            <p className="text-[9px] font-mono text-gray-400 mb-0.5">{activeTask.id}</p>
            <p className="text-sm font-medium text-gray-800 leading-snug">{activeTask.title || 'Untitled'}</p>
          </div>
        )}
      </DragOverlay>
    </DndContext>
    </BlockCtx.Provider>
    </>
  );
}
