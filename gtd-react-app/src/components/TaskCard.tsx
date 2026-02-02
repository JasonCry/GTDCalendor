import React, { useMemo } from 'react';
import { 
  CheckCircle2, Circle, Trash2, Clock, ListTodo, Repeat, CheckSquare, Square, GripVertical 
} from 'lucide-react';
import { isBefore, parseISO, isValid, startOfDay } from 'date-fns';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Task } from '../types/gtd';

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

interface TaskCardProps {
  task: Task;
  isBatchMode?: boolean;
  selected?: boolean;
  isActive?: boolean;
  onToggle: (idx: number, status: boolean) => void;
  onDelete: (idx: number) => void;
  onSelect: (id: string) => void;
  onOpenDetail: (task: Task) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onMakeSubtask: (sourceIdx: number, targetIdx: number) => void;
}

const TaskCard: React.FC<TaskCardProps> = React.memo(({ 
  task, isBatchMode, selected, isActive, 
  onToggle, onDelete, onSelect, onOpenDetail, onDragStart, onMakeSubtask
}) => {
  const [isSubtaskDropTarget, setIsSubtaskDropTarget] = React.useState(false);
  const isOverdue = useMemo(() => {
    if (!task.date || task.completed) return false;
    try {
      const hasTime = task.date.includes(' ');
      const dStr = hasTime ? task.date.replace(' ', 'T') : task.date;
      const taskDate = parseISO(dStr);
      if (!isValid(taskDate)) return false;
      const now = new Date();
      if (!hasTime) return isBefore(taskDate, startOfDay(now));
      return isBefore(taskDate, now);
    } catch { return false; }
  }, [task.date, task.completed]);

  const priorityStyle = useMemo(() => {
    switch(task.priority) {
      case 1: return "text-rose-500 bg-rose-50 dark:bg-rose-950/30 border-rose-100 dark:border-rose-900/50";
      case 2: return "text-orange-500 bg-orange-50 dark:bg-orange-950/30 border-orange-100 dark:border-orange-900/50";
      case 3: return "text-sky-500 bg-sky-50 dark:bg-sky-950/30 border-sky-100 dark:border-sky-900/50";
      default: return "text-slate-400 bg-slate-50 dark:bg-slate-900/30 border-slate-100 dark:border-slate-800";
    }
  }, [task.priority]);

  return (
    <div 
      className={cn(
        "task-card-root group relative flex flex-col bg-white dark:bg-slate-800 border rounded-xl transition-all duration-300 mb-1 shadow-sm overflow-hidden",
        task.completed ? "opacity-50" : "border-slate-200 dark:border-slate-700",
        isActive && "border-blue-500 ring-4 ring-blue-500/10",
        selected && "border-blue-500 ring-2 ring-blue-500/20"
      )}
      onClick={() => onOpenDetail(task)}
    >
      <div className="flex min-h-[40px]">
        {/* 拖拽抓手：与卡片同色系，悬停略深 */}
        <div 
          className="w-7 flex items-center justify-center rounded-l-xl cursor-grab active:cursor-grabbing shrink-0 bg-slate-100 dark:bg-slate-700/80 text-slate-500 dark:text-slate-400 hover:bg-slate-200 hover:text-slate-600 dark:hover:bg-slate-600 dark:hover:text-slate-300 transition-colors"
          draggable
          onDragStart={(e) => {
             e.stopPropagation();
             const card = e.currentTarget.closest('.task-card-root');
             if (card) e.dataTransfer.setDragImage(card, 10, 10);
             onDragStart(e, task);
          }}
        >
          <GripVertical size={14} strokeWidth={2.5} />
        </div>

        <div className="flex-1 px-2.5 py-2 flex items-center gap-2">
          {isBatchMode ? (
            <button onClick={(e) => { e.stopPropagation(); onSelect(task.id); }} className="shrink-0 text-blue-500">
              {selected ? <CheckSquare size={17} className="fill-current/10" /> : <Square size={17} className="opacity-40" />}
            </button>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggle(task.lineIndex, task.completed); }} 
              className={cn("shrink-0 transition-all", task.completed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400 hover:text-blue-500 dark:hover:text-blue-400")}
            >
              {task.completed ? <CheckCircle2 size={17} strokeWidth={2.5} /> : <Circle size={17} strokeWidth={2.5} />}
            </button>
          )}

          <div className="flex-1 flex items-center gap-2 min-w-0">
            {task.priority && (
              <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0", priorityStyle)}>
                P{task.priority}
              </span>
            )}
            <h4 className={cn(
              "font-bold text-[13px] truncate leading-snug flex-1",
              task.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"
            )}>
              {task.content}
            </h4>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {task.date && (
                <div className={cn("text-[10px] font-bold flex items-center gap-1 px-1 py-0.5 rounded", isOverdue ? "text-rose-500 bg-rose-50 dark:bg-rose-500/10" : "text-blue-500/80 bg-blue-50/50 dark:bg-blue-500/10")}>
                  <Clock size={10} />
                  <span>{task.date.split(' ')[0].split('-').slice(1).join('/')}</span>
                </div>
              )}
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(task.lineIndex); }}
                className="p-1 rounded-lg text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 transition-colors opacity-0 group-hover:opacity-100"
                title="删除任务"
              >
                <Trash2 size={13} strokeWidth={2.5} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Subtasks Section */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="ml-7 border-l-2 border-slate-100 dark:border-slate-700">
          {task.subtasks.map((sub) => (
            <div key={sub.lineIndex} className="flex min-h-[36px] border-t border-slate-100 dark:border-slate-700/50">
              <div 
                className="w-7 flex items-center justify-center cursor-grab active:cursor-grabbing shrink-0 text-slate-400 dark:text-slate-500 bg-slate-50/80 dark:bg-slate-800/50 hover:bg-slate-200 hover:text-slate-500 dark:hover:bg-slate-700 dark:hover:text-slate-400 transition-colors"
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStart(e, { ...task, lineIndex: sub.lineIndex, content: sub.content, lineCount: 1, isSubtask: true } as any);
                }}
              >
                <GripVertical size={12} strokeWidth={2.5} />
              </div>

              <div className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors group/sub">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggle(sub.lineIndex, sub.completed); }}
                  className={cn("shrink-0 transition-all", sub.completed ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-slate-400 hover:text-blue-500/80")}
                >
                  {sub.completed ? <CheckCircle2 size={14} /> : <Circle size={14} strokeWidth={2.5} />}
                </button>
                <span className={cn("text-[12px] font-medium flex-1", sub.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300")}>
                  {sub.content}
                </span>
                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(sub.lineIndex); }}
                  className="p-1 rounded text-slate-300 dark:text-slate-600 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 opacity-0 group-hover/sub:opacity-100 transition-opacity"
                  title="删除子任务"
                >
                  <Trash2 size={12} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 📥 NESTING DROP ZONE: Convert to subtask */}
      <div 
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsSubtaskDropTarget(true); }}
        onDragLeave={() => setIsSubtaskDropTarget(false)}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setIsSubtaskDropTarget(false);
          try {
            const raw = e.dataTransfer.getData('task');
            if (!raw) return;
            const taskData = JSON.parse(raw);
            if (taskData.lineIndex !== task.lineIndex) {
              onMakeSubtask(taskData.lineIndex, task.lineIndex);
            }
          } catch (err) { console.error('Subtask drop error:', err); }
        }}
        className={cn(
          "ml-10 mt-1 rounded-xl transition-all duration-300 flex items-center justify-center border-2 border-dashed",
          isSubtaskDropTarget 
            ? "h-16 border-blue-500 bg-blue-500/10 scale-[1.02] shadow-lg" 
            : "h-2 border-transparent"
        )}
      >
        {isSubtaskDropTarget && (
          <div className="flex flex-col items-center gap-1">
            <span className="text-[11px] font-black text-blue-600 dark:text-blue-400 uppercase tracking-widest animate-bounce">
              Drop to create Subtask
            </span>
            <span className="text-[9px] text-blue-400 opacity-70">Will indent under: {task.content.slice(0, 20)}...</span>
          </div>
        )}
      </div>
    </div>
  );
});

export default TaskCard;
