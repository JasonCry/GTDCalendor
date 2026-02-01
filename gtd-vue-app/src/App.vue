<script setup>
import { 
  CheckCircle2, Circle, Layout, FileText, Plus, Menu, Inbox, Hash, Zap, Coffee, Hourglass, 
  ListTodo, Info, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Clock, Trash2, X, Calendar,
  FolderOpen, Save, RefreshCw, Pin, Search, Eye, EyeOff, Tag, Languages, Settings, Sun, Moon, BarChart2,
  CornerDownRight, Repeat, Cloud, CloudOff, AlertTriangle, Bell, BellRing,
  Timer, Play, Pause, Square, CheckSquare, Layers, Copy, Move, Calendar as CalendarAction
} from 'lucide-vue-next';
import { ref, computed, watch, onMounted, nextTick, shallowRef, onUnmounted } from 'vue';
import { addDays, addWeeks, addMonths, parseISO, format as formatDt, isBefore, isValid } from 'date-fns';
import TaskCard from './components/TaskCard.vue';
import ProjectItem from './components/ProjectItem.vue';
import { saveFileHandle, getFileHandle, removeFileHandle } from './utils/fileStorage';

// --- Utils ---
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

const formatMinutesToTime = (totalMinutes) => {
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
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

// --- State ---
const markdown = ref(localStorage.getItem('gtd-markdown') || DEFAULT_MARKDOWN);
const activeView = ref('view'); 
const calendarMode = ref('day'); 
const selectedFilter = ref({ type: 'all', value: 'ALL' });
const selectedTag = ref(null);
const searchQuery = ref('');
const hideCompleted = ref(false);
const sidebarOpen = ref(localStorage.getItem('gtd-sidebar-open') !== 'false');
const isSettingsOpen = ref(false);
const isLanguageDropdownOpen = ref(false);
const lang = ref(localStorage.getItem('gtd-lang') || 'zh');
const isDarkMode = ref(localStorage.getItem('gtd-dark-mode') === 'true');
const expandedGroups = ref({'📥 收件箱': true, '⚡ 下一步行动': true});
const isSaving = ref(false);
const newTaskInput = ref('');
const viewDate = ref(new Date());
const quickAddDate = ref(null);
const searchInputRef = ref(null);
const mainInputRef = ref(null);

const scrollRef = ref(null);
const currentFileHandle = shallowRef(null);
const lastDiskModified = ref(0);
const fileCheckTimer = ref(null);
const autoSaveTimer = ref(null);
const fileChangedOnDisk = ref(false);
const isDefaultFile = ref(false);
const pendingDefaultHandle = shallowRef(null);

const dropTargetIdx = ref(null);
const activeSubtaskDropIdx = ref(null);

// --- Sync Engine State ---
const syncStatus = ref('synced'); 
const lastSyncedContent = ref(markdown.value);
const syncError = ref('');
const lastSyncTime = ref(Date.now());
const notifiedTasks = ref(new Set());

// --- Pomodoro State ---
const pomoState = ref({
  isActive: false,
  timeLeft: 25 * 60,
  mode: 'work', // 'work', 'break'
  totalSeconds: 25 * 60
});
let pomoTimer = null;

// --- Batch Operations State ---
const isBatchMode = ref(false);
const selectedTaskIds = ref(new Set());

// --- Master-Detail State (V0.0.9) ---
const selectedTaskId = ref(null);
const selectedTask = computed(() => {
  if (!selectedTaskId.value) return null;
  return allTasks.value.find(t => t.id === selectedTaskId.value);
});

const detailForm = ref({
  content: '',
  priority: null,
  tags: '',
  date: '',
  recurrence: null
});

// --- Toast State ---
const toasts = ref([]);
const addToast = (message, type = 'info') => {
  const id = Date.now();
  toasts.value.push({ id, message, type });
  setTimeout(() => {
    toasts.value = toasts.value.filter(t => t.id !== id);
  }, 3000);
};

// --- i18n ---
const t = computed(() => {
  const translations = {
    zh: {
      allTasks: '所有任务',
      today: '今天',
      tomorrow: '明天',
      next7Days: '最近 7 天',
      calendar: '日历日程',
      tags: '标签',
      activeProjects: '活跃项目',
      workflows: '工作流与目录',
      settings: '设置',
      language: '语言',
      fileManagement: '文件管理',
      openFile: '打开本地文件',
      saveFile: '保存更改',
      saveAs: '另存为',
      setDefault: '设为默认',
      unsetDefault: '取消默认',
      saving: '保存中...',
      searchPlaceholder: '搜索 (Ctrl K)...',
      quickAddPlaceholder: '捕捉灵感 (N)...',
      newProject: '新建项目',
      viewSettings: '视图设置',
      hideCompleted: '隐藏已完成',
      all: '全部',
      editTask: '编辑任务详情',
      confirmDelete: '确定要删除项目 "{name}" 及其所有任务吗？',
      timePlaceholder: '这个时段你要做什么？',
      addToSchedule: '确定加入日程',
      allTasksTitle: '所有任务清单',
      projectTitle: '项目清单',
      todayTitle: '今日待办',
      tomorrowTitle: '明日待办',
      weekTitle: '未来 7 天待办',
      inbox: '收件箱',
      nextActions: '下一步行动',
      waitingFor: '等待确认',
      somedayMaybe: '将来/也许',
      darkMode: '深色模式',
      lightMode: '浅色模式',
      review: '回顾统计',
      achievementCenter: '成就中心',
      totalCompleted: '累计完成',
      completionRate: '完成率',
      activeDays: '活跃天数',
      weeklyTrend: '最近 7 天完成趋势',
      projectDistribution: '项目完成分布',
      noData: '暂无统计数据，开始执行任务吧！',
      syncStatus: '同步状态',
      syncing: '正在同步...',
      synced: '已同步',
      syncError: '同步失败',
      syncConflict: '内容冲突，已尝试合并',
      cloudSync: 'iCloud 自动同步',
      shortcuts: '快捷键',
      quickSearch: '全局搜索',
      newTodo: '新建任务',
      pomodoro: '番茄钟',
      work: '专注',
      break: '休息',
      start: '开始',
      stop: '停止',
      batch: '批量',
      selected: '项已选择',
      deleteSelected: '删除选中',
      moveSelected: '迁移到...',
      setDate: '设置日期',
      swipeRightDone: '右滑完成',
      swipeLeftDelete: '左滑删除'
    },
    en: {
      allTasks: 'All Tasks',
      today: 'Today',
      tomorrow: 'Tomorrow',
      next7Days: 'Next 7 Days',
      calendar: 'Calendar',
      tags: 'Tags',
      activeProjects: 'Active Projects',
      workflows: 'Workflows & Folders',
      settings: 'Settings',
      language: 'Language',
      fileManagement: 'File Management',
      openFile: 'Open Local File',
      saveFile: 'Save Changes',
      saveAs: 'Save As...',
      setDefault: 'Set as Default',
      unsetDefault: 'Unset Default',
      saving: 'SAVING...',
      searchPlaceholder: 'Search (Ctrl K)...',
      quickAddPlaceholder: 'Quick Add (N)...',
      newProject: 'New Project',
      viewSettings: 'View Settings',
      hideCompleted: 'Hide Completed',
      all: 'All',
      editTask: 'Edit Task Details',
      confirmDelete: 'Delete project "{name}" and all its tasks?',
      timePlaceholder: 'What are you doing?',
      addToSchedule: 'Add to Schedule',
      allTasksTitle: 'All Tasks',
      projectTitle: 'Project',
      todayTitle: 'Today\'s Tasks',
      tomorrowTitle: 'Tomorrow\'s Tasks',
      weekTitle: 'Next 7 Days',
      inbox: 'Inbox',
      nextActions: 'Next Actions',
      waitingFor: 'Waiting For',
      somedayMaybe: 'Someday/Maybe',
      darkMode: 'Dark Mode',
      lightMode: 'Light Mode',
      review: 'Review & Stats',
      achievementCenter: 'Achievement Center',
      totalCompleted: 'Completed',
      completionRate: 'Success Rate',
      activeDays: 'Active Days',
      weeklyTrend: 'Weekly Completion Trend',
      projectDistribution: 'Project Distribution',
      noData: 'No stats yet. Start getting things done!',
      syncStatus: 'Sync Status',
      syncing: 'Syncing...',
      synced: 'Synced',
      syncError: 'Sync Error',
      syncConflict: 'Conflict merged',
      cloudSync: 'iCloud Auto-Sync',
      shortcuts: 'Shortcuts',
      quickSearch: 'Quick Search',
      newTodo: 'New Todo',
      pomodoro: 'Pomodoro',
      work: 'Focus',
      break: 'Break',
      start: 'Start',
      stop: 'Stop',
      batch: 'Batch',
      selected: 'items selected',
      deleteSelected: 'Delete Selected',
      moveSelected: 'Move to...',
      setDate: 'Set Date',
      swipeRightDone: 'Swipe Right: Done',
      swipeLeftDelete: 'Swipe Left: Delete'
    }
  };
  return translations[lang.value];
});

const getLocalizedName = (name) => {
  if (name.includes('收件箱') || name.toLowerCase().includes('inbox')) return `📥 ${t.value.inbox}`;
  if (name.includes('下一步') || name.toLowerCase().includes('next action')) return `⚡ ${t.value.nextActions}`;
  if (name.includes('等待') || name.toLowerCase().includes('waiting')) return `⏳ ${t.value.waitingFor}`;
  if (name.includes('将来') || name.toLowerCase().includes('someday')) return `☕ ${t.value.somedayMaybe}`;
  return name;
};

const getHeaderTitle = computed(() => {
  if (activeView.value === 'calendar') {
    return lang.value === 'zh' 
      ? `${viewDate.value.getFullYear()}年 ${viewDate.value.getMonth() + 1}月`
      : `${viewDate.value.toLocaleString('en-US', { month: 'long' })} ${viewDate.value.getFullYear()}`;
  }
  if (activeView.value === 'stats') return t.value.achievementCenter;
  const filter = selectedFilter.value;
  if (!filter) return '';
  if (filter.type === 'all') return t.value.allTasksTitle;
  if (filter.type === 'time') {
    if (filter.value === 'today') return t.value.todayTitle;
    if (filter.value === 'tomorrow') return t.value.tomorrowTitle;
    if (filter.value === 'week') return t.value.weekTitle;
  }
  if (filter.type === 'project') {
    const name = filter.value.split(' / ').pop();
    return `${getLocalizedName(name)} ${t.value.projectTitle}`;
  }
  return '';
});

const toggleLang = () => {
  lang.value = lang.value === 'zh' ? 'en' : 'zh';
  localStorage.setItem('gtd-lang', lang.value);
};

// --- File System Actions ---
const verifyPermission = async (fileHandle, withWrite) => {
  const options = {};
  if (withWrite) options.mode = 'readwrite';
  return (await fileHandle.queryPermission(options)) === 'granted' || (await fileHandle.requestPermission(options)) === 'granted';
};

const startFileWatcher = () => {
  if (fileCheckTimer.value) clearInterval(fileCheckTimer.value);
  fileCheckTimer.value = setInterval(async () => {
    if (!currentFileHandle.value || isSaving.value) return;
    try {
      const file = await currentFileHandle.value.getFile();
      if (file.lastModified > lastDiskModified.value + 500) {
        const contents = await file.text();
        if (contents !== markdown.value) {
          syncStatus.value = 'syncing';
          if (markdown.value === lastSyncedContent.value) {
            markdown.value = contents;
            lastSyncedContent.value = contents;
            syncStatus.value = 'synced';
          } else {
            syncStatus.value = 'conflict';
            fileChangedOnDisk.value = true;
            clearInterval(fileCheckTimer.value);
          }
          lastDiskModified.value = file.lastModified;
        }
      }
    } catch(e) { 
      console.error('Sync watcher error:', e); 
      syncStatus.value = 'error';
    }
  }, 3000);
};

const loadFileContent = async (handle) => {
  const file = await handle.getFile();
  const contents = await file.text();
  markdown.value = contents;
  lastSyncedContent.value = contents;
  currentFileHandle.value = handle;
  lastDiskModified.value = file.lastModified;
  fileChangedOnDisk.value = false;
  syncStatus.value = 'synced';
  const defaultHandle = await getFileHandle();
  isDefaultFile.value = defaultHandle && (await handle.isSameEntry(defaultHandle));
  startFileWatcher();
};

const saveToFile = async () => {
  if (!currentFileHandle.value) return;
  syncStatus.value = 'syncing';
  try {
    const writable = await currentFileHandle.value.createWritable();
    await writable.write(markdown.value);
    await writable.close();
    const file = await currentFileHandle.value.getFile();
    lastDiskModified.value = file.lastModified;
    lastSyncedContent.value = markdown.value;
    syncStatus.value = 'synced';
    setIsSaving(false);
  } catch (err) {
    syncStatus.value = 'error';
    syncError.value = err.message;
    setIsSaving(false);
  }
};

const reloadFileFromDisk = async () => {
  if (currentFileHandle.value) await loadFileContent(currentFileHandle.value);
};

// --- Pomodoro Logic ---
const startPomo = () => {
  if (pomoTimer) return;
  if (pomoState.value.timeLeft <= 0) {
    pomoState.value.timeLeft = pomoState.value.mode === 'work' ? 25 * 60 : 5 * 60;
  }
  pomoState.value.isActive = true;
  pomoTimer = setInterval(() => {
    if (pomoState.value.timeLeft > 0) {
      pomoState.value.timeLeft--;
    } else {
      stopPomo();
      const msg = pomoState.value.mode === 'work' ? '专注结束，休息一下吧！' : '休息结束，开始专注！';
      addToast(msg, 'success');
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('番茄钟 | GTD Flow', { body: msg });
      }
      togglePomoMode();
    }
  }, 1000);
};

const stopPomo = () => {
  if (pomoTimer) { clearInterval(pomoTimer); pomoTimer = null; }
  pomoState.value.isActive = false;
};

const resetPomo = () => {
  stopPomo();
  pomoState.value.mode = 'work';
  pomoState.value.timeLeft = 25 * 60;
  pomoState.value.totalSeconds = 25 * 60;
  addToast('番茄钟已重置', 'info');
};

const togglePomoMode = () => {
  const wasActive = pomoState.value.isActive;
  stopPomo();
  pomoState.value.mode = pomoState.value.mode === 'work' ? 'break' : 'work';
  pomoState.value.timeLeft = pomoState.value.mode === 'work' ? 25 * 60 : 5 * 60;
  pomoState.value.totalSeconds = pomoState.value.timeLeft;
  if (wasActive) startPomo();
};

const formatPomoTime = (seconds) => {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// --- Detail Panel Logic (V0.0.9) ---
const openDetail = (task) => {
  selectedTaskId.value = task.id;
  detailForm.value = {
    content: task.content,
    priority: task.priority,
    tags: task.tags.join(' '),
    date: task.date || '',
    recurrence: task.recurrence || null
  };
};

const closeDetail = () => {
  selectedTaskId.value = null;
};

const saveDetailChanges = () => {
  if (!selectedTask.value) return;
  const tagsArray = detailForm.value.tags.split(/\s+/).filter(t => t.length > 0);
  handleUpdateTask(selectedTask.value.lineIndex, {
    content: detailForm.value.content,
    priority: detailForm.value.priority,
    tags: tagsArray,
    date: detailForm.value.date || null,
    recurrence: detailForm.value.recurrence || null
  });
};

watch(detailForm, () => {
  if (selectedTaskId.value) saveDetailChanges();
}, { deep: true });

const datePart = computed({
  get: () => detailForm.value.date ? detailForm.value.date.split(' ')[0] : '',
  set: (val) => {
    const time = timePart.value || '';
    detailForm.value.date = val ? (time ? `${val} ${time}` : val) : (time ? ` ${time}` : '');
  }
});

const timePart = computed({
  get: () => {
    if (!detailForm.value.date) return '';
    const parts = detailForm.value.date.split(' ');
    return parts.length > 1 ? parts[1] : '';
  },
  set: (val) => {
    const date = datePart.value || '';
    if (val) {
      detailForm.value.date = date ? `${date} ${val}` : ` ${val}`;
    } else {
      detailForm.value.date = date;
    }
  }
});

// --- Core Actions ---
const handleToggle = (idx, status) => {
  const lines = markdown.value.split('\n');
  const line = lines[idx];
  if (!line) return;
  
  const tasks = allTasks.value || [];
  const task = tasks.find(t => t.lineIndex === idx);

  if (status) {
    // Unchecking: Remove [x] and ALL existing @done tags
    lines[idx] = line
      .replace(/^- \[x\]/, '- [ ]')
      .replace(/\s*@done\(\d{4}-\d{2}-\d{2}\)/g, '');
  } else {
    // Checking: Remove any stale @done tags first, then add [x] and ONE fresh @done tag
    const cleanLine = line.replace(/\s*@done\(\d{4}-\d{2}-\d{2}\)/g, '');
    const doneTag = ` @done(${getToday()})`;
    lines[idx] = cleanLine.replace(/^- \[ \]/, '- [x]') + doneTag;

    // Handle Recurring Task logic
    if (task && task.recurrence) {
      let nextDate = new Date();
      const baseDate = task.date ? parseISO(task.date.split(' ')[0]) : new Date();
      
      if (task.recurrence === 'day') nextDate = addDays(baseDate, 1);
      else if (task.recurrence === 'week') nextDate = addWeeks(baseDate, 1);
      else if (task.recurrence === 'month') nextDate = addMonths(baseDate, 1);

      const nextDateStr = formatDt(nextDate, 'yyyy-MM-dd');
      const timePart = task.date && task.date.includes(' ') ? ' ' + task.date.split(' ')[1] : '';
      
      let newTaskLine = `- [ ] ${task.content}`;
      if (task.priority) newTaskLine += ` !${task.priority}`;
      newTaskLine += ` @${nextDateStr}${timePart}`;
      newTaskLine += ` @every(${task.recurrence})`;
      if (task.tags && task.tags.length) newTaskLine += ` ${task.tags.map(tg => '#' + tg).join(' ')}`;

      lines.splice(idx + (task.lineCount || 1), 0, newTaskLine);
    }
  }
  markdown.value = lines.join('\n');
};

const addTask = (dateInfo = null) => {
  if (!newTaskInput.value.trim()) return;
  const lines = markdown.value.split('\n');
  let text = newTaskInput.value.trim();
  let date = dateInfo;

  // 1. Inherit date from smart time filters
  if (!date && selectedFilter.value.type === 'time') {
    if (selectedFilter.value.value === 'today') date = getToday();
    else if (selectedFilter.value.value === 'tomorrow') date = formatDate(addDays(new Date(), 1));
  }

  // 2. Basic NLP
  if (!date) {
    if (text.includes('今天')) { date = getToday(); text = text.replace('今天', '').trim(); }
    else if (text.includes('明天')) { date = formatDate(addDays(new Date(), 1)); text = text.replace('明天', '').trim(); }
  }

  let content = `- [ ] ${text}`;
  if (date) content += ` @${date}`;
  
  let insertIdx = -1;
  if (selectedFilter.value.type === 'project') {
      const projectName = selectedFilter.value.value.split(' / ').pop().trim();
      insertIdx = lines.findIndex(l => l.startsWith('#') && l.replace(/^#+\s*/, '').trim() === projectName) + 1;
  } else {
      insertIdx = lines.findIndex(l => l.includes('收件箱') || l.toLowerCase().includes('inbox')) + 1;
  }

  if (insertIdx <= 0) insertIdx = lines.findIndex(l => l.startsWith('#')) + 1;
  if (insertIdx <= 0) { 
    lines.push(`# 📥 ${t.value.inbox}`, content); 
  } else { 
    lines.splice(insertIdx, 0, content); 
  } 
  
  markdown.value = lines.join('\n');
  newTaskInput.value = '';
};

const handleToggleSubtask = (subIdx, status) => {
  const lines = markdown.value.split('\n');
  if (!lines[subIdx]) return;
  lines[subIdx] = status ? lines[subIdx].replace('- [x]', '- [ ]') : lines[subIdx].replace('- [ ]', '- [x]');
  markdown.value = lines.join('\n');
};

const handleUpdateTask = (lineIndex, updates) => {
  const lines = markdown.value.split('\n');
  const task = allTasks.value.find(t => t.lineIndex === parseInt(lineIndex));
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
  if (newTags?.length) newLine += ` ${newTags.map(t => '#' + t).join(' ')}`;
  lines[lineIndex] = newLine;
  markdown.value = lines.join('\n');
};

const handleDeleteTask = (idx) => {
  const lines = markdown.value.split('\n');
  lines.splice(idx, 1);
  markdown.value = lines.join('\n');
  if (selectedTaskId.value && allTasks.value[idx]?.id === selectedTaskId.value) closeDetail();
  addToast(lang.value === 'zh' ? '任务已删除' : 'Task deleted', 'info');
};

const handleMoveTaskToProject = (idx, targetPath) => {
  const lines = markdown.value.split('\n');
  const task = allTasks.value.find(t => t.lineIndex === idx);
  if (!task) return;
  const taskLines = lines.splice(idx, task.lineCount || 1);
  const targetName = targetPath.split(' / ').pop().trim();
  const targetLevel = targetPath.split(' / ').length;
  let projectIdx = lines.findIndex(l => l.startsWith('#') && l.replace(/^#+\s*/, '').trim() === targetName && (l.match(/^#+/) || ['#'])[0].length === targetLevel);
  if (projectIdx !== -1) lines.splice(projectIdx + 1, 0, ...taskLines);
  markdown.value = lines.join('\n');
};

const handleAddProject = () => {
  const lines = markdown.value.split('\n');
  lines.push('', '# 新建项目');
  markdown.value = lines.join('\n');
  addToast(lang.value === 'zh' ? '新建项目成功' : 'Project added', 'success');
};

const handleUpdateProject = (oldPath, newName) => {
  const lines = markdown.value.split('\n');
  const pathParts = oldPath.split(' / ');
  const oldName = pathParts[pathParts.length - 1];
  const level = pathParts.length;
  const index = lines.findIndex(l => l.startsWith('#') && l.replace(/^#+\s*/, '').trim() === oldName && (l.match(/^#+/) || ['#'])[0].length === level);
  if (index !== -1) {
    lines[index] = '#'.repeat(level) + ' ' + newName;
    markdown.value = lines.join('\n');
  }
};

const handleDeleteProject = (path) => {
  if (!confirm(`确定要删除项目 "${path}" 及其所有任务吗？`)) return;
  const lines = markdown.value.split('\n');
  const pathParts = path.split(' / ');
  const name = pathParts[pathParts.length - 1];
  const level = pathParts.length;
  const startIndex = lines.findIndex(l => l.startsWith('#') && l.replace(/^#+\s*/, '').trim() === name && (l.match(/^#+/) || ['#'])[0].length === level);
  if (startIndex === -1) return;
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('#') && (lines[i].match(/^#+/) || ['#'])[0].length <= level) {
      endIndex = i; break;
    }
  }
  lines.splice(startIndex, endIndex - startIndex);
  markdown.value = lines.join('\n');
  if (selectedFilter.value.value === path) selectedFilter.value = { type: 'all', value: 'ALL' };
  addToast(lang.value === 'zh' ? '项目已删除' : 'Project deleted', 'info');
};

const handleMakeSubtask = (sourceIdx, targetIdx) => {
  const sourceTask = parsedData.value.allTasks.find(t => t.lineIndex === parseInt(sourceIdx));
  if (!sourceTask || sourceIdx === targetIdx) return;
  const lines = markdown.value.split('\n');
  const taskLines = lines.splice(sourceIdx, sourceTask.lineCount || 1);
  let adjustedTargetIdx = parseInt(targetIdx);
  if (sourceIdx < targetIdx) adjustedTargetIdx -= (sourceTask.lineCount || 1);
  let insertionPoint = adjustedTargetIdx + 1;
  while (insertionPoint < lines.length) {
    const line = lines[insertionPoint];
    if (line.trim().startsWith('#') || (line.startsWith('- [') && !line.startsWith(' ') && !line.startsWith('\t'))) break;
    insertionPoint++;
  }
  const indentedLines = taskLines.map(l => {
    return '  ' + l.trimStart().replace(/\s*@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '');
  });
  lines.splice(insertionPoint, 0, ...indentedLines);
  markdown.value = lines.join('\n');
  addToast(lang.value === 'zh' ? '已成功建立子任务并缩进' : 'Subtask created', 'success');
};

const handleBatchDelete = () => {
  if (!confirm(`确定要批量删除这 ${selectedTaskIds.value.size} 个任务吗？`)) return;
  const lines = markdown.value.split('\n');
  const sortedIndices = Array.from(selectedTaskIds.value).map(id => allTasks.value.find(t => t.id === id)?.lineIndex).filter(i => i !== undefined).sort((a, b) => b - a);
  sortedIndices.forEach(idx => lines.splice(idx, 1));
  markdown.value = lines.join('\n');
  selectedTaskIds.value.clear(); isBatchMode.value = false;
  addToast('批量删除成功', 'info');
};

const handleBatchSetDate = (newDate) => {
  Array.from(selectedTaskIds.value).forEach(id => {
    const task = allTasks.value.find(t => t.id === id);
    if (task) handleUpdateTask(task.lineIndex, { date: newDate });
  });
  selectedTaskIds.value.clear(); isBatchMode.value = false;
  addToast('批量设置日期成功', 'success');
};

// --- UI Actions ---
const toggleSidebar = () => {
  sidebarOpen.value = !sidebarOpen.value;
  localStorage.setItem('gtd-sidebar-open', sidebarOpen.value);
};

const handleGlobalKeydown = (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'k') { e.preventDefault(); activeView.value = 'view'; nextTick(() => searchInputRef.value?.focus()); }
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') { if (e.key === 'Escape') { e.target.blur(); searchQuery.value = ''; } return; }
  if (e.key === 'n' || e.key === 'N') { e.preventDefault(); activeView.value = 'view'; nextTick(() => mainInputRef.value?.focus()); }
  if (e.key === 's' || e.key === 'S') toggleSidebar();
  if (e.key === 'b' || e.key === 'B') { isBatchMode.value = !isBatchMode.value; selectedTaskIds.value.clear(); }
};

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('gtd-dark-mode', isDarkMode.value);
};

watch(isDarkMode, (val) => {
  document.documentElement.classList.toggle('dark', val);
}, { immediate: true });

const vClickOutside = {
  mounted(el, binding) { el.clickOutsideEvent = (event) => { if (!(el === event.target || el.contains(event.target))) binding.value(event); }; document.addEventListener('click', el.clickOutsideEvent); },
  unmounted(el) { document.removeEventListener('click', el.clickOutsideEvent); },
};

const getGTDIcon = (name) => {
  if (name.includes('收件箱')) return Inbox;
  if (name.includes('下一步')) return Zap;
  if (name.includes('等待')) return Hourglass;
  if (name.includes('将来')) return Coffee;
  return Hash;
};

const getGTDTips = (name) => {
  if (name.includes('收件箱')) return "【收集】清空大脑！把所有任务先扔到这里。";
  if (name.includes('下一步')) return "【行动】明确的、可以立即开始的任务。";
  if (name.includes('等待')) return "【回顾】指派给他人或需等待条件的任务。";
  if (name.includes('将来')) return "【孵化】现在不急着做，留待将来 review 的事。";
  return "项目分类：将相关联的任务组织在一起。";
};

// --- Computed Data Engine ---
const parsedData = computed(() => {
  const currentLang = lang.value;
  const lines = markdown.value.split('\n');
  const root = { name: 'Root', children: [], tasks: [], level: 0, path: '' };
  const stack = [root];
  const all = [];
  let currentTask = null;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed === '') { currentTask = null; return; }
    if (trimmed.startsWith('#')) {
      currentTask = null;
      const level = (trimmed.match(/^#+/) || ['#'])[0].length;
      const nodeName = trimmed.replace(/^#+\s*/, '').trim();
      const node = { name: nodeName, displayName: getLocalizedName(nodeName), children: [], tasks: [], level, path: '' };
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack[stack.length - 1];
      node.path = parent.path ? `${parent.path} / ${nodeName}` : nodeName;
      parent.children.push(node); stack.push(node);
    } else if (currentTask && (line.startsWith('  ') || line.startsWith('\t'))) {
      if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
        const cleanContent = trimmed
          .replace(/^- \[[ x]\]\s*/, '')
          .replace(/@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '')
          .replace(/@done\(\d{4}-\d{2}-\d{2}\)/, '')
          .replace(/@every\((day|week|month)\)/, '')
          .replace(/![1-3]/, '')
          .replace(/#[^\s#]+/g, '')
          .trim();
        currentTask.subtasks.push({ content: cleanContent, completed: trimmed.startsWith('- [x]'), lineIndex: index });
      } else currentTask.notes.push(trimmed);
      currentTask.lineCount++;
    } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      const dateMatch = trimmed.match(/@(\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?)/);
      const doneMatch = trimmed.match(/@done\((\d{4}-\d{2}-\d{2})\)/);
      const everyMatch = trimmed.match(/@every\((day|week|month)\)/);
      const priorityMatch = trimmed.match(/!([1-3])/);
      const tagsMatch = trimmed.match(/#([^\s#]+)/g);
      const task = {
        id: `task-${index}`, lineIndex: index, lineCount: 1, content: trimmed.replace(/^- \[[ x]\]\s*/, '').replace(/@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '').replace(/@done\(\d{4}-\d{2}-\d{2}\)/, '').replace(/@every\((day|week|month)\)/, '').replace(/![1-3]/, '').replace(/#[^\s#]+/g, '').trim(),
        completed: trimmed.startsWith('- [x]'), date: dateMatch ? dateMatch[1] : null, doneDate: doneMatch ? doneMatch[1] : null, recurrence: everyMatch ? everyMatch[1] : null, priority: priorityMatch ? parseInt(priorityMatch[1]) : null, tags: tagsMatch ? tagsMatch.map(t => t.substring(1)) : [], projectPath: stack[stack.length - 1].path, notes: [], subtasks: []
      };
      stack[stack.length - 1].tasks.push(task); all.push(task); currentTask = task;
    } else currentTask = null;
  });

  const calculateStats = (node) => {
    let incomplete = (node.tasks || []).filter(t => !t.completed).length;
    (node.children || []).forEach(child => { incomplete += calculateStats(child).incomplete; });
    node.incompleteCount = incomplete; return { incomplete };
  };
  root.children.forEach(calculateStats);
  return { projects: root.children, allTasks: all };
});

const projects = computed(() => parsedData.value?.projects || []);
const allTasks = computed(() => parsedData.value?.allTasks || []);

const filteredTasks = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const filter = selectedFilter.value;
  const tag = selectedTag.value;
  const today = getToday();
  const tomorrow = formatDate(addDays(new Date(), 1));
  const nextWeek = formatDate(addDays(new Date(), 7));

  return (allTasks.value || []).filter(t => {
    let matchFilter = true;
    if (filter.type === 'project') matchFilter = t.projectPath.startsWith(filter.value);
    else if (filter.type === 'time') {
      if (filter.value === 'today') matchFilter = t.date && isDateInRange(today, t.date);
      else if (filter.value === 'tomorrow') matchFilter = t.date && isDateInRange(tomorrow, t.date);
      else if (filter.value === 'week') matchFilter = t.date && t.date.split(' ')[0] >= today && t.date.split(' ')[0] <= nextWeek;
    }
    const tagMatch = !tag || t.tags.includes(tag);
    const searchMatch = !query || t.content.toLowerCase().includes(query) || t.projectPath.toLowerCase().includes(query) || t.tags.some(tg => tg.toLowerCase().includes(query));
    const completedMatch = !hideCompleted.value || !t.completed;
    return matchFilter && tagMatch && searchMatch && completedMatch;
  });
});

const activeProjects = computed(() => {
  const coreCategories = ['收件箱', '下一步行动', '等待确认', '将来/也许'];
  const findActive = (nodes) => {
    let active = [];
    nodes.forEach(node => {
      const isCore = coreCategories.some(cat => node.path === cat || node.name.includes(cat));
      if (node.incompleteCount > 0 && !isCore) active.push(node);
      active = active.concat(findActive(node.children));
    });
    return active;
  };
  return findActive(projects.value);
});

const allTags = computed(() => {
  const tags = new Set();
  (allTasks.value || []).forEach(t => t.tags.forEach(tag => tags.add(tag)));
  return Array.from(tags).sort();
});

const calendarDays = computed(() => {
  const days = [];
  const tasks = allTasks.value || [];
  if (calendarMode.value === 'month') {
    const year = viewDate.value.getFullYear(); const month = viewDate.value.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const d = formatDate(new Date(year, month, i));
      days.push({ date: d, day: i, tasks: tasks.filter(t => isDateInRange(d, t.date)) });
    }
  } else if (calendarMode.value === 'week') {
    const start = getStartOfWeek(viewDate.value);
    for (let i = 0; i < 7; i++) {
      const d = addDays(start, i); const ds = formatDate(d);
      days.push({ date: ds, day: d.getDate(), tasks: tasks.filter(t => isDateInRange(ds, t.date)) });
    }
  } else if (calendarMode.value === 'day') {
    const ds = formatDate(viewDate.value);
    days.push({ date: ds, day: viewDate.value.getDate(), tasks: tasks.filter(t => isDateInRange(ds, t.date)) });
  }
  return days;
});

const toggleTaskSelection = (id) => {
  if (selectedTaskIds.value.has(id)) selectedTaskIds.value.delete(id);
  else selectedTaskIds.value.add(id);
};

// --- Notifications ---
const requestNotificationPermission = async () => {
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission();
  }
};

const checkNotifications = () => {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const now = new Date();
  allTasks.value.forEach(task => {
    if (task.completed || !task.date?.includes(' ') || notifiedTasks.value.has(task.id)) return;
    try {
      const taskTime = parseISO(task.date.replace(' ', 'T'));
      const diffMinutes = (taskTime - now) / (1000 * 60);
      if (diffMinutes > 0 && diffMinutes <= 10) {
        new Notification('任务提醒 | GTD Flow', { body: `任务 "${task.content}" 即将开始 (${task.date.split(' ')[1]})` });
        notifiedTasks.value.add(task.id);
        addToast(`提醒: ${task.content}`, 'info');
      }
    } catch (e) { console.error(e); }
  });
};

const notificationTimer = ref(null);

onMounted(async () => {
  window.addEventListener('keydown', handleGlobalKeydown);
  requestNotificationPermission();
  notificationTimer.value = setInterval(checkNotifications, 60000);
  window.addEventListener('click', (e) => { if (!e.target.closest('.relative')) isLanguageDropdownOpen.value = false; });
  try {
    const defaultHandle = await getFileHandle();
    if (defaultHandle) {
      if (await verifyPermission(defaultHandle, true)) await loadFileContent(defaultHandle);
      else pendingDefaultHandle.value = defaultHandle;
    }
  } catch (e) { console.error('Error loading default file:', e); }
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleGlobalKeydown);
  clearInterval(notificationTimer.value);
  clearInterval(fileCheckTimer.value);
});

const onDragStart = (e, task) => { e.dataTransfer.setData('task', JSON.stringify(task)); e.dataTransfer.effectAllowed = 'move'; };
const onDragOver = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; };
const onDrop = (e, dayDate) => {
  const taskData = JSON.parse(e.dataTransfer.getData('task'));
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const minutesTotal = Math.floor(y); 
  const snappedMinutes = Math.round(minutesTotal / 15) * 15;
  const timeStr = formatMinutesToTime(Math.min(snappedMinutes, 1425));
  if (dayDate) moveTask(taskData.lineIndex, dayDate, timeStr);
};

const onSidebarDrop = (e, targetPath) => {
  try {
    const taskData = JSON.parse(e.dataTransfer.getData('task'));
    handleMoveTaskToProject(taskData.lineIndex, targetPath);
  } catch (err) {
    console.error('Sidebar drop error:', err);
  }
};

const onTaskDrop = (e, targetLineIdx) => {
  dropTargetIdx.value = null;
  try {
    const taskData = JSON.parse(e.dataTransfer.getData('task'));
    const sourceIdx = parseInt(taskData.lineIndex);
    const targetIdx = parseInt(targetLineIdx);
    if (isNaN(sourceIdx) || isNaN(targetIdx) || sourceIdx === targetIdx) return;

    const lines = markdown.value.split('\n');
    const sourceTask = allTasks.value.find(t => t.lineIndex === sourceIdx);
    if (!sourceTask) return;

    const lineCount = sourceTask.lineCount || 1;
    const taskLines = lines.splice(sourceIdx, lineCount);
    let finalTargetIdx = targetIdx;
    if (sourceIdx < targetIdx) {
      finalTargetIdx = targetIdx - lineCount;
    }
    lines.splice(finalTargetIdx, 0, ...taskLines);
    markdown.value = lines.join('\n');
  } catch (err) {
    console.error('Task reorder error:', err);
  }
};

const onSubtaskDropOnZone = (e, targetLineIdx) => {
  activeSubtaskDropIdx.value = null;
  try {
    const taskData = JSON.parse(e.dataTransfer.getData('task'));
    handleMakeSubtask(taskData.lineIndex, targetLineIdx);
  } catch (err) {
    console.error('Subtask drop error:', err);
  }
};
const loadPendingDefault = async () => {
  if (pendingDefaultHandle.value && await verifyPermission(pendingDefaultHandle.value, true)) {
    await loadFileContent(pendingDefaultHandle.value);
    pendingDefaultHandle.value = null;
  }
};

const toggleDefaultFile = async () => {
  if (!currentFileHandle.value) return;
  if (isDefaultFile.value) { await removeFileHandle(); isDefaultFile.value = false; }
  else { await saveFileHandle(currentFileHandle.value); isDefaultFile.value = true; }
};

const handleOpenFile = async () => {
  try {
    const [handle] = await window.showOpenFilePicker({ types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } }], multiple: false });
    await loadFileContent(handle);
  } catch (err) { if (err.name !== 'AbortError') console.error(err); }
};

const handleSaveAs = async () => {
  try {
    const handle = await window.showSaveFilePicker({ types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } }] });
    const writable = await handle.createWritable(); await writable.write(markdown.value); await writable.close();
    await loadFileContent(handle);
  } catch (err) { console.error(err); }
};

const handleSaveFile = async () => {
  if (!currentFileHandle.value) return handleSaveAs();
  setIsSaving(true); await saveToFile();
};

</script>

<template>
  <div class="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none" @mouseup="handleGlobalMouseUp">
    <!-- Sidebar -->
    <div :class="[sidebarOpen ? 'w-64' : 'w-0', 'bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex flex-col overflow-hidden z-20']">
      <div class="p-6 flex items-center justify-between shrink-0">
         <div class="relative">
           <div @click.stop="isLanguageDropdownOpen = !isLanguageDropdownOpen" class="flex items-center gap-3 font-black text-xl text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-2 -m-2 rounded-xl transition-all">
             <CheckCircle2 class="w-8 h-8" /> <span>GTD Flow</span>
             <ChevronDown :size="16" class="text-slate-400" />
           </div>
           
           <div v-if="isLanguageDropdownOpen" v-click-outside="() => isLanguageDropdownOpen = false" class="absolute left-0 mt-4 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
             <button @click="toggleLang(); isLanguageDropdownOpen = false" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
               <Languages :size="18" class="text-slate-400"/> {{ lang === 'zh' ? 'English' : '中文' }}
             </button>
             <button @click="toggleDarkMode(); isLanguageDropdownOpen = false" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
               <component :is="isDarkMode ? Sun : Moon" :size="18" class="text-slate-400"/> {{ isDarkMode ? t.lightMode : t.darkMode }}
             </button>
             <button @click="isSettingsOpen = true; isLanguageDropdownOpen = false" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
               <Settings :size="18" class="text-slate-400"/> {{ t.settings }}
             </button>
           </div>
         </div>
         
         <div class="flex items-center gap-3">
            <div v-if="currentFileHandle" class="flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all" :class="[syncStatus === 'syncing' ? 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800' : syncStatus === 'conflict' ? 'text-amber-500 bg-amber-50 dark:bg-amber-900/20 border-amber-100 dark:border-amber-800 cursor-pointer' : syncStatus === 'error' ? 'text-red-500 bg-red-50 dark:bg-red-900/20 border-red-100 dark:border-red-800 cursor-pointer' : 'text-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 border-emerald-100 dark:border-emerald-800']" @click="syncStatus === 'conflict' || syncStatus === 'error' ? reloadFileFromDisk() : null">
               <RefreshCw v-if="syncStatus === 'syncing'" :size="12" class="animate-spin" />
               <AlertTriangle v-else-if="syncStatus === 'conflict'" :size="12" />
               <CloudOff v-else-if="syncStatus === 'error'" :size="12" />
               <Cloud v-else :size="12" />
               <span class="text-[9px] font-black uppercase tracking-tighter">{{ syncStatus === 'syncing' ? t.syncing : syncStatus === 'conflict' ? 'Conflict' : syncStatus === 'error' ? 'Error' : 'Synced' }}</span>
            </div>
            <div class="px-2 py-1 rounded text-[10px] font-bold border" :class="isSaving ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100'">{{ isSaving ? t.saving : 'V0.2.0' }}</div>
         </div>
      </div>
      
      <div class="flex-1 overflow-y-auto px-4 space-y-6 pb-10 scroll-smooth custom-scrollbar">
        <div class="px-4 mt-2">
          <div class="relative group">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500 group-focus-within:text-blue-500" :size="14"/>
            <input ref="searchInputRef" v-model="searchQuery" class="w-full pl-9 pr-12 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all dark:text-slate-200" :placeholder="t.searchPlaceholder" />
            <div class="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <span class="text-[9px] font-black text-slate-300 dark:text-slate-600 border border-slate-200 dark:border-slate-700 px-1 rounded">Ctrl K</span>
              <button v-if="searchQuery" @click="searchQuery = ''" class="text-slate-300 hover:text-slate-50 dark:text-slate-500 dark:hover:text-slate-300"><X :size="12"/></button>
            </div>
          </div>
        </div>

        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">{{ t.allTasks }}</div>
          <div @click="selectedFilter = {type: 'all', value: 'ALL'}; activeView = 'view'" class="flex items-center justify-between px-4 py-2 cursor-pointer rounded-xl transition-all group" :class="selectedFilter.type === 'all' && activeView === 'view' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'">
            <div class="flex items-center gap-3">
              <ListTodo :size="20" :class="selectedFilter.type === 'all' && activeView === 'view' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/>
              <span class="text-sm font-bold">{{ t.allTasks }}</span>
            </div>
            <button @click.stop="hideCompleted = !hideCompleted" class="p-1.5 rounded-lg transition-colors hover:bg-white/20" :title="hideCompleted ? '显示已完成' : '隐藏已完成'"><component :is="hideCompleted ? EyeOff : Eye" :size="16" :class="selectedFilter.type === 'all' && activeView === 'view' ? 'text-blue-200' : 'text-slate-300 dark:text-slate-600'"/></button>
          </div>
          <div @click="selectedFilter = {type: 'time', value: 'today'}; activeView = 'view'" class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group" :class="selectedFilter.type === 'time' && selectedFilter.value === 'today' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'"><Sun :size="20" :class="selectedFilter.type === 'time' && selectedFilter.value === 'today' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/><span class="text-sm font-bold">{{ t.today }}</span></div>
          <div @click="selectedFilter = {type: 'time', value: 'tomorrow'}; activeView = 'view'" class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group" :class="selectedFilter.type === 'time' && selectedFilter.value === 'tomorrow' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'"><Calendar :size="20" :class="selectedFilter.type === 'time' && selectedFilter.value === 'tomorrow' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/><span class="text-sm font-bold">{{ t.tomorrow }}</span></div>
          <div @click="selectedFilter = {type: 'time', value: 'week'}; activeView = 'view'" class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group" :class="selectedFilter.type === 'time' && selectedFilter.value === 'week' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'"><CalendarDays :size="20" :class="selectedFilter.type === 'time' && selectedFilter.value === 'week' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/><span class="text-sm font-bold">{{ t.next7Days }}</span></div>
          <div @click="activeView = 'calendar'" class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group" :class="activeView === 'calendar' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'"><Calendar :size="20" :class="activeView === 'calendar' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/><span class="text-sm font-bold">{{ t.calendar }}</span></div>
          <div @click="activeView = 'stats'" class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group" :class="activeView === 'stats' ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'"><BarChart2 :size="20" :class="activeView === 'stats' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/><span class="text-sm font-bold">{{ t.review }}</span></div>
        </nav>

        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 mt-6 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">标签</div>
          <div class="flex flex-wrap gap-1.5 px-4 py-1">
            <button v-for="tag in allTags" :key="tag" @click="selectedTag = tag === selectedTag ? null : tag" class="px-2 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1" :class="selectedTag === tag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'">#{{ tag }}</button>
          </div>
        </nav>
        
        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 mt-6 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">活跃项目 ({{ activeProjects.length }})</div>
          <div v-for="p in activeProjects" :key="p.path" @click="selectedFilter = {type: 'project', value: p.path}; activeView = 'view'" @dragover="onDragOver($event); activeProjectsDragOver = p.path" @dragleave="activeProjectsDragOver = null" @drop="activeProjectsDragOver = null; onSidebarDrop($event, p.path)" class="flex items-center gap-3 px-4 py-1.5 cursor-pointer rounded-xl transition-all group border-2 border-transparent" :class="[selectedFilter.type === 'project' && selectedFilter.value === p.path ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50', activeProjectsDragOver === p.path ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : '']"><div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div><span class="text-sm font-bold truncate flex-1">{{ p.displayName }}</span><span class="text-[10px] font-bold text-slate-400 dark:text-slate-500">{{ p.incompleteCount }}</span></div>
        </nav>

        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 mt-6 flex items-center justify-between gap-2"><span class="flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">工作流与目录</span><button @click="handleAddProject" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-blue-500 transition-colors"><Plus :size="16"/></button></div>
          <template v-for="p in projects" :key="p.path">
            <ProjectItem :node="p" :expanded="expandedGroups[p.path]" :icon="getGTDIcon(p.name)" :tip="getGTDTips(p.name)" :active="selectedFilter.type === 'project' && selectedFilter.value === p.path && activeView === 'view'" @toggle="expandedGroups[p.path] = !expandedGroups[p.path]" @select="(node) => { selectedFilter = {type: 'project', value: node.path}; activeView = 'view'; }" @rename="handleUpdateProject" @delete="handleDeleteProject" @drop-task="handleMoveTaskToProject" />
          </template>
        </nav>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex min-w-0 bg-slate-50 dark:bg-slate-900 relative">
      <!-- Master: Task List -->
      <div class="flex-1 flex flex-col min-w-0 border-r border-slate-200 dark:border-slate-700 relative">
        <header class="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-10">
          <div class="flex items-center gap-4">
            <button @click="toggleSidebar" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500">
              <Menu v-if="!sidebarOpen" :size="20"/><ChevronLeft v-else :size="20"/>
            </button>
            <h2 class="font-bold text-lg text-slate-700 dark:text-slate-200 truncate">{{ getHeaderTitle }}</h2>
          </div>
          
          <div class="flex items-center gap-4">
            <div class="flex items-center gap-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 p-1 pl-3 rounded-xl shadow-sm">
                <div class="flex items-center gap-2 cursor-pointer" @click="togglePomoMode">
                    <div class="w-2 h-2 rounded-full" :class="[pomoState.mode === 'work' ? 'bg-red-500' : 'bg-emerald-500', pomoState.isActive ? 'animate-pulse' : '']"></div>
                    <span class="text-xs font-mono font-black text-slate-700 dark:text-slate-200">{{ formatPomoTime(pomoState.timeLeft) }}</span>
                </div>
                <div class="flex items-center gap-0.5">
                  <button @click="pomoState.isActive ? stopPomo() : startPomo()" class="w-8 h-8 rounded-lg flex items-center justify-center transition-all" :class="pomoState.isActive ? 'text-amber-500' : 'text-emerald-600'"><Pause v-if="pomoState.isActive" :size="16" class="fill-current"/><Play v-else :size="16" class="fill-current ml-0.5"/></button>
                  <button v-if="pomoState.isActive || pomoState.timeLeft !== pomoState.totalSeconds" @click="resetPomo" class="w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-red-50"><Square :size="14" class="fill-current"/></button>
                </div>
            </div>
            <button @click="activeView = (activeView === 'code' ? 'view' : 'code')" class="p-2 bg-slate-900 text-white rounded-xl"><Layout v-if="activeView === 'code'" :size="16"/><FileText v-else :size="16"/></button>
          </div>
        </header>

        <main class="flex-1 overflow-hidden flex flex-col relative scroll-smooth custom-scrollbar">
          <div v-if="activeView === 'stats'" class="flex-1 overflow-y-auto p-8 max-w-4xl mx-auto w-full">
              <div class="grid grid-cols-3 gap-6 mb-8">
                  <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"><div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{{ t.totalCompleted }}</div><div class="text-4xl font-black text-blue-600 dark:text-blue-400">{{ statistics.totalCompleted }}</div></div>
                  <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"><div class="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">{{ t.completionRate }}</div><div class="text-4xl font-black text-emerald-500 dark:text-emerald-400">{{ statistics.completionRate }}%</div></div>
                  <div class="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm"><div class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">{{ t.activeDays }}</div><div class="text-4xl font-black text-amber-500 dark:text-amber-400">{{ statistics.activeDays }}</div></div>
              </div>

              <!-- Weekly Trend Bar Chart -->
              <div class="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                  <h3 class="font-black text-slate-800 dark:text-slate-100 mb-8 flex items-center gap-2">
                      <Zap :size="18" class="text-blue-500"/> {{ t.weeklyTrend }}
                  </h3>
                  <div class="flex items-end justify-between h-48 gap-2 sm:gap-4 px-2">
                      <div v-for="day in statistics.weeklyTrend" :key="day.fullDate" class="flex-1 flex flex-col items-center group relative">
                          <div class="absolute -top-10 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                              {{ day.count }} 任务
                          </div>
                          <div 
                              class="w-full bg-blue-100 dark:bg-blue-900/30 rounded-t-lg transition-all duration-500 group-hover:bg-blue-500"
                              :style="{ height: `${Math.max((day.count / (Math.max(...statistics.weeklyTrend.map(d => d.count)) || 1)) * 100, 5)}%` }"
                          ></div>
                          <div class="text-[10px] font-bold text-slate-400 dark:text-slate-500 mt-3">{{ day.label }}</div>
                      </div>
                  </div>
              </div>

              <!-- Project Distribution -->
              <div class="bg-white dark:bg-slate-800 p-8 rounded-3xl border border-slate-100 dark:border-slate-700 shadow-sm">
                  <h3 class="font-black text-slate-800 dark:text-slate-100 mb-6 flex items-center gap-2">
                      <ListTodo :size="18" class="text-emerald-500"/> {{ t.projectDistribution }}
                  </h3>
                  <div class="space-y-6">
                      <div v-for="p in statistics.projectDistribution" :key="p.name" class="space-y-2">
                          <div class="flex justify-between text-xs font-bold">
                              <span class="text-slate-700 dark:text-slate-300">{{ p.name }}</span>
                              <span class="text-slate-400">{{ p.completed }} / {{ p.total }}</span>
                          </div>
                          <div class="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                              <div 
                                  class="h-full bg-emerald-500 transition-all duration-700" 
                                  :style="{ width: `${p.percent}%` }"
                              ></div>
                          </div>
                      </div>
                      <div v-if="statistics.projectDistribution.length === 0" class="py-12 text-center text-slate-400 italic">
                          {{ t.noData }}
                      </div>
                  </div>
              </div>
          </div>

          <div v-if="activeView === 'calendar'" class="flex-1 flex flex-col p-6 overflow-hidden">
            <div class="flex justify-between items-center mb-6">
              <div class="flex gap-2">
                <button @click="navigateDate(-1)" class="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"><ChevronLeft :size="20"/></button>
                <button @click="viewDate = new Date()" class="px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-200">今</button>
                <button @click="navigateDate(1)" class="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"><ChevronRight :size="20"/></button>
              </div>
              <div class="flex items-center bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
                <button v-for="m in ['day', 'week', 'month']" :key="m" @click="calendarMode = m"
                  class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
                  :class="calendarMode === m ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
                >
                  {{ m === 'day' ? '日' : m === 'week' ? '周' : '月' }}
                </button>
              </div>
            </div>

            <div class="flex-1 bg-white dark:bg-slate-800 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm flex flex-col overflow-hidden">
              <!-- Header Row -->
              <div class="grid border-b border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 shrink-0"
                   :class="calendarMode === 'month' ? 'grid-cols-7' : 'grid-cols-[50px_1fr] sm:grid-cols-[80px_1fr]'">
                  <template v-if="calendarMode === 'month'">
                      <div v-for="d in ['日', '一', '二', '三', '四', '五', '六']" :key="d" 
                           class="py-3 text-center text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest border-r last:border-0 border-slate-100 dark:border-slate-700">
                           {{d}}
                      </div>
                  </template>
                  <template v-else>
                      <div class="w-[50px] sm:w-20 border-r border-slate-100 dark:border-slate-700" />
                      <div class="grid w-full" :class="calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'">
                          <div v-for="(day, idx) in calendarDays" :key="idx" class="py-3 text-center border-r last:border-0 border-slate-100 dark:border-slate-700">
                              <div class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tighter">
                                  {{ day ? ['日', '一', '二', '三', '四', '五', '六'][new Date(day.date).getDay()] : '' }}
                              </div>
                              <div class="text-sm font-black mt-1" :class="day?.date === getToday() ? 'text-blue-600 dark:text-blue-400 underline underline-offset-4 decoration-2' : 'text-slate-700 dark:text-slate-300'">
                                  {{ day ? day.day : '' }}
                              </div>
                          </div>
                      </div>
                  </template>
              </div>
              
              <!-- Body -->
              <div ref="scrollRef" class="flex-1 overflow-y-auto custom-scrollbar relative bg-[#fafafa] dark:bg-slate-900/50">
                <div class="h-full" :class="calendarMode === 'month' ? 'grid grid-cols-7' : 'flex'">
                  
                  <template v-if="calendarMode === 'day' || calendarMode === 'week'">
                      <div class="relative min-h-[1440px] flex flex-1">
                          <!-- Time Column -->
                          <div class="w-[50px] sm:w-20 border-r border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/50 shrink-0 sticky left-0 z-30">
                              <div v-for="hour in hours" :key="hour" class="h-[60px] relative border-b border-slate-50 dark:border-slate-800">
                                  <span class="absolute -top-2 right-1 sm:right-3 text-[10px] font-bold text-slate-300 dark:text-slate-600">
                                      {{ String(hour).padStart(2, '0') }}:00
                                  </span>
                              </div>
                          </div>
                          
                          <!-- Columns -->
                          <div class="grid flex-1 relative bg-white dark:bg-slate-800" :class="calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'">
                              <div v-for="(day, dayIdx) in calendarDays" :key="dayIdx"
                                  class="relative border-r last:border-0 border-slate-100 dark:border-slate-700"
                                  @dragover.prevent
                                  @drop="(e) => day && onDrop(e, day.date)">
                                  
                                  <!-- Time Slots Background & Selection -->
                                  <div v-for="mTotal in timeSlots" :key="mTotal"
                                       class="h-[15px] w-full relative group/slot"
                                       :class="mTotal % 60 === 45 ? 'border-b border-slate-100/60 dark:border-slate-700/60' : ''"
                                       @mousedown="day && handleTimeMouseDown(day.date, mTotal)"
                                       @mouseenter="day && handleTimeMouseEnter(day.date, mTotal)">
                                      <div class="absolute inset-x-0 top-0 h-[1px] bg-blue-500/0 group-hover/slot:bg-blue-500/20 pointer-events-none" />
                                      <div v-if="isSelecting && selectionStart?.date === day?.date && 
                                                mTotal >= Math.min(selectionStart.minutes, selectionEnd.minutes) &&
                                                mTotal <= Math.max(selectionStart.minutes, selectionEnd.minutes)"
                                           class="absolute inset-0 bg-blue-100/50 dark:bg-blue-900/30 pointer-events-none border-x-2 border-blue-400" />
                                  </div>

                                  <!-- Tasks -->
                                  <template v-if="day">
                                    <div v-for="t in day.tasks" :key="t.id">
                                      <div v-if="parseTaskTime(t.date)" 
                                           draggable="true"
                                           @dragstart="(e) => onDragStart(e, t)"
                                           @click="openDetail(t)"
                                           class="absolute left-1.5 right-1.5 px-2 py-1.5 rounded-xl border shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing z-10 overflow-hidden group/task"
                                           :class="t.completed ? 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-400 dark:text-slate-500 opacity-60' : 'bg-white dark:bg-slate-700 border-blue-200 dark:border-blue-800 text-slate-800 dark:text-slate-200 border-l-4 border-l-blue-500 dark:border-l-blue-400'"
                                           :style="{ top: `${parseTaskTime(t.date).totalMinutes}px`, height: '48px' }">
                                          
                                          <div class="text-[10px] font-bold truncate leading-tight" :class="t.completed ? 'line-through' : ''">{{ t.content }}</div>
                                          <div class="text-[8px] text-slate-400 dark:text-slate-500 mt-1 flex items-center justify-between">
                                              <span class="flex items-center gap-1 font-mono"><Clock :size="8"/> {{ formatMinutesToTime(parseTaskTime(t.date).totalMinutes) }}</span>
                                              <button 
                                                  @click.stop="handleDeleteTask(t.lineIndex)"
                                                  class="opacity-0 group-hover/task:opacity-100 text-red-400 dark:text-red-500 hover:text-red-600 dark:hover:text-red-400 transition-opacity"
                                              >
                                                  <Trash2 :size="8"/>
                                              </button>
                                          </div>
                                      </div>
                                    </div>
                                  </template>
                              </div>
                          </div>
                      </div>
                  </template>

                  <template v-else>
                      <!-- Month View -->
                      <div v-for="(day, idx) in calendarDays" :key="idx" 
                           class="min-h-[140px] p-2 border-r border-b border-slate-100 dark:border-slate-700 relative"
                           :class="!day ? 'bg-slate-50/30 dark:bg-slate-900/30' : 'hover:bg-slate-50/50 dark:hover:bg-slate-700/50 transition-colors'">
                          <template v-if="day">
                              <div class="text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full mb-2"
                                   :class="day.date === getToday() ? 'bg-blue-600 dark:bg-blue-500 text-white' : 'text-slate-400 dark:text-slate-500'">
                                  {{ day.day }}
                              </div>
                              <div class="space-y-1">
                                  <div v-for="t in day.tasks" :key="t.id" class="text-[9px] truncate px-1.5 py-1 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded text-slate-600 dark:text-slate-300 shadow-xs">
                                      {{ t.content }}
                                  </div>
                              </div>
                          </template>
                      </div>
                  </template>

                </div>
              </div>
            </div>
          </div>

          <div v-if="activeView === 'view'" class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-1 relative">
              <div class="flex items-center justify-between mb-4 max-w-4xl mx-auto w-full px-2">
                 <div class="flex flex-col"><span class="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{{ getHeaderTitle }}</span><span class="text-[9px] text-slate-300 dark:text-slate-600 font-black">{{ filteredTasks.length }} {{ t.allTasks }}</span></div>
                 <button @click="isBatchMode = !isBatchMode; selectedTaskIds.clear()" class="px-3 py-1.5 rounded-lg border transition-all flex items-center gap-2" :class="isBatchMode ? 'bg-blue-600 border-blue-600 text-white' : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-400 hover:text-blue-600'"><Layers :size="14"/><span class="text-[10px] font-black uppercase">{{ t.batch }}</span></button>
              </div>

              <div class="max-w-4xl mx-auto w-full mb-4 px-2">
                <div class="relative group">
                   <Plus class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" :size="16"/>
                   <input ref="mainInputRef" v-model="newTaskInput" @keydown.enter="addTask(null)" class="w-full pl-10 pr-12 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl outline-none shadow-sm focus:ring-4 focus:ring-blue-500/5 transition-all font-bold text-sm" :placeholder="t.quickAddPlaceholder" />
                   <div class="absolute right-3 top-1/2 -translate-y-1/2"><span class="text-[8px] font-black text-slate-300 border px-1 rounded uppercase">N</span></div>
                </div>
              </div>

              <div class="max-w-4xl mx-auto w-full">
                <TransitionGroup name="list" tag="div">
                  <div v-for="t in filteredTasks" :key="t.id" class="relative">
                    <div v-if="dropTargetIdx === t.lineIndex" class="absolute -top-0.5 left-0 right-0 h-0.5 bg-blue-500 rounded-full z-10"></div>
                    <div @dragover.prevent="dropTargetIdx = t.lineIndex" @dragleave="dropTargetIdx = null" @drop="onTaskDrop($event, t.lineIndex)">
                                              <TaskCard 
                                                :task="t" 
                                                :is-batch-mode="isBatchMode"
                                                :selected="selectedTaskIds.has(t.id)"
                                                :is-active="selectedTaskId === t.id"
                                                @select-task="toggleTaskSelection"
                                                @open-detail="openDetail"
                                                @toggle="handleToggle" 
                                                @toggle-subtask="handleToggleSubtask"
                                                @make-subtask="handleMakeSubtask"
                                                @delete="handleDeleteTask" 
                                                @update="handleUpdateTask"
                                                @dragstart="onDragStart"
                                              />
                      
                    </div>
                  </div>
                </TransitionGroup>
              </div>
          </div>
        </main>
      </div>

      <!-- Detail Panel (Inspector) -->
      <div v-if="selectedTask" class="w-96 bg-white dark:bg-slate-800 border-l border-slate-200 dark:border-slate-700 flex flex-col shadow-2xl z-30 animate-in slide-in-from-right duration-300">
        <div class="h-16 flex items-center justify-between px-6 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <span class="text-[10px] font-black text-slate-400 uppercase tracking-widest">Detail Inspector</span>
          <button @click="closeDetail" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-all"><X :size="20"/></button>
        </div>

        <div class="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
          <div class="space-y-4">
            <textarea v-model="detailForm.content" class="w-full bg-transparent text-xl font-black text-slate-800 dark:text-slate-100 outline-none resize-none border-none p-0 focus:ring-0 leading-tight" placeholder="任务内容..." rows="3"></textarea>
            <div class="flex items-center gap-2"><span class="text-[9px] font-black text-slate-400 uppercase">Project</span><span class="text-[10px] font-black text-blue-600 dark:text-blue-400 px-2 py-0.5 bg-blue-50 dark:bg-blue-900/30 rounded-full">{{ selectedTask.projectPath }}</span></div>
          </div>
          <div class="h-[1px] bg-slate-100 dark:bg-slate-700"></div>
          <div class="space-y-6">
            <div class="grid grid-cols-2 gap-4">
              <div class="space-y-2"><label class="text-[9px] font-black text-slate-400 uppercase px-1">Priority</label><select v-model="detailForm.priority" class="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"><option :value="null">None</option><option :value="1">P1 - High</option><option :value="2">P2 - Medium</option><option :value="3">P3 - Low</option></select></div>
              <div class="space-y-2"><label class="text-[9px] font-black text-slate-400 uppercase px-1">Repeat</label><select v-model="detailForm.recurrence" class="w-full p-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none"><option :value="null">No Repeat</option><option value="day">Daily</option><option value="week">Weekly</option><option value="month">Monthly</option></select></div>
            </div>
            <div class="space-y-2"><label class="text-[9px] font-black text-slate-400 uppercase px-1">Schedule</label><div class="flex gap-2"><div class="relative flex-1"><Calendar class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="14"/><input type="date" v-model="datePart" class="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" /></div><div class="relative w-32"><Clock class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" :size="14"/><input type="time" v-model="timePart" class="w-full pl-10 pr-3 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" /></div></div></div>
            <div class="space-y-2"><label class="text-[9px] font-black text-slate-400 uppercase px-1">Tags</label><div class="relative"><Tag class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" :size="14"/><input v-model="detailForm.tags" class="w-full pl-10 pr-4 py-2.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none" placeholder="空格分隔..." /></div></div>
          </div>
          <div class="h-[1px] bg-slate-100 dark:bg-slate-700"></div>
          <div class="space-y-6">
            <div v-if="selectedTask.subtasks?.length" class="space-y-3">
              <label class="text-[9px] font-black text-slate-400 uppercase px-1">Checklist</label>
              <div class="space-y-2.5"><div v-for="sub in selectedTask.subtasks" :key="sub.lineIndex" class="flex items-center gap-3"><button @click="handleToggleSubtask(sub.lineIndex, sub.completed)" class="text-slate-300 dark:text-slate-600 hover:text-blue-500"><CheckCircle2 v-if="sub.completed" :size="16" class="text-emerald-500"/><Circle v-else :size="16"/></button><span class="text-xs font-bold" :class="sub.completed ? 'text-slate-400 line-through' : 'text-slate-700 dark:text-slate-200'">{{ sub.content }}</span></div></div>
            </div>
            <div v-if="selectedTask.notes?.length" class="space-y-3">
              <label class="text-[9px] font-black text-slate-400 uppercase px-1">Notes</label>
              <div class="p-4 bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-700 rounded-2xl space-y-2"><div v-for="(note, nIdx) in selectedTask.notes" :key="nIdx" class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words" v-html="formatContent(note)"></div></div>
            </div>
          </div>
        </div>
        <div class="p-6 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30">
          <button @click="closeDetail" class="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl active:scale-95 transition-all">Done & Close</button>
        </div>
      </div>
    </div>

    <!-- Batch Action Bar (Floating) -->
    <div v-if="isBatchMode && selectedTaskIds.size > 0" class="fixed bottom-10 left-1/2 -translate-x-1/2 z-[150] bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-6 animate-in slide-in-from-bottom-10 duration-300">
        <div class="flex flex-col"><span class="text-[9px] font-black uppercase text-slate-400">BATCH</span><span class="text-xs font-bold">{{ selectedTaskIds.size }} {{ t.selected }}</span></div>
        <div class="flex items-center gap-2">
            <button @click="handleBatchDelete" class="p-2 hover:bg-red-500 hover:text-white rounded-lg transition-all"><Trash2 :size="14"/></button>
            <button @click="handleBatchSetDate(getToday())" class="p-2 hover:bg-blue-500 hover:text-white rounded-lg transition-all flex items-center gap-2 text-xs font-bold"><CalendarAction :size="14"/></button>
        </div>
        <button @click="selectedTaskIds.clear(); isBatchMode = false" class="ml-4 p-1 hover:bg-white/10 dark:hover:bg-slate-100 rounded-full"><X :size="16"/></button>
    </div>

    <!-- Global Toast Overlay -->
    <div class="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none">
      <TransitionGroup name="toast">
        <div v-for="toast in toasts" :key="toast.id" class="px-6 py-3 rounded-2xl shadow-2xl border flex items-center gap-3 pointer-events-auto animate-in slide-in-from-right-10 duration-300" :class="[toast.type === 'success' ? 'bg-emerald-500 border-emerald-400 text-white' : toast.type === 'error' ? 'bg-red-500 border-red-400 text-white' : 'bg-slate-800 border-slate-700 text-white']">
          <CheckCircle2 v-if="toast.type === 'success'" :size="18"/><AlertCircle v-else-if="toast.type === 'error'" :size="18"/><Info v-else :size="18"/><span class="text-sm font-bold">{{ toast.message }}</span>
        </div>
      </TransitionGroup>
    </div>

    <!-- Settings Modal -->
    <div v-if="isSettingsOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div class="bg-white dark:bg-slate-800 w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
        <div class="p-6 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30"><h3 class="font-black text-slate-800 dark:text-slate-100 flex items-center gap-2"><Settings :size="20" class="text-blue-600"/>{{ t.settings }}</h3><button @click="isSettingsOpen = false" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-all"><X :size="20"/></button></div>
        <div class="p-8 space-y-8">
          <section class="space-y-4">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">{{ t.fileManagement }}</h4>
            <div v-if="pendingDefaultHandle" @click="loadPendingDefault" class="p-4 bg-amber-50 dark:bg-amber-900/20 text-amber-600 dark:text-amber-400 rounded-2xl text-sm font-bold cursor-pointer border border-amber-100 dark:border-amber-800 flex items-center gap-3"><RefreshCw :size="18" /><span>重连默认文件...</span></div>
            <div class="grid grid-cols-1 gap-3">
              <button @click="handleOpenFile" class="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-all border border-slate-100 dark:border-slate-700 group"><div class="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors"><FolderOpen :size="20" /></div><span class="font-bold text-sm">{{ t.openFile }}</span></button>
              <button @click="handleSaveFile" class="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-all border border-slate-100 dark:border-slate-700 group"><div class="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors"><Save :size="20" /></div><span class="font-bold text-sm">{{ currentFileHandle ? t.saveFile : t.saveAs }}</span></button>
              <button v-if="currentFileHandle" @click="toggleDefaultFile" class="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 dark:bg-slate-900/50 text-slate-700 dark:text-slate-300 hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-all border border-slate-100 dark:border-slate-700 group"><div class="p-2 rounded-xl bg-white dark:bg-slate-800 shadow-sm group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors" :class="isDefaultFile ? 'text-amber-500' : ''"><Pin :size="20" :class="isDefaultFile ? 'fill-current' : ''"/></div><span class="font-bold text-sm">{{ isDefaultFile ? t.unsetDefault : t.setDefault }}</span></button>
            </div>
          </section>
          <section class="space-y-4">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">{{ t.language }}</h4>
            <div class="flex p-1 bg-slate-100 dark:bg-slate-900/50 rounded-2xl"><button @click="lang = 'zh'; localStorage.setItem('gtd-lang', 'zh')" class="flex-1 py-3 text-sm font-bold rounded-xl transition-all" :class="lang === 'zh' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500'">中文</button><button @click="lang = 'en'; localStorage.setItem('gtd-lang', 'en')" class="flex-1 py-3 text-sm font-bold rounded-xl transition-all" :class="lang === 'en' ? 'bg-white dark:bg-slate-800 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500'">English</button></div>
          </section>
        </div>
      </div>
    </div>
  </div>
</template>

<style>
.list-move, .list-enter-active, .list-leave-active { transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); }
.list-enter-from, .list-leave-to { opacity: 0; transform: translateX(30px); }
.list-leave-active { position: absolute; }
.toast-enter-active, .toast-leave-active { transition: all 0.3s ease; }
.toast-enter-from { opacity: 0; transform: translateX(30px); }
.toast-leave-to { opacity: 0; transform: scale(0.9); }
.custom-scrollbar::-webkit-scrollbar { width: 6px; }
.custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(156, 163, 175, 0.2); border-radius: 10px; }
.dark .custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(75, 85, 99, 0.4); }
</style>