import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Calendar, Clock, Tag, CheckCircle2, Circle, Repeat, 
  ChevronRight, AlignLeft, Flag, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { Task, Priority, Recurrence } from '../types/gtd';

const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

const TIMEZONE_OPTIONS = [
  { value: '', labelKey: 'timezoneFixedTime', group: 'fixedTime' },
  { value: 'UTC', label: 'UTC', group: 'fixedTz' },
  { value: 'Asia/Shanghai', label: 'Asia/Shanghai', group: 'fixedTz' },
  { value: 'Asia/Tokyo', label: 'Asia/Tokyo', group: 'fixedTz' },
  { value: 'America/New_York', label: 'America/New_York', group: 'fixedTz' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles', group: 'fixedTz' },
  { value: 'Europe/London', label: 'Europe/London', group: 'fixedTz' },
  { value: 'Europe/Paris', label: 'Europe/Paris', group: 'fixedTz' }
];

interface InspectorProps {
  task: Task;
  onUpdate: (lineIndex: number, updates: any) => void;
  onClose: () => void;
  onToggleSubtask: (subIdx: number, status: boolean) => void;
  translations: any;
}

const Inspector: React.FC<InspectorProps> = ({ 
  task, onUpdate, onClose, onToggleSubtask, translations: t 
}) => {
  const [formData, setFormData] = useState({
    content: '',
    priority: null as Priority,
    tags: '',
    date: '',
    recurrence: null as Recurrence,
    timezone: '' as string
  });

  useEffect(() => {
    if (task) {
      setFormData({
        content: task.content,
        priority: task.priority,
        tags: task.tags.join(' '),
        date: task.date || '',
        recurrence: task.recurrence,
        timezone: task.timezone || ''
      });
    }
  }, [task]);

  // Debounced auto-save
  useEffect(() => {
    const timer = setTimeout(() => {
      if (task) {
        const tagsArray = formData.tags.split(/\s+/).filter(tg => tg.length > 0);
        const hasChanged = 
          formData.content !== task.content ||
          formData.priority !== task.priority ||
          formData.date !== task.date ||
          formData.recurrence !== task.recurrence ||
          formData.timezone !== (task.timezone || '') ||
          tagsArray.join(' ') !== task.tags.join(' ');

        if (hasChanged) {
          onUpdate(task.lineIndex, {
            ...formData,
            tags: tagsArray,
            date: formData.date || null,
            timezone: formData.timezone || null
          });
        }
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [formData, task, onUpdate]);

  const datePart = useMemo(() => formData.date ? formData.date.split(' ')[0] : '', [formData.date]);
  const timePart = useMemo(() => {
    if (!formData.date) return '';
    const parts = formData.date.split(' ');
    return parts.length > 1 ? parts[1] : '';
  }, [formData.date]);

  const updateDatePart = (val: string) => {
    const time = timePart;
    const newDate = val ? (time ? `${val} ${time}` : val) : (time ? ` ${time}` : '');
    setFormData(prev => ({ ...prev, date: newDate }));
  };

  const updateTimePart = (val: string) => {
    const date = datePart;
    const newDate = val ? (date ? `${date} ${val}` : ` ${val}`) : date;
    setFormData(prev => ({ ...prev, date: newDate }));
  };

  return (
    <motion.div 
      initial={{ width: 0, opacity: 0 }}
      animate={{ width: 420, opacity: 1 }}
      exit={{ width: 0, opacity: 0 }}
      transition={{ type: 'spring', damping: 30, stiffness: 250 }}
      className="relative h-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-2xl border-l border-slate-200/50 dark:border-slate-800/50 shadow-[-20px_0_50px_rgba(0,0,0,0.05)] z-30 flex flex-col overflow-hidden shrink-0"
    >
      <header className="h-20 flex items-center justify-between px-8 shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
            <Zap size={16} strokeWidth={2.5}/>
          </div>
          <span className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em]">Properties</span>
        </div>
        <button 
          onClick={onClose} 
          className="w-10 h-10 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-full text-slate-400 transition-all active:scale-90"
        >
          <X size={22} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-8 space-y-10 pb-20 custom-scrollbar">
        {/* Title Section */}
        <section className="space-y-4">
          <textarea 
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            className="w-full bg-transparent text-2xl font-black text-slate-800 dark:text-white outline-none resize-none border-none p-0 focus:ring-0 leading-[1.1] placeholder:text-slate-200 dark:placeholder:text-slate-800"
            placeholder="What needs to be done?"
            rows={3}
          />
          <div className="flex items-center gap-2">
             <div className="px-2.5 py-1 bg-slate-100 dark:bg-slate-800 rounded-lg text-[10px] font-black text-slate-400 uppercase tracking-wider">
               {task.projectPath.split(' / ').pop()}
             </div>
          </div>
        </section>

        {/* Attribute Grid */}
        <section className="grid grid-cols-1 gap-6">
          <div className="space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
               <Flag size={12}/> Priority
             </div>
             <div className="flex gap-2">
                {[1, 2, 3].map((p) => (
                  <button 
                    key={p}
                    onClick={() => setFormData(prev => ({ ...prev, priority: (prev.priority === p ? null : p) as Priority }))}
                    className={cn(
                      "flex-1 py-3 rounded-2xl text-xs font-black transition-all border",
                      formData.priority === p 
                        ? (p === 1 ? "bg-rose-500 border-rose-500 text-white shadow-lg shadow-rose-500/20" : p === 2 ? "bg-orange-500 border-orange-500 text-white shadow-lg shadow-orange-500/20" : "bg-sky-500 border-sky-500 text-white shadow-lg shadow-sky-500/20")
                        : "bg-slate-50 dark:bg-slate-800/50 border-slate-100 dark:border-slate-800 text-slate-400 hover:border-slate-200"
                    )}
                  >
                    P{p}
                  </button>
                ))}
             </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
               <Calendar size={12}/> Schedule
             </div>
             <div className="grid grid-cols-2 gap-3">
                <div className="relative group">
                  <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14}/>
                  <input 
                    type="date" 
                    value={datePart}
                    onChange={(e) => updateDatePart(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all dark:text-slate-200" 
                  />
                </div>
                <div className="relative group">
                  <Clock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-blue-500 transition-colors" size={14}/>
                  <input 
                    type="time" 
                    value={timePart}
                    onChange={(e) => updateTimePart(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all dark:text-slate-200" 
                  />
                </div>
             </div>
          </div>

          <div className="space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
               <Repeat size={12}/> Recurrence
             </div>
             <select 
                value={formData.recurrence || ''}
                onChange={(e) => setFormData(prev => ({ ...prev, recurrence: (e.target.value || null) as Recurrence }))}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer dark:text-slate-200"
              >
                <option value="">No Repeat</option>
                <option value="day">Every Day</option>
                <option value="week">Every Week</option>
                <option value="month">Every Month</option>
              </select>
          </div>

          <div className="space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
               <Clock size={12}/> {t.timezone}
             </div>
             <select 
                value={formData.timezone}
                onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all appearance-none cursor-pointer dark:text-slate-200"
              >
                <option value="">{t.timezoneFixedTime}</option>
                <optgroup label={t.timezoneFixedTz}>
                  {TIMEZONE_OPTIONS.filter(o => o.group === 'fixedTz').map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </optgroup>
              </select>
          </div>

          <div className="space-y-3">
             <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
               <Tag size={12}/> Tags
             </div>
             <div className="relative group">
               <Tag className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" size={14}/>
               <input 
                 value={formData.tags}
                 onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                 className="w-full pl-12 pr-6 py-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-2xl text-[13px] font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all dark:text-slate-200" 
                 placeholder="Add tags separated by space..." 
               />
             </div>
          </div>
        </section>

        {/* Dynamic Content */}
        <section className="space-y-8 pb-10">
          {task.subtasks?.length > 0 && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <AlignLeft size={12}/> Checklist
              </div>
              <div className="bg-slate-50/50 dark:bg-slate-800/30 rounded-3xl border border-slate-100/50 dark:border-slate-800/50 overflow-hidden">
                {task.subtasks.map((sub, idx) => (
                  <div 
                    key={sub.lineIndex} 
                    onClick={() => onToggleSubtask(sub.lineIndex, sub.completed)}
                    className={cn(
                      "flex items-center gap-4 px-6 py-4 cursor-pointer transition-all hover:bg-white dark:hover:bg-slate-800/50",
                      idx !== task.subtasks.length - 1 && "border-b border-slate-100/50 dark:border-slate-800/50"
                    )}
                  >
                    <div className={cn("shrink-0 transition-all duration-300", sub.completed ? "text-emerald-500" : "text-slate-300 dark:text-slate-600")}>
                      {sub.completed ? <CheckCircle2 size={18} strokeWidth={2.5}/> : <Circle size={18} strokeWidth={2.5}/>}
                    </div>
                    <span className={cn("text-[13px] font-bold transition-all", sub.completed ? "text-slate-400 line-through" : "text-slate-700 dark:text-slate-200")}>
                      {sub.content}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {task.notes?.length > 0 && (
            <div className="space-y-4">
               <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                <AlignLeft size={12}/> Notes
              </div>
              <div className="p-6 bg-slate-50/50 dark:bg-slate-800/30 border border-slate-100/50 dark:border-slate-800/50 rounded-3xl space-y-4">
                {task.notes.map((note, nIdx) => (
                  <div key={nIdx} className="text-[13px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">
                    {note}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>
      
      <div className="p-8 bg-white/50 dark:bg-slate-900/50 backdrop-blur-md border-t border-slate-100 dark:border-slate-800">
        <button 
          onClick={onClose} 
          className="w-full py-5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-[20px] font-black text-[12px] uppercase tracking-[0.2em] shadow-2xl shadow-slate-900/20 dark:shadow-none hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Close Inspector
        </button>
      </div>
    </motion.div>
  );
};

export default Inspector;
