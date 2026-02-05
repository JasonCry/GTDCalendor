import { useMemo } from 'react';
import { Task, ProjectNode, Recurrence, Priority } from '../types/gtd';

export const useGtdParser = (markdown: string, translations: any) => {
  const getLocalizedName = (name: string, t: any): string => {
    if (name.includes('收件箱') || name.toLowerCase().includes('inbox')) return t.inbox;
    if (name.includes('下一步') || name.toLowerCase().includes('next action')) return t.nextActions;
    if (name.includes('等待') || name.toLowerCase().includes('waiting')) return t.waitingFor;
    if (name.includes('将来') || name.includes('未来也许') || name.toLowerCase().includes('someday') || name.toLowerCase().includes('maybe')) return t.somedayMaybe;
    return name;
  };

  return useMemo(() => {
    const lines = markdown.split('\n');
    const root: ProjectNode = { name: 'Root', displayName: 'Root', children: [], tasks: [], level: 0, path: '', incompleteCount: 0 };
    const stack: ProjectNode[] = [root];
    const allTasks: Task[] = [];
    let currentTask: Task | null = null;

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed === '') { currentTask = null; return; }

      if (trimmed.startsWith('#')) {
        currentTask = null;
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const nodeName = trimmed.replace(/^#+\s*/, '').trim();
        const node: ProjectNode = { 
          name: nodeName, 
          displayName: getLocalizedName(nodeName, translations),
          children: [], tasks: [], level, path: '', incompleteCount: 0 
        };
        while (stack.length > 1 && (stack[stack.length - 1].level >= level)) stack.pop();
        const parent = stack[stack.length - 1];
        node.path = parent.path ? `${parent.path} / ${nodeName}` : nodeName;
        parent.children.push(node);
        stack.push(node);
      } else if (currentTask && (line.startsWith('  ') || line.startsWith('\t'))) {
        if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
          const dateMatch = trimmed.match(/@(\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?)/);
          const doneMatch = trimmed.match(/@done\((\d{4}-\d{2}-\d{2})\)/);
          const everyMatch = trimmed.match(/@every\((day|week|month)\)/);
          const tzMatch = trimmed.match(/@tz\(([^)]+)\)/);
          const priorityMatch = trimmed.match(/!([1-3])/);
          const tagsMatch = trimmed.match(/#([^\s#]+)/g);
          const cleanContent = trimmed
            .replace(/^- \[[ x]\]\s*/, '')
            .replace(/@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '')
            .replace(/@done\(\d{4}-\d{2}-\d{2}\)/, '')
            .replace(/@every\((day|week|month)\)/, '')
            .replace(/@tz\([^)]+\)/, '')
            .replace(/![1-3]/, '')
            .replace(/#[^\s#]+/g, '')
            .trim();
          currentTask.subtasks.push({
            content: cleanContent,
            completed: trimmed.startsWith('- [x]'),
            lineIndex: index,
            date: dateMatch ? dateMatch[1] : null,
            doneDate: doneMatch ? doneMatch[1] : null,
            priority: (priorityMatch ? parseInt(priorityMatch[1]) : null) as Priority,
            tags: tagsMatch ? tagsMatch.map(t => t.substring(1)) : [],
            recurrence: (everyMatch ? everyMatch[1] : null) as Recurrence,
            timezone: tzMatch ? tzMatch[1].trim() : null
          });
        } else {
          currentTask.notes.push(trimmed);
        }
        currentTask.lineCount++;
      } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        const dateMatch = trimmed.match(/@(\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?)/);
        const doneMatch = trimmed.match(/@done\((\d{4}-\d{2}-\d{2})\)/);
        const everyMatch = trimmed.match(/@every\((day|week|month)\)/);
        const tzMatch = trimmed.match(/@tz\(([^)]+)\)/);
        const priorityMatch = trimmed.match(/!([1-3])/);
        const tagsMatch = trimmed.match(/#([^\s#]+)/g);
        
        const task: Task = {
          id: `task-${index}`,
          lineIndex: index,
          lineCount: 1,
          content:
            trimmed
              .replace(/^- \[[ x]\]\s*/, '')
              .replace(/@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '')
              .replace(/@done\(\d{4}-\d{2}-\d{2}\)/, '')
              .replace(/@every\((day|week|month)\)/, '')
              .replace(/@tz\([^)]+\)/, '')
              .replace(/![1-3]/, '')
              .replace(/#[^\s#]+/g, '')
              .trim(),
          completed: trimmed.startsWith('- [x]'),
          date: dateMatch ? dateMatch[1] : null,
          doneDate: doneMatch ? doneMatch[1] : null,
          recurrence: (everyMatch ? everyMatch[1] : null) as Recurrence,
          priority: (priorityMatch ? parseInt(priorityMatch[1]) : null) as Priority,
          tags: tagsMatch ? tagsMatch.map(t => t.substring(1)) : [],
          timezone: tzMatch ? tzMatch[1].trim() : null,
          projectPath: stack[stack.length - 1].path,
          notes: [],
          subtasks: []
        };
        stack[stack.length - 1].tasks.push(task);
        allTasks.push(task);
        currentTask = task;
      }
    });

    const calculateStats = (node: ProjectNode): number => {
      let incomplete = node.tasks.filter(t => !t.completed).length;
      node.children.forEach(child => { incomplete += calculateStats(child); });
      node.incompleteCount = incomplete;
      return incomplete;
    };
    root.children.forEach(calculateStats);

    return { projects: root.children, allTasks };
  }, [markdown, translations]);
};
