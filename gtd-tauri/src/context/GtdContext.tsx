import React, { createContext, useContext, useState, useEffect, useMemo, useCallback, ReactNode } from 'react';
import { Filter, ViewType } from '../types/gtd';

interface PomoState {
  isActive: boolean;
  timeLeft: number;
  mode: 'work' | 'break';
  totalSeconds: number;
}

interface Toast {
  id: string;
  message: string;
  type: 'info' | 'success' | 'error';
  createdAt: number;
}

interface GtdContextType {
  lang: string;
  setLang: (l: string) => void;
  isDarkMode: boolean;
  setIsDarkMode: (v: boolean) => void;
  userTimezone: string;
  setUserTimezone: (v: string) => void;
  effectiveTimezone: string;
  sidebarOpen: boolean;
  setSidebarOpen: (v: boolean) => void;
  activeView: ViewType;
  setActiveView: (v: ViewType) => void;
  selectedFilter: Filter;
  setSelectedFilter: (f: Filter) => void;
  toasts: Toast[];
  addToast: (msg: string, type?: Toast['type']) => void;
  pomoState: PomoState;
  setPomoState: React.Dispatch<React.SetStateAction<PomoState>>;
  syncStatus: string;
  setSyncStatus: (s: string) => void;
  t: any;
}

const GtdContext = createContext<GtdContextType | undefined>(undefined);

export const GtdProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState(localStorage.getItem('gtd-lang') || 'zh');
  const setLang = useCallback((l: string) => {
    setLangState(l);
    localStorage.setItem('gtd-lang', l);
  }, []);
  const [isDarkMode, setIsDarkMode] = useState(localStorage.getItem('gtd-dark-mode') === 'true');
  const [userTimezone, setUserTimezoneState] = useState(() => {
    const stored = localStorage.getItem('gtd-timezone');
    if (stored !== null) return stored;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  });
  const setUserTimezone = useCallback((tz: string) => {
    setUserTimezoneState(tz);
    localStorage.setItem('gtd-timezone', tz);
  }, []);
  const effectiveTimezone = useMemo(() => {
    if (userTimezone !== '') return userTimezone;
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    } catch {
      return 'UTC';
    }
  }, [userTimezone]);
  const [sidebarOpen, setSidebarOpen] = useState(localStorage.getItem('gtd-sidebar-open') !== 'false');
  const [activeView, setActiveView] = useState<ViewType>('view');
  const [selectedFilter, setSelectedFilter] = useState<Filter>({ type: 'all', value: 'ALL' });
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [syncStatus, setSyncStatus] = useState('synced');
  const [pomoState, setPomoState] = useState<PomoState>({
    isActive: false,
    timeLeft: 25 * 60,
    mode: 'work',
    totalSeconds: 25 * 60
  });

  const translations = useMemo(() => ({
    zh: {
      allTasks: '所有任务', today: '今天', tomorrow: '明天', next7Days: '最近 7 天', calendar: '日历日程',
      tags: '标签', activeProjects: '活跃项目', workflows: '工作流与目录', settings: '设置', language: '语言',
      inbox: '收件箱', nextActions: '下一步行动', waitingFor: '等待确认', somedayMaybe: '将来/也许',
      searchPlaceholder: '快捷搜索...', quickAddPlaceholder: '捕捉灵感 (N)...', batch: '批量操作',
      darkMode: '深色模式', lightMode: '浅色模式', deleteSelected: '项已删除', saving: '同步中...',
      fileManagement: '文件管理', openFile: '打开本地文件', saveFile: '保存更改', saveAs: '另存为',
      setDefault: '设为默认', unsetDefault: '取消默认',
      review: '回顾统计', achievementCenter: '成就中心', totalCompleted: '累计完成', completionRate: '完成率',
      activeDays: '活跃天数', weeklyTrend: '最近 7 天完成趋势', projectDistribution: '项目完成分布',
      noData: '暂无统计数据，开始执行任务吧！',
      newGroup: '新建组', ungrouped: '未分组', deleteGroup: '删除组', renameGroup: '重命名组', confirmDeleteGroup: '确定删除该组？组内项目将变为未分组。',
      timezone: '时区', timezoneAuto: '自动（浏览器）', timezoneDefault: '默认（应用设置）',
      timezoneFixedTime: '固定时间（以当地时间为准）', timezoneFixedTz: '固定时区'
    },
    en: {
      allTasks: 'All Tasks', today: 'Today', tomorrow: 'Tomorrow', next7Days: 'Next 7 Days', calendar: 'Calendar',
      tags: 'Tags', activeProjects: 'Active Projects', workflows: 'Workflows', settings: 'Settings', language: 'Language',
      inbox: 'Inbox', nextActions: 'Next Actions', waitingFor: 'Waiting For', somedayMaybe: 'Someday/Maybe',
      searchPlaceholder: 'Search...', quickAddPlaceholder: 'Quick Add (N)...', batch: 'Batch Actions',
      darkMode: 'Dark Mode', lightMode: 'Light Mode', deleteSelected: 'items deleted', saving: 'Saving...',
      fileManagement: 'File Management', openFile: 'Open Local File', saveFile: 'Save Changes', saveAs: 'Save As...',
      setDefault: 'Set as Default', unsetDefault: 'Unset Default',
      review: 'Review & Stats', achievementCenter: 'Achievement Center', totalCompleted: 'Completed',
      completionRate: 'Success Rate', activeDays: 'Active Days', weeklyTrend: 'Weekly Completion Trend',
      projectDistribution: 'Project Distribution', noData: 'No stats yet. Start getting things done!',
      newGroup: 'New group', ungrouped: 'Ungrouped', deleteGroup: 'Delete group', renameGroup: 'Rename group', confirmDeleteGroup: 'Delete this group? Projects in it will become ungrouped.',
      timezone: 'Timezone', timezoneAuto: 'Auto (browser)', timezoneDefault: 'Default (app setting)',
      timezoneFixedTime: 'Fixed time (use local time)', timezoneFixedTz: 'Fixed timezone'
    }
  }[lang]), [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDarkMode);
    localStorage.setItem('gtd-dark-mode', String(isDarkMode));
  }, [isDarkMode]);

  const TOAST_TTL_MS = 3000;
  const toastTimeoutsRef = React.useRef<ReturnType<typeof setTimeout>[]>([]);
  const addToast = useCallback((message: string, type: Toast['type'] = 'info') => {
    const now = Date.now();
    const id = `${now}-${Math.random().toString(36).slice(2)}`;
    setToasts(prev => {
      const next = [...prev.filter(t => now - t.createdAt < TOAST_TTL_MS + 1000), { id, message, type, createdAt: now }];
      return next.length > 5 ? next.slice(-5) : next;
    });
    const t = setTimeout(() => {
      setToasts(prev => prev.filter(toast => toast.id !== id));
    }, TOAST_TTL_MS);
    toastTimeoutsRef.current.push(t);
  }, []);
  React.useEffect(() => {
    const timeouts = toastTimeoutsRef.current;
    return () => { timeouts.forEach(clearTimeout); toastTimeoutsRef.current = []; };
  }, []);

  const value = {
    lang, setLang, isDarkMode, setIsDarkMode, userTimezone, setUserTimezone, effectiveTimezone, sidebarOpen, setSidebarOpen,
    activeView, setActiveView, selectedFilter, setSelectedFilter,
    toasts, addToast, pomoState, setPomoState, syncStatus, setSyncStatus,
    t: translations
  };

  return <GtdContext.Provider value={value}>{children}</GtdContext.Provider>;
};

export const useGtd = () => {
  const context = useContext(GtdContext);
  if (!context) throw new Error('useGtd must be used within GtdProvider');
  return context;
};
