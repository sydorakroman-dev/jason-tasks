export interface Priority {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface Status {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface Tag {
  id: string;
  label: string;
  color: string;
}

export interface Block {
  id: string;
  label: string;
  color: string;
  order: number;
}

export interface Person {
  id: string;
  name: string;
  email: string;
}

export interface Goal {
  id: string;
  title: string;
  description: string;
  priorityId: string;
  statusId: string;
  dueDate: string;
  tags: string[];
  assignedTo: string;   // person id
  calendarEventId?: string;
  createdAt: string;
  tasks: string[];
  blockId?: string;
}

export interface Task {
  id: string;
  goalId: string;
  title: string;
  description: string;
  priorityId: string;
  statusId: string;
  dueDate: string;
  tags: string[];
  assignedTo: string;   // person id
  calendarEventId?: string;
  createdAt: string;
  blockId?: string;
}

export interface AppSettings {
  googleClientId: string;
  statuses: Status[];
  priorities: Priority[];
  tags: Tag[];
  people: Person[];
  blocks: Block[];
}

export type ViewMode = 'list' | 'kanban';

export type DetailItem = { kind: 'task'; id: string } | { kind: 'goal'; id: string };

export interface AppState {
  goals: Record<string, Goal>;
  tasks: Record<string, Task>;
  settings: AppSettings;
  goalCounter: number;
  taskCounter: number;
}
