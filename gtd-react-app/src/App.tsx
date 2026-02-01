import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { 
  CheckCircle2, Plus, Menu, ListTodo, ChevronLeft, Clock, Trash2, X, Calendar as CalendarIcon,
  Search, Sun, Moon, BarChart2, Layers, Settings, Languages, Pause, Play, Square, Inbox, Zap, Coffee, Hourglass, Hash,
  ChevronDown, Info, FolderOpen, Save, Pin
} from 'lucide-react';
import { format as formatDt, addDays } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useGtd } from './context/GtdContext';
import { useGtdParser } from './hooks/useGtdParser';
import { getFileHandle, saveFileHandle, removeFileHandle } from './utils/fileStorage';
import TaskCard from './components/TaskCard';
import ProjectItem from './components/ProjectItem';
import Inspector from './components/Inspector';
import { Task, ProjectNode } from './types/gtd';

const cn = (...inputs: any[]) => twMerge(clsx(inputs));

const App: React.FC = () => {
  const { 
    lang, setLang, isDarkMode, setIsDarkMode, sidebarOpen, setSidebarOpen,
    activeView, setActiveView, selectedFilter, setSelectedFilter,
    toasts, addToast, pomoState, setPomoState, syncStatus, t
  } = useGtd();

  const [markdown, setMarkdown] = useState(localStorage.getItem('gtd-markdown') || '# 📥 收件箱\n- [ ] 🚀 开启 TypeScript & Modern UI 之旅');
  const [newTaskInput, setNewTaskInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({'📥 收件箱': true});
  const [hasCurrentFile, setHasCurrentFile] = useState(false);
  const [isDefaultFile, setIsDefaultFile] = useState(false);

  const mainInputRef = useRef<HTMLInputElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pomoTimer = useRef<NodeJS.Timeout | null>(null);
  const currentFileHandle = useRef<any>(null);

  const { projects, allTasks } = useGtdParser(markdown, t);

  const selectedTask = useMemo(() => allTasks.find(t => t.id === selectedTaskId), [allTasks, selectedTaskId]);

  useEffect(() => {
    const onDocClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsLanguageDropdownOpen(false);
      }
    };
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadDefault = async () => {
      try {
        const defaultHandle = await getFileHandle();
        if (!defaultHandle || cancelled) return;
        const file = await defaultHandle.getFile();
        if (cancelled) return;
        const text = await file.text();
        if (cancelled) return;
        setMarkdown(text);
        localStorage.setItem('gtd-markdown', text);
        currentFileHandle.current = defaultHandle;
        setHasCurrentFile(true);
        setIsDefaultFile(true);
      } catch {
        // Permission denied or no default file
      }
    };
    loadDefault();
    return () => { cancelled = true; };
  }, []);

  const loadFileContent = useCallback(async (handle: FileSystemFileHandle) => {
    const file = await handle.getFile();
    const text = await file.text();
    setMarkdown(text);
    localStorage.setItem('gtd-markdown', text);
    currentFileHandle.current = handle;
    setHasCurrentFile(true);
    const defaultHandle = await getFileHandle();
    setIsDefaultFile(!!defaultHandle && (await handle.isSameEntry(defaultHandle)));
  }, []);

  const handleOpenFile = useCallback(async () => {
    try {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }], multiple: false });
      await loadFileContent(handle);
      addToast(lang === 'zh' ? '文件已打开' : 'File opened', 'success');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') console.error(err);
    }
  }, [loadFileContent, addToast, lang]);

  const handleSaveAs = useCallback(async () => {
    try {
      const handle = await window.showSaveFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }] });
      const writable = await handle.createWritable();
      await writable.write(markdown);
      await writable.close();
      await loadFileContent(handle);
      addToast(lang === 'zh' ? '另存为成功' : 'Saved as', 'success');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') console.error(err);
    }
  }, [markdown, loadFileContent, addToast, lang]);

  const toggleDefaultFile = useCallback(async () => {
    if (!currentFileHandle.current) return;
    if (isDefaultFile) {
      await removeFileHandle();
      setIsDefaultFile(false);
      addToast(lang === 'zh' ? '已取消默认文件' : 'Unset default file', 'info');
    } else {
      await saveFileHandle(currentFileHandle.current);
      setIsDefaultFile(true);
      addToast(lang === 'zh' ? '已设为默认文件' : 'Set as default file', 'success');
    }
  }, [isDefaultFile, addToast, lang]);

  // --- File Actions ---
  const saveToFile = useCallback(async (content: string) => {
    if (!currentFileHandle.current) return;
    try {
      const writable = await currentFileHandle.current.createWritable();
      await writable.write(content);
      await writable.close();
    } catch (err) {
      console.error('File save error:', err);
    }
  }, []);

  const saveToDisk = useCallback((content: string) => {
    setMarkdown(content);
    localStorage.setItem('gtd-markdown', content);
    if (currentFileHandle.current) {
      saveToFile(content);
    }
  }, [saveToFile]);

  const handleSaveFile = useCallback(async () => {
    if (currentFileHandle.current) {
      await saveToFile(markdown);
      addToast(lang === 'zh' ? '保存成功' : 'Saved', 'success');
    } else {
      await handleSaveAs();
    }
  }, [markdown, saveToFile, handleSaveAs, addToast, lang]);

  const handleUpdateTask = useCallback((lineIndex: number, updates: Partial<Task>) => {
    const lines = markdown.split('\n');
    const task = allTasks.find(t => t.lineIndex === lineIndex);
    if (!task) return;

    const newContent = updates.content ?? task.content;
    const newCompleted = updates.completed ?? task.completed;
    const newDate = updates.date ?? task.date;
    const newPriority = updates.priority ?? task.priority;
    const newTags = updates.tags ?? task.tags;
    const newRecurrence = updates.recurrence ?? task.recurrence;

    let newLine = `- [${newCompleted ? 'x' : ' '}] ${newContent}`;
    if (newPriority) newLine += ` !${newPriority}`;
    if (newDate) newLine += ` @${newDate}`;
    if (newRecurrence) newLine += ` @every(${newRecurrence})`;
    if (newTags?.length) newLine += ` ${newTags.map(tg => '#' + tg).join(' ')}`;
    
    lines[lineIndex] = newLine;
    saveToDisk(lines.join('\n'));
  }, [markdown, allTasks, saveToDisk]);

  const handleToggle = (idx: number, status: boolean) => {
    const lines = markdown.split('\n');
    const line = lines[idx];
    if (!line) return;

    if (status) {
      // Unchecking: Just switch [x] to [ ], keep everything else
      lines[idx] = line.replace(/(\s*-\s*)\[x\]/, '$1[ ]');
    } else {
      // Checking: Just switch [ ] to [x], keep everything else
      lines[idx] = line.replace(/(\s*-\s*)\[ \]/, '$1[x]');
    }
    saveToDisk(lines.join('\n'));
  };

  const handleToggleSubtask = (subIdx: number, status: boolean) => {
    // We use the same logic for subtasks as parent tasks now
    handleToggle(subIdx, status);
  };

  const addTask = () => {
    if (!newTaskInput.trim()) return;
    const lines = markdown.split('\n');
    const content = `- [ ] ${newTaskInput.trim()}`;
    let insertIdx = lines.findIndex(l => l.includes('收件箱') || l.toLowerCase().includes('inbox')) + 1;
    if (insertIdx <= 0) insertIdx = lines.findIndex(l => l.startsWith('#')) + 1;
    if (insertIdx <= 0) { lines.push(`# 📥 ${t.inbox}`, content); } else { lines.splice(insertIdx, 0, content); }
    saveToDisk(lines.join('\n'));
    setNewTaskInput('');
  };

  const handleDeleteTask = (idx: number) => {
    const lines = markdown.split('\n');
    lines.splice(idx, 1);
    saveToDisk(lines.join('\n'));
    addToast(t.deleteSelected, 'info');
  };

  const onDragStart = (e: React.DragEvent, task: Task) => {
    e.dataTransfer.setData('task', JSON.stringify(task));
    e.dataTransfer.effectAllowed = 'move';
  };

  const onTaskDrop = (e: React.DragEvent, targetLineIdx: number) => {
    e.preventDefault();
    try {
      const taskData = JSON.parse(e.dataTransfer.getData('task'));
      const sourceIdx = parseInt(taskData.lineIndex);
      const targetIdx = parseInt(targetLineIdx.toString());
      if (isNaN(sourceIdx) || isNaN(targetIdx) || sourceIdx === targetIdx) return;

      const lines = markdown.split('\n');
      let taskLines = lines.splice(sourceIdx, taskData.lineCount || 1);
      
      // Promotion logic: if it was a subtask, strip leading whitespace to make it a parent task
      if (taskData.isSubtask) {
        taskLines = taskLines.map(line => line.replace(/^[\s\t]+-/, '-'));
      }

      let finalTargetIdx = targetIdx;
      if (sourceIdx < targetIdx) {
        finalTargetIdx = targetIdx - (taskData.lineCount || 1);
      }

      lines.splice(finalTargetIdx, 0, ...taskLines);
      saveToDisk(lines.join('\n'));
      addToast(taskData.isSubtask ? 'Task Promoted' : 'Task Moved', 'success');
    } catch (err) { console.error('Drop error:', err); }
  };

  const handleMoveTaskToProject = (idx: number, targetPath: string) => {
    const lines = markdown.split('\n');
    const task = allTasks.find(t => t.lineIndex === idx) || { lineCount: 1 };
    
    let taskLines = lines.splice(idx, task.lineCount || 1);
    // If a subtask is moved to a project, promote it
    taskLines = taskLines.map(line => line.replace(/^[\s\t]+-/, '-'));

    const targetName = targetPath.split(' / ').pop()?.trim();
    const targetLevel = targetPath.split(' / ').length;
    
    let projectIdx = lines.findIndex(l => 
      l.startsWith('#') && 
      l.replace(/^#+\s*/, '').trim() === targetName && 
      (l.match(/^#+/) || ['#'])[0].length === targetLevel
    );

    if (projectIdx !== -1) {
      lines.splice(projectIdx + 1, 0, ...taskLines);
      saveToDisk(lines.join('\n'));
      addToast(`Moved to ${targetName}`, 'success');
    }
  };

  const handleMakeSubtask = (sourceIdx: number, targetIdx: number) => {
    const lines = markdown.split('\n');
    const sourceTask = allTasks.find(t => t.lineIndex === sourceIdx);
    if (!sourceTask) return;

    // 1. Cut the source task (and its own subtasks if any) out
    const taskCount = sourceTask.lineCount || 1;
    let taskLines = lines.splice(sourceIdx, taskCount);
    
    // 2. Indent all cut lines and strip dates
    taskLines = taskLines.map(line => {
      const indented = line.startsWith('  ') ? line : `  ${line}`;
      return indented.replace(/\s*@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '');
    });

    // 3. Calculate adjusted target index
    let adjustedTargetIdx = targetIdx;
    if (sourceIdx < targetIdx) {
      adjustedTargetIdx = targetIdx - taskCount;
    }

    // 4. Find the EXACT line of the target task to insert after it
    // We insert right after the target task's first line
    lines.splice(adjustedTargetIdx + 1, 0, ...taskLines);
    
    saveToDisk(lines.join('\n'));
    addToast(lang === 'zh' ? '已转为子任务' : 'Converted to subtask', 'success');
  };

  const handleAddProject = () => {
    const lines = markdown.split('\n');
    const uniqueName = `新建项目-${Date.now().toString().slice(-4)}`;
    lines.push('', `# ${uniqueName}`);
    saveToDisk(lines.join('\n'));
    addToast(lang === 'zh' ? '新建项目成功' : 'Project added', 'success');
  };

  const handleDeleteProject = useCallback((path: string) => {
    const lines = markdown.split('\n');
    const stack: { level: number; name: string }[] = [];
    let targetLevel = 0;
    let targetLineIdx = -1;

    for (let i = 0; i < lines.length; i++) {
      const trimmed = lines[i].trim();
      if (!trimmed) continue;
      if (trimmed.startsWith('#')) {
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        const name = trimmed.replace(/^#+\s*/, '').trim();
        while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
        stack.push({ level, name });
        const currentPath = stack.map(s => s.name).join(' / ');
        if (currentPath === path) {
          targetLevel = level;
          targetLineIdx = i;
          break;
        }
      }
    }

    if (targetLineIdx === -1) return;

    let endIdx = targetLineIdx + 1;
    while (endIdx < lines.length) {
      const trimmed = lines[endIdx].trim();
      if (trimmed.startsWith('#')) {
        const level = (trimmed.match(/^#+/) || ['#'])[0].length;
        if (level <= targetLevel) break;
      }
      endIdx++;
    }

    const newLines = [...lines.slice(0, targetLineIdx), ...lines.slice(endIdx)];
    saveToDisk(newLines.join('\n'));
    if (selectedFilter.type === 'project' && selectedFilter.value === path) {
      setSelectedFilter({ type: 'all', value: 'ALL' });
    }
    addToast(lang === 'zh' ? '项目已删除' : 'Project deleted', 'info');
  }, [markdown, saveToDisk, addToast, lang, selectedFilter, setSelectedFilter]);

  // --- UI Helpers ---
  const getGTDIcon = (name: string) => {
    if (name.includes('收件箱') || name.toLowerCase().includes('inbox')) return Inbox;
    if (name.includes('下一步') || name.toLowerCase().includes('next')) return Zap;
    if (name.includes('等待') || name.toLowerCase().includes('waiting')) return Hourglass;
    if (name.includes('将来') || name.toLowerCase().includes('someday')) return Coffee;
    return Hash;
  };

  const filteredTasks = useMemo(() => {
    const now = new Date();
    const todayStr = formatDt(now, 'yyyy-MM-dd');
    const tomorrowStr = formatDt(addDays(now, 1), 'yyyy-MM-dd');
    const next7DaysStr = formatDt(addDays(now, 7), 'yyyy-MM-dd');

    return allTasks.filter(t => {
      if (searchQuery && !t.content.toLowerCase().includes(searchQuery.toLowerCase())) return false;
      
      if (selectedFilter.type === 'project') {
        if (!t.projectPath.startsWith(selectedFilter.value)) return false;
      } else if (selectedFilter.type === 'tag') {
        if (!t.tags.includes(selectedFilter.value)) return false;
      } else if (selectedFilter.type === 'time') {
        if (!t.date) return false;
        const taskDateOnly = t.date.split(' ')[0];
        if (selectedFilter.value === 'today') {
          return taskDateOnly === todayStr;
        } else if (selectedFilter.value === 'tomorrow') {
          return taskDateOnly === tomorrowStr;
        } else if (selectedFilter.value === 'next7Days') {
          return taskDateOnly >= todayStr && taskDateOnly <= next7DaysStr;
        }
      }
      
      return true;
    });
  }, [allTasks, searchQuery, selectedFilter]);

  return (
    <div className="flex flex-row w-screen h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Dynamic Background Blur - Glassmorphism */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 dark:bg-blue-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 dark:bg-indigo-600/5 blur-[120px] rounded-full"></div>
      </div>

      {/* Sidebar - Bento Style (Column 1) */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0 }}
        className="relative bg-white/70 dark:bg-slate-900/70 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col overflow-hidden z-20 shrink-0"
      >
        <div className="p-8 flex items-center justify-between shrink-0">
          <div ref={dropdownRef} className="relative">
            <div
              className="flex items-center gap-3.5 group cursor-pointer p-2 -m-2 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all"
              onClick={(e) => { e.stopPropagation(); setIsLanguageDropdownOpen(!isLanguageDropdownOpen); }}
            >
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <CheckCircle2 size={22} className="text-white" strokeWidth={3} />
              </div>
              <span className="font-black text-xl tracking-tight bg-gradient-to-br from-slate-900 to-slate-500 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">GTD Flow</span>
              <ChevronDown size={16} className="text-slate-400" />
            </div>
            {isLanguageDropdownOpen && (
              <div className="absolute left-0 mt-2 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
                <button
                  onClick={() => { setLang(lang === 'zh' ? 'en' : 'zh'); setIsLanguageDropdownOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  <Languages size={18} className="text-slate-400" />
                  {lang === 'zh' ? 'English' : '中文'}
                </button>
                <button
                  onClick={() => { setIsDarkMode(!isDarkMode); setIsLanguageDropdownOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  {isDarkMode ? <Sun size={18} className="text-slate-400" /> : <Moon size={18} className="text-slate-400" />}
                  {isDarkMode ? t.lightMode : t.darkMode}
                </button>
                <button
                  onClick={() => { setIsSettingsOpen(true); setIsLanguageDropdownOpen(false); }}
                  className="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3"
                >
                  <Settings size={18} className="text-slate-400" />
                  {t.settings}
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5 space-y-8 custom-scrollbar">
          <div className="space-y-4">
            <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Quick Search</div>
            <div className="px-3">
              <div className="relative group">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-blue-500 transition-colors" size={14}/>
                <input 
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2.5 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 rounded-xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/5 transition-all dark:text-slate-200" 
                  placeholder={t.searchPlaceholder} 
                />
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Navigation</div>
            
            {/* 🧪 VERIFICATION ROW */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
              <button 
                onClick={() => setSelectedFilter({type: 'all', value: 'ALL'})}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                  selectedFilter.type === 'all' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                ALL
              </button>
              <button 
                onClick={() => setSelectedFilter({type: 'time', value: 'today'})}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                  (selectedFilter.type === 'time' && selectedFilter.value === 'today') ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                TODAY
              </button>
              <button 
                onClick={() => setSelectedFilter({type: 'time', value: 'next7Days'})}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                  (selectedFilter.type === 'time' && selectedFilter.value === 'next7Days') ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                7 DAYS
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center justify-between">
              <span>{t.workflows}</span>
              <Plus size={14} className="text-blue-500 cursor-pointer hover:rotate-90 transition-transform" />
            </div>
            {projects.map(p => (
              <ProjectItem 
                key={p.path}
                node={p}
                expanded={expandedGroups[p.path]}
                active={selectedFilter.value === p.path}
                icon={getGTDIcon(p.name)}
                onToggle={(path) => setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }))}
                onSelect={(n) => setSelectedFilter({type: 'project', value: n.path})}
                onRename={() => {}}
                onDelete={handleDeleteProject}
                onDropTask={handleMoveTaskToProject}
              />
            ))}
          </div>
        </div>
      </motion.aside>

      {/* Main Content - Bento Canvas */}
      <main className="flex-1 flex flex-col relative min-w-0 z-10">
        <header className="h-20 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-2.5 hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all">
              {sidebarOpen ? <ChevronLeft size={18}/> : <Menu size={18}/>}
            </button>
            <div className="flex flex-col">
              <h2 className="font-black text-xl tracking-tight text-slate-800 dark:text-slate-100 leading-none mb-1">{t.allTasks}</h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{filteredTasks.length} {t.activeProjects}</span>
            </div>
          </div>

          <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none">
            <div className="px-4 flex items-center gap-3">
               <div className={cn("w-2 h-2 rounded-full", pomoState.isActive ? "bg-rose-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600")}></div>
               <span className="text-sm font-black font-mono tracking-tighter">25:00</span>
            </div>
            <button className="w-9 h-9 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg shadow-blue-500/30">
               <Play size={16} fill="currentColor" />
            </button>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-10 custom-scrollbar">
          <div className="max-w-4xl mx-auto w-full">
            <div className="relative group mb-8">
              <div className="absolute inset-0 bg-blue-500/5 blur-2xl group-focus-within:bg-blue-500/10 transition-all rounded-3xl"></div>
              <Plus className="absolute left-5 top-1/2 -translate-y-1/2 text-blue-500/50 group-focus-within:text-blue-500 transition-colors" size={20} strokeWidth={3} />
              <input 
                ref={mainInputRef}
                value={newTaskInput}
                onChange={(e) => setNewTaskInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addTask()}
                className="relative w-full pl-14 pr-6 py-5 bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-200/50 dark:border-slate-700/50 rounded-3xl outline-none shadow-[0_10px_40px_rgba(0,0,0,0.02)] focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-slate-700 dark:text-slate-100 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                placeholder={t.quickAddPlaceholder}
              />
            </div>

            <div className="space-y-2">
              <AnimatePresence mode="popLayout">
                {filteredTasks.map(task => (
                                      <motion.div
                                        key={task.id}
                                        layout
                                        initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                        animate={{ opacity: 1, scale: 1, y: 0 }}
                                        exit={{ opacity: 0, scale: 0.9, x: -20 }}
                                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                                        onDragOver={(e) => e.preventDefault()}
                                        onDrop={(e) => onTaskDrop(e, task.lineIndex)}
                                      >
                                        <TaskCard 
                                          task={task}
                                          isActive={selectedTaskId === task.id}
                                          isBatchMode={isBatchMode}
                                          selected={selectedTaskIds.has(task.id)}
                                          onToggle={handleToggle}
                                          onDelete={handleDeleteTask}
                                          onSelect={(id) => {}}
                                          onOpenDetail={(t) => setSelectedTaskId(t.id)}
                                          onDragStart={onDragStart}
                                          onMakeSubtask={handleMakeSubtask}
                                        />
                                      </motion.div>
                  
                ))}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </main>

      {/* Inspector - Slide Panel */}
      <AnimatePresence>
        {selectedTask && (
          <Inspector 
            task={selectedTask}
            onClose={() => setSelectedTaskId(null)}
            onUpdate={handleUpdateTask}
            onToggleSubtask={handleToggleSubtask}
            translations={t}
          />
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/60 dark:bg-slate-950/70 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
                <h3 className="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
                  <Settings size={20} className="text-blue-600" />
                  {t.settings}
                </h3>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-all">
                  <X size={20} />
                </button>
              </div>
              <div className="p-8 space-y-8">
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.fileManagement}</h4>
                  <div className="grid grid-cols-1 gap-3">
                    <button onClick={handleOpenFile} className="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all border border-slate-100 dark:border-slate-700 group">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                        <FolderOpen size={20} />
                      </div>
                      <span className="font-bold text-sm">{t.openFile}</span>
                    </button>
                    <button onClick={handleSaveFile} className="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all border border-slate-100 dark:border-slate-700 group">
                      <div className="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
                        <Save size={20} />
                      </div>
                      <span className="font-bold text-sm">{hasCurrentFile ? t.saveFile : t.saveAs}</span>
                    </button>
                    {hasCurrentFile && (
                      <button onClick={toggleDefaultFile} className="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all border border-slate-100 dark:border-slate-700 group">
                        <div className={cn("p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm transition-colors", isDefaultFile && "text-amber-500")}>
                          <Pin size={20} className={isDefaultFile ? "fill-current" : ""} />
                        </div>
                        <span className="font-bold text-sm">{isDefaultFile ? t.unsetDefault : t.setDefault}</span>
                      </button>
                    )}
                  </div>
                </section>
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.language}</h4>
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl">
                    <button onClick={() => setLang('zh')} className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-all", lang === 'zh' ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500")}>中文</button>
                    <button onClick={() => setLang('en')} className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-all", lang === 'en' ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500")}>English</button>
                  </div>
                </section>
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.darkMode}</h4>
                  <div className="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl">
                    <button onClick={() => setIsDarkMode(false)} className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2", !isDarkMode ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500")}>
                      <Sun size={18} /> {t.lightMode}
                    </button>
                    <button onClick={() => setIsDarkMode(true)} className={cn("flex-1 py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2", isDarkMode ? "bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400" : "text-slate-500")}>
                      <Moon size={18} /> {t.darkMode}
                    </button>
                  </div>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Toasts */}
      <div className="fixed bottom-10 right-10 z-[200] flex flex-col gap-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map(toast => (
            <motion.div 
              key={toast.id}
              initial={{ opacity: 0, x: 50, scale: 0.8 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="px-6 py-4 bg-slate-900/90 dark:bg-white/90 backdrop-blur-xl text-white dark:text-slate-900 rounded-2xl shadow-2xl flex items-center gap-4 border border-white/10 dark:border-slate-200/10 pointer-events-auto"
            >
              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-500">
                <Info size={18} strokeWidth={3}/>
              </div>
              <span className="text-[13px] font-black tracking-tight">{toast.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default App;
