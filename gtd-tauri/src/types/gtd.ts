export type Priority = 1 | 2 | 3 | null;
export type Recurrence = 'day' | 'week' | 'month' | null;

export interface Subtask {
  content: string;
  completed: boolean;
  lineIndex: number;
  date?: string | null;
  doneDate?: string | null;
  priority?: Priority;
  tags?: string[];
  recurrence?: Recurrence;
  timezone?: string | null;
}

export interface Task {
  id: string;
  lineIndex: number;
  lineCount: number;
  content: string;
  completed: boolean;
  date: string | null;
  doneDate: string | null;
  /** Timed reminder: "YYYY-MM-DD HH:mm" (stored in markdown as @remind(...)) */
  reminder: string | null;
  recurrence: Recurrence;
  priority: Priority;
  tags: string[];
  timezone: string | null;
  projectPath: string;
  notes: string[];
  subtasks: Subtask[];
}

export interface ProjectNode {
  name: string;
  displayName: string;
  children: ProjectNode[];
  tasks: Task[];
  level: number;
  path: string;
  incompleteCount: number;
}

export type ViewType = 'view' | 'calendar' | 'stats' | 'settings';

export interface Filter {
  type: 'all' | 'project' | 'time' | 'tag';
  value: string;
}

/** 项目分组（仅 UI 层，不改变 markdown） */
export interface ProjectGroup {
  id: string;
  name: string;
  projectPaths: string[];
}
