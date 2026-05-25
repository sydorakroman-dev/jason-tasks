import { useState, useCallback, useEffect, useRef } from 'react';
import type { AppState, Goal, Task, AppSettings, Status, Priority, Tag, Person, Block } from '../types';
import { loadLocalState, saveLocalState, loadRemoteState, scheduleSaveRemote } from './storage';

function nextGoalId(counter: number) { return `G-${String(counter + 1).padStart(3, '0')}`; }
function nextTaskId(counter: number) { return `T-${String(counter + 1).padStart(3, '0')}`; }

export function useAppStore() {
  const [state, setState] = useState<AppState>(() => loadLocalState());
  const initialLocalRef = useRef<AppState | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    initialLocalRef.current = state;
    loadRemoteState().then(remote => {
      if (remote) setState(current => current === initialLocalRef.current ? remote : current);
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    saveLocalState(state);
    scheduleSaveRemote(state);
  }, [state, hydrated]);

  // ── Goals ──────────────────────────────────────────────────────────────────
  const addGoal = useCallback((data: Omit<Goal, 'id' | 'createdAt' | 'tasks'>) => {
    setState(s => {
      const id = nextGoalId(s.goalCounter);
      return { ...s, goalCounter: s.goalCounter + 1, goals: { ...s.goals, [id]: { ...data, id, createdAt: new Date().toISOString(), tasks: [] } } };
    });
  }, []);

  const updateGoal = useCallback((id: string, data: Partial<Goal>) => {
    setState(s => ({ ...s, goals: { ...s.goals, [id]: { ...s.goals[id], ...data } } }));
  }, []);

  const deleteGoal = useCallback((id: string) => {
    setState(s => {
      const tasks = { ...s.tasks };
      s.goals[id]?.tasks.forEach(tid => delete tasks[tid]);
      const goals = { ...s.goals }; delete goals[id];
      return { ...s, goals, tasks };
    });
  }, []);

  // ── Tasks ──────────────────────────────────────────────────────────────────
  const addTask = useCallback((data: Omit<Task, 'id' | 'createdAt'>) => {
    setState(s => {
      const id = nextTaskId(s.taskCounter);
      const goalId = s.goals[data.goalId] ? data.goalId : '';
      const goal = goalId ? s.goals[goalId] : null;
      return {
        ...s, taskCounter: s.taskCounter + 1,
        tasks: { ...s.tasks, [id]: { ...data, id, goalId, createdAt: new Date().toISOString() } },
        goals: goal ? { ...s.goals, [goalId]: { ...goal, tasks: [...goal.tasks, id] } } : s.goals,
      };
    });
  }, []);

  const updateTask = useCallback((id: string, data: Partial<Task>) => {
    setState(s => ({ ...s, tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...data } } }));
  }, []);

  const deleteTask = useCallback((id: string) => {
    setState(s => {
      const task = s.tasks[id];
      const tasks = { ...s.tasks }; delete tasks[id];
      const goals = { ...s.goals };
      if (task?.goalId && goals[task.goalId])
        goals[task.goalId] = { ...goals[task.goalId], tasks: goals[task.goalId].tasks.filter(t => t !== id) };
      return { ...s, tasks, goals };
    });
  }, []);

  // ── Settings ───────────────────────────────────────────────────────────────
  const updateSettings = useCallback((data: Partial<AppSettings>) => {
    setState(s => ({ ...s, settings: { ...s.settings, ...data } }));
  }, []);

  // Statuses
  const addStatus = useCallback((st: Status) => {
    setState(s => ({ ...s, settings: { ...s.settings, statuses: [...s.settings.statuses, st] } }));
  }, []);
  const updateStatus = useCallback((id: string, data: Partial<Status>) => {
    setState(s => ({ ...s, settings: { ...s.settings, statuses: s.settings.statuses.map(st => st.id === id ? { ...st, ...data } : st) } }));
  }, []);
  const deleteStatus = useCallback((id: string) => {
    setState(s => {
      const fallback = s.settings.statuses.find(st => st.id !== id)?.id ?? '';
      const goals = Object.fromEntries(Object.entries(s.goals).map(([k, g]) =>
        [k, g.statusId === id ? { ...g, statusId: fallback } : g]));
      const tasks = Object.fromEntries(Object.entries(s.tasks).map(([k, t]) =>
        [k, t.statusId === id ? { ...t, statusId: fallback } : t]));
      return { ...s, goals, tasks, settings: { ...s.settings, statuses: s.settings.statuses.filter(st => st.id !== id) } };
    });
  }, []);

  // Priorities
  const addPriority = useCallback((p: Priority) => {
    setState(s => ({ ...s, settings: { ...s.settings, priorities: [...s.settings.priorities, p] } }));
  }, []);
  const updatePriority = useCallback((id: string, data: Partial<Priority>) => {
    setState(s => ({ ...s, settings: { ...s.settings, priorities: s.settings.priorities.map(p => p.id === id ? { ...p, ...data } : p) } }));
  }, []);
  const deletePriority = useCallback((id: string) => {
    setState(s => {
      const fallback = s.settings.priorities.find(p => p.id !== id)?.id ?? '';
      const goals = Object.fromEntries(Object.entries(s.goals).map(([k, g]) =>
        [k, g.priorityId === id ? { ...g, priorityId: fallback } : g]));
      const tasks = Object.fromEntries(Object.entries(s.tasks).map(([k, t]) =>
        [k, t.priorityId === id ? { ...t, priorityId: fallback } : t]));
      return { ...s, goals, tasks, settings: { ...s.settings, priorities: s.settings.priorities.filter(p => p.id !== id) } };
    });
  }, []);

  // Tags
  const addTag = useCallback((tag: Tag) => {
    setState(s => ({ ...s, settings: { ...s.settings, tags: [...s.settings.tags, tag] } }));
  }, []);
  const updateTag = useCallback((id: string, data: Partial<Tag>) => {
    setState(s => ({ ...s, settings: { ...s.settings, tags: s.settings.tags.map(t => t.id === id ? { ...t, ...data } : t) } }));
  }, []);
  const deleteTag = useCallback((id: string) => {
    setState(s => {
      const goals = Object.fromEntries(Object.entries(s.goals).map(([k, g]) =>
        [k, g.tags.includes(id) ? { ...g, tags: g.tags.filter(t => t !== id) } : g]));
      const tasks = Object.fromEntries(Object.entries(s.tasks).map(([k, t]) =>
        [k, t.tags.includes(id) ? { ...t, tags: t.tags.filter(tag => tag !== id) } : t]));
      return { ...s, goals, tasks, settings: { ...s.settings, tags: s.settings.tags.filter(t => t.id !== id) } };
    });
  }, []);

  // People
  const addPerson = useCallback((person: Person) => {
    setState(s => ({ ...s, settings: { ...s.settings, people: [...s.settings.people, person] } }));
  }, []);
  const updatePerson = useCallback((id: string, data: Partial<Person>) => {
    setState(s => ({ ...s, settings: { ...s.settings, people: s.settings.people.map(p => p.id === id ? { ...p, ...data } : p) } }));
  }, []);
  const deletePerson = useCallback((id: string) => {
    setState(s => {
      const goals = Object.fromEntries(Object.entries(s.goals).map(([k, g]) =>
        [k, g.assignedTo === id ? { ...g, assignedTo: '' } : g]));
      const tasks = Object.fromEntries(Object.entries(s.tasks).map(([k, t]) =>
        [k, t.assignedTo === id ? { ...t, assignedTo: '' } : t]));
      return { ...s, goals, tasks, settings: { ...s.settings, people: s.settings.people.filter(p => p.id !== id) } };
    });
  }, []);

  // Move task from one goal to another (or to standalone when targetGoalId = '')
  const moveTaskToGoal = useCallback((taskId: string, targetGoalId: string) => {
    setState(s => {
      const task = s.tasks[taskId];
      if (!task || task.goalId === targetGoalId) return s;
      const tasks = { ...s.tasks, [taskId]: { ...task, goalId: targetGoalId } };
      const goals = { ...s.goals };
      if (task.goalId && goals[task.goalId]) {
        goals[task.goalId] = { ...goals[task.goalId], tasks: goals[task.goalId].tasks.filter(t => t !== taskId) };
      }
      if (targetGoalId && goals[targetGoalId]) {
        goals[targetGoalId] = { ...goals[targetGoalId], tasks: [...goals[targetGoalId].tasks, taskId] };
      }
      return { ...s, tasks, goals };
    });
  }, []);

  // Detach task from its goal → makes it standalone
  const detachTask = useCallback((taskId: string) => {
    setState(s => {
      const task = s.tasks[taskId];
      if (!task || !task.goalId) return s;
      const tasks = { ...s.tasks, [taskId]: { ...task, goalId: '' } };
      const goals = { ...s.goals };
      if (goals[task.goalId]) {
        goals[task.goalId] = { ...goals[task.goalId], tasks: goals[task.goalId].tasks.filter(t => t !== taskId) };
      }
      return { ...s, tasks, goals };
    });
  }, []);

  // Promote task → goal (creates new Goal with task's data, removes task)
  const promoteTaskToGoal = useCallback((taskId: string) => {
    setState(s => {
      const task = s.tasks[taskId];
      if (!task) return s;
      const newGoalId = nextGoalId(s.goalCounter);
      const newGoal: Goal = {
        id: newGoalId,
        title: task.title,
        description: task.description,
        priorityId: task.priorityId,
        statusId: task.statusId,
        dueDate: task.dueDate,
        tags: [...task.tags],
        assignedTo: task.assignedTo,
        calendarEventId: task.calendarEventId,
        createdAt: task.createdAt,
        tasks: [],
      };
      const tasks = { ...s.tasks };
      delete tasks[taskId];
      const goals = { ...s.goals };
      if (task.goalId && goals[task.goalId]) {
        goals[task.goalId] = { ...goals[task.goalId], tasks: goals[task.goalId].tasks.filter(t => t !== taskId) };
      }
      goals[newGoalId] = newGoal;
      return { ...s, tasks, goals, goalCounter: s.goalCounter + 1 };
    });
  }, []);

  // Blocks
  const addBlock = useCallback((block: Block) => {
    setState(s => ({ ...s, settings: { ...s.settings, blocks: [...s.settings.blocks, block] } }));
  }, []);
  const updateBlock = useCallback((id: string, data: Partial<Block>) => {
    setState(s => ({ ...s, settings: { ...s.settings, blocks: s.settings.blocks.map(b => b.id === id ? { ...b, ...data } : b) } }));
  }, []);
  const deleteBlock = useCallback((id: string) => {
    setState(s => {
      const goals = Object.fromEntries(Object.entries(s.goals).map(([k, g]) =>
        [k, g.blockId === id ? { ...g, blockId: undefined } : g]));
      const tasks = Object.fromEntries(Object.entries(s.tasks).map(([k, t]) =>
        [k, t.blockId === id ? { ...t, blockId: undefined } : t]));
      return { ...s, goals, tasks, settings: { ...s.settings, blocks: s.settings.blocks.filter(b => b.id !== id) } };
    });
  }, []);

  return {
    state, hydrated,
    addGoal, updateGoal, deleteGoal,
    addTask, updateTask, deleteTask,
    updateSettings,
    addStatus, updateStatus, deleteStatus,
    addPriority, updatePriority, deletePriority,
    addTag, updateTag, deleteTag,
    addPerson, updatePerson, deletePerson,
    moveTaskToGoal, detachTask, promoteTaskToGoal,
    addBlock, updateBlock, deleteBlock,
  };
}

export type AppStore = ReturnType<typeof useAppStore>;
