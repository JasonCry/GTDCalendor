import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  CheckCircle2, 
  Circle, 
  Layout, 
  FileText, 
  Plus, 
  Trash2, 
  Menu, 
  Inbox,
  Hash,
  RotateCcw,
  GripVertical,
  X,
  ChevronDown,
  ChevronRight,
  CalendarDays,
  Sun,
  Clock,
  Calendar as CalendarIcon,
  ChevronLeft,
  Columns,
  Info,
  Zap,
  Coffee,
  Hourglass,
  ListTodo,
  Save
} from 'lucide-react';

// --- Helper Functions ---
const formatDate = (date) => date.toISOString().split('T')[0];
const getToday = () => formatDate(new Date());

const getStartOfWeek = (date) => {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day; 
  return new Date(d.setDate(diff));
};

const isDateInRange = (dateStr, rangeStr) => {
  if (!rangeStr) return false;
  const pureDate = rangeStr.split(' ')[0];
  if (!pureDate.includes('~')) return dateStr === pureDate;
  const [start, end] = pureDate.split('~');
  return dateStr >= start && dateStr <= end;
};

const parseTaskTime = (dateStr) => {
  if (!dateStr || !dateStr.includes(' ')) return null;
  const timePart = dateStr.split(' ')[1]; 
  if (!timePart) return null;
  const mainTime = timePart.split('~')[0];
  const [hours, minutes] = mainTime.split(':').map(Number);
  return { hours, minutes, totalMinutes: hours * 60 + (minutes || 0) };
};

const DEFAULT_MARKDOWN = `# 📥 收件箱
- [ ] 💡 记录下闪现的灵感：开发 GTD 插件 @${getToday()}
- [ ] 🛒 买牛奶和面包
- [ ] 📧 回复李总的合作邮件 @${getToday()} 10:30

# ⚡ 下一步行动
## 核心研发
- [ ] 🛠️ 修复看板拖拽 Bug @${getToday()} 14:00
- [ ] 📝 编写用户手册

# ⏳ 等待确认
- [ ] 📦 等待快递配送
- [ ] 👥 等待团队提交周报 @${getToday()} 18:00

# ☕ 将来/也许
- [ ] ✈️ 计划去冰岛旅行
- [ ] 🎸 学习吉他进阶课程
`;

export default function App() {
  const [markdown, setMarkdown] = useState(() => localStorage.getItem('gtd-markdown') || DEFAULT_MARKDOWN);
  const [activeView, setActiveView] = useState('view'); 
  const [calendarMode, setCalendarMode] = useState('day'); 
  const [selectedFilter, setSelectedFilter] = useState({ type: 'all', value: 'ALL' });
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [newTaskInput, setNewTaskInput] = useState('');
  const [expandedGroups, setExpandedGroups] = useState({'📥 收件箱': true, '⚡ 下一步行动': true});
  const [isSaving, setIsSaving] = useState(false);
  
  const [viewDate, setViewDate] = useState(new Date());
  const [quickAddDate, setQuickAddDate] = useState(null);
  
  const [selectionStart, setSelectionStart] = useState(null);
  const [selectionEnd, setSelectionEnd] = useState(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const scrollRef = useRef(null);

  // --- Data Parsing ---
  const { projects, allTasks } = useMemo(() => {
    const lines = markdown.split('\n');
    const root = { name: 'Root', children: [], tasks: [], level: 0, path: '' };
    const stack = [root];
    const all = [];

    lines.forEach((line, index) => {
      const trimmed = line.trim();
      if (trimmed.startsWith('#')) {
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const nodeName = trimmed.replace(/^#+\s*/, '');
        const node = { 
          name: nodeName, 
          children: [], tasks: [], level, path: '' 
        };
        while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
        const parent = stack[stack.length - 1];
        node.path = parent.path ? `${parent.path} / ${nodeName}` : nodeName;
        parent.children.push(node);
        stack.push(node);
      } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        const dateMatch = trimmed.match(/@(\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?)/);
        const task = {
          id: `task-${index}`,
          lineIndex: index,
          content: trimmed.replace(/^- \[[ x]\]\s*/, '').replace(/@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '').trim(),
          completed: trimmed.startsWith('- [x]'),
          date: dateMatch ? dateMatch[1] : null,
          projectPath: stack[stack.length - 1].path
        };
        stack[stack.length - 1].tasks.push(task);
        all.push(task);
      }
    });
    return { projects: root.children, allTasks: all };
  }, [markdown]);

  useEffect(() => {
    setIsSaving(true);
    localStorage.setItem('gtd-markdown', markdown);
    const timer = setTimeout(() => setIsSaving(false), 500);
    return () => clearTimeout(timer);
  }, [markdown]);

  useEffect(() => {
    if (activeView === 'calendar' && (calendarMode === 'day' || calendarMode === 'week') && scrollRef.current) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const scrollPos = (currentMinutes / 1440) * scrollRef.current.scrollHeight - 200;
        scrollRef.current.scrollTop = Math.max(0, scrollPos);
    }
  }, [activeView, calendarMode]);

  const calendarDays = useMemo(() => {
    const days = [];
    if (calendarMode === 'month') {
      const year = viewDate.getFullYear();
      const month = viewDate.getMonth();
      const firstDay = new Date(year, month, 1).getDay();
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      for (let i = 0; i < firstDay; i++) days.push(null);
      for (let i = 1; i <= daysInMonth; i++) {
        const d = formatDate(new Date(year, month, i));
        days.push({ date: d, day: i, tasks: allTasks.filter(t => isDateInRange(d, t.date)) });
      }
    } else if (calendarMode === 'week') {
      const start = getStartOfWeek(viewDate);
      for (let i = 0; i < 7; i++) {
        const d = new Date(start);
        d.setDate(start.getDate() + i);
        const ds = formatDate(d);
        days.push({ date: ds, day: d.getDate(), tasks: allTasks.filter(t => isDateInRange(ds, t.date)) });
      }
    } else if (calendarMode === 'day') {
      const ds = formatDate(viewDate);
      days.push({ date: ds, day: viewDate.getDate(), tasks: allTasks.filter(t => isDateInRange(ds, t.date)) });
    }
    return days;
  }, [viewDate, calendarMode, allTasks]);

  const handleToggle = (idx, status) => {
    const lines = markdown.split('\n');
    lines[idx] = status ? lines[idx].replace('- [x]', '- [ ]') : lines[idx].replace('- [ ]', '- [x]');
    setMarkdown(lines.join('\n'));
  };

  const handleDeleteTask = (idx) => {
    const lines = markdown.split('\n');
    lines.splice(idx, 1);
    setMarkdown(lines.join('\n'));
  };

  const addTask = (dateInfo) => {
    if (!newTaskInput.trim()) return;
    const lines = markdown.split('\n');
    let content = `- [ ] ${newTaskInput.trim()}`;
    if (dateInfo) content += ` @${dateInfo}`;
    
    // 默认插入到当前选中的项目下，如果没有选中，则插入到收件箱
    let insertIdx = -1;
    if (selectedFilter.value !== 'ALL') {
        const projectName = selectedFilter.value.split(' / ').pop();
        insertIdx = lines.findIndex(l => l.startsWith('#') && l.includes(projectName)) + 1;
    } else {
        insertIdx = lines.findIndex(l => l.includes('收件箱')) + 1;
    }

    if (insertIdx <= 0) insertIdx = lines.findIndex(l => l.startsWith('#')) + 1;
    if (insertIdx <= 0) { lines.push('# 📥 收件箱', content); }
    else { lines.splice(insertIdx, 0, content); }
    
    setMarkdown(lines.join('\n'));
    setNewTaskInput('');
    setQuickAddDate(null);
  };

  const moveTask = (lineIndex, newDate, newTime) => {
    const lines = [...markdown.split('\n')];
    const targetLine = lines[lineIndex];
    if (!targetLine) return;

    const datePattern = /@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/;
    const newDateString = newTime ? `${newDate} ${newTime}` : newDate;
    
    let newLine;
    if (datePattern.test(targetLine)) {
      newLine = targetLine.replace(datePattern, `@${newDateString}`);
    } else {
      newLine = `${targetLine} @${newDateString}`;
    }
    
    lines[lineIndex] = newLine;
    setMarkdown(lines.join('\n'));
  };

  const formatMinutesToTime = (totalMinutes) => {
    const hours = Math.floor(totalMinutes / 60);
    const mins = totalMinutes % 60;
    return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
  };

  const handleTimeMouseDown = (date, minutes) => {
    setIsSelecting(true);
    setSelectionStart({ date, minutes });
    setSelectionEnd({ date, minutes });
  };

  const handleTimeMouseEnter = (date, minutes) => {
    if (isSelecting) {
      setSelectionEnd({ date, minutes });
    }
  };

  const handleGlobalMouseUp = () => {
    if (isSelecting && selectionStart && selectionEnd) {
      const startMin = Math.min(selectionStart.minutes, selectionEnd.minutes);
      const endMin = Math.max(selectionStart.minutes, selectionEnd.minutes) + 15;
      const timeStr = startMin === (endMin - 15) 
        ? formatMinutesToTime(startMin) 
        : `${formatMinutesToTime(startMin)}~${formatMinutesToTime(endMin)}`;
      setQuickAddDate(`${selectionStart.date} ${timeStr}`);
    }
    setIsSelecting(false);
    setSelectionStart(null);
    setSelectionEnd(null);
  };

  const navigateDate = (dir) => {
    const d = new Date(viewDate);
    if (calendarMode === 'month') d.setMonth(d.getMonth() + dir);
    else if (calendarMode === 'week') d.setDate(d.getDate() + dir * 7);
    else d.setDate(d.getDate() + dir);
    setViewDate(d);
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);
  const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => i * 15);

  const getGTDIcon = (name) => {
    if (name.includes('收件箱')) return <Inbox size={16} />;
    if (name.includes('下一步')) return <Zap size={16} />;
    if (name.includes('等待')) return <Hourglass size={16} />;
    if (name.includes('将来')) return <Coffee size={16} />;
    return <Hash size={16} />;
  };

  const getGTDTips = (name) => {
    if (name.includes('收件箱')) return "【收集】清空大脑！把所有任务先扔到这里。";
    if (name.includes('下一步')) return "【行动】明确的、可以立即开始的任务。";
    if (name.includes('等待')) return "【回顾】指派给他人或需等待条件的任务。";
    if (name.includes('将来')) return "【孵化】现在不急着做，留待将来 review 的事。";
    return "项目分类：将相关联的任务组织在一起。";
  };

  return (
    <div className="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans select-none" onMouseUp={handleGlobalMouseUp}>
      {/* Sidebar */}
      <div className={`${sidebarOpen ? 'w-80' : 'w-0'} bg-white border-r border-slate-200 transition-all duration-300 flex flex-col overflow-hidden z-20`}>
        <div className="p-6 flex items-center justify-between">
           <div className="flex items-center gap-3 font-black text-xl text-blue-600">
             <CheckCircle2 className="w-8 h-8" /> <span>GTD Flow</span>
           </div>
           <div className={`px-2 py-1 rounded text-[10px] font-bold border ${isSaving ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100'}`}>
              {isSaving ? 'SAVING...' : 'V1.1.0'}
           </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-4 space-y-6 pb-10">
          <nav className="space-y-1">
            <SectionTitle label="主视图切换" />
            <SidebarItem icon={<ListTodo size={18}/>} label="清单模式" active={activeView === 'view' && selectedFilter.value === 'ALL'} onClick={() => { setSelectedFilter({type: 'all', value: 'ALL'}); setActiveView('view'); }} />
            <SidebarItem icon={<CalendarIcon size={18}/>} label="日历日程" active={activeView === 'calendar'} onClick={() => setActiveView('calendar')} />
          </nav>
          
          <nav className="space-y-1">
            <SectionTitle label="GTD 工作流 / 项目" />
            {projects.map(p => (
              <ProjectItem 
                key={p.path} 
                node={p} 
                expanded={expandedGroups[p.path]}
                icon={getGTDIcon(p.name)}
                tip={getGTDTips(p.name)}
                active={selectedFilter.value === p.path && activeView === 'view'}
                onToggle={() => setExpandedGroups({...expandedGroups, [p.path]: !expandedGroups[p.path]})}
                onSelect={() => { setSelectedFilter({type: 'project', value: p.path}); setActiveView('view'); }}
              />
            ))}
          </nav>

          <div className="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
             <div className="flex items-center gap-2 text-slate-400 mb-2">
                <Info size={14}/>
                <span className="text-[10px] font-bold uppercase tracking-wider">GTD 核心理念</span>
             </div>
             <p className="text-[11px] text-slate-500 leading-relaxed italic">
                捕捉、理清、组织、回顾、执行。
             </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0 bg-slate-50">
        <header className="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><Menu size={20}/></button>
            <h2 className="font-bold text-lg text-slate-700 truncate max-w-[200px]">
              {activeView === 'calendar' 
                ? `${viewDate.getFullYear()}年 ${viewDate.getMonth() + 1}月` 
                : (selectedFilter.value === 'ALL' ? '所有任务清单' : `${selectedFilter.value.split(' / ').pop()} 清单`)}
            </h2>
          </div>
          
          <div className="flex items-center gap-4">
            {activeView === 'calendar' && (
              <div className="flex items-center bg-slate-100 p-1 rounded-xl">
                {['day', 'week', 'month'].map(m => (
                  <button 
                    key={m} onClick={() => setCalendarMode(m)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${calendarMode === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
                  >
                    {m === 'day' ? '日' : m === 'week' ? '周' : '月'}
                  </button>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <button 
                onClick={() => setActiveView(activeView === 'code' ? 'view' : 'code')} 
                className={`px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2 ${activeView === 'code' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'}`}
              >
                {activeView === 'code' ? <Layout size={14}/> : <FileText size={14}/>}
                {activeView === 'code' ? '返回视图' : '源码模式'}
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-hidden flex flex-col relative">
          {activeView === 'calendar' && (
            <div className="flex-1 flex flex-col p-6 overflow-hidden">
              <div className="flex justify-between items-center mb-6">
                <div className="flex gap-2">
                  <button onClick={() => navigateDate(-1)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"><ChevronLeft size={20}/></button>
                  <button onClick={() => setViewDate(new Date())} className="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">今天</button>
                  <button onClick={() => navigateDate(1)} className="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"><ChevronRight size={20}/></button>
                </div>
                <div className="text-blue-600 font-bold bg-blue-50 px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-sm border border-blue-100">
                    <CalendarDays size={16}/> {calendarMode === 'week' ? '本周日程' : formatDate(viewDate)}
                </div>
              </div>

              <div className="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
                <div className={`grid ${calendarMode === 'month' ? 'grid-cols-7' : 'grid-cols-[80px_1fr]'} border-b border-slate-100 bg-slate-50/50 shrink-0`}>
                    {calendarMode === 'month' ? (
                        ['周日', '周一', '周二', '周三', '周四', '周五', '周六'].map(d => (
                            <div key={d} className="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r last:border-0 border-slate-100">{d}</div>
                        ))
                    ) : (
                        <>
                            <div className="w-20 border-r border-slate-100" />
                            <div className={`grid ${calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} w-full`}>
                                {calendarDays.map((day, idx) => (
                                    <div key={idx} className="py-3 text-center border-r last:border-0 border-slate-100">
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                            {day ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(day.date).getDay()] : ''}
                                        </div>
                                        <div className={`text-sm font-black mt-1 ${day?.date === getToday() ? 'text-blue-600 underline underline-offset-4 decoration-2' : 'text-slate-700'}`}>
                                            {day ? day.day : ''}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
                
                <div 
                    ref={(calendarMode === 'day' || calendarMode === 'week') ? scrollRef : null}
                    className="flex-1 overflow-y-auto custom-scrollbar relative bg-[#fafafa]"
                >
                  <div className={`h-full ${calendarMode === 'month' ? 'grid grid-cols-7' : 'flex'}`}>
                    {(calendarMode === 'day' || calendarMode === 'week') ? (
                        <div className="relative min-h-[1440px] flex flex-1">
                            <div className="w-20 border-r border-slate-100 bg-slate-50/50 shrink-0 sticky left-0 z-30">
                                {hours.map(hour => (
                                    <div key={hour} className="h-[60px] relative border-b border-slate-50">
                                        <span className="absolute -top-2 right-3 text-[10px] font-bold text-slate-300">
                                            {String(hour).padStart(2, '0')}:00
                                        </span>
                                    </div>
                                ))}
                            </div>
                            
                            <div className={`grid ${calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'} flex-1 relative bg-white`}>
                                {calendarDays.map((day, dayIdx) => (
                                    <div 
                                        key={dayIdx} 
                                        className="relative border-r last:border-0 border-slate-100"
                                        onDragOver={e => e.preventDefault()}
                                        onDrop={e => {
                                            const taskData = JSON.parse(e.dataTransfer.getData('task'));
                                            const rect = e.currentTarget.getBoundingClientRect();
                                            const y = e.clientY - rect.top;
                                            const minutesTotal = Math.floor(y); 
                                            const snappedMinutes = Math.round(minutesTotal / 15) * 15;
                                            const timeStr = formatMinutesToTime(Math.min(snappedMinutes, 1425));
                                            if (day) moveTask(taskData.lineIndex, day.date, timeStr);
                                        }}
                                    >
                                        {timeSlots.map(mTotal => (
                                            <div 
                                                key={mTotal} 
                                                className={`h-[15px] w-full relative group/slot ${mTotal % 60 === 45 ? 'border-b border-slate-100/60' : ''}`}
                                                onMouseDown={() => day && handleTimeMouseDown(day.date, mTotal)}
                                                onMouseEnter={() => day && handleTimeMouseEnter(day.date, mTotal)}
                                            >
                                                <div className="absolute inset-x-0 top-0 h-[1px] bg-blue-500/0 group-hover/slot:bg-blue-500/20 pointer-events-none" />
                                                {isSelecting && selectionStart?.date === day.date && 
                                                 mTotal >= Math.min(selectionStart.minutes, selectionEnd.minutes) &&
                                                 mTotal <= Math.max(selectionStart.minutes, selectionEnd.minutes) && (
                                                   <div className="absolute inset-0 bg-blue-100/50 pointer-events-none border-x-2 border-blue-400" />
                                                )}
                                            </div>
                                        ))}

                                        {day?.tasks.map(t => {
                                            const time = parseTaskTime(t.date);
                                            if (!time) return null;
                                            return (
                                                <div 
                                                    key={t.id} draggable
                                                    onDragStart={e => e.dataTransfer.setData('task', JSON.stringify(t))}
                                                    className={`absolute left-1.5 right-1.5 px-2 py-1.5 rounded-xl border shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing z-10 overflow-hidden group/task
                                                        ${t.completed ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' : 'bg-white border-blue-200 text-slate-800 border-l-4 border-l-blue-500'}`}
                                                    style={{ top: `${time.totalMinutes}px`, height: '48px' }}
                                                >
                                                    <div className={`text-[10px] font-bold truncate leading-tight ${t.completed ? 'line-through' : ''}`}>{t.content}</div>
                                                    <div className="text-[8px] text-slate-400 mt-1 flex items-center justify-between">
                                                        <span className="flex items-center gap-1 font-mono"><Clock size={8}/> {formatMinutesToTime(time.totalMinutes)}</span>
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); handleDeleteTask(t.lineIndex); }}
                                                            className="opacity-0 group-hover/task:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
                                                        >
                                                            <Trash2 size={8}/>
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        calendarDays.map((day, idx) => (
                            <div key={idx} className={`min-h-[140px] p-2 border-r border-b border-slate-100 relative ${!day ? 'bg-slate-50/30' : 'hover:bg-slate-50/50 transition-colors'}`}>
                                {day && (
                                    <>
                                        <div className={`text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full mb-2 ${day.date === getToday() ? 'bg-blue-600 text-white' : 'text-slate-400'}`}>{day.day}</div>
                                        <div className="space-y-1">
                                            {day.tasks.map(t => (
                                                <div key={t.id} className="text-[9px] truncate px-1.5 py-1 bg-white border border-slate-100 rounded text-slate-600 shadow-xs">{t.content}</div>
                                            ))}
                                        </div>
                                    </>
                                )}
                            </div>
                        ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeView === 'view' && (
             <div className="flex-1 overflow-y-auto p-8 space-y-4 max-w-3xl mx-auto w-full">
                <div className="flex items-center gap-3 mb-8">
                   <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                      {selectedFilter.value === 'ALL' ? <ListTodo size={24}/> : getGTDIcon(selectedFilter.value)}
                   </div>
                   <div>
                      <h1 className="text-2xl font-black text-slate-800 tracking-tight">
                        {selectedFilter.value === 'ALL' ? '所有待办' : selectedFilter.value.split(' / ').pop()}
                      </h1>
                      <p className="text-xs text-slate-400 font-medium">共 {allTasks.filter(t => selectedFilter.value === 'ALL' || t.projectPath.startsWith(selectedFilter.value)).length} 个任务项</p>
                   </div>
                </div>

                <div className="relative group mb-8">
                   <Plus className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" size={20}/>
                   <input 
                      className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 placeholder:text-slate-300"
                      placeholder={selectedFilter.value === 'ALL' ? "捕捉灵感..." : `在 ${selectedFilter.value.split(' / ').pop()} 中添加任务...`}
                      value={newTaskInput}
                      onChange={e => setNewTaskInput(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && addTask()}
                   />
                </div>

                <div className="space-y-3">
                  {allTasks.filter(t => selectedFilter.value === 'ALL' || t.projectPath.startsWith(selectedFilter.value)).map(t => (
                      <TaskCard key={t.id} task={t} onToggle={handleToggle} onDelete={handleDeleteTask} />
                  ))}
                  {allTasks.filter(t => selectedFilter.value === 'ALL' || t.projectPath.startsWith(selectedFilter.value)).length === 0 && (
                    <div className="py-24 text-center">
                       <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                          <CheckCircle2 size={32}/>
                       </div>
                       <p className="text-slate-400 font-medium italic">"你的清单清空了，真是了不起的专注力。"</p>
                    </div>
                  )}
                </div>
             </div>
          )}

          {activeView === 'code' && (
            <div className="flex-1 flex flex-col">
                <div className="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center shrink-0">
                    <span className="text-[10px] font-mono text-slate-400 uppercase tracking-widest">gtd-storage.md</span>
                    <span className="text-[10px] text-slate-500 italic">在此直接编辑 Markdown 同步视图</span>
                </div>
                <textarea 
                    className="flex-1 p-10 font-mono text-xs bg-slate-900 text-slate-300 outline-none leading-relaxed resize-none custom-scrollbar"
                    value={markdown} onChange={e => setMarkdown(e.target.value)}
                    spellCheck={false}
                />
            </div>
          )}

          {quickAddDate && (
            <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4 animate-in fade-in duration-200">
              <div className="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl border border-slate-100 transform animate-in zoom-in-95 duration-200">
                <div className="flex justify-between items-center mb-6">
                  <h3 className="font-black text-slate-800 text-lg">规划时间段</h3>
                  <button onClick={() => setQuickAddDate(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X size={18}/></button>
                </div>
                <div className="mb-6 p-4 bg-blue-50 rounded-2xl flex items-center gap-3 text-blue-600 font-bold text-sm border border-blue-100 shadow-inner">
                   <Clock size={18}/> {quickAddDate}
                </div>
                <input 
                  autoFocus className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-4 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
                  placeholder="这个时段你要做什么？" value={newTaskInput} onChange={e => setNewTaskInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && addTask(quickAddDate)}
                />
                <button onClick={() => addTask(quickAddDate)} className="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95">确定加入日程</button>
              </div>
            </div>
          )}
        </main>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes strike {
          0% { width: 0; }
          100% { width: 100%; }
        }
        .task-completed { position: relative; }
      `}</style>
    </div>
  );
}

function TaskCard({ task, onToggle, onDelete }) {
  return (
    <div className={`flex items-center gap-4 p-5 bg-white border rounded-3xl transition-all shadow-sm group ${task.completed ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'}`}>
      <button 
        onClick={() => onToggle(task.lineIndex, task.completed)} 
        className={`transition-all ${task.completed ? 'text-emerald-500' : 'text-slate-200 hover:text-blue-500 hover:scale-110 active:scale-90'}`}
      >
        {task.completed ? <CheckCircle2 size={24}/> : <Circle size={24}/>}
      </button>
      <div className="flex-1 min-w-0">
        <h4 className={`font-bold text-sm truncate transition-all ${task.completed ? 'text-slate-300 line-through' : 'text-slate-800'}`}>
          {task.content}
        </h4>
        <div className="flex items-center gap-4 mt-1.5">
           {task.date && (
             <div className="text-[10px] text-blue-500 font-black bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-100">
                <Clock size={10}/> {task.date}
             </div>
           )}
           <div className="text-[10px] text-slate-400 font-bold tracking-tight uppercase"># {task.projectPath.split(' / ').pop()}</div>
        </div>
      </div>
      <button 
        onClick={() => onDelete(task.lineIndex)}
        className="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
        title="删除任务"
      >
         <Trash2 size={16}/>
      </button>
    </div>
  );
}

function SidebarItem({ icon, label, active, onClick }) {
  return (
    <div onClick={onClick} className={`flex items-center gap-3 px-4 py-3 cursor-pointer rounded-2xl font-black transition-all group ${active ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-1' : 'text-slate-500 hover:bg-slate-100 hover:translate-x-1'}`}>
      <span className={`${active ? 'text-white' : 'text-slate-300 group-hover:text-blue-500'}`}>{icon}</span>
      <span className="text-xs">{label}</span>
    </div>
  );
}

function ProjectItem({ node, expanded, onToggle, onSelect, icon, tip, active }) {
  const hasChildren = node.children.length > 0;
  return (
    <div className="group/proj relative">
      <div 
        className={`flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer transition-all ${active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'}`}
        onClick={onSelect}
        title={tip}
      >
        <button 
            className="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors" 
            onClick={(e) => { e.stopPropagation(); onToggle(); }}
        >
          {hasChildren ? (expanded ? <ChevronDown size={14} className="stroke-[3]"/> : <ChevronRight size={14} className="stroke-[3]"/>) : (icon || <Hash size={14} className="opacity-30"/>)}
        </button>
        <span className={`text-xs truncate flex-1 tracking-tight ${active ? 'font-black' : 'font-bold'}`}>{node.name}</span>
        {hasChildren && <span className="text-[9px] bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded-lg group-hover/proj:border-blue-200 group-hover/proj:text-blue-400 transition-all font-bold shadow-sm">{node.children.length}</span>}
      </div>
      {expanded && node.children.map(c => <div key={c.path} className="ml-5 border-l-2 border-slate-50 pl-1 mt-1"><ProjectItem node={c} onSelect={onSelect} tip={tip} active={active} /></div>)}
    </div>
  );
}

function SectionTitle({ label }) {
  return <div className="px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 mt-8 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100">{label}</div>;
}