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
        "task-card-root group relative flex flex-col bg-white dark:bg-slate-800 border rounded-2xl transition-all duration-300 mb-1.5 shadow-sm overflow-hidden",
        task.completed ? "opacity-50" : "border-slate-200 dark:border-slate-700",
        isActive && "border-blue-500 ring-4 ring-blue-500/10",
        selected && "border-blue-500 ring-2 ring-blue-500/20"
      )}
      onClick={() => onOpenDetail(task)}
    >
      <div className="flex min-h-[48px]">
        {/* 🚀 暴力高对比度手柄区 - 亮蓝色背景 */}
        <div 
          className="w-10 flex items-center justify-center bg-blue-600 dark:bg-blue-500 cursor-grab active:cursor-grabbing text-white shrink-0 shadow-inner"
          draggable
          onDragStart={(e) => {
             e.stopPropagation();
             const card = e.currentTarget.closest('.task-card-root');
             if (card) e.dataTransfer.setDragImage(card, 10, 10);
             onDragStart(e, task);
          }}
        >
          <GripVertical size={20} strokeWidth={3} />
        </div>

        <div className="flex-1 p-3 flex items-center gap-3">
          {isBatchMode ? (
            <button onClick={(e) => { e.stopPropagation(); onSelect(task.id); }} className="shrink-0 text-blue-500">
              {selected ? <CheckSquare size={19} className="fill-current/10" /> : <Square size={19} className="opacity-40" />}
            </button>
          ) : (
            <button 
              onClick={(e) => { e.stopPropagation(); onToggle(task.lineIndex, task.completed); }} 
              className={cn("shrink-0 transition-all", task.completed ? "text-emerald-500" : "text-slate-300 dark:text-slate-600 hover:text-blue-500")}
            >
              {task.completed ? <CheckCircle2 size={19} strokeWidth={2.5} /> : <Circle size={19} strokeWidth={2.5} />}
            </button>
          )}

          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            {task.priority && (
              <span className={cn("text-[10px] font-black px-1.5 py-0.5 rounded-md border shrink-0", priorityStyle)}>
                P{task.priority}
              </span>
            )}
            <h4 className={cn(
              "font-bold text-[14px] truncate leading-snug flex-1",
              task.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200"
            )}>
              {task.content}
            </h4>
            <div className="flex items-center gap-2 shrink-0 ml-auto">
              {task.date && (
                <div className={cn("text-[10px] font-bold flex items-center gap-1 px-1.5 py-0.5 rounded-md", isOverdue ? "text-rose-500 bg-rose-50 dark:bg-rose-500/10" : "text-blue-500/80 bg-blue-50/50 dark:bg-blue-500/10")}>
                  <Clock size={11} />
                  <span>{task.date.split(' ')[0].split('-').slice(1).join('/')}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Subtasks Section */}
      {task.subtasks && task.subtasks.length > 0 && (
        <div className="ml-10 border-l-2 border-slate-100 dark:border-slate-700">
          {task.subtasks.map((sub) => (
            <div key={sub.lineIndex} className="flex border-t border-slate-100 dark:border-slate-700/50">
              {/* 🔵 子任务暴力手柄 - 深蓝色区域 */}
              <div 
                className="w-10 flex items-center justify-center bg-blue-100 dark:bg-blue-900/30 cursor-grab active:cursor-grabbing text-blue-600 dark:text-blue-400 shrink-0"
                draggable
                onDragStart={(e) => {
                  e.stopPropagation();
                  onDragStart(e, { ...task, lineIndex: sub.lineIndex, content: sub.content, lineCount: 1, isSubtask: true } as any);
                }}
              >
                <GripVertical size={16} />
              </div>

              <div className="flex-1 flex items-center gap-3 p-2 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                <button 
                  onClick={(e) => { e.stopPropagation(); onToggle(sub.lineIndex, sub.completed); }}
                  className={cn("shrink-0", sub.completed ? "text-emerald-500/60" : "text-slate-300 dark:text-slate-600")}
                >
                  {sub.completed ? <CheckCircle2 size={15} /> : <Circle size={15} />}
                </button>
                <span className={cn("text-[12px] font-medium flex-1", sub.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-300")}>
                  {sub.content}
                </span>
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
