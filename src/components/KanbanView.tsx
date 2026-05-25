import { useState } from 'react';
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  useDraggable, useDroppable,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core';
import { Plus, Pencil, Trash2, CalendarDays, CalendarPlus, User, ChevronDown, ChevronRight, Search, X, GripVertical } from 'lucide-react';
import type { Goal, Task, Status } from '../types';
import type { DetailItem } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { TagBadge } from './TagBadge';
import { ItemForm } from './ItemForm';
import { useConfirm } from './ConfirmDialog';
import type { AppStore } from '../store/useAppStore';
import { buildCalendarUrl } from '../utils/googleCalendar';
import { toast } from 'sonner';

interface Props {
  store: AppStore;
  onOpenDetail: (item: DetailItem) => void;
}

function formatDate(d: string) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(d: string) {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

// ─── Draggable Goal Card ───────────────────────────────────────────────────────

interface DraggableGoalCardProps {
  goal: Goal;
  tasks: Record<string, Task>;
  settings: AppStore['state']['settings'];
  expandedGoals: Record<string, boolean>;
  toggleGoal: (id: string) => void;
  setEditGoal: (goal: Goal) => void;
  setNewTaskInfo: (info: { statusId: string; goalId: string }) => void;
  ask: (title: string, msg: string, cb: () => void) => void;
  deleteGoal: (id: string) => void;
  deleteTask: (id: string) => void;
  setEditTask: (task: Task) => void;
  doneStatusIds: Set<string>;
  tagMap: Record<string, { id: string; label: string; color: string }>;
  blockMap: Record<string, { id: string; label: string; color: string; order: number }>;
  activeGoalId: string | null;
  onOpenDetail: (item: DetailItem) => void;
  statusId: string;
}

function DraggableGoalCard({
  goal, tasks, settings, expandedGoals, toggleGoal, setEditGoal, setNewTaskInfo,
  ask, deleteGoal, deleteTask, setEditTask, doneStatusIds, tagMap, blockMap,
  activeGoalId, onOpenDetail, statusId,
}: DraggableGoalCardProps) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: goal.id });

  const style = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 20 } : undefined;
  const isBeingDragged = activeGoalId === goal.id;

  const isOpen = !!expandedGoals[goal.id];
  const goalTasks = (goal.tasks ?? []).map(tid => tasks[tid]).filter(Boolean) as Task[];
  const totalCount = goalTasks.length;
  const doneCount = goalTasks.filter(t => doneStatusIds.has(t.statusId)).length;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden transition-opacity ${isBeingDragged ? 'opacity-30' : ''}`}
    >
      {/* Goal card */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-1 mb-2">
          <div className="flex items-center gap-1 shrink-0 mt-0.5">
            {/* Drag handle */}
            <button
              {...listeners}
              {...attributes}
              className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing transition-colors p-0.5"
              tabIndex={-1}
              onClick={e => e.stopPropagation()}
            >
              <GripVertical size={12} />
            </button>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1 mb-0.5 flex-wrap">
              <button
                onClick={() => onOpenDetail({ kind: 'goal', id: goal.id })}
                className="text-[10px] font-mono shrink-0 leading-none px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
              >{goal.id}</button>
              <PriorityBadge priority={settings.priorities.find(p => p.id === goal.priorityId)} />
            </div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 leading-snug">{goal.title}</p>
          </div>
          <div className="flex gap-0.5 shrink-0 mt-0.5">
            <button onClick={() => setEditGoal(goal)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
              <Pencil size={12} />
            </button>
            <a href={buildCalendarUrl(goal.title, goal.description || undefined, goal.dueDate || undefined)} target="_blank" rel="noopener noreferrer" className="p-1 rounded hover:bg-blue-50 text-blue-400">
              <CalendarPlus size={12} />
            </a>
            <button
              onClick={() => ask('Delete Goal', `"${goal.title || 'Untitled'}" and all its tasks will be permanently deleted.`, () => {
                deleteGoal(goal.id);
                toast.success(`Goal "${goal.title || 'Untitled'}" deleted`);
              })}
              className="p-1 rounded hover:bg-red-50 text-red-400"
            >
              <Trash2 size={12} />
            </button>
          </div>
        </div>

        {goal.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-2">
            {goal.tags.map(tid => tagMap[tid] && <TagBadge key={tid} tag={tagMap[tid]} />)}
          </div>
        )}

        <div className="flex items-center gap-3 text-xs text-gray-400">
          {goal.dueDate && (
            <span className={`flex items-center gap-1 ${isOverdue(goal.dueDate) ? 'text-red-500' : ''}`}>
              <CalendarDays size={10} /> {formatDate(goal.dueDate)}
            </span>
          )}
          {goal.assignedTo && (
            <span className="flex items-center gap-1 truncate max-w-[80px]">
              <User size={10} /> {goal.assignedTo.split('@')[0]}
            </span>
          )}
        </div>

        {/* Progress bar */}
        {totalCount > 0 && (
          <div className="mt-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-gray-400">{doneCount}/{totalCount} tasks</span>
              <span className="text-[10px] text-gray-400">{Math.round(doneCount / totalCount * 100)}%</span>
            </div>
            <div className="h-1 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
              <div className="h-full bg-indigo-400 rounded-full transition-all" style={{ width: `${totalCount ? doneCount / totalCount * 100 : 0}%` }} />
            </div>
          </div>
        )}

        {/* Tasks toggle */}
        {totalCount > 0 && (
          <button
            onClick={() => toggleGoal(goal.id)}
            className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition"
          >
            {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
            {totalCount} task{totalCount !== 1 ? 's' : ''}
          </button>
        )}
      </div>

      {/* All tasks for this goal */}
      {isOpen && (
        <div className="border-t border-gray-100 dark:border-gray-700 bg-gray-50/60 dark:bg-gray-900/30">
          {goalTasks.length === 0 && (
            <p className="px-3 py-2 text-xs text-gray-400 italic">No tasks yet</p>
          )}
          {goalTasks.map(task => {
            const taskStatus = settings.statuses.find(s => s.id === task.statusId);
            return (
              <div
                key={task.id}
                className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 dark:border-gray-700 last:border-0 group hover:bg-white dark:hover:bg-gray-700/50 transition"
              >
                <div className="w-3 h-3 rounded border border-gray-300 dark:border-gray-600 mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                    <button
                      onClick={() => onOpenDetail({ kind: 'task', id: task.id })}
                      className="text-[10px] font-mono shrink-0 leading-none px-1 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 hover:bg-indigo-100 dark:hover:bg-indigo-900/50 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors"
                    >{task.id}</button>
                    {taskStatus && (
                      <span
                        className="px-1.5 py-0 rounded-full text-[10px] font-medium leading-4"
                        style={{ backgroundColor: taskStatus.color + '20', color: taskStatus.color }}
                      >
                        {taskStatus.label}
                      </span>
                    )}
                    {task.blockId && blockMap[task.blockId] && (
                      <span
                        className="px-1.5 py-0 rounded-full text-[9px] font-medium leading-4"
                        style={{ backgroundColor: blockMap[task.blockId].color + '22', color: blockMap[task.blockId].color }}
                      >
                        {blockMap[task.blockId].label}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-700 dark:text-gray-300 leading-snug">{task.title}</p>
                  {task.dueDate && (
                    <span className={`text-xs flex items-center gap-1 mt-0.5 ${isOverdue(task.dueDate) ? 'text-red-500' : 'text-gray-400'}`}>
                      <CalendarDays size={9} /> {formatDate(task.dueDate)}
                    </span>
                  )}
                </div>
                <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition shrink-0">
                  <button onClick={() => setEditTask(task)} className="p-0.5 rounded hover:bg-gray-200 text-gray-400">
                    <Pencil size={11} />
                  </button>
                  <a href={buildCalendarUrl(task.title, task.description || undefined, task.dueDate || undefined)} target="_blank" rel="noopener noreferrer" className="p-0.5 rounded hover:bg-blue-50 text-blue-400">
                    <CalendarPlus size={11} />
                  </a>
                  <button
                    onClick={() => ask('Delete Task', `"${task.title || 'Untitled'}" will be permanently deleted.`, () => {
                      deleteTask(task.id);
                      toast.success(`Task "${task.title || 'Untitled'}" deleted`);
                    })}
                    className="p-0.5 rounded hover:bg-red-50 text-red-400"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add task to this goal */}
      <button
        onClick={() => setNewTaskInfo({ statusId, goalId: goal.id })}
        className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50/50 dark:hover:bg-indigo-900/20 transition border-t border-gray-100 dark:border-gray-700"
      >
        <Plus size={11} /> Add task
      </button>
    </div>
  );
}

// ─── Droppable Column ──────────────────────────────────────────────────────────

interface DroppableColumnProps {
  statusId: string;
  activeGoalId: string | null;
  children: React.ReactNode;
}

function DroppableColumn({ statusId, activeGoalId, children }: DroppableColumnProps) {
  const { setNodeRef, isOver } = useDroppable({ id: statusId });
  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col gap-2 flex-1 min-h-[60px] rounded-xl transition-colors ${isOver && activeGoalId !== null ? 'bg-indigo-50/30 ring-1 ring-inset ring-indigo-200' : ''}`}
    >
      {children}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export function KanbanView({ store, onOpenDetail }: Props) {
  const { state, addGoal, updateGoal, deleteGoal, addTask, updateTask, deleteTask } = store;
  const { goals, tasks, settings } = state;

  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newGoalStatusId, setNewGoalStatusId] = useState<string | null>(null);
  const [newTaskInfo, setNewTaskInfo] = useState<{ statusId: string; goalId: string } | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
  const [searchText, setSearchText] = useState('');
  const [activeGoalId, setActiveGoalId] = useState<string | null>(null);
  const { ask, dialog } = useConfirm();

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));

  const tagMap   = Object.fromEntries(settings.tags.map(t => [t.id, t]));
  const blockMap = Object.fromEntries(settings.blocks.map(b => [b.id, b]));
  const sortedStatuses = [...settings.statuses].sort((a, b) => a.order - b.order);
  const doneStatusIds = new Set(settings.statuses.filter(s => s.label.toLowerCase() === 'done').map(s => s.id));

  const toggleGoal = (id: string) => setExpandedGoals(e => ({ ...e, [id]: !e[id] }));

  const goalsForStatus = (statusId: string) => {
    const q = searchText.toLowerCase();
    return Object.values(goals)
      .filter(g => {
        if (g.statusId !== statusId) return false;
        if (!q) return true;
        return g.title.toLowerCase().includes(q) || (g.description || '').toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const pa = settings.priorities.find(p => p.id === a.priorityId)?.order ?? 99;
        const pb = settings.priorities.find(p => p.id === b.priorityId)?.order ?? 99;
        return pa - pb;
      });
  };

  function handleDragStart({ active }: DragStartEvent) {
    setActiveGoalId(String(active.id));
  }

  function handleDragEnd({ active, over }: DragEndEvent) {
    setActiveGoalId(null);
    if (!over) return;
    const goalId = String(active.id);
    const newStatusId = String(over.id);
    const goal = goals[goalId];
    if (goal && goal.statusId !== newStatusId) {
      updateGoal(goalId, { statusId: newStatusId });
    }
  }

  return (
    <>
    {dialog}
    <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="mb-4 flex items-center gap-2">
        <div className="relative max-w-xs">
          <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <input
            type="text"
            value={searchText}
            onChange={e => setSearchText(e.target.value)}
            placeholder="Search goals..."
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-gray-400 dark:placeholder:text-gray-500"
          />
          {searchText && (
            <button onClick={() => setSearchText('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X size={11} />
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4 flex-1">
        {sortedStatuses.map(status => {
          const columnGoals = goalsForStatus(status.id);

          return (
            <div key={status.id} className="flex-shrink-0 w-72 flex flex-col">
              {/* Column header */}
              <div className="flex items-center justify-between mb-3 px-1">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                  <span className="text-sm font-semibold text-gray-700 dark:text-gray-200">{status.label}</span>
                  <span className="text-xs text-gray-400 dark:text-gray-500 bg-gray-100 dark:bg-gray-700 rounded-full px-1.5 py-0.5">
                    {columnGoals.length}
                  </span>
                </div>
                <button
                  onClick={() => setNewGoalStatusId(status.id)}
                  className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-400 hover:text-indigo-600 dark:hover:text-indigo-400"
                  title="Add goal"
                >
                  <Plus size={14} />
                </button>
              </div>

              {/* Droppable cards area */}
              <DroppableColumn statusId={status.id} activeGoalId={activeGoalId}>
                {columnGoals.map(goal => (
                  <DraggableGoalCard
                    key={goal.id}
                    goal={goal}
                    tasks={tasks}
                    settings={settings}
                    expandedGoals={expandedGoals}
                    toggleGoal={toggleGoal}
                    setEditGoal={setEditGoal}
                    setNewTaskInfo={setNewTaskInfo}
                    ask={ask}
                    deleteGoal={deleteGoal}
                    deleteTask={deleteTask}
                    setEditTask={setEditTask}
                    doneStatusIds={doneStatusIds}
                    tagMap={tagMap}
                    blockMap={blockMap}
                    activeGoalId={activeGoalId}
                    onOpenDetail={onOpenDetail}
                    statusId={status.id}
                  />
                ))}

                {/* Add goal card */}
                <button
                  onClick={() => setNewGoalStatusId(status.id)}
                  className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 dark:border-gray-700 text-xs text-gray-400 dark:text-gray-500 hover:border-indigo-300 dark:hover:border-indigo-600 hover:text-indigo-600 dark:hover:text-indigo-400 transition"
                >
                  <Plus size={13} /> Add goal
                </button>
              </DroppableColumn>
            </div>
          );
        })}
      </div>
    </div>

    {/* Drag Overlay */}
    <DragOverlay>
      {activeGoalId && goals[activeGoalId] && (
        <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-400 px-3 py-3 shadow-2xl w-72 rotate-1 opacity-95">
          <p className="text-xs font-mono text-gray-400 mb-1">{goals[activeGoalId].id}</p>
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{goals[activeGoalId].title || 'Untitled'}</p>
        </div>
      )}
    </DragOverlay>

    {/* Modals */}
    {newGoalStatusId && (
      <ItemForm
        mode="goal"
        initial={{ statusId: newGoalStatusId }}
        settings={settings}
        onSave={data => addGoal({ ...data, calendarEventId: undefined })}
        onClose={() => setNewGoalStatusId(null)}
      />
    )}

    {newTaskInfo && (
      <ItemForm
        mode="task"
        initial={{ statusId: newTaskInfo.statusId }}
        settings={settings}
        onSave={data => addTask({ ...data, goalId: newTaskInfo.goalId, calendarEventId: undefined })}
        onClose={() => setNewTaskInfo(null)}
      />
    )}

    {editGoal && (
      <ItemForm
        mode="goal"
        initial={editGoal}
        settings={settings}
        existingCalendarEventId={editGoal.calendarEventId}
        onSave={data => updateGoal(editGoal.id, data)}
        onCalendarSync={id => updateGoal(editGoal.id, { calendarEventId: id })}
        onClose={() => setEditGoal(null)}
      />
    )}

    {editTask && (
      <ItemForm
        mode="task"
        initial={editTask}
        settings={settings}
        existingCalendarEventId={editTask.calendarEventId}
        onSave={data => updateTask(editTask.id, data)}
        onCalendarSync={id => updateTask(editTask.id, { calendarEventId: id })}
        onClose={() => setEditTask(null)}
      />
    )}
    </DndContext>
    </>
  );
}
