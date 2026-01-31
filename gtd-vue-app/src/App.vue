<script setup>
import { ref, computed, watch, onMounted, nextTick, shallowRef, onUnmounted } from 'vue';
import { 
  CheckCircle2, Layout, FileText, Plus, Menu, Inbox, Hash, Zap, Coffee, Hourglass, 
  ListTodo, Info, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Clock, Trash2, X, Calendar,
  FolderOpen, Save, RefreshCw, Pin, Search, Eye, EyeOff, Tag, Languages, Settings, Sun, Moon
} from 'lucide-vue-next';
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
const sidebarOpen = ref(true);
const isSettingsOpen = ref(false);
const isLanguageDropdownOpen = ref(false);
const lang = ref(localStorage.getItem('gtd-lang') || 'zh');
const isDarkMode = ref(localStorage.getItem('gtd-dark-mode') === 'true');
const expandedGroups = ref({'📥 收件箱': true, '⚡ 下一步行动': true});
const isSaving = ref(false);
const newTaskInput = ref('');
const viewDate = ref(new Date());
const quickAddDate = ref(null);

const toggleDarkMode = () => {
  isDarkMode.value = !isDarkMode.value;
  localStorage.setItem('gtd-dark-mode', isDarkMode.value);
};

watch(isDarkMode, (val) => {
  if (val) {
    document.documentElement.classList.add('dark');
  } else {
    document.documentElement.classList.remove('dark');
  }
}, { immediate: true });

const vClickOutside = {
  mounted(el, binding) {
    el.clickOutsideEvent = (event) => {
      if (!(el === event.target || el.contains(event.target))) {
        binding.value(event);
      }
    };
    document.addEventListener('click', el.clickOutsideEvent);
  },
  unmounted(el) {
    document.removeEventListener('click', el.clickOutsideEvent);
  },
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
      searchPlaceholder: '搜索任务、项目或标签...',
      newProject: '新建项目',
      viewSettings: '视图设置',
      hideCompleted: '隐藏已完成任务',
      all: '全部',
      editTask: '编辑任务详情',
      confirmDelete: '确定要删除项目 "{name}" 及其所有任务吗？',
      quickAddPlaceholder: '捕捉灵感...',
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
      lightMode: '浅色模式'
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
      searchPlaceholder: 'Search tasks, projects, tags...',
      newProject: 'New Project',
      viewSettings: 'View Settings',
      hideCompleted: 'Hide Completed',
      all: 'All',
      editTask: 'Edit Task Details',
      confirmDelete: 'Delete project "{name}" and all its tasks?',
      quickAddPlaceholder: 'Capture inspiration...',
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
      lightMode: 'Light Mode'
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

const selectionStart = ref(null);
const selectionEnd = ref(null);
const isSelecting = ref(false);
const selectedTaskForEdit = ref(null);

const scrollRef = ref(null);
const currentFileHandle = shallowRef(null); // File System Access API Handle
const lastDiskModified = ref(0);
const fileCheckTimer = ref(null);
const autoSaveTimer = ref(null);
const fileChangedOnDisk = ref(false);
const isDefaultFile = ref(false);
const pendingDefaultHandle = shallowRef(null);

// --- Computed ---
const parsedData = computed(() => {
  // Use lang.value here to ensure this re-calculates on language change
  const currentLang = lang.value;
  const lines = markdown.value.split('\n');
  const root = { name: 'Root', children: [], tasks: [], level: 0, path: '' };
  const stack = [root];
  const all = [];

  let currentTask = null;

  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('#')) {
      currentTask = null;
      const level = (trimmed.match(/^#+/) || ['#'])[0].length;
      const nodeName = trimmed.replace(/^#+\s*/, '').trim();
      const node = { 
        name: nodeName, 
        displayName: getLocalizedName(nodeName),
        children: [], tasks: [], level, path: '' 
      };
      while (stack.length > 1 && stack[stack.length - 1].level >= level) stack.pop();
      const parent = stack[stack.length - 1];
      node.path = parent.path ? `${parent.path} / ${nodeName}` : nodeName;
      parent.children.push(node);
      stack.push(node);
    } else if (trimmed.startsWith('- [ ]') || trimmed.startsWith('- [x]')) {
      const dateMatch = trimmed.match(/@(\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?)/);
      const priorityMatch = trimmed.match(/!([1-3])/);
      const tagsMatch = trimmed.match(/#([^\s#]+)/g);
      
      const task = {
        id: `task-${index}`,
        lineIndex: index,
        lineCount: 1,
        content: trimmed
          .replace(/^- \[[ x]\]\s*/, '')
          .replace(/@\d{4}-\d{2}-\d{2}(~\d{4}-\d{2}-\d{2})?(\s\d{2}:\d{2}(~\d{2}:\d{2})?)?/, '')
          .replace(/![1-3]/, '')
          .replace(/#[^\s#]+/g, '')
          .trim(),
        completed: trimmed.startsWith('- [x]'),
        date: dateMatch ? dateMatch[1] : null,
        priority: priorityMatch ? parseInt(priorityMatch[1]) : null,
        tags: tagsMatch ? tagsMatch.map(t => t.substring(1)) : [],
        projectPath: stack[stack.length - 1].path,
        notes: []
      };
      stack[stack.length - 1].tasks.push(task);
      all.push(task);
      currentTask = task;
    } else if (currentTask && (line.startsWith('  ') || line.startsWith('\t'))) {
      currentTask.notes.push(trimmed);
      currentTask.lineCount++;
    } else if (trimmed === '' && currentTask) {
      currentTask = null;
    } else {
      currentTask = null;
    }
  });

  const calculateStats = (node) => {
    let incomplete = (node.tasks || []).filter(t => !t.completed).length;
    (node.children || []).forEach(child => {
      const stats = calculateStats(child);
      incomplete += stats.incomplete;
    });
    node.incompleteCount = incomplete;
    return { incomplete };
  };
  
  root.children.forEach(calculateStats);

  return { projects: root.children, allTasks: all };
});

const projects = computed(() => parsedData.value?.projects || []);
const allTasks = computed(() => parsedData.value?.allTasks || []);

const allTags = computed(() => {
  const tags = new Set();
  const tasks = allTasks.value || [];
  tasks.forEach(t => {
    if (t.tags) {
      t.tags.forEach(tag => tags.add(tag));
    }
  });
  return Array.from(tags).sort();
});

const filteredTasks = computed(() => {
  const query = searchQuery.value.toLowerCase();
  const filter = selectedFilter.value;
  const tag = selectedTag.value;
  const today = getToday();
  
  const tomorrowDate = new Date();
  tomorrowDate.setDate(tomorrowDate.getDate() + 1);
  const tomorrow = formatDate(tomorrowDate);
  
  const nextWeekDate = new Date();
  nextWeekDate.setDate(nextWeekDate.getDate() + 7);
  const nextWeek = formatDate(nextWeekDate);

  return (allTasks.value || []).filter(t => {
    // Project/Time Filter
    let matchFilter = true;
    if (filter.type === 'project') {
      matchFilter = t.projectPath.startsWith(filter.value);
    } else if (filter.type === 'time') {
      if (filter.value === 'today') {
        matchFilter = t.date && isDateInRange(today, t.date);
      } else if (filter.value === 'tomorrow') {
        matchFilter = t.date && isDateInRange(tomorrow, t.date);
      } else if (filter.value === 'week') {
        matchFilter = t.date && t.date.split(' ')[0] >= today && t.date.split(' ')[0] <= nextWeek;
      }
    }

    const tagMatch = !tag || (t.tags && t.tags.includes(tag));
    const searchMatch = !query || 
      t.content.toLowerCase().includes(query) ||
      t.projectPath.toLowerCase().includes(query) ||
      (t.tags && t.tags.some(tg => tg.toLowerCase().includes(query)));
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
      
      if (node.incompleteCount > 0 && !isCore) {
        active.push(node);
      }
      active = active.concat(findActive(node.children));
    });
    return active;
  };
  return findActive(projects.value);
});

const calendarDays = computed(() => {
  const days = [];
  const tasks = allTasks.value || [];
  if (calendarMode.value === 'month') {
    const year = viewDate.value.getFullYear();
    const month = viewDate.value.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const d = formatDate(new Date(year, month, i));
      days.push({ date: d, day: i, tasks: tasks.filter(t => isDateInRange(d, t.date)) });
    }
  } else if (calendarMode.value === 'week') {
    const start = getStartOfWeek(viewDate.value);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = formatDate(d);
      days.push({ date: ds, day: d.getDate(), tasks: tasks.filter(t => isDateInRange(ds, t.date)) });
    }
  } else if (calendarMode.value === 'day') {
    const ds = formatDate(viewDate.value);
    days.push({ date: ds, day: viewDate.value.getDate(), tasks: tasks.filter(t => isDateInRange(ds, t.date)) });
  }
  return days;
});

const hours = Array.from({ length: 24 }, (_, i) => i);
const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => i * 15);

// --- Actions ---
const handleToggle = (idx, status) => {
  const lines = markdown.value.split('\n');
  const line = lines[idx];
  if (!line) return;
  
  if (status) {
    lines[idx] = line.replace(/^- \[x\]/, '- [ ]');
  } else {
    lines[idx] = line.replace(/^- \[ \]/, '- [x]');
  }
  markdown.value = lines.join('\n');
};

const handleUpdateTask = (lineIndex, updates) => {
  const lines = markdown.value.split('\n');
  const task = allTasks.value.find(t => parseInt(t.lineIndex) === parseInt(lineIndex));
  if (!task) return;

  const newCompleted = updates.completed !== undefined ? updates.completed : task.completed;
  const newContent = updates.content !== undefined ? updates.content : task.content;
  const newDate = updates.date !== undefined ? updates.date : task.date;
  const newPriority = updates.priority !== undefined ? updates.priority : task.priority;
  const newTags = updates.tags !== undefined ? updates.tags : task.tags;

  let newLine = `- [${newCompleted ? 'x' : ' '}] ${newContent}`;
  if (newPriority) newLine += ` !${newPriority}`;
  if (newDate) newLine += ` @${newDate}`;
  if (newTags && newTags.length) newLine += ` ${newTags.map(t => '#' + t).join(' ')}`;
  
  lines[lineIndex] = newLine;
  markdown.value = lines.join('\n');
};

const handleDeleteTask = (idx) => {
  const lines = markdown.value.split('\n');
  lines.splice(idx, 1);
  markdown.value = lines.join('\n');
};

const handleMoveTaskToProject = (lineIndex, targetProjectPath) => {
  const lines = markdown.value.split('\n');
  const tasksArray = allTasks.value || [];
  const task = tasksArray.find(t => parseInt(t.lineIndex) === parseInt(lineIndex));
  if (!task) return;

  const lineCount = task.lineCount || 1;
  const taskLines = lines.slice(lineIndex, lineIndex + lineCount);

  // Find target project heading
  const targetParts = targetProjectPath.split(' / ');
  const targetName = targetParts[targetParts.length - 1].trim();
  const targetLevel = targetParts.length;

  const projectIndex = lines.findIndex(l => {
    if (!l.startsWith('#')) return false;
    const lLevel = (l.match(/^#+/) || ['#'])[0].length;
    const lName = l.replace(/^#+\s*/, '').trim();
    return lName === targetName && lLevel === targetLevel;
  });

  if (projectIndex !== -1) {
    // Remove task from old position
    lines.splice(lineIndex, lineCount);
    
    // Re-find project index after removal
    const adjustedProjectIndex = lines.findIndex(l => {
      if (!l.startsWith('#')) return false;
      const lLevel = (l.match(/^#+/) || ['#'])[0].length;
      const lName = l.replace(/^#+\s*/, '').trim();
      return lName === targetName && lLevel === targetLevel;
    });

    lines.splice(adjustedProjectIndex + 1, 0, ...taskLines);
    markdown.value = lines.join('\n');
  }
};

const activeProjectsDragOver = ref(null);

const handleConvertTaskToProject = (lineIndex) => {
  const lines = markdown.value.split('\n');
  const tasksArray = allTasks.value || [];
  const task = tasksArray.find(t => parseInt(t.lineIndex) === parseInt(lineIndex));
  if (!task) return;

  const currentLevel = (task.projectPath || '').split(' / ').length;
  const newHeading = '#'.repeat(currentLevel + 1) + ' ' + task.content;
  
  lines[lineIndex] = newHeading;
  markdown.value = lines.join('\n');
};

const handleAddProject = () => {
  const lines = markdown.value.split('\n');
  lines.push('', '# 新建项目');
  markdown.value = lines.join('\n');
};

const handleUpdateProject = (oldPath, newName) => {
  const lines = markdown.value.split('\n');
  const pathParts = oldPath.split(' / ');
  const oldName = pathParts[pathParts.length - 1];
  const level = pathParts.length;

  const index = lines.findIndex(l => {
    if (!l.startsWith('#')) return false;
    const lLevel = (l.match(/^#+/) || ['#'])[0].length;
    const lName = l.replace(/^#+\s*/, '').trim();
    return lName === oldName && lLevel === level;
  });

  if (index !== -1) {
    const hashes = '#'.repeat(level);
    lines[index] = `${hashes} ${newName}`;
    markdown.value = lines.join('\n');
  }
};

const handleDeleteProject = (path) => {
  if (!confirm(`确定要删除项目 "${path}" 及其所有任务吗？`)) return;
  
  const lines = markdown.value.split('\n');
  const pathParts = path.split(' / ');
  const name = pathParts[pathParts.length - 1];
  const level = pathParts.length;

  const startIndex = lines.findIndex(l => {
    if (!l.startsWith('#')) return false;
    const lLevel = (l.match(/^#+/) || ['#'])[0].length;
    const lName = l.replace(/^#+\s*/, '');
    return lName === name && lLevel === level;
  });

  if (startIndex === -1) return;

  // Find where the next heading of same or higher level starts
  let endIndex = lines.length;
  for (let i = startIndex + 1; i < lines.length; i++) {
    if (lines[i].startsWith('#')) {
      const lLevel = (lines[i].match(/^#+/) || ['#'])[0].length;
      if (lLevel <= level) {
        endIndex = i;
        break;
      }
    }
  }

  lines.splice(startIndex, endIndex - startIndex);
  markdown.value = lines.join('\n');
  if (selectedFilter.value.value === path) {
    selectedFilter.value = { type: 'all', value: 'ALL' };
  }
};

const addTask = (dateInfo = null) => {
  if (!newTaskInput.value.trim()) return;
  const lines = markdown.value.split('\n');
  let text = newTaskInput.value.trim();
  let date = dateInfo;

  // Basic NLP for dates if not provided by calendar
  if (!date) {
    if (text.includes('今天')) {
      date = getToday();
      text = text.replace('今天', '').trim();
    } else if (text.includes('明天')) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      date = formatDate(tomorrow);
      text = text.replace('明天', '').trim();
    }
  }

  let content = `- [ ] ${text}`;
  if (date) content += ` @${date}`;
  
  let insertIdx = -1;
  if (selectedFilter.value.value !== 'ALL') {
      const projectName = selectedFilter.value.value.split(' / ').pop();
      insertIdx = lines.findIndex(l => l.startsWith('#') && l.includes(projectName)) + 1;
  } else {
      insertIdx = lines.findIndex(l => l.includes('收件箱')) + 1;
  }

  if (insertIdx <= 0) insertIdx = lines.findIndex(l => l.startsWith('#')) + 1;
  if (insertIdx <= 0) { lines.push('# 📥 收件箱', content); } 
  else { lines.splice(insertIdx, 0, content); } 
  
  markdown.value = lines.join('\n');
  newTaskInput.value = '';
  quickAddDate.value = null;
};

const moveTask = (lineIndex, newDate, newTime) => {
  const lines = [...markdown.value.split('\n')];
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
  markdown.value = lines.join('\n');
};

// --- File System Actions ---
const verifyPermission = async (fileHandle, withWrite) => {
  const options = {};
  if (withWrite) {
    options.mode = 'readwrite';
  }
  if ((await fileHandle.queryPermission(options)) === 'granted') {
    return true;
  }
  if ((await fileHandle.requestPermission(options)) === 'granted') {
    return true;
  }
  return false;
};

const startFileWatcher = () => {
  if (fileCheckTimer.value) clearInterval(fileCheckTimer.value);
  fileCheckTimer.value = setInterval(async () => {
    if (!currentFileHandle.value || isSaving.value) return;
    try {
      const file = await currentFileHandle.value.getFile();
      // Allow 1s buffer for file system quirks
      if (file.lastModified > lastDiskModified.value + 1000) {
        fileChangedOnDisk.value = true;
        clearInterval(fileCheckTimer.value);
      }
    } catch(e) { console.error('File watcher error:', e); }
  }, 2000);
};

const loadFileContent = async (handle) => {
  const file = await handle.getFile();
  const contents = await file.text();
  markdown.value = contents;
  currentFileHandle.value = handle;
  lastDiskModified.value = file.lastModified;
  fileChangedOnDisk.value = false;
  
  // Check if this is the stored default
  const defaultHandle = await getFileHandle();
  isDefaultFile.value = defaultHandle && (await handle.isSameEntry(defaultHandle));
  
  startFileWatcher();
};

const handleOpenFile = async () => {
  try {
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } }],
      multiple: false
    });
    await loadFileContent(handle);
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Error opening file:', err);
  }
};

const saveToFile = async () => {
  if (!currentFileHandle.value) return;
  try {
    const writable = await currentFileHandle.value.createWritable();
    await writable.write(markdown.value);
    await writable.close();
    
    // Update lastDiskModified so we don't trigger our own watcher
    const file = await currentFileHandle.value.getFile();
    lastDiskModified.value = file.lastModified;
    
    setIsSaving(false);
  } catch (err) {
    console.error('Error saving file:', err);
    setIsSaving(false);
  }
};

const handleSaveFile = async () => {
  if (!currentFileHandle.value) {
    return handleSaveAs();
  }
  setIsSaving(true);
  await saveToFile();
};

const handleSaveAs = async () => {
  try {
    const handle = await window.showSaveFilePicker({
      types: [{ description: 'Markdown Files', accept: { 'text/markdown': ['.md'] } }],
    });
    // Write immediately on Save As
    const writable = await handle.createWritable();
    await writable.write(markdown.value);
    await writable.close();
    
    await loadFileContent(handle);
  } catch (err) {
    if (err.name !== 'AbortError') console.error('Error saving file:', err);
  }
};

const toggleDefaultFile = async () => {
  if (!currentFileHandle.value) return;
  if (isDefaultFile.value) {
    await removeFileHandle();
    isDefaultFile.value = false;
  } else {
    await saveFileHandle(currentFileHandle.value);
    isDefaultFile.value = true;
  }
};

const reloadFileFromDisk = async () => {
  if (currentFileHandle.value) {
    await loadFileContent(currentFileHandle.value);
  }
};

const loadPendingDefault = async () => {
  if (pendingDefaultHandle.value) {
    if (await verifyPermission(pendingDefaultHandle.value, true)) {
       await loadFileContent(pendingDefaultHandle.value);
       pendingDefaultHandle.value = null;
    }
  }
};

// --- Selection Logic ---
const handleTimeMouseDown = (date, minutes) => {
  isSelecting.value = true;
  selectionStart.value = { date, minutes };
  selectionEnd.value = { date, minutes };
};

const handleTimeMouseEnter = (date, minutes) => {
  if (isSelecting.value) {
    selectionEnd.value = { date, minutes };
  }
};

const handleGlobalMouseUp = () => {
  if (isSelecting.value && selectionStart.value && selectionEnd.value) {
    const startMin = Math.min(selectionStart.value.minutes, selectionEnd.value.minutes);
    const endMin = Math.max(selectionStart.value.minutes, selectionEnd.value.minutes) + 15;
    const timeStr = startMin === (endMin - 15) 
      ? formatMinutesToTime(startMin) 
      : `${formatMinutesToTime(startMin)}~${formatMinutesToTime(endMin)}`;
    quickAddDate.value = `${selectionStart.value.date} ${timeStr}`;
  }
  isSelecting.value = false;
  selectionStart.value = null;
  selectionEnd.value = null;
};

// --- Navigation ---
const navigateDate = (dir) => {
  const d = new Date(viewDate.value);
  if (calendarMode.value === 'month') d.setMonth(d.getMonth() + dir);
  else if (calendarMode.value === 'week') d.setDate(d.getDate() + dir * 7);
  else d.setDate(d.getDate() + dir);
  viewDate.value = d;
};

// --- Icons & Tips Helper ---
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

// --- Watchers ---
watch(markdown, (newVal) => {
  setIsSaving(true);
  localStorage.setItem('gtd-markdown', newVal);
  
  if (currentFileHandle.value) {
    if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
    autoSaveTimer.value = setTimeout(() => {
        saveToFile();
    }, 2000);
  } else {
    setTimeout(() => setIsSaving(false), 500);
  }
});

const setIsSaving = (val) => isSaving.value = val;

watch([activeView, calendarMode], async () => {
  if (activeView.value === 'calendar' && (calendarMode.value === 'day' || calendarMode.value === 'week')) {
      await nextTick();
      if (scrollRef.value) {
        const now = new Date();
        const currentMinutes = now.getHours() * 60 + now.getMinutes();
        const scrollPos = (currentMinutes / 1440) * scrollRef.value.scrollHeight - 200;
        scrollRef.value.scrollTop = Math.max(0, scrollPos);
      }
  }
});

onMounted(async () => {
    // Global click listener to close dropdown
    window.addEventListener('click', (e) => {
      if (!e.target.closest('.relative')) {
        isLanguageDropdownOpen.value = false;
      }
    });

    try {
        const defaultHandle = await getFileHandle();
        if (defaultHandle) {
             const perm = await defaultHandle.queryPermission({mode: 'readwrite'});
             if (perm === 'granted') {
                 await loadFileContent(defaultHandle);
             } else {
                 pendingDefaultHandle.value = defaultHandle;
             }
        }
    } catch (e) { console.error('Error loading default file:', e); }
});

onUnmounted(() => {
    if (fileCheckTimer.value) clearInterval(fileCheckTimer.value);
    if (autoSaveTimer.value) clearTimeout(autoSaveTimer.value);
});

// --- Drag & Drop ---
const onDragStart = (e, task) => {
  e.dataTransfer.setData('task', JSON.stringify(task));
  e.dataTransfer.effectAllowed = 'move';
};

const onDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
};

const onSidebarDrop = (e, targetPath) => {
  try {
    const taskData = JSON.parse(e.dataTransfer.getData('task'));
    handleMoveTaskToProject(taskData.lineIndex, targetPath);
  } catch (err) {
    console.error('Sidebar drop error:', err);
  }
};

const onDrop = (e, dayDate) => {
  const taskData = JSON.parse(e.dataTransfer.getData('task'));
  const rect = e.currentTarget.getBoundingClientRect();
  const y = e.clientY - rect.top;
  const minutesTotal = Math.floor(y); 
  const snappedMinutes = Math.round(minutesTotal / 15) * 15;
  const timeStr = formatMinutesToTime(Math.min(snappedMinutes, 1425));
  if (dayDate) moveTask(taskData.lineIndex, dayDate, timeStr);
};

</script>

<template>
  <div class="flex h-screen bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-slate-100 overflow-hidden font-sans select-none" @mouseup="handleGlobalMouseUp">
    <!-- Sidebar -->
    <div :class="[sidebarOpen ? 'w-80' : 'w-0', 'bg-white dark:bg-slate-800 border-r border-slate-200 dark:border-slate-700 transition-all duration-300 flex flex-col overflow-hidden z-20']">
      <div class="p-6 flex items-center justify-between">
         <div class="relative">
           <div @click.stop="isLanguageDropdownOpen = !isLanguageDropdownOpen" class="flex items-center gap-3 font-black text-xl text-blue-600 dark:text-blue-400 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700/50 p-2 -m-2 rounded-xl transition-all">
             <CheckCircle2 class="w-8 h-8" /> <span>GTD Flow</span>
             <ChevronDown :size="16" class="text-slate-400" />
           </div>
           
           <!-- Logo Dropdown Menu -->
           <div v-if="isLanguageDropdownOpen" v-click-outside="() => isLanguageDropdownOpen = false" class="absolute left-0 mt-4 w-48 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl shadow-xl z-50 py-2 animate-in fade-in zoom-in-95 duration-200">
             <button @click="toggleLang(); isLanguageDropdownOpen = false" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
               <Languages :size="18" class="text-slate-400"/>
               {{ lang === 'zh' ? 'English' : '中文' }}
             </button>
             <button @click="toggleDarkMode(); isLanguageDropdownOpen = false" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
               <component :is="isDarkMode ? Sun : Moon" :size="18" class="text-slate-400"/>
               {{ isDarkMode ? t.lightMode : t.darkMode }}
             </button>
             <button @click="isSettingsOpen = true; isLanguageDropdownOpen = false" class="w-full text-left px-4 py-3 text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-3">
               <Settings :size="18" class="text-slate-400"/>
               {{ t.settings }}
             </button>
           </div>
         </div>
         
         <div class="px-2 py-1 rounded text-[10px] font-bold border" :class="isSaving ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100'">
            {{ isSaving ? t.saving : 'V0.0.5' }}
         </div>
      </div>
      
      <div class="flex-1 overflow-y-auto px-4 space-y-6 pb-10">
        <!-- Global Search -->
        <div class="px-4 mt-2">
          <div class="relative group">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-500 group-focus-within:text-blue-500" :size="14"/>
            <input 
              v-model="searchQuery"
              class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-700 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/10 focus:border-blue-500 transition-all dark:text-slate-200"
              :placeholder="t.searchPlaceholder"
            />
            <button v-if="searchQuery" @click="searchQuery = ''" class="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-50 dark:text-slate-500 dark:hover:text-slate-300">
              <X :size="12"/>
            </button>
          </div>
        </div>

        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">{{ t.allTasks }}</div>
          
          <div @click="selectedFilter = {type: 'all', value: 'ALL'}; activeView = 'view'" 
               class="flex items-center justify-between px-4 py-2 cursor-pointer rounded-xl transition-all group"
               :class="selectedFilter.type === 'all' && activeView === 'view' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'">
            <div class="flex items-center gap-3">
              <ListTodo :size="20" :class="selectedFilter.type === 'all' && activeView === 'view' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/>
              <span class="text-sm font-bold">{{ t.allTasks }}</span>
            </div>
            <button @click.stop="hideCompleted = !hideCompleted" 
                    class="p-1.5 rounded-lg transition-colors hover:bg-white/20"
                    :title="hideCompleted ? '显示已完成' : '隐藏已完成'">
              <component :is="hideCompleted ? EyeOff : Eye" :size="16" :class="selectedFilter.type === 'all' && activeView === 'view' ? 'text-blue-200' : 'text-slate-300 dark:text-slate-600'"/>
            </button>
          </div>

          <!-- Time Filters -->
          <div @click="selectedFilter = {type: 'time', value: 'today'}; activeView = 'view'" 
               class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group"
               :class="selectedFilter.type === 'time' && selectedFilter.value === 'today' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'">
            <Sun :size="20" :class="selectedFilter.type === 'time' && selectedFilter.value === 'today' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/>
            <span class="text-sm font-bold">{{ t.today }}</span>
          </div>

          <div @click="selectedFilter = {type: 'time', value: 'tomorrow'}; activeView = 'view'" 
               class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group"
               :class="selectedFilter.type === 'time' && selectedFilter.value === 'tomorrow' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'">
            <Calendar :size="20" :class="selectedFilter.type === 'time' && selectedFilter.value === 'tomorrow' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/>
            <span class="text-sm font-bold">{{ t.tomorrow }}</span>
          </div>

          <div @click="selectedFilter = {type: 'time', value: 'week'}; activeView = 'view'" 
               class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group"
               :class="selectedFilter.type === 'time' && selectedFilter.value === 'week' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'">
            <CalendarDays :size="20" :class="selectedFilter.type === 'time' && selectedFilter.value === 'week' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/>
            <span class="text-sm font-bold">{{ t.next7Days }}</span>
          </div>
          
          <div @click="activeView = 'calendar'" 
               class="flex items-center gap-3 px-4 py-2 cursor-pointer rounded-xl transition-all group"
               :class="activeView === 'calendar' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 dark:shadow-blue-900/20' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700/50'">
            <Calendar :size="20" :class="activeView === 'calendar' ? 'text-white' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'"/>
            <span class="text-sm font-bold">{{ t.calendar }}</span>
          </div>
        </nav>

        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 mt-6 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">标签</div>
          <div class="flex flex-wrap gap-1.5 px-4 py-1">
            <button 
              v-for="tag in allTags" :key="tag"
              @click="selectedTag = tag === selectedTag ? null : tag"
              class="px-2 py-1 text-[11px] font-bold rounded-lg border transition-all flex items-center gap-1"
              :class="selectedTag === tag ? 'bg-blue-600 text-white border-blue-600' : 'bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-blue-300'"
            >
              #{{ tag }}
            </button>
          </div>
        </nav>
        
        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 mt-6 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">活跃项目 ({{ activeProjects.length }})</div>
          <div v-for="p in activeProjects" :key="p.path" 
               @click="selectedFilter = {type: 'project', value: p.path}; activeView = 'view'"
               @dragover="onDragOver($event); activeProjectsDragOver = p.path"
               @dragleave="activeProjectsDragOver = null"
               @drop="activeProjectsDragOver = null; onSidebarDrop($event, p.path)"
               class="flex items-center gap-3 px-4 py-1.5 cursor-pointer rounded-xl transition-all group border-2 border-transparent"
               :class="[
                 selectedFilter.type === 'project' && selectedFilter.value === p.path ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700/50',
                 activeProjectsDragOver === p.path ? 'border-blue-400 bg-blue-50 dark:bg-blue-900/30' : ''
               ]">
            <div class="w-1.5 h-1.5 rounded-full bg-blue-500"></div>
            <span class="text-sm font-bold truncate flex-1">{{ p.displayName }}</span>
            <span class="text-[10px] font-bold text-slate-400 dark:text-slate-500">{{ p.incompleteCount }}</span>
          </div>
        </nav>

        <nav class="space-y-0.5">
          <div class="px-4 text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-[0.2em] mb-2 mt-6 flex items-center justify-between gap-2">
            <span class="flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100 dark:after:bg-slate-700">工作流与目录</span>
            <button @click="handleAddProject" class="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded text-blue-500 transition-colors">
              <Plus :size="16"/>
            </button>
          </div>
          <template v-for="p in projects" :key="p.path">
            <ProjectItem 
              :node="p" 
              :expanded="expandedGroups[p.path]"
              :icon="getGTDIcon(p.name)"
              :tip="getGTDTips(p.name)"
              :active="selectedFilter.type === 'project' && selectedFilter.value === p.path && activeView === 'view'"
              @toggle="expandedGroups[p.path] = !expandedGroups[p.path]"
              @select="(node) => { selectedFilter = {type: 'project', value: node.path}; activeView = 'view'; }"
              @rename="handleUpdateProject"
              @delete="handleDeleteProject"
              @drop-task="handleMoveTaskToProject"
            />
          </template>
        </nav>

        <div class="mt-8 p-4 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700">
           <div class="flex items-center gap-2 text-slate-400 dark:text-slate-500 mb-2">
              <Info :size="14"/>
              <span class="text-[10px] font-bold uppercase tracking-wider">GTD 核心理念</span>
           </div>
           <div v-if="currentFileHandle" class="mb-2">
               <span class="text-[9px] bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 px-1.5 py-0.5 rounded font-mono break-all">
                  {{ currentFileHandle.name }}
               </span>
           </div>
           <p class="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed italic">
              捕捉、理清、组织、回顾、执行。
           </p>
        </div>
      </div>
    </div>

    <!-- Settings Modal -->
    <div v-if="isSettingsOpen" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div class="bg-white w-full max-w-md rounded-3xl shadow-2xl border border-slate-100 overflow-hidden">
        <div class="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <h3 class="font-black text-slate-800 flex items-center gap-2">
            <Settings :size="20" class="text-blue-600"/>
            {{ t.settings }}
          </h3>
          <button @click="isSettingsOpen = false" class="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-all"><X :size="20"/></button>
        </div>
        
        <div class="p-8 space-y-8">
          <!-- File Management in Settings -->
          <section class="space-y-4">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">{{ t.fileManagement }}</h4>
            
            <div v-if="pendingDefaultHandle" @click="loadPendingDefault" 
                 class="p-4 bg-amber-50 text-amber-600 rounded-2xl text-sm font-bold cursor-pointer hover:bg-amber-100 transition-colors border border-amber-100 flex items-center gap-3">
              <RefreshCw :size="18" />
              <span>重连默认文件...</span>
            </div>

            <div v-if="fileChangedOnDisk" class="p-4 bg-red-50 text-red-600 rounded-2xl text-sm font-bold border border-red-100 space-y-3">
              <div class="flex items-center gap-3">
                 <RefreshCw :size="18" class="animate-spin"/>
                 <span>文件外部已更改</span>
              </div>
              <button @click="reloadFileFromDisk" class="w-full py-2 bg-red-100 hover:bg-red-200 rounded-xl transition-colors text-red-700">重新加载</button>
            </div>

            <div class="grid grid-cols-1 gap-3">
              <button @click="handleOpenFile" class="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 text-slate-700 hover:bg-blue-50 hover:text-blue-600 transition-all border border-slate-100 group">
                <div class="p-2 rounded-xl bg-white shadow-sm group-hover:bg-blue-100 transition-colors">
                  <FolderOpen :size="20" />
                </div>
                <span class="font-bold text-sm">{{ t.openFile }}</span>
              </button>

              <button @click="handleSaveFile" class="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 text-slate-700 hover:bg-emerald-50 hover:text-emerald-600 transition-all border border-slate-100 group">
                <div class="p-2 rounded-xl bg-white shadow-sm group-hover:bg-emerald-100 transition-colors">
                  <Save :size="20" />
                </div>
                <span class="font-bold text-sm">{{ currentFileHandle ? t.saveFile : t.saveAs }}</span>
              </button>

              <button v-if="currentFileHandle" @click="toggleDefaultFile" class="w-full p-4 flex items-center gap-4 rounded-2xl bg-slate-50 text-slate-700 hover:bg-amber-50 hover:text-amber-600 transition-all border border-slate-100 group">
                <div class="p-2 rounded-xl bg-white shadow-sm group-hover:bg-amber-100 transition-colors" :class="isDefaultFile ? 'text-amber-500' : ''">
                  <Pin :size="20" :class="isDefaultFile ? 'fill-current' : ''"/>
                </div>
                <span class="font-bold text-sm">{{ isDefaultFile ? t.unsetDefault : t.setDefault }}</span>
              </button>
            </div>
          </section>

          <!-- Language in Settings -->
          <section class="space-y-4">
            <h4 class="text-[10px] font-black text-slate-400 uppercase tracking-widest">{{ t.language }}</h4>
            <div class="flex p-1 bg-slate-100 rounded-2xl">
              <button @click="lang = 'zh'; localStorage.setItem('gtd-lang', 'zh')" 
                      class="flex-1 py-3 text-sm font-bold rounded-xl transition-all"
                      :class="lang === 'zh' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'">
                中文
              </button>
              <button @click="lang = 'en'; localStorage.setItem('gtd-lang', 'en')" 
                      class="flex-1 py-3 text-sm font-bold rounded-xl transition-all"
                      :class="lang === 'en' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'">
                English
              </button>
            </div>
          </section>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 bg-slate-50 dark:bg-slate-900 relative">
      <!-- Mobile Overlay -->
      <div v-if="sidebarOpen" @click="sidebarOpen = false" class="lg:hidden fixed inset-0 bg-slate-900/20 dark:bg-slate-900/40 backdrop-blur-sm z-10"></div>

      <header class="h-16 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between px-6 shrink-0 z-10">
        <div class="flex items-center gap-4">
          <button @click="sidebarOpen = !sidebarOpen" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors text-slate-400 dark:text-slate-500"><Menu :size="20"/></button>
          <h2 class="font-bold text-lg text-slate-700 dark:text-slate-200 truncate max-w-[150px] sm:max-w-[300px]">
            {{ getHeaderTitle }}
          </h2>
        </div>
        
        <div class="flex items-center gap-2 sm:gap-4">
          <div v-if="activeView === 'calendar'" class="hidden sm:flex items-center bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl">
            <button v-for="m in ['day', 'week', 'month']" :key="m" @click="calendarMode = m"
              class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="calendarMode === m ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'"
            >
              {{ m === 'day' ? '日' : m === 'week' ? '周' : '月' }}
            </button>
          </div>

          <div class="flex gap-2">
            <button 
              @click="activeView = (activeView === 'code' ? 'view' : 'code')" 
              class="px-3 py-2 sm:px-4 sm:py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
              :class="activeView === 'code' ? 'bg-blue-600 text-white' : 'bg-slate-900 dark:bg-slate-700 text-white hover:bg-slate-800 dark:hover:bg-slate-600'"
            >
              <Layout v-if="activeView === 'code'" :size="14"/>
              <FileText v-else :size="14"/>
              <span class="hidden sm:inline">{{ activeView === 'code' ? '返回视图' : '源码模式' }}</span>
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-hidden flex flex-col relative">
        
        <!-- Calendar View -->
        <div v-if="activeView === 'calendar'" class="flex-1 flex flex-col p-3 sm:p-6 overflow-hidden">
          <div class="flex justify-between items-center mb-4 sm:mb-6">
            <div class="flex gap-2">
              <button @click="navigateDate(-1)" class="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"><ChevronLeft :size="20"/></button>
              <button @click="viewDate = new Date()" class="px-4 sm:px-6 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-sm font-bold hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm text-slate-700 dark:text-slate-200">今</button>
              <button @click="navigateDate(1)" class="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors shadow-sm"><ChevronRight :size="20"/></button>
            </div>
            <div class="text-blue-600 dark:text-blue-400 font-bold bg-blue-50 dark:bg-blue-900/30 px-4 py-2 rounded-full text-xs sm:text-sm flex items-center gap-2 shadow-sm border border-blue-100 dark:border-blue-800">
                <CalendarDays :size="16"/> {{ calendarMode === 'week' ? '本周日程' : formatDate(viewDate) }}
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
                                         @click="selectedTaskForEdit = t"
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

        <!-- List View -->
        <div v-if="activeView === 'view'" class="flex-1 overflow-y-auto p-4 sm:p-8 space-y-4 max-w-3xl mx-auto w-full">
            <div class="flex items-center gap-3 mb-6 sm:mb-8">
               <div class="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100 dark:shadow-blue-900/20">
                  <ListTodo v-if="selectedFilter.type === 'all'" :size="24"/>
                  <Sun v-else-if="selectedFilter.type === 'time' && selectedFilter.value === 'today'" :size="24"/>
                  <Calendar v-else-if="selectedFilter.type === 'time' && selectedFilter.value === 'tomorrow'" :size="24"/>
                  <CalendarDays v-else-if="selectedFilter.type === 'time' && selectedFilter.value === 'week'" :size="24"/>
                  <component v-else :is="getGTDIcon(selectedFilter.value)" :size="24"/>
               </div>
               <div>
                  <h1 class="text-xl sm:text-2xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
                    {{ getHeaderTitle }}
                  </h1>
                  <p class="text-xs text-slate-400 dark:text-slate-500 font-medium">
                    <template v-if="selectedTag">
                      {{ t.tags }} "#{{ selectedTag }}" : {{ filteredTasks.length }}
                    </template>
                    <template v-else-if="selectedFilter?.type === 'all' || selectedFilter?.type === 'time'">
                      {{ (filteredTasks || []).length }} {{ t.allTasks }}
                    </template>
                    <template v-else-if="selectedFilter">
                      {{ t.todayTitle }}: {{ (allTasks || []).filter(t => t.projectPath && t.projectPath.startsWith(selectedFilter.value) && !t.completed).length }} / 
                      {{ t.allTasks }}: {{ (allTasks || []).filter(t => t.projectPath && t.projectPath.startsWith(selectedFilter.value)).length }}
                    </template>
                  </p>
               </div>
            </div>

            <div class="relative group mb-6 sm:mb-8">
               <Plus class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 group-focus-within:text-blue-500 transition-colors" :size="20"/>
               <input 
                  class="w-full pl-12 pr-4 py-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 dark:text-slate-200 placeholder:text-slate-300 dark:placeholder:text-slate-600"
                  :placeholder="selectedFilter.value === 'ALL' ? '捕捉灵感...' : `在 ${selectedFilter.value.split(' / ').pop()} 中添加任务...`"
                  v-model="newTaskInput"
                  @keydown.enter="addTask(null)"
               />
            </div>

            <div class="space-y-3 pb-20">
              <TaskCard 
                v-for="t in filteredTasks" 
                :key="t.id" 
                :task="t" 
                @toggle="handleToggle" 
                @delete="handleDeleteTask" 
                @update="handleUpdateTask"
                @convert-to-project="handleConvertTaskToProject"
                @dragstart="onDragStart"
              />
              
              <div v-if="filteredTasks.length === 0" class="py-12 sm:py-24 text-center">
                 <div class="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300 dark:text-slate-700">
                    <CheckCircle2 :size="32"/>
                 </div>
                 <p class="text-slate-400 dark:text-slate-600 font-medium italic">"没有找到匹配的任务。"</p>
              </div>
            </div>
        </div>

        <!-- Code View -->
        <div v-if="activeView === 'code'" class="flex-1 flex flex-col">
            <div class="bg-slate-800 dark:bg-slate-950 px-4 py-2 border-b border-slate-700 flex justify-between items-center shrink-0">
                <span class="text-[10px] font-mono text-slate-400 uppercase tracking-widest">gtd-storage.md</span>
                <span class="text-[10px] text-slate-500 italic">在此直接编辑 Markdown 同步视图</span>
            </div>
            <textarea 
                class="flex-1 p-10 font-mono text-xs bg-slate-900 dark:bg-slate-950 text-slate-300 dark:text-slate-400 outline-none leading-relaxed resize-none custom-scrollbar"
                v-model="markdown"
                spellcheck="false"
            />
        </div>

        <!-- Quick Add Modal -->
        <div v-if="quickAddDate" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div class="bg-white dark:bg-slate-800 w-full max-w-sm p-6 rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700">
            <div class="flex justify-between items-center mb-6">
              <h3 class="font-black text-slate-800 dark:text-slate-100 text-lg">规划时间段</h3>
              <button @click="quickAddDate = null" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400 transition-colors"><X :size="18"/></button>
            </div>
            <div class="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-2xl flex items-center gap-3 text-blue-600 dark:text-blue-400 font-bold text-sm border border-blue-100 dark:border-blue-800 shadow-inner">
               <Clock :size="18"/> {{ quickAddDate }}
            </div>
            <input 
              autofocus class="w-full p-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700 rounded-2xl mb-4 outline-none font-bold text-slate-700 dark:text-slate-200 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              placeholder="这个时段你要做什么？" v-model="newTaskInput"
              @keydown.enter="addTask(quickAddDate)"
            />
            <button @click="addTask(quickAddDate)" class="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95">确定加入日程</button>
          </div>
        </div>

        <!-- Task Edit Modal (for Calendar View) -->
        <div v-if="selectedTaskForEdit" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div class="bg-white dark:bg-slate-800 w-full max-w-lg p-1 overflow-hidden rounded-3xl shadow-2xl border border-slate-100 dark:border-slate-700">
             <div class="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50/50 dark:bg-slate-900/30">
               <h3 class="font-black text-slate-800 dark:text-slate-100">编辑任务详情</h3>
               <button @click="selectedTaskForEdit = null" class="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full text-slate-400"><X :size="18"/></button>
             </div>
             <div class="p-6">
               <TaskCard 
                 :task="selectedTaskForEdit" 
                 @toggle="handleToggle" 
                 @delete="(idx) => { handleDeleteTask(idx); selectedTaskForEdit = null; }" 
                 @update="(idx, updates) => { handleUpdateTask(idx, updates); selectedTaskForEdit = null; }"
                 @convert-to-project="(idx) => { handleConvertTaskToProject(idx); selectedTaskForEdit = null; }"
               />
             </div>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>