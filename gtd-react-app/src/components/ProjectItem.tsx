import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, ChevronRight, Edit2, Check, Trash2, Hash } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { ProjectNode } from '../types/gtd';

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

interface ProjectItemProps {
  node: ProjectNode;
  expanded: boolean;
  active: boolean;
  icon: React.ElementType;
  onToggle: (path: string) => void;
  onSelect: (node: ProjectNode) => void;
  onRename: (path: string, newName: string) => void;
  onDelete: (path: string) => void;
  onDropTask: (idx: number, targetPath: string) => void;
}

const ProjectItem: React.FC<ProjectItemProps> = ({ 
  node, expanded, active, icon: Icon, 
  onToggle, onSelect, onRename, onDelete, onDropTask 
}) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(node.name);
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const hasChildren = node.children && node.children.length > 0;

  useEffect(() => {
    if (isEditing) inputRef.current?.focus();
  }, [isEditing]);

  const handleSave = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (editName.trim() && editName !== node.name) {
      onRename(node.path, editName.trim());
    }
    setIsEditing(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    try {
      const taskData = JSON.parse(e.dataTransfer.getData('task'));
      onDropTask(taskData.lineIndex, node.path);
    } catch (err) {
      console.error('Drop error:', err);
    }
  };

  return (
    <div className="group/proj relative">
      <div 
        className={cn(
          "flex items-center gap-3 px-3 py-2 rounded-2xl cursor-pointer transition-all duration-300 border border-transparent mb-0.5",
          active 
            ? "bg-blue-600/10 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 font-bold border-blue-500/20" 
            : "text-slate-500 dark:text-slate-400 hover:bg-white dark:hover:bg-slate-800/50 hover:shadow-sm",
          isDragOver && "border-blue-500 bg-blue-50 dark:bg-blue-900/30 ring-4 ring-blue-500/10"
        )}
        onClick={() => onSelect(node)}
        onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={() => setIsDragOver(false)}
        onDrop={handleDrop}
      >
        <button 
          className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors"
          onClick={(e) => { e.stopPropagation(); onToggle(node.path); }}
        >
          {hasChildren ? (
            expanded ? <ChevronDown size={14} strokeWidth={3} /> : <ChevronRight size={14} strokeWidth={3} />
          ) : (
            <Icon size={14} className={cn(active ? "text-blue-500" : "text-slate-400")} />
          )}
        </button>

        {isEditing ? (
          <div className="flex-1 flex items-center gap-1.5" onClick={e => e.stopPropagation()}>
            <input 
              ref={inputRef}
              value={editName}
              onChange={e => setEditName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') setIsEditing(false); }}
              className="flex-1 bg-white dark:bg-slate-900 border border-blue-500/30 rounded-lg px-2 py-0.5 text-xs font-bold outline-none ring-2 ring-blue-500/10"
            />
          </div>
        ) : (
          <>
            <span className="text-[13px] truncate flex-1 tracking-tight font-medium">
              {node.displayName || node.name}
            </span>
            
            <div className="flex items-center gap-1 opacity-0 group-hover/proj:opacity-100 transition-all duration-300">
              <button 
                onClick={(e) => { e.stopPropagation(); setEditName(node.name); setIsEditing(true); }}
                className="p-1 text-slate-300 hover:text-blue-500 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-md transition-colors"
              >
                <Edit2 size={11}/>
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete(node.path); }}
                className="p-1 text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/30 rounded-md transition-colors"
              >
                <Trash2 size={11}/>
              </button>
            </div>

            {node.incompleteCount > 0 && (
              <span className={cn(
                "text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center",
                active ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
              )}>
                {node.incompleteCount}
              </span>
            )}
          </>
        )}
      </div>

      {expanded && hasChildren && (
        <div className="ml-5 border-l border-slate-200/50 dark:border-slate-800/50 pl-2 mt-1 space-y-0.5">
          {node.children.map(child => (
            <ProjectItem 
              key={child.path}
              node={child}
              expanded={expanded}
              active={active && child.path === node.path} // simplified for now
              icon={Hash}
              onToggle={onToggle}
              onSelect={onSelect}
              onRename={onRename}
              onDelete={onDelete}
              onDropTask={onDropTask}
            />
          ))}
        </div>
      )}
    </div>
  );
};

export default ProjectItem;
