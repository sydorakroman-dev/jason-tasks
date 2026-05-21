import { useState } from 'react';
import { Plus, Pencil, Trash2, CalendarDays, User, ChevronDown, ChevronRight } from 'lucide-react';
import type { Goal, Task, Status } from '../types';
import { PriorityBadge } from './PriorityBadge';
import { TagBadge } from './TagBadge';
import { ItemForm } from './ItemForm';
import { useConfirm } from './ConfirmDialog';
import type { AppStore } from '../store/useAppStore';

interface Props {
  store: AppStore;
}

function formatDate(d: string) {
  if (!d) return null;
  return new Date(d + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function isOverdue(d: string) {
  if (!d) return false;
  return new Date(d) < new Date(new Date().toDateString());
}

export function KanbanView({ store }: Props) {
  const { state, addGoal, updateGoal, deleteGoal, addTask, updateTask, deleteTask } = store;
  const { goals, tasks, settings } = state;

  const [editGoal, setEditGoal] = useState<Goal | null>(null);
  const [editTask, setEditTask] = useState<Task | null>(null);
  const [newGoalStatusId, setNewGoalStatusId] = useState<string | null>(null);
  const [newTaskInfo, setNewTaskInfo] = useState<{ statusId: string; goalId: string } | null>(null);
  const [expandedGoals, setExpandedGoals] = useState<Record<string, boolean>>({});
  const { ask, dialog } = useConfirm();

  const tagMap   = Object.fromEntries(settings.tags.map(t => [t.id, t]));
  const blockMap = Object.fromEntries(settings.blocks.map(b => [b.id, b]));
  const sortedStatuses = [...settings.statuses].sort((a, b) => a.order - b.order);

  const toggleGoal = (id: string) => setExpandedGoals(e => ({ ...e, [id]: !e[id] }));

  const goalsForStatus = (statusId: string) =>
    Object.values(goals)
      .filter(g => g.statusId === statusId)
      .sort((a, b) => {
        const pa = settings.priorities.find(p => p.id === a.priorityId)?.order ?? 99;
        const pb = settings.priorities.find(p => p.id === b.priorityId)?.order ?? 99;
        return pa - pb;
      });

  const allTasksForGoal = (goalId: string) =>
    (goals[goalId]?.tasks ?? [])
      .map(tid => tasks[tid])
      .filter(Boolean) as Task[];

  return (
    <>
    {dialog}
    <div className="flex gap-4 overflow-x-auto pb-4 h-full">
      {sortedStatuses.map(status => {
        const columnGoals = goalsForStatus(status.id);

        return (
          <div key={status.id} className="flex-shrink-0 w-72 flex flex-col">
            {/* Column header */}
            <div className="flex items-center justify-between mb-3 px-1">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: status.color }} />
                <span className="text-sm font-semibold text-gray-700">{status.label}</span>
                <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-1.5 py-0.5">
                  {columnGoals.length}
                </span>
              </div>
              <button
                onClick={() => setNewGoalStatusId(status.id)}
                className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-indigo-600"
                title="Add goal"
              >
                <Plus size={14} />
              </button>
            </div>

            {/* Cards */}
            <div className="flex flex-col gap-2 flex-1">
              {columnGoals.map(goal => {
                const isOpen = !!expandedGoals[goal.id];
                const goalTasks = allTasksForGoal(goal.id);
                const totalTasks = goalTasks.length;

                return (
                  <div
                    key={goal.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden"
                  >
                    {/* Goal card */}
                    <div className="p-3">
                      <div className="flex items-start justify-between gap-1 mb-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1 mb-0.5">
                            <span className="text-xs font-mono text-gray-400">{goal.id}</span>
                            <PriorityBadge priority={settings.priorities.find(p => p.id === goal.priorityId)} />
                          </div>
                          <p className="text-sm font-semibold text-gray-900 leading-snug">{goal.title}</p>
                        </div>
                        <div className="flex gap-0.5 shrink-0 mt-0.5">
                          <button onClick={() => setEditGoal(goal)} className="p-1 rounded hover:bg-gray-100 text-gray-400">
                            <Pencil size={12} />
                          </button>
                          <button
                            onClick={() => ask('Delete Goal', `"${goal.title || 'Untitled'}" and all its tasks will be permanently deleted.`, () => deleteGoal(goal.id))}
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

                      {/* Tasks toggle */}
                      {totalTasks > 0 && (
                        <button
                          onClick={() => toggleGoal(goal.id)}
                          className="mt-2 flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition"
                        >
                          {isOpen ? <ChevronDown size={11} /> : <ChevronRight size={11} />}
                          {totalTasks} task{totalTasks !== 1 ? 's' : ''}
                        </button>
                      )}
                    </div>

                    {/* All tasks for this goal */}
                    {isOpen && (
                      <div className="border-t border-gray-100 bg-gray-50/60">
                        {goalTasks.length === 0 && (
                          <p className="px-3 py-2 text-xs text-gray-400 italic">No tasks yet</p>
                        )}
                        {goalTasks.map(task => {
                          const taskStatus = settings.statuses.find(s => s.id === task.statusId);
                          return (
                            <div
                              key={task.id}
                              className="flex items-start gap-2 px-3 py-2 border-b border-gray-100 last:border-0 group hover:bg-white transition"
                            >
                              <div className="w-3 h-3 rounded border border-gray-300 mt-0.5 shrink-0" />
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-1 mb-0.5 flex-wrap">
                                  <span className="text-[10px] font-mono text-gray-400">{task.id}</span>
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
                                <p className="text-xs text-gray-700 leading-snug">{task.title}</p>
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
                                <button
                                  onClick={() => ask('Delete Task', `"${task.title || 'Untitled'}" will be permanently deleted.`, () => deleteTask(task.id))}
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
                      onClick={() => setNewTaskInfo({ statusId: status.id, goalId: goal.id })}
                      className="w-full flex items-center gap-1 px-3 py-1.5 text-xs text-gray-400 hover:text-indigo-600 hover:bg-indigo-50/50 transition border-t border-gray-100"
                    >
                      <Plus size={11} /> Add task
                    </button>
                  </div>
                );
              })}

              {/* Add goal card */}
              <button
                onClick={() => setNewGoalStatusId(status.id)}
                className="w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl border-2 border-dashed border-gray-200 text-xs text-gray-400 hover:border-indigo-300 hover:text-indigo-600 transition"
              >
                <Plus size={13} /> Add goal
              </button>
            </div>
          </div>
        );
      })}

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
    </div>
    </>
  );
}
