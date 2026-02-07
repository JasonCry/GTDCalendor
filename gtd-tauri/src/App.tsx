import React, { useState, useEffect, useCallback, useRef, useMemo, useTransition } from 'react';
import { 
  CheckCircle2, Plus, Menu, ListTodo, ChevronLeft, Clock, Trash2, X, Calendar as CalendarIcon,
  Search, Sun, Moon, BarChart2, Layers, Settings, Languages, Pause, Play, Square, Inbox, Zap, Coffee, Hourglass, Hash,
  ChevronDown, ChevronRight, Info, FolderOpen, Save, Pin, Folder, Edit2
} from 'lucide-react';
import { format as formatDt, addDays, subDays } from 'date-fns';
import { AnimatePresence, motion } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

import { useGtd } from './context/GtdContext';
import { useGtdParser } from './hooks/useGtdParser';
import { getFileHandle, saveFileHandle, removeFileHandle } from './utils/fileStorage';
import { fetchMarkdown, pushMarkdown } from './utils/syncApi';
import {
  isTauri,
  tauriReadMarkdown,
  tauriWriteMarkdown,
  tauriGetDefaultStorePath,
  tauriSetDefaultStorePath,
  tauriOpenFileDialog,
  tauriSaveFileDialog,
  tauriReadFileAtPath,
  tauriWriteFileAtPath,
} from './utils/tauriStorage';
import TaskCard from './components/TaskCard';
import ProjectItem from './components/ProjectItem';
import Inspector from './components/Inspector';
import { Task, ProjectNode, ProjectGroup } from './types/gtd';

const cn = (...inputs: any[]) => twMerge(clsx(inputs));

/** 默认 GTD 工作流模板：收件箱、下一步行动、等待确认、将来/也许 */
const DEFAULT_GTD_TEMPLATE = `# 📥 收件箱
- [ ] 示例任务（可删除或开始添加）

# ⚡ 下一步行动


# ⏳ 等待确认


# ☕ 将来/也许
`;

/** 固定 GTD 工作流路径（与模板中的一级标题一致，用于侧栏与筛选） */
const GTD_WORKFLOW_PATHS = ['📥 收件箱', '⚡ 下一步行动', '⏳ 等待确认', '☕ 将来/也许'] as const;

const App: React.FC = () => {
  const { 
    lang, setLang, isDarkMode, setIsDarkMode, userTimezone, setUserTimezone, effectiveTimezone, sidebarOpen, setSidebarOpen,
    activeView, setActiveView, selectedFilter, setSelectedFilter,
    toasts, addToast, pomoState, setPomoState, syncStatus, setSyncStatus, t
  } = useGtd();

  const [markdown, setMarkdown] = useState(() => {
    if (typeof window === 'undefined') return DEFAULT_GTD_TEMPLATE;
    return localStorage.getItem('gtd-markdown') || DEFAULT_GTD_TEMPLATE;
  });
  const [newTaskInput, setNewTaskInput] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [selectedSubtaskLineIndex, setSelectedSubtaskLineIndex] = useState<number | null>(null);
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());
  const [isLanguageDropdownOpen, setIsLanguageDropdownOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [searchExpanded, setSearchExpanded] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({'📥 收件箱': true});
  const [projectGroups, setProjectGroups] = useState<ProjectGroup[]>(() => {
    try {
      const raw = localStorage.getItem('gtd-project-groups');
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [expandedFolderGroups, setExpandedFolderGroups] = useState<Record<string, boolean>>({});
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
  const [editingGroupName, setEditingGroupName] = useState('');
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [dragOverUngrouped, setDragOverUngrouped] = useState(false);
  const [dragOverWorkflowPath, setDragOverWorkflowPath] = useState<string | null>(null);
  const [hasCurrentFile, setHasCurrentFile] = useState(false);
  const [isDefaultFile, setIsDefaultFile] = useState(false);
  const [syncMode, setSyncMode] = useState(false);
  const [isSubtaskDragging, setIsSubtaskDragging] = useState(false);
  const [dragOverTaskId, setDragOverTaskId] = useState<string | null>(null);

  const mainInputRef = useRef<HTMLInputElement>(null);
  const [, startTransition] = useTransition();
  const syncModeRef = useRef(false);
  syncModeRef.current = syncMode;
  const dragOverTaskIdRef = useRef<string | null>(null);
  const dragOverRafRef = useRef<number | null>(null);
  /** Tauri/WebView 下 drop 时 dataTransfer.getData 可能为空，用 ref 保存拖拽中的数据供 drop 使用 */
  const dragPayloadRef = useRef<{ lineIndex: number; lineCount?: number; isSubtask?: boolean } | null>(null);
  /** Tauri 专用：指针拖拽不依赖 HTML5 DnD，用 ref 存当前拖拽任务与 overlay 位置，拖拽过程不触发重渲染 */
  const pointerDragTaskRef = useRef<Task | null>(null);
  const pointerDragOverlayRef = useRef<HTMLDivElement | null>(null);
  const pointerDragLastDropRef = useRef<Element | null>(null);
  const pointerDragPosRef = useRef({ x: 0, y: 0 });
  const [pointerDragActive, setPointerDragActive] = useState(false);
  const [pointerDragTask, setPointerDragTask] = useState<Task | null>(null);
  const pointerDragHandlersRef = useRef<{
    handleMoveTaskToProject: (idx: number, path: string) => void;
    handleMakeSubtask: (source: number, target: number) => void;
    saveToDisk: (content: string) => void;
    markdown: string;
  }>(null as any);
  const notificationRequestedRef = useRef(false);
  const checkTaskNotificationsRef = useRef<() => void>(() => {});
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const pomoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notificationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const notifiedTaskIdsRef = useRef<Set<string>>(new Set());
  const currentFileHandle = useRef<any>(null);
  const currentFilePathRef = useRef<string | null>(null);

  const { projects, allTasks } = useGtdParser(markdown, t);

  const TZ_OFFSET_MINUTES: Record<string, number> = {
    UTC: 0,
    'Asia/Shanghai': 8 * 60,
    'Asia/Tokyo': 9 * 60,
    'America/New_York': -5 * 60,
    'America/Los_Angeles': -8 * 60,
    'Europe/London': 0,
    'Europe/Paris': 1 * 60
  };

  /** 未知时区时使用当前系统时区偏移（便于提醒时间正确） */
  const getOffsetMinutes = useCallback((tz: string) => {
    return TZ_OFFSET_MINUTES[tz] ?? -new Date().getTimezoneOffset();
  }, []);

  const getTaskMomentUtc = useCallback((task: Task): number | null => {
    if (!task.date?.includes(' ')) return null;
    const [datePart, timePart] = task.date.split(' ');
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    const tz = task.timezone || effectiveTimezone;
    const offsetMin = getOffsetMinutes(tz);
    return Date.UTC(y, m - 1, d, h, min, 0) - offsetMin * 60 * 1000;
  }, [effectiveTimezone, getOffsetMinutes]);

  /** Parse "YYYY-MM-DD HH:mm" in task timezone to UTC ms (for reminder) */
  const getReminderMomentUtc = useCallback((task: Task): number | null => {
    const reminder = (task as { reminder?: string | null }).reminder;
    if (!reminder || !reminder.includes(' ')) return null;
    const [datePart, timePart] = reminder.split(' ');
    const [y, m, d] = datePart.split('-').map(Number);
    const [h, min] = timePart.split(':').map(Number);
    const tz = task.timezone || effectiveTimezone;
    const offsetMin = getOffsetMinutes(tz);
    return Date.UTC(y, m - 1, d, h, min, 0) - offsetMin * 60 * 1000;
  }, [effectiveTimezone, getOffsetMinutes]);

  const formatPomoTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const startPomo = useCallback(() => {
    setPomoState(prev => {
      if (prev.isActive) return prev;
      const timeLeft = prev.timeLeft <= 0
        ? (prev.mode === 'work' ? 25 * 60 : 5 * 60)
        : prev.timeLeft;
      return { ...prev, isActive: true, timeLeft };
    });
  }, [setPomoState]);

  const stopPomo = useCallback(() => {
    if (pomoIntervalRef.current) {
      clearInterval(pomoIntervalRef.current);
      pomoIntervalRef.current = null;
    }
    setPomoState(prev => ({ ...prev, isActive: false }));
  }, [setPomoState]);

  const resetPomo = useCallback(() => {
    if (pomoIntervalRef.current) {
      clearInterval(pomoIntervalRef.current);
      pomoIntervalRef.current = null;
    }
    const defaultWork = 25 * 60;
    const defaultBreak = 5 * 60;
    setPomoState(prev => ({
      ...prev,
      isActive: false,
      timeLeft: prev.mode === 'work' ? defaultWork : defaultBreak,
      totalSeconds: prev.mode === 'work' ? defaultWork : defaultBreak
    }));
    addToast(lang === 'zh' ? '番茄钟已重置' : 'Pomodoro reset', 'info');
  }, [setPomoState, addToast, lang]);

  const selectedTask = useMemo(() => {
    if (selectedSubtaskLineIndex != null) {
      const parent = allTasks.find(t => t.subtasks.some(s => s.lineIndex === selectedSubtaskLineIndex));
      if (!parent) return null;
      const sub = parent.subtasks.find(s => s.lineIndex === selectedSubtaskLineIndex);
      if (!sub) return null;
      return {
        id: `sub-${sub.lineIndex}`,
        lineIndex: sub.lineIndex,
        lineCount: 1,
        content: sub.content,
        completed: sub.completed,
        date: sub.date ?? null,
        doneDate: sub.doneDate ?? null,
        recurrence: (sub.recurrence ?? null) as import('./types/gtd').Recurrence,
        priority: (sub.priority ?? null) as import('./types/gtd').Priority,
        tags: sub.tags ?? [],
        timezone: sub.timezone ?? null,
        projectPath: parent.projectPath,
        notes: [],
        subtasks: []
      } as Task;
    }
    return allTasks.find(t => t.id === selectedTaskId) ?? null;
  }, [allTasks, selectedTaskId, selectedSubtaskLineIndex]);

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
    if (!pomoState.isActive) return;
    pomoIntervalRef.current = setInterval(() => {
      setPomoState(prev => {
        if (prev.timeLeft <= 0) return prev;
        if (prev.timeLeft === 1) {
          const nextMode = prev.mode === 'work' ? 'break' : 'work';
          const nextTotal = nextMode === 'work' ? 25 * 60 : 5 * 60;
          const msg = prev.mode === 'work'
            ? (lang === 'zh' ? '专注结束，休息一下吧！' : 'Focus done. Take a break!')
            : (lang === 'zh' ? '休息结束，开始专注！' : 'Break over. Back to focus!');
          setTimeout(() => addToast(msg, 'info'), 0);
          try {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
              new Notification(lang === 'zh' ? '番茄钟 | GTD Flow' : 'Pomodoro | GTD Flow', { body: msg });
            }
          } catch (_) {}
          return { ...prev, timeLeft: nextTotal, totalSeconds: nextTotal, mode: nextMode, isActive: false };
        }
        return { ...prev, timeLeft: prev.timeLeft - 1 };
      });
    }, 1000);
    return () => {
      if (pomoIntervalRef.current) {
        clearInterval(pomoIntervalRef.current);
        pomoIntervalRef.current = null;
      }
    };
  }, [pomoState.isActive, setPomoState, addToast, lang]);

  const notificationGrantedRef = useRef(false);
  const permissionDeniedToastShownRef = useRef(false);

  const requestNotificationPermission = useCallback(async () => {
    if (isTauri()) {
      try {
        const notif = await import('@tauri-apps/plugin-notification');
        let granted = await notif.isPermissionGranted();
        if (!granted) {
          const p = await notif.requestPermission();
          granted = p === 'granted';
        }
        notificationGrantedRef.current = granted;
      } catch (_) {
        notificationGrantedRef.current = false;
      }
      return;
    }
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
    notificationGrantedRef.current = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  }, []);

  const checkTaskNotifications = useCallback(async () => {
    if (isTauri() && !notificationGrantedRef.current) {
      try {
        const notif = await import('@tauri-apps/plugin-notification');
        notificationGrantedRef.current = await notif.isPermissionGranted();
      } catch (_) {}
    }
    const hasPermission = isTauri()
      ? notificationGrantedRef.current
      : (typeof Notification !== 'undefined' && Notification.permission === 'granted');
    if (!hasPermission) return;
    const now = Date.now();
    const title = lang === 'zh' ? '任务提醒 | GTD Flow' : 'Task reminder | GTD Flow';
    for (const task of allTasks) {
      if (task.completed || notifiedTaskIdsRef.current.has(task.id)) continue;
      const reminder = (task as { reminder?: string | null }).reminder;
      const reminderUtc = reminder?.includes(' ') ? getReminderMomentUtc(task) : null;
      const taskUtc = task.date?.includes(' ') ? getTaskMomentUtc(task) : null;
      const useReminder = reminderUtc != null;
      const useSchedule = !useReminder && taskUtc != null;
      const targetUtc = useReminder ? reminderUtc! : useSchedule ? taskUtc! : null;
      if (targetUtc == null) continue;
      const diffMinutes = (targetUtc - now) / (1000 * 60);
      // 提醒时间到达前 10 分钟内或到达后 15 分钟内触发一次系统通知
      if (diffMinutes <= 10 && diffMinutes > -15) {
        try {
          const timeStr = useReminder ? (reminder!.split(' ')[1] || '') : (task.date!.split(' ')[1] || '');
          const msg = useReminder
            ? (lang === 'zh' ? `提醒: "${task.content}" (${timeStr})` : `Reminder: "${task.content}" (${timeStr})`)
            : (lang === 'zh' ? `任务 "${task.content}" 即将开始 (${timeStr})` : `Task "${task.content}" starting soon (${timeStr})`);
          if (isTauri()) {
            const notif = await import('@tauri-apps/plugin-notification');
            await notif.sendNotification({ title, body: msg });
          } else {
            new Notification(title, { body: msg });
          }
          notifiedTaskIdsRef.current.add(task.id);
          addToast(lang === 'zh' ? `提醒: ${task.content}` : `Reminder: ${task.content}`, 'info');
        } catch (_) {}
      }
    }
  }, [allTasks, getTaskMomentUtc, getReminderMomentUtc, addToast, lang]);
  checkTaskNotificationsRef.current = checkTaskNotifications;

  useEffect(() => {
    if (!notificationRequestedRef.current) {
      notificationRequestedRef.current = true;
    }
    const run = () => { checkTaskNotificationsRef.current()?.catch(() => {}); };
    (async () => {
      await requestNotificationPermission();
      if (isTauri() && !notificationGrantedRef.current && !permissionDeniedToastShownRef.current) {
        permissionDeniedToastShownRef.current = true;
        addToast(lang === 'zh' ? '请在「系统设置 → 通知」中允许 GTD Flow 发送任务提醒' : 'Enable notifications for GTD Flow in System Settings to get task reminders.', 'info');
      }
      run();
    })();
    notificationIntervalRef.current = setInterval(run, 30000);
    return () => {
      if (notificationIntervalRef.current) {
        clearInterval(notificationIntervalRef.current);
        notificationIntervalRef.current = null;
      }
    };
  }, [requestNotificationPermission, addToast, lang]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches) {
      setSidebarOpen(false);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('gtd-project-groups', JSON.stringify(projectGroups));
  }, [projectGroups]);

  const projectPathsSet = useMemo(() => new Set(projects.map(p => p.path)), [projects]);

  /** 排除固定 GTD 工作流后的项目列表（固定四项在侧栏顶部单独展示） */
  const customProjects = useMemo(() =>
    projects.filter(p => !GTD_WORKFLOW_PATHS.includes(p.path as typeof GTD_WORKFLOW_PATHS[number])),
    [projects]
  );
  useEffect(() => {
    setProjectGroups(prev => prev.map(g => ({
      ...g,
      projectPaths: g.projectPaths.filter(path => projectPathsSet.has(path))
    })));
  }, [projectPathsSet]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (isTauri()) {
        try {
          const content = await tauriReadMarkdown();
          if (cancelled) return;
          setMarkdown(content);
          const path = await tauriGetDefaultStorePath();
          if (cancelled) return;
          currentFilePathRef.current = path;
          setHasCurrentFile(!!path);
          setIsDefaultFile(!!path);
        } catch (e) {
          console.error('Tauri read_markdown:', e);
        }
        return;
      }
      const remote = await fetchMarkdown();
      if (cancelled) return;
      if (remote !== null) {
        setMarkdown(remote);
        localStorage.setItem('gtd-markdown', remote);
        setHasCurrentFile(true);
        setSyncMode(true);
        setSyncStatus('synced');
        return;
      }
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
    })();
    return () => { cancelled = true; };
  }, [setSyncStatus]);

  useEffect(() => {
    if (!syncMode) return;
    const t = setInterval(async () => {
      const remote = await fetchMarkdown();
      if (remote === null) return;
      setMarkdown(prev => (prev !== remote ? remote : prev));
    }, 30000);
    return () => clearInterval(t);
  }, [syncMode]);

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
    if (isTauri()) {
      try {
        const path = await tauriOpenFileDialog();
        if (!path) return;
        const content = await tauriReadFileAtPath(path);
        setMarkdown(content);
        await tauriSetDefaultStorePath(path);
        currentFilePathRef.current = path;
        setHasCurrentFile(true);
        setIsDefaultFile(true);
        addToast(lang === 'zh' ? '文件已打开' : 'File opened', 'success');
      } catch (err) {
        console.error(err);
      }
      return;
    }
    try {
      const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Markdown', accept: { 'text/markdown': ['.md'] } }], multiple: false });
      await loadFileContent(handle);
      addToast(lang === 'zh' ? '文件已打开' : 'File opened', 'success');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') console.error(err);
    }
  }, [loadFileContent, addToast, lang]);

  const handleSaveAs = useCallback(async () => {
    if (isTauri()) {
      try {
        const path = await tauriSaveFileDialog();
        if (!path) return;
        await tauriWriteFileAtPath(path, markdown);
        await tauriSetDefaultStorePath(path);
        currentFilePathRef.current = path;
        setHasCurrentFile(true);
        setIsDefaultFile(true);
        addToast(lang === 'zh' ? '另存为成功' : 'Saved as', 'success');
      } catch (err) {
        console.error(err);
      }
      return;
    }
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
    if (isTauri()) {
      if (!currentFilePathRef.current) return;
      if (isDefaultFile) {
        await tauriSetDefaultStorePath(null);
        setIsDefaultFile(false);
        addToast(lang === 'zh' ? '已取消默认文件' : 'Unset default file', 'info');
      } else {
        await tauriSetDefaultStorePath(currentFilePathRef.current);
        setIsDefaultFile(true);
        addToast(lang === 'zh' ? '已设为默认文件' : 'Set as default file', 'success');
      }
      return;
    }
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
    startTransition(() => setMarkdown(content));
    if (!isTauri()) {
      localStorage.setItem('gtd-markdown', content);
    }
    if (isTauri()) {
      tauriWriteMarkdown(content).catch((e) => console.error('Tauri write_markdown:', e));
    } else if (currentFileHandle.current) {
      saveToFile(content);
    }
    if (syncModeRef.current) {
      pushMarkdown(content).then(ok => setSyncStatus(ok ? 'synced' : 'sync failed'));
    }
  }, [saveToFile]);

  const handleSaveFile = useCallback(async () => {
    if (isTauri()) {
      try {
        await tauriWriteMarkdown(markdown);
        addToast(lang === 'zh' ? '保存成功' : 'Saved', 'success');
      } catch (e) {
        console.error(e);
      }
      return;
    }
    if (currentFileHandle.current) {
      await saveToFile(markdown);
      addToast(lang === 'zh' ? '保存成功' : 'Saved', 'success');
    } else {
      await handleSaveAs();
    }
  }, [markdown, saveToFile, handleSaveAs, addToast, lang]);

  const handleUpdateTask = useCallback((lineIndex: number, updates: Partial<Task>) => {
    const lines = markdown.split('\n');
    const currentLine = lines[lineIndex];
    if (currentLine == null) return;
    const indentMatch = currentLine.match(/^(\s*)/);
    const indent = indentMatch ? indentMatch[1] : '';

    const task = allTasks.find(t => t.lineIndex === lineIndex);
    const newContent = updates.content ?? task?.content ?? '';
    const newCompleted = updates.completed ?? task?.completed ?? false;
    const newDate = updates.date ?? task?.date ?? null;
    const newReminder = (updates as { reminder?: string | null }).reminder ?? (task as { reminder?: string | null })?.reminder ?? null;
    const newPriority = updates.priority ?? task?.priority ?? null;
    const newTags = updates.tags ?? task?.tags ?? [];
    const newRecurrence = updates.recurrence ?? task?.recurrence ?? null;
    const newTimezone = updates.timezone ?? task?.timezone ?? null;

    let newLine = `${indent}- [${newCompleted ? 'x' : ' '}] ${newContent}`;
    if (newPriority) newLine += ` !${newPriority}`;
    if (newDate) newLine += ` @${newDate}`;
    if (newReminder && newReminder.includes(' ')) newLine += ` @remind(${newReminder})`;
    if (newRecurrence) newLine += ` @every(${newRecurrence})`;
    if (newTimezone) newLine += ` @tz(${newTimezone})`;
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

  /** 从输入中解析自然语言时间（早上9点、下午2:00 等），返回 HH:mm 及剥离后的文本 */
  const parseNaturalLanguageTime = (input: string): { time: string; rest: string } | null => {
    let rest = input.trim();
    const pad = (n: number) => String(n).padStart(2, '0');

    // 中午 -> 12:00
    const noon = rest.match(/(.+)?中午(.+)?/);
    if (noon) {
      rest = [noon[1] ?? '', noon[2] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
      return { time: '12:00', rest };
    }

    // 早上/早晨/上午 X点 / X点半 / X点YY分
    const morning = rest.match(/(.+)?(早上|早晨|上午)\s*(\d{1,2})\s*点(半|(\d{2})分?)?\s*(.+)?/);
    if (morning) {
      const h = parseInt(morning[3], 10);
      const m = morning[4] === '半' ? 30 : morning[5] ? parseInt(morning[5], 10) : 0;
      const hour = h === 12 ? 12 : h;
      rest = [morning[1] ?? '', morning[6] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
      return { time: `${pad(hour)}:${pad(m)}`, rest };
    }

    // 下午 X点 / X点半 / X:YY
    const afternoon = rest.match(/(.+)?下午\s*(\d{1,2})(?:\s*点(半|(\d{2})分?)?|\s*:(\d{2}))\s*(.+)?/);
    if (afternoon) {
      const h = parseInt(afternoon[2], 10);
      const m = afternoon[3] === '半' ? 30 : afternoon[4] ? parseInt(afternoon[4], 10) : afternoon[5] ? parseInt(afternoon[5], 10) : 0;
      const hour = h >= 12 ? h : h + 12;
      rest = [afternoon[1] ?? '', afternoon[6] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
      return { time: `${pad(hour)}:${pad(m)}`, rest };
    }

    // 晚上/傍晚 X点
    const evening = rest.match(/(.+)?(晚上|傍晚)\s*(\d{1,2})\s*点(半|(\d{2})分?)?\s*(.+)?/);
    if (evening) {
      const h = parseInt(evening[3], 10);
      const m = evening[4] === '半' ? 30 : evening[5] ? parseInt(evening[5], 10) : 0;
      const hour = h >= 12 ? h : h + 12;
      rest = [evening[1] ?? '', evening[6] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
      return { time: `${pad(hour)}:${pad(m)}`, rest };
    }

    // 英文 afternoon 2:00 / morning 9:00
    const enAfternoon = rest.match(/(.+)?(?:afternoon|pm)\s*(\d{1,2})(?::(\d{2}))?\s*(.+)?/i);
    if (enAfternoon) {
      const h = parseInt(enAfternoon[2], 10);
      const m = enAfternoon[3] ? parseInt(enAfternoon[3], 10) : 0;
      const hour = h >= 12 ? h : h + 12;
      rest = [enAfternoon[1] ?? '', enAfternoon[4] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
      return { time: `${pad(hour)}:${pad(m)}`, rest };
    }
    const enMorning = rest.match(/(.+)?(?:morning|am)\s*(\d{1,2})(?::(\d{2}))?\s*(.+)?/i);
    if (enMorning) {
      const h = parseInt(enMorning[2], 10);
      const m = enMorning[3] ? parseInt(enMorning[3], 10) : 0;
      const hour = h === 12 ? 0 : h;
      rest = [enMorning[1] ?? '', enMorning[4] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
      return { time: `${pad(hour)}:${pad(m)}`, rest };
    }

    // 纯数字时间 HH:mm 或 H:mm（24 小时）
    const direct = rest.match(/(.+)?\b(\d{1,2}):(\d{2})\b\s*(.+)?/);
    if (direct) {
      const h = parseInt(direct[2], 10);
      const m = parseInt(direct[3], 10);
      if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
        rest = [direct[1] ?? '', direct[4] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
        return { time: `${pad(h)}:${pad(m)}`, rest };
      }
    }

    // 仅「X点」或「X点半」（无 早上/下午 时按上午处理，12点=中午）
    const point = rest.match(/(.+)?(\d{1,2})\s*点(半)?\s*(.+)?/);
    if (point) {
      const h = parseInt(point[2], 10);
      const m = point[3] === '半' ? 30 : 0;
      const hour = h >= 1 && h <= 12 ? (h === 12 ? 12 : h) : h;
      rest = [point[1] ?? '', point[4] ?? ''].join(' ').replace(/\s+/g, ' ').trim();
      return { time: `${pad(hour)}:${pad(m)}`, rest };
    }

    return null;
  };

  const addTask = () => {
    if (!newTaskInput.trim()) return;
    const lines = markdown.split('\n');
    const now = new Date();
    const todayStr = formatDt(now, 'yyyy-MM-dd');
    let text = newTaskInput.trim();
    let date: string | null = null;

    // 1. 继承当前时间筛选：在「今天」「明天」「7 天」视图下新建任务自动带对应日期
    if (selectedFilter.type === 'time') {
      if (selectedFilter.value === 'today') date = todayStr;
      else if (selectedFilter.value === 'tomorrow') date = formatDt(addDays(now, 1), 'yyyy-MM-dd');
      else if (selectedFilter.value === 'next7Days') date = todayStr; // 默认今天，或可留空
    }

    // 2. 简单自然语言日期识别：从内容中解析并剥离关键词
    if (!date) {
      const lower = text.toLowerCase();
      if (text.includes('今天') || lower.includes('today')) {
        date = todayStr;
        text = text.replace(/今天/g, '').replace(/today/gi, '').trim();
      } else if (text.includes('明天') || lower.includes('tomorrow')) {
        date = formatDt(addDays(now, 1), 'yyyy-MM-dd');
        text = text.replace(/明天/g, '').replace(/tomorrow/gi, '').trim();
      } else if (text.includes('后天')) {
        date = formatDt(addDays(now, 2), 'yyyy-MM-dd');
        text = text.replace(/后天/g, '').trim();
      } else if (text.includes('下周') || text.includes('下週') || lower.includes('next week')) {
        date = formatDt(addDays(now, 7), 'yyyy-MM-dd');
        text = text.replace(/下周|下週/g, '').replace(/next week/gi, '').trim();
      }
    }

    // 3. 自然语言时间识别：早上9点、下午2:00 等，从内容中解析并剥离
    let dateTime = date ?? null;
    const timeParsed = parseNaturalLanguageTime(text);
    if (timeParsed) {
      text = timeParsed.rest.replace(/\s+/g, ' ').trim();
      const baseDate = date ?? todayStr;
      dateTime = `${baseDate} ${timeParsed.time}`;
    } else if (date) {
      dateTime = date;
    }

    const content = dateTime ? `- [ ] ${text} @${dateTime}` : `- [ ] ${text}`;
    // 捕捉的灵感一律放入收件箱
    let insertIdx = lines.findIndex(l => l.includes('收件箱') || l.toLowerCase().includes('inbox')) + 1;
    if (insertIdx <= 0) insertIdx = lines.findIndex(l => l.startsWith('#')) + 1;
    if (insertIdx <= 0) {
      lines.push(`# 📥 ${t.inbox}`, content);
    } else {
      lines.splice(insertIdx, 0, content);
    }
    saveToDisk(lines.join('\n'));
    setNewTaskInput('');
  };

  const handleDeleteTask = (idx: number) => {
    const task = allTasks.find(t => t.lineIndex === idx);
    const lineCount = task?.lineCount ?? 1;
    const lines = markdown.split('\n');
    lines.splice(idx, lineCount);
    saveToDisk(lines.join('\n'));
    if (selectedTaskId && task && task.id === selectedTaskId) setSelectedTaskId(null);
    if (selectedSubtaskLineIndex !== null && task && task.lineIndex === selectedSubtaskLineIndex) setSelectedSubtaskLineIndex(null);
    addToast(t.deleteSelected, 'info');
  };

  const onDragStart = (e: React.DragEvent, task: Task) => {
    const payload = JSON.stringify(task);
    e.dataTransfer.setData('task', payload);
    e.dataTransfer.setData('text/plain', payload);
    e.dataTransfer.setData('application/json', payload);
    e.dataTransfer.effectAllowed = 'move';
    const data = { lineIndex: task.lineIndex, lineCount: task.lineCount ?? 1, isSubtask: !!(task as any).isSubtask };
    dragPayloadRef.current = data;
    setIsSubtaskDragging(!!(task as any).isSubtask);
  };

  const onDragEnd = useCallback(() => {
    setIsSubtaskDragging(false);
    dragOverTaskIdRef.current = null;
    dragPayloadRef.current = null;
    if (dragOverRafRef.current != null) cancelAnimationFrame(dragOverRafRef.current);
    dragOverRafRef.current = null;
    setDragOverTaskId(null);
  }, []);

  const setDragOverTaskIdThrottled = useCallback((id: string | null) => {
    if (dragOverTaskIdRef.current === id) return;
    dragOverTaskIdRef.current = id;
    if (dragOverRafRef.current != null) return;
    dragOverRafRef.current = requestAnimationFrame(() => {
      dragOverRafRef.current = null;
      setDragOverTaskId(dragOverTaskIdRef.current);
    });
  }, []);

  const getTaskDataFromTransfer = (dt: DataTransfer | null): { lineIndex: number; lineCount?: number; isSubtask?: boolean } | null => {
    if (dt) {
      const raw = dt.getData('task') || dt.getData('text/plain') || dt.getData('application/json');
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          if (parsed != null && typeof parsed.lineIndex === 'number') return parsed;
        } catch {}
      }
    }
    return dragPayloadRef.current;
  };

  /** Tauri 专用：开始指针拖拽，不依赖 HTML5 DnD，拖拽过程仅更新 overlay 位置（DOM），不触发整树重渲染 */
  const startPointerDrag = useCallback((task: Task, clientX?: number, clientY?: number) => {
    if (!isTauri()) return;
    const t = { ...task };
    pointerDragTaskRef.current = t;
    pointerDragPosRef.current = { x: clientX ?? 0, y: clientY ?? 0 };
    setPointerDragTask(t);
    setPointerDragActive(true);
  }, []);

  useEffect(() => {
    if (!pointerDragActive || !isTauri()) return;
    const overlay = pointerDragOverlayRef.current;
    const pos = pointerDragPosRef.current;
    if (overlay) overlay.style.transform = `translate(${pos.x}px,${pos.y}px)`;
    const onMove = (e: PointerEvent) => {
      if (!overlay) return;
      overlay.style.transform = `translate(${e.clientX}px,${e.clientY}px)`;
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const dropEl = els.find(el => (el as HTMLElement).dataset?.drop);
      if (dropEl !== pointerDragLastDropRef.current) {
        pointerDragLastDropRef.current?.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/80', 'dark:bg-blue-900/30');
        pointerDragLastDropRef.current = dropEl as Element | null;
        (dropEl as HTMLElement)?.classList.add('ring-2', 'ring-blue-500', 'bg-blue-50/80', 'dark:bg-blue-900/30');
      }
    };
    const onUp = (e: PointerEvent) => {
      const task = pointerDragTaskRef.current;
      pointerDragTaskRef.current = null;
      setPointerDragTask(null);
      setPointerDragActive(false);
      pointerDragLastDropRef.current?.classList.remove('ring-2', 'ring-blue-500', 'bg-blue-50/80', 'dark:bg-blue-900/30');
      pointerDragLastDropRef.current = null;
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      if (!task) return;
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const dropEl = els.find(el => (el as HTMLElement).dataset?.drop) as HTMLElement | undefined;
      if (!dropEl?.dataset?.drop) return;
      const dropType = dropEl.dataset.drop;
      const path = dropEl.dataset.dropPath;
      const targetLineStr = dropEl.dataset.dropTargetLine;
      const targetLine = targetLineStr != null ? parseInt(targetLineStr, 10) : NaN;
      const handlers = pointerDragHandlersRef.current;
      if (!handlers) return;
      if (dropType === 'workflow' && path) {
        handlers.handleMoveTaskToProject(task.lineIndex, path);
        addToast(lang === 'zh' ? `已移至 ${path.split(' / ').pop()?.trim()}` : `Moved`, 'success');
      } else if (dropType === 'project' && path) {
        handlers.handleMoveTaskToProject(task.lineIndex, path);
        addToast(lang === 'zh' ? `已移至 ${path.split(' / ').pop()?.trim()}` : `Moved`, 'success');
      } else if (dropType === 'subtask' && !Number.isNaN(targetLine) && targetLine !== task.lineIndex) {
        handlers.handleMakeSubtask(task.lineIndex, targetLine);
        addToast(lang === 'zh' ? '已转为子任务' : 'Converted to subtask', 'success');
      } else if (dropType === 'task-row' && !Number.isNaN(targetLine) && targetLine !== task.lineIndex) {
        const lines = handlers.markdown.split('\n');
        const lineCount = task.lineCount ?? 1;
        let taskLines = lines.splice(task.lineIndex, lineCount);
        if ((task as any).isSubtask) taskLines = taskLines.map((l: string) => l.replace(/^[\s\t]+-/, '-'));
        let finalIdx = targetLine;
        if (task.lineIndex < targetLine) finalIdx = targetLine - lineCount;
        lines.splice(finalIdx, 0, ...taskLines);
        handlers.saveToDisk(lines.join('\n'));
        addToast((task as any).isSubtask ? 'Task Promoted' : 'Task Moved', 'success');
      }
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
    return () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
    };
  }, [pointerDragActive, lang, addToast]);

  const onTaskDrop = (e: React.DragEvent, targetLineIdx: number) => {
    e.preventDefault();
    try {
      const taskData = getTaskDataFromTransfer(e.dataTransfer);
      if (!taskData) return;
      const sourceIdx = Number(taskData.lineIndex);
      const targetIdx = Number(targetLineIdx);
      if (Number.isNaN(sourceIdx) || Number.isNaN(targetIdx) || sourceIdx === targetIdx) return;

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
    // 仅当移动的是「单行子任务」时提升为父任务；多行（父+子任务）时保留子任务缩进
    if (taskLines.length === 1 && /^[\s\t]+-/.test(taskLines[0])) {
      taskLines[0] = taskLines[0].replace(/^[\s\t]+-/, '-');
    }

    const targetName = targetPath.split(' / ').pop()?.trim();
    const targetLevel = targetPath.split(' / ').length;
    
    let projectIdx = lines.findIndex(l => 
      l.startsWith('#') && 
      l.replace(/^#+\s*/, '').trim() === targetName && 
      (l.match(/^#+/) || ['#'])[0].length === targetLevel
    );

    // 若目标是固定 GTD 工作流但文件中尚无该标题，则在文件末尾追加该分区并放入任务
    if (projectIdx === -1 && GTD_WORKFLOW_PATHS.includes(targetPath as typeof GTD_WORKFLOW_PATHS[number])) {
      if (lines.length > 0 && lines[lines.length - 1].trim() !== '') lines.push('');
      lines.push(`# ${targetName}`, ...taskLines);
      saveToDisk(lines.join('\n'));
      addToast(lang === 'zh' ? `已移至 ${targetName}` : `Moved to ${targetName}`, 'success');
      return;
    }

    if (projectIdx !== -1) {
      lines.splice(projectIdx + 1, 0, ...taskLines);
      saveToDisk(lines.join('\n'));
      addToast(lang === 'zh' ? `已移至 ${targetName}` : `Moved to ${targetName}`, 'success');
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

  pointerDragHandlersRef.current = {
    handleMoveTaskToProject,
    handleMakeSubtask,
    saveToDisk,
    markdown
  };

  const handlePromoteSubtask = useCallback((subtaskLineIndex: number) => {
    const lines = markdown.split('\n');
    const line = lines[subtaskLineIndex];
    if (!line || !/^\s+- \[[ x]\]/.test(line)) return;
    const parent = allTasks.find(
      t => t.lineIndex <= subtaskLineIndex && (t.lineIndex + (t.lineCount || 1)) > subtaskLineIndex
    );
    if (!parent) return;
    const parentLineIndex = parent.lineIndex;
    const oneLine = lines.splice(subtaskLineIndex, 1)[0];
    const unindented = oneLine.replace(/^\s+/, '');
    lines.splice(parentLineIndex + 1, 0, unindented);
    saveToDisk(lines.join('\n'));
    addToast(lang === 'zh' ? '已提升为独立任务' : 'Promoted to task', 'success');
  }, [markdown, allTasks, saveToDisk, addToast, lang]);

  const handleAddProject = () => {
    const lines = markdown.split('\n');
    const uniqueName = `新建项目-${Date.now().toString().slice(-4)}`;
    lines.push('', `# ${uniqueName}`);
    saveToDisk(lines.join('\n'));
    addToast(lang === 'zh' ? '新建项目成功' : 'Project added', 'success');
  };

  const handleRenameProject = useCallback((path: string, newName: string) => {
    if (!newName.trim()) return;
    const lines = markdown.split('\n');
    const pathParts = path.split(' / ').map(s => s.trim());
    const oldName = pathParts[pathParts.length - 1];
    const level = pathParts.length;
    const idx = lines.findIndex(l => {
      const trimmed = l.trim();
      if (!trimmed.startsWith('#')) return false;
      const headLevel = (trimmed.match(/^#+/) || ['#'])[0].length;
      const name = trimmed.replace(/^#+\s*/, '').trim();
      return name === oldName && headLevel === level;
    });
    if (idx !== -1) {
      const nameTrimmed = newName.trim();
      lines[idx] = '#'.repeat(level) + ' ' + nameTrimmed;
      saveToDisk(lines.join('\n'));
      if (selectedFilter.type === 'project' && selectedFilter.value === path) {
        const newPath = pathParts.length === 1 ? nameTrimmed : pathParts.slice(0, -1).join(' / ') + ' / ' + nameTrimmed;
        setSelectedFilter({ type: 'project', value: newPath });
      }
      addToast(lang === 'zh' ? '项目已重命名' : 'Project renamed', 'success');
    }
  }, [markdown, saveToDisk, addToast, lang, selectedFilter, setSelectedFilter]);

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

  // --- 项目分组（UI 层）---
  const projectPathToGroupId = useMemo(() => {
    const map: Record<string, string> = {};
    projectGroups.forEach(g => g.projectPaths.forEach(path => { map[path] = g.id; }));
    return map;
  }, [projectGroups]);

  const ungroupedProjects = useMemo(() => 
    customProjects.filter(p => !projectPathToGroupId[p.path]), 
    [customProjects, projectPathToGroupId]
  );

  const addGroup = useCallback(() => {
    const name = lang === 'zh' ? '新建组' : 'New group';
    setProjectGroups(prev => [...prev, { id: `g-${Date.now()}`, name, projectPaths: [] }]);
    addToast(lang === 'zh' ? '已新建组' : 'Group added', 'success');
  }, [lang, addToast]);

  const renameGroup = useCallback((groupId: string, newName: string) => {
    if (!newName.trim()) return;
    setProjectGroups(prev => prev.map(g => g.id === groupId ? { ...g, name: newName.trim() } : g));
    addToast(lang === 'zh' ? '组已重命名' : 'Group renamed', 'success');
  }, [addToast, lang]);

  const deleteGroup = useCallback((groupId: string) => {
    if (!window.confirm(t.confirmDeleteGroup)) return;
    setProjectGroups(prev => prev.filter(g => g.id !== groupId));
    addToast(lang === 'zh' ? '组已删除' : 'Group deleted', 'info');
  }, [addToast, lang, t.confirmDeleteGroup]);

  const moveProjectToGroup = useCallback((projectPath: string, groupId: string) => {
    setProjectGroups(prev => prev.map(g => {
      const has = g.projectPaths.includes(projectPath);
      if (g.id === groupId) return has ? g : { ...g, projectPaths: [...g.projectPaths, projectPath] };
      return has ? { ...g, projectPaths: g.projectPaths.filter(p => p !== projectPath) } : g;
    }));
  }, []);

  const removeProjectFromGroup = useCallback((projectPath: string) => {
    setProjectGroups(prev => prev.map(g => 
      g.projectPaths.includes(projectPath) ? { ...g, projectPaths: g.projectPaths.filter(p => p !== projectPath) } : g
    ));
  }, []);

  const getProjectsInGroup = useCallback((group: ProjectGroup) => 
    group.projectPaths.map(path => projects.find(p => p.path === path)).filter(Boolean) as ProjectNode[],
    [projects]
  );

  const handleProjectDragStart = useCallback((e: React.DragEvent, path: string) => {
    e.dataTransfer.setData('application/x-gtd-project', path);
    e.dataTransfer.effectAllowed = 'move';
  }, []);

  const handleGroupDrop = useCallback((e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    const path = e.dataTransfer.getData('application/x-gtd-project');
    if (path) moveProjectToGroup(path, groupId);
  }, [moveProjectToGroup]);

  const handleUngroupedDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const path = e.dataTransfer.getData('application/x-gtd-project');
    if (path) removeProjectFromGroup(path);
  }, [removeProjectFromGroup]);

  // --- UI Helpers ---
  const getGTDIcon = (name: string) => {
    if (name.includes('收件箱') || name.toLowerCase().includes('inbox')) return Inbox;
    if (name.includes('下一步') || name.toLowerCase().includes('next')) return Zap;
    if (name.includes('等待') || name.toLowerCase().includes('waiting')) return Hourglass;
    if (name.includes('将来') || name.includes('未来也许') || name.toLowerCase().includes('someday')) return Coffee;
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

  // GTD 回顾统计：基于已完成任务与项目分布
  const statistics = useMemo(() => {
    const total = allTasks.length;
    const completed = allTasks.filter(t => t.completed).length;
    const completionRate = total ? Math.round((completed / total) * 100) : 0;
    const doneDates = allTasks.filter(t => t.completed && t.doneDate).map(t => t.doneDate!.split(' ')[0]);
    const activeDays = new Set(doneDates).size;

    const now = new Date();
    const weekDays = Array.from({ length: 7 }, (_, i) => {
      const d = subDays(now, 6 - i);
      const fullDate = formatDt(d, 'yyyy-MM-dd');
      const count = allTasks.filter(t => t.completed && t.doneDate && t.doneDate.startsWith(fullDate)).length;
      const label = lang === 'zh' ? formatDt(d, 'M/d') : formatDt(d, 'EEE');
      return { fullDate, label, count };
    });
    const maxWeekCount = Math.max(...weekDays.map(d => d.count), 1);

    const projectMap = new Map<string, { total: number; completed: number }>();
    allTasks.forEach(t => {
      const path = t.projectPath || (lang === 'zh' ? '未分类' : 'Uncategorized');
      const cur = projectMap.get(path) ?? { total: 0, completed: 0 };
      cur.total++;
      if (t.completed) cur.completed++;
      projectMap.set(path, cur);
    });
    const projectDistribution = Array.from(projectMap.entries()).map(([name, { total: tot, completed: cmp }]) => ({
      name,
      total: tot,
      completed: cmp,
      percent: tot ? Math.round((cmp / tot) * 100) : 0
    })).sort((a, b) => b.total - a.total);

    return { totalCompleted: completed, completionRate, activeDays, weeklyTrend: weekDays, maxWeekCount, projectDistribution };
  }, [allTasks, lang]);

  return (
    <div className="flex flex-row w-screen h-screen bg-[#F8FAFC] dark:bg-[#0F172A] text-slate-900 dark:text-slate-100 overflow-hidden font-sans selection:bg-blue-500/30">
      {/* Tauri 指针拖拽：跟随光标的浮层，仅 DOM 更新位置不触发重渲染 */}
      {isTauri() && pointerDragTask && (
        <div
          ref={pointerDragOverlayRef}
          className="fixed left-0 top-0 w-64 pointer-events-none z-[9999] px-3 py-2 rounded-xl shadow-2xl border-2 border-blue-500 bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 text-sm font-bold truncate"
          style={{ transform: `translate(${pointerDragPosRef.current.x}px,${pointerDragPosRef.current.y}px)` }}
        >
          {pointerDragTask.content}
        </div>
      )}
      {/* Dynamic Background Blur - Glassmorphism */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-blue-400/10 dark:bg-blue-600/5 blur-[120px] rounded-full"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-indigo-400/10 dark:bg-indigo-600/5 blur-[120px] rounded-full"></div>
      </div>

      {/* Mobile: backdrop when sidebar open */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-[18] md:hidden"
          aria-hidden
          onClick={() => setSidebarOpen(false)}
        />
      )}
      {/* Sidebar: overlay on mobile, column on desktop */}
      <motion.aside 
        initial={false}
        animate={{ width: sidebarOpen ? 280 : 0 }}
        className={cn(
          "fixed md:relative left-0 top-0 h-full md:h-auto bg-white/90 dark:bg-slate-900/90 backdrop-blur-xl border-r border-slate-200/50 dark:border-slate-800/50 flex flex-col overflow-hidden z-20 shrink-0 shadow-xl md:shadow-none"
        )}
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
            <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em]">Navigation</div>
            
            {/* 🧪 VERIFICATION ROW */}
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800/50 rounded-2xl">
              <button 
                onClick={() => { setSelectedFilter({type: 'all', value: 'ALL'}); setActiveView('view'); }}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                  selectedFilter.type === 'all' && activeView === 'view' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                ALL
              </button>
              <button 
                onClick={() => { setSelectedFilter({type: 'time', value: 'today'}); setActiveView('view'); }}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                  (selectedFilter.type === 'time' && selectedFilter.value === 'today') && activeView === 'view' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                TODAY
              </button>
              <button 
                onClick={() => { setSelectedFilter({type: 'time', value: 'next7Days'}); setActiveView('view'); }}
                className={cn(
                  "flex-1 py-2 rounded-xl text-[10px] font-black transition-all",
                  (selectedFilter.type === 'time' && selectedFilter.value === 'next7Days') && activeView === 'view' ? "bg-white dark:bg-slate-700 shadow-sm text-blue-600" : "text-slate-500 hover:text-slate-700"
                )}
              >
                7 DAYS
              </button>
            </div>
            <button
              onClick={() => setActiveView('stats')}
              className={cn(
                "w-full mt-2 flex items-center gap-3 px-3 py-2.5 rounded-2xl text-sm font-black transition-all",
                activeView === 'stats' ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50"
              )}
            >
              <BarChart2 size={18} className={activeView === 'stats' ? "text-white" : "text-slate-400"} />
              {t.review}
            </button>
          </div>

          <div className="space-y-2">
            <div className="px-3 text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] mb-3 flex items-center justify-between gap-1">
              <span>{t.workflows}</span>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={addGroup} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title={t.newGroup}>
                  <Folder size={14} className="text-amber-500" />
                </button>
                <button type="button" onClick={handleAddProject} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded transition-colors" title={lang === 'zh' ? '新建项目' : 'New project'}>
                  <Plus size={14} className="text-blue-500 cursor-pointer hover:rotate-90 transition-transform" />
                </button>
              </div>
            </div>
            {/* 固定 GTD 工作流：收件箱、下一步行动、等待确认、将来/也许（支持拖入任务） */}
            <div className="space-y-0.5 mb-4">
              {GTD_WORKFLOW_PATHS.map(path => {
                const label = path === '📥 收件箱' ? t.inbox : path === '⚡ 下一步行动' ? t.nextActions : path === '⏳ 等待确认' ? t.waitingFor : t.somedayMaybe;
                const active = selectedFilter.type === 'project' && selectedFilter.value === path;
                const workflowNode = projects.find(p => p.path === path);
                const incompleteCount = workflowNode?.incompleteCount ?? 0;
                const isDragOver = dragOverWorkflowPath === path;
                return (
                  <div
                    key={path}
                    role="button"
                    tabIndex={0}
                    data-drop="workflow"
                    data-drop-path={path}
                    onClick={() => { setSelectedFilter({ type: 'project', value: path }); setActiveView('view'); }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedFilter({ type: 'project', value: path }); setActiveView('view'); } }}
                    onDragOver={!isTauri() ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverWorkflowPath(path); } : undefined}
                    onDragLeave={!isTauri() ? () => setDragOverWorkflowPath(null) : undefined}
                    onDrop={!isTauri() ? (e) => {
                      e.preventDefault();
                      setDragOverWorkflowPath(null);
                      const taskData = getTaskDataFromTransfer(e.dataTransfer);
                      if (taskData != null) handleMoveTaskToProject(taskData.lineIndex, path);
                    } : undefined}
                    className={cn(
                      "w-full flex items-center gap-3 px-3 py-2.5 min-h-[44px] rounded-2xl text-left text-sm font-bold transition-all cursor-pointer touch-manipulation",
                      active ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50",
                      isDragOver && "ring-2 ring-blue-500 bg-blue-50 dark:bg-blue-900/30"
                    )}
                  >
                    {React.createElement(getGTDIcon(path), { size: 18, className: active ? "text-blue-600 dark:text-blue-400" : "text-slate-400" })}
                    <span className="truncate flex-1">{label}</span>
                    {incompleteCount > 0 && (
                      <span className={cn(
                        "text-[10px] font-black px-1.5 py-0.5 rounded-full min-w-[20px] text-center shrink-0",
                        active ? "bg-blue-500 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-400"
                      )}>
                        {incompleteCount}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            {projectGroups.map(g => {
              const expanded = expandedFolderGroups[g.id] !== false;
              const isEditing = editingGroupId === g.id;
              const groupProjects = getProjectsInGroup(g);
              return (
                <div key={g.id} className="space-y-0.5">
                  <div
                    className={cn(
                      "px-3 py-2 rounded-2xl border-2 border-dashed transition-colors flex items-center gap-2 min-h-[40px]",
                      dragOverGroupId === g.id ? "border-blue-400 bg-blue-50/50 dark:bg-blue-900/20" : "border-transparent"
                    )}
                    onDragOver={(e) => { e.preventDefault(); setDragOverGroupId(g.id); }}
                    onDragLeave={() => setDragOverGroupId(null)}
                    onDrop={(e) => { e.preventDefault(); setDragOverGroupId(null); handleGroupDrop(e, g.id); }}
                  >
                    <button type="button" onClick={() => setExpandedFolderGroups(prev => ({ ...prev, [g.id]: !expanded }))} className="shrink-0 text-slate-400">
                      {expanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                    </button>
                    {isEditing ? (
                      <input
                        value={editingGroupName}
                        onChange={(e) => setEditingGroupName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { renameGroup(g.id, editingGroupName); setEditingGroupId(null); } if (e.key === 'Escape') setEditingGroupId(null); }}
                        onBlur={() => { if (editingGroupName.trim()) renameGroup(g.id, editingGroupName); setEditingGroupId(null); }}
                        className="flex-1 min-w-0 bg-white dark:bg-slate-800 border border-blue-500/30 rounded-lg px-2 py-0.5 text-xs font-bold outline-none"
                        autoFocus
                      />
                    ) : (
                      <>
                        <Folder size={14} className="text-amber-500 shrink-0" />
                        <span className="flex-1 text-[12px] font-bold text-slate-700 dark:text-slate-200 truncate">{g.name}</span>
                        <button type="button" onClick={() => { setEditingGroupId(g.id); setEditingGroupName(g.name); }} className="p-1 text-slate-400 hover:text-blue-500 rounded" title={t.renameGroup}>
                          <Edit2 size={11} />
                        </button>
                        <button type="button" onClick={() => deleteGroup(g.id)} className="p-1 text-slate-400 hover:text-rose-500 rounded" title={t.deleteGroup}>
                          <Trash2 size={11} />
                        </button>
                      </>
                    )}
                  </div>
                  {expanded && (
                    <div className="ml-2 pl-2 border-l border-slate-200/50 dark:border-slate-700/50 space-y-0.5">
                      {groupProjects.map(p => (
                        <div key={p.path} draggable onDragStart={(e) => handleProjectDragStart(e, p.path)} className="cursor-grab active:cursor-grabbing">
                          <ProjectItem
                            node={p}
                            expanded={expandedGroups[p.path]}
                            active={selectedFilter.value === p.path}
                            icon={getGTDIcon(p.name)}
                            onToggle={(path) => setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }))}
                            onSelect={(n) => setSelectedFilter({ type: 'project', value: n.path })}
                            onRename={handleRenameProject}
                            onDelete={handleDeleteProject}
                            onDropTask={handleMoveTaskToProject}
                            getDraggedTaskData={getTaskDataFromTransfer}
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
            {(projectGroups.length > 0 ? ungroupedProjects : customProjects).length > 0 && (
              <div className="mt-2">
                {projectGroups.length > 0 && (
                  <div
                    className={cn("px-3 py-1.5 text-[10px] font-black uppercase tracking-widest flex items-center gap-2 rounded-xl transition-colors", dragOverUngrouped ? "bg-slate-100 dark:bg-slate-800/50 text-slate-600 dark:text-slate-400" : "text-slate-400 dark:text-slate-500")}
                    onDragOver={(e) => { e.preventDefault(); setDragOverUngrouped(true); }}
                    onDragLeave={() => setDragOverUngrouped(false)}
                    onDrop={(e) => { e.preventDefault(); setDragOverUngrouped(false); handleUngroupedDrop(e); }}
                  >
                    <span>{t.ungrouped}</span>
                  </div>
                )}
                <div className="space-y-0.5">
                  {(projectGroups.length > 0 ? ungroupedProjects : customProjects).map(p => (
                    <div key={p.path} draggable onDragStart={(e) => handleProjectDragStart(e, p.path)} className="cursor-grab active:cursor-grabbing">
                      <ProjectItem
                        node={p}
                        expanded={expandedGroups[p.path]}
                        active={selectedFilter.value === p.path}
                        icon={getGTDIcon(p.name)}
                        onToggle={(path) => setExpandedGroups(prev => ({ ...prev, [path]: !prev[path] }))}
                        onSelect={(n) => setSelectedFilter({ type: 'project', value: n.path })}
                        onRename={handleRenameProject}
                        onDelete={handleDeleteProject}
                        onDropTask={handleMoveTaskToProject}
                        getDraggedTaskData={getTaskDataFromTransfer}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </motion.aside>

      {/* Main Content - Bento Canvas */}
      <main className="flex-1 flex flex-col relative min-w-0 z-10">
        <header className="h-20 flex items-center justify-between px-8 shrink-0">
          <div className="flex items-center gap-5">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="min-h-[44px] min-w-[44px] p-2.5 hover:bg-white dark:hover:bg-slate-800 shadow-sm border border-slate-200/50 dark:border-slate-700/50 rounded-xl transition-all touch-manipulation">
              {sidebarOpen ? <ChevronLeft size={18}/> : <Menu size={18}/>}
            </button>
            <div className="flex flex-col">
              <h2 className="font-black text-xl tracking-tight text-slate-800 dark:text-slate-100 leading-none mb-1">
                {activeView === 'stats' ? t.achievementCenter : t.allTasks}
              </h2>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {activeView === 'stats' ? '' : `${filteredTasks.length} ${t.activeProjects}`}
              </span>
            </div>
            {activeView !== 'stats' && (
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => { searchInputRef.current?.focus(); setSearchExpanded(true); }}
                  className="p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition-colors shrink-0"
                  title={t.searchPlaceholder}
                >
                  <Search size={18} />
                </button>
                <input
                  ref={searchInputRef}
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setSearchExpanded(true)}
                  onBlur={() => setSearchExpanded(false)}
                  className={cn(
                    "rounded-xl text-xs font-bold outline-none transition-all duration-200 dark:text-slate-200 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 focus:ring-2 focus:ring-blue-500/20",
                    searchExpanded || searchQuery ? "w-28 pl-2.5 pr-2 py-1.5 opacity-100" : "w-0 p-0 opacity-0 overflow-hidden border-0"
                  )}
                  placeholder={t.searchPlaceholder}
                />
              </div>
            )}
          </div>

          <div className="flex items-center gap-4 bg-white/50 dark:bg-slate-800/50 backdrop-blur-md p-1.5 rounded-2xl border border-white/50 dark:border-slate-700/50 shadow-xl shadow-slate-200/20 dark:shadow-none">
            <div className="px-4 flex items-center gap-3">
               <div className={cn("w-2 h-2 rounded-full", pomoState.isActive ? "bg-rose-500 animate-pulse" : "bg-slate-300 dark:bg-slate-600")}></div>
               <span className="text-sm font-black font-mono tracking-tighter min-w-[3rem]">{formatPomoTime(pomoState.timeLeft)}</span>
            </div>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); pomoState.isActive ? stopPomo() : startPomo(); }}
              className={cn(
                "w-9 h-9 rounded-xl flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg",
                pomoState.isActive ? "bg-amber-500 text-white shadow-amber-500/30" : "bg-blue-600 text-white shadow-blue-500/30"
              )}
              title={pomoState.isActive ? (lang === 'zh' ? '暂停' : 'Pause') : (lang === 'zh' ? '开始专注' : 'Start')}
            >
               {pomoState.isActive ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" />}
            </button>
            {(pomoState.isActive || pomoState.timeLeft !== pomoState.totalSeconds) && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); resetPomo(); }}
                className="w-9 h-9 rounded-xl flex items-center justify-center text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-all"
                title={lang === 'zh' ? '复位' : 'Reset'}
              >
                <Square size={14} strokeWidth={2.5} />
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto px-8 pb-10 custom-scrollbar">
          {activeView === 'stats' ? (
            <div className="max-w-4xl mx-auto w-full p-2">
              {/* GTD 回顾统计：三张概览卡片 */}
              <div className="grid grid-cols-3 gap-6 mb-8">
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                  <div className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t.totalCompleted}</div>
                  <div className="text-4xl font-black text-blue-600 dark:text-blue-400">{statistics.totalCompleted}</div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                  <div className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t.completionRate}</div>
                  <div className="text-4xl font-black text-emerald-500 dark:text-emerald-400">{statistics.completionRate}%</div>
                </div>
                <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-100 dark:border-slate-700 rounded-3xl p-6 shadow-sm">
                  <div className="text-sm font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{t.activeDays}</div>
                  <div className="text-4xl font-black text-amber-500 dark:text-amber-400">{statistics.activeDays}</div>
                </div>
              </div>

              {/* 最近 7 天完成趋势 */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-100 dark:border-slate-700 rounded-3xl p-8 shadow-sm mb-8">
                <h3 className="font-black text-slate-800 dark:text-slate-100 mb-8 flex items-center gap-2">
                  <Zap size={18} className="text-blue-500" /> {t.weeklyTrend}
                </h3>
                <div className="flex items-end justify-between h-48 gap-2 sm:gap-4 px-2">
                  {statistics.weeklyTrend.map(day => (
                    <div key={day.fullDate} className="flex-1 flex flex-col items-center group relative">
                      <div className="absolute -top-10 bg-slate-900 dark:bg-slate-700 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                        {day.count} {lang === 'zh' ? '任务' : 'tasks'}
                      </div>
                      <div
                        className="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-lg transition-all duration-500 group-hover:bg-blue-500"
                        style={{ height: `${Math.max((day.count / statistics.maxWeekCount) * 100, 5)}%` }}
                      />
                      <div className="text-xs font-bold text-slate-400 dark:text-slate-500 mt-3">{day.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* 项目完成分布 */}
              <div className="bg-white/80 dark:bg-slate-800/80 backdrop-blur-xl border border-slate-100 dark:border-slate-700 rounded-3xl p-8 shadow-sm">
                <h3 className="font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                  <ListTodo size={18} className="text-emerald-500" /> {t.projectDistribution}
                </h3>
                <div className="space-y-6">
                  {statistics.projectDistribution.length === 0 ? (
                    <div className="py-12 text-center text-slate-400 dark:text-slate-500 italic">{t.noData}</div>
                  ) : (
                    statistics.projectDistribution.map(p => (
                      <div key={p.name} className="space-y-2">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-slate-700 dark:text-slate-300 truncate mr-2">{p.name}</span>
                          <span className="text-slate-400 shrink-0">{p.completed} / {p.total}</span>
                        </div>
                        <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 dark:bg-emerald-400 transition-all duration-700 rounded-full"
                            style={{ width: `${p.percent}%` }}
                          />
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          ) : (
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
                      data-drop="task-row"
                      data-drop-target-line={String(task.lineIndex)}
                      initial={{ opacity: 0, scale: 0.98, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, x: -20 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      className="relative"
                      onDragOver={!isTauri() ? (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setDragOverTaskIdThrottled(task.id); } : undefined}
                      onDragLeave={!isTauri() ? () => setDragOverTaskIdThrottled(null) : undefined}
                      onDrop={!isTauri() ? (e) => { setDragOverTaskIdThrottled(null); onTaskDrop(e, task.lineIndex); } : undefined}
                    >
                      {isSubtaskDragging && dragOverTaskId === task.id && (
                        <div className="absolute left-0 right-0 -top-1 z-10 h-0.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] pointer-events-none" aria-hidden />
                      )}
                      <TaskCard 
                        task={task}
                        isActive={selectedTaskId === task.id || (selectedSubtaskLineIndex != null && task.subtasks.some(s => s.lineIndex === selectedSubtaskLineIndex))}
                        isBatchMode={isBatchMode}
                        selected={selectedTaskIds.has(task.id)}
                        onToggle={handleToggle}
                        onDelete={handleDeleteTask}
                        onSelect={(id) => {}}
                        onOpenDetail={(t) => { setSelectedTaskId(t.id); setSelectedSubtaskLineIndex(null); }}
                        onOpenSubtaskDetail={(lineIndex) => { setSelectedTaskId(null); setSelectedSubtaskLineIndex(lineIndex); }}
                        onDragStart={onDragStart}
                        onDragEnd={onDragEnd}
                        onMakeSubtask={handleMakeSubtask}
                        onPromoteSubtask={handlePromoteSubtask}
                        isSubtaskDragging={isSubtaskDragging}
                        isPromoteDropTarget={dragOverTaskId === task.id}
                        getDraggedTaskData={getTaskDataFromTransfer}
                        usePointerDrag={isTauri()}
                        onPointerDragStart={startPointerDrag}
                        isDraggingAnyTask={isSubtaskDragging || pointerDragActive}
                      />
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Inspector - Slide Panel */}
      <AnimatePresence>
        {selectedTask && (
          <Inspector 
            task={selectedTask}
            onClose={() => { setSelectedTaskId(null); setSelectedSubtaskLineIndex(null); }}
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
                <section className="space-y-4">
                  <h4 className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest">{t.timezone}</h4>
                  <select
                    value={userTimezone || ''}
                    onChange={(e) => setUserTimezone(e.target.value)}
                    className="w-full p-3 text-sm font-bold rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="">{t.timezoneAuto}</option>
                    <option value="UTC">UTC</option>
                    <option value="Asia/Shanghai">Asia/Shanghai</option>
                    <option value="Asia/Tokyo">Asia/Tokyo</option>
                    <option value="America/New_York">America/New_York</option>
                    <option value="America/Los_Angeles">America/Los_Angeles</option>
                    <option value="Europe/London">Europe/London</option>
                    <option value="Europe/Paris">Europe/Paris</option>
                  </select>
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
