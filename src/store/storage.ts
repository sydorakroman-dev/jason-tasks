import type { AppState, AppSettings } from '../types';

const LS_KEY = 'jason_tasks_v1';
const API = '/api/data';

export const DEFAULT_SETTINGS: AppSettings = {
  googleClientId: '',
  theme: 'system',
  statuses: [
    { id: 'backlog',      label: 'Backlog',      color: '#6b7280', order: 0 },
    { id: 'todo',         label: 'To Do',        color: '#3b82f6', order: 1 },
    { id: 'in-progress',  label: 'In Progress',  color: '#f59e0b', order: 2 },
    { id: 'done',         label: 'Done',         color: '#10b981', order: 3 },
  ],
  priorities: [
    { id: 'critical', label: 'Critical', color: '#ef4444', order: 0 },
    { id: 'high',     label: 'High',     color: '#f97316', order: 1 },
    { id: 'medium',   label: 'Medium',   color: '#eab308', order: 2 },
    { id: 'low',      label: 'Low',      color: '#3b82f6', order: 3 },
    { id: 'minimal',  label: 'Minimal',  color: '#9ca3af', order: 4 },
  ],
  tags: [
    { id: 'strategy',  label: 'Strategy',   color: '#8b5cf6' },
    { id: 'finance',   label: 'Finance',    color: '#06b6d4' },
    { id: 'ops',       label: 'Operations', color: '#f97316' },
    { id: 'hr',        label: 'HR',         color: '#ec4899' },
  ],
  people: [],
  blocks: [
    { id: 'operations', label: 'Operations', color: '#f97316', order: 0 },
    { id: 'strategy',   label: 'Strategy',   color: '#3b82f6', order: 1 },
    { id: 'personal',   label: 'Personal',   color: '#22c55e', order: 2 },
    { id: 'phd',        label: 'PhD',        color: '#eab308', order: 3 },
  ],
};

export const INITIAL_STATE: AppState = {
  goals: {},
  tasks: {},
  settings: DEFAULT_SETTINGS,
  goalCounter: 0,
  taskCounter: 0,
};

// Migrate data from old numeric priority format
function migrate(raw: any): AppState {
  const numericMap: Record<number, string> = {
    1: 'critical', 2: 'high', 3: 'medium', 4: 'low', 5: 'minimal',
  };

  const goals = { ...raw.goals } as Record<string, any>;
  Object.values(goals).forEach((g: any) => {
    if (typeof g.priority === 'number') { g.priorityId = numericMap[g.priority] ?? 'medium'; delete g.priority; }
    if (!g.priorityId) g.priorityId = 'medium';
  });

  const tasks = { ...raw.tasks } as Record<string, any>;
  Object.values(tasks).forEach((t: any) => {
    if (typeof t.priority === 'number') { t.priorityId = numericMap[t.priority] ?? 'medium'; delete t.priority; }
    if (!t.priorityId) t.priorityId = 'medium';
  });

  const settings = { ...DEFAULT_SETTINGS, ...raw.settings };
  if (!settings.priorities) settings.priorities = DEFAULT_SETTINGS.priorities;
  if (!settings.people)     settings.people     = [];
  if (!settings.theme) settings.theme = 'system';
  if (!settings.blocks) {
    settings.blocks = DEFAULT_SETTINGS.blocks;
  } else {
    // Re-apply canonical order + color for the 4 default blocks
    const blockFix: Record<string, { order: number; color: string }> = {
      operations: { order: 0, color: '#f97316' },
      strategy:   { order: 1, color: '#3b82f6' },
      personal:   { order: 2, color: '#22c55e' },
      phd:        { order: 3, color: '#eab308' },
    };
    settings.blocks = settings.blocks.map((b: any) =>
      blockFix[b.id] !== undefined ? { ...b, ...blockFix[b.id] } : b
    );
  }

  return { ...raw, goals, tasks, settings };
}

// ── localStorage ──────────────────────────────────────────────────────────────

export function loadLocalState(): AppState {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return INITIAL_STATE;
    return migrate(JSON.parse(raw));
  } catch {
    return INITIAL_STATE;
  }
}

export function saveLocalState(state: AppState): void {
  try { localStorage.setItem(LS_KEY, JSON.stringify(state)); } catch { /* quota */ }
}

// ── File server ───────────────────────────────────────────────────────────────

export async function loadRemoteState(): Promise<AppState | null> {
  try {
    const res = await fetch(API, { signal: AbortSignal.timeout(2000) });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data) return null;
    return migrate(data);
  } catch {
    return null;
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null;
export function scheduleSaveRemote(state: AppState): void {
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(state) })
      .catch(() => {});
  }, 400);
}
