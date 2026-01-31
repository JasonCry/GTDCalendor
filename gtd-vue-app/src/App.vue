<script setup>
import { ref, computed, watch, onMounted, nextTick, shallowRef, onUnmounted } from 'vue';
import { 
  CheckCircle2, Layout, FileText, Plus, Menu, Inbox, Hash, Zap, Coffee, Hourglass, 
  ListTodo, Info, ChevronLeft, ChevronRight, CalendarDays, Clock, Trash2, X, Calendar as CalendarIcon,
  FolderOpen, Save, RefreshCw, Pin
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
const sidebarOpen = ref(true);
const newTaskInput = ref('');
const expandedGroups = ref({'📥 收件箱': true, '⚡ 下一步行动': true});
const isSaving = ref(false);
const viewDate = ref(new Date());
const quickAddDate = ref(null);

const selectionStart = ref(null);
const selectionEnd = ref(null);
const isSelecting = ref(false);

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
  const lines = markdown.value.split('\n');
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
});

const projects = computed(() => parsedData.value.projects);
const allTasks = computed(() => parsedData.value.allTasks);

const calendarDays = computed(() => {
  const days = [];
  if (calendarMode.value === 'month') {
    const year = viewDate.value.getFullYear();
    const month = viewDate.value.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) {
      const d = formatDate(new Date(year, month, i));
      days.push({ date: d, day: i, tasks: allTasks.value.filter(t => isDateInRange(d, t.date)) });
    }
  } else if (calendarMode.value === 'week') {
    const start = getStartOfWeek(viewDate.value);
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setDate(start.getDate() + i);
      const ds = formatDate(d);
      days.push({ date: ds, day: d.getDate(), tasks: allTasks.value.filter(t => isDateInRange(ds, t.date)) });
    }
  } else if (calendarMode.value === 'day') {
    const ds = formatDate(viewDate.value);
    days.push({ date: ds, day: viewDate.value.getDate(), tasks: allTasks.value.filter(t => isDateInRange(ds, t.date)) });
  }
  return days;
});

const hours = Array.from({ length: 24 }, (_, i) => i);
const timeSlots = Array.from({ length: 24 * 4 }, (_, i) => i * 15);

// --- Actions ---
const handleToggle = (idx, status) => {
  const lines = markdown.value.split('\n');
  lines[idx] = status ? lines[idx].replace('- [x]', '- [ ]') : lines[idx].replace('- [ ]', '- [x]');
  markdown.value = lines.join('\n');
};

const handleDeleteTask = (idx) => {
  const lines = markdown.value.split('\n');
  lines.splice(idx, 1);
  markdown.value = lines.join('\n');
};

const addTask = (dateInfo = null) => {
  if (!newTaskInput.value.trim()) return;
  const lines = markdown.value.split('\n');
  let content = `- [ ] ${newTaskInput.value.trim()}`;
  if (dateInfo) content += ` @${dateInfo}`;
  
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
  <div class="flex h-screen bg-slate-50 text-slate-900 overflow-hidden font-sans select-none" @mouseup="handleGlobalMouseUp">
    <!-- Sidebar -->
    <div :class="[sidebarOpen ? 'w-80' : 'w-0', 'bg-white border-r border-slate-200 transition-all duration-300 flex flex-col overflow-hidden z-20']">
      <div class="p-6 flex items-center justify-between">
         <div class="flex items-center gap-3 font-black text-xl text-blue-600">
           <CheckCircle2 class="w-8 h-8" /> <span>GTD Flow</span>
         </div>
         <div class="px-2 py-1 rounded text-[10px] font-bold border" :class="isSaving ? 'text-amber-500 bg-amber-50 border-amber-100' : 'text-emerald-500 bg-emerald-50 border-emerald-100'">
            {{ isSaving ? 'SAVING...' : 'V0.0.2' }}
         </div>
      </div>
      
      <div class="flex-1 overflow-y-auto px-4 space-y-6 pb-10">
        <!-- File Management Section -->
        <nav class="space-y-1">
           <div class="px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100">文件管理</div>
           
           <div v-if="pendingDefaultHandle" @click="loadPendingDefault" 
                class="mx-4 mb-2 p-3 bg-amber-50 text-amber-600 rounded-2xl text-xs font-bold cursor-pointer hover:bg-amber-100 transition-colors border border-amber-100 flex items-center gap-2">
             <RefreshCw :size="16" />
             <span>重连默认文件...</span>
           </div>

           <div v-if="fileChangedOnDisk" class="mx-4 mb-2 p-3 bg-red-50 text-red-600 rounded-2xl text-xs font-bold border border-red-100">
             <div class="flex items-center gap-2 mb-2">
                <RefreshCw :size="16" class="animate-spin"/>
                <span>文件外部已更改</span>
             </div>
             <button @click="reloadFileFromDisk" class="w-full py-1.5 bg-red-100 hover:bg-red-200 rounded-lg transition-colors text-red-700">重新加载</button>
           </div>
           
           <div class="flex items-center gap-2 px-4 py-1">
               <button @click="handleOpenFile" 
                       class="flex-1 p-2.5 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-blue-600 transition-all border border-slate-100 shadow-sm active:scale-95" 
                       title="打开本地文件">
                   <FolderOpen :size="18" />
               </button>

               <button @click="handleSaveFile" 
                       class="flex-1 p-2.5 flex items-center justify-center rounded-xl bg-slate-50 text-slate-500 hover:bg-slate-100 hover:text-emerald-600 transition-all border border-slate-100 shadow-sm active:scale-95"
                       :title="currentFileHandle ? '保存更改' : '另存为...'">
                   <Save :size="18" />
               </button>

               <button v-if="currentFileHandle" 
                       @click="toggleDefaultFile" 
                       class="flex-1 p-2.5 flex items-center justify-center rounded-xl border shadow-sm transition-all active:scale-95"
                       :class="isDefaultFile ? 'bg-amber-50 border-amber-100 text-amber-500' : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100 hover:text-amber-500'"
                       :title="isDefaultFile ? '已设为默认文件' : '设为默认文件'">
                   <Pin :size="18" :class="isDefaultFile ? 'fill-current' : ''"/>
               </button>
           </div>
        </nav>

        <nav class="space-y-1">
          <div class="px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 mt-8 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100">主视图切换</div>
          
          <div @click="selectedFilter = {type: 'all', value: 'ALL'}; activeView = 'view'" 
               class="flex items-center gap-3 px-4 py-3 cursor-pointer rounded-2xl font-black transition-all group"
               :class="activeView === 'view' && selectedFilter.value === 'ALL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-1' : 'text-slate-500 hover:bg-slate-100 hover:translate-x-1'">
            <ListTodo :size="18" :class="activeView === 'view' && selectedFilter.value === 'ALL' ? 'text-white' : 'text-slate-300 group-hover:text-blue-500'"/>
            <span class="text-xs">清单模式</span>
          </div>
          
          <div @click="activeView = 'calendar'" 
               class="flex items-center gap-3 px-4 py-3 cursor-pointer rounded-2xl font-black transition-all group"
               :class="activeView === 'calendar' ? 'bg-blue-600 text-white shadow-lg shadow-blue-200 translate-x-1' : 'text-slate-500 hover:bg-slate-100 hover:translate-x-1'">
            <CalendarIcon :size="18" :class="activeView === 'calendar' ? 'text-white' : 'text-slate-300 group-hover:text-blue-500'"/>
            <span class="text-xs">日历日程</span>
          </div>
        </nav>
        
        <nav class="space-y-1">
          <div class="px-4 text-[9px] font-black text-slate-300 uppercase tracking-[0.2em] mb-2 mt-8 flex items-center gap-2 after:content-[''] after:h-[1px] after:flex-1 after:bg-slate-100">GTD 工作流 / 项目</div>
          <template v-for="p in projects" :key="p.path">
            <ProjectItem 
              :node="p" 
              :expanded="expandedGroups[p.path]"
              :icon="getGTDIcon(p.name)"
              :tip="getGTDTips(p.name)"
              :active="selectedFilter.value === p.path && activeView === 'view'"
              @toggle="expandedGroups[p.path] = !expandedGroups[p.path]"
              @select="(node) => { selectedFilter = {type: 'project', value: node.path}; activeView = 'view'; }"
            />
          </template>
        </nav>

        <div class="mt-8 p-4 bg-slate-50 rounded-2xl border border-slate-100">
           <div class="flex items-center gap-2 text-slate-400 mb-2">
              <Info :size="14"/>
              <span class="text-[10px] font-bold uppercase tracking-wider">GTD 核心理念</span>
           </div>
           <div v-if="currentFileHandle" class="mb-2">
               <span class="text-[9px] bg-emerald-50 text-emerald-600 border border-emerald-100 px-1.5 py-0.5 rounded font-mono break-all">
                  {{ currentFileHandle.name }}
               </span>
           </div>
           <p class="text-[11px] text-slate-500 leading-relaxed italic">
              捕捉、理清、组织、回顾、执行。
           </p>
        </div>
      </div>
    </div>

    <!-- Main Content -->
    <div class="flex-1 flex flex-col min-w-0 bg-slate-50">
      <header class="h-16 bg-white border-b border-slate-200 flex items-center justify-between px-6 shrink-0 z-10">
        <div class="flex items-center gap-4">
          <button @click="sidebarOpen = !sidebarOpen" class="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-400"><Menu :size="20"/></button>
          <h2 class="font-bold text-lg text-slate-700 truncate max-w-[200px]">
            {{ activeView === 'calendar' 
              ? `${viewDate.getFullYear()}年 ${viewDate.getMonth() + 1}月` 
              : (selectedFilter.value === 'ALL' ? '所有任务清单' : `${selectedFilter.value.split(' / ').pop()} 清单`)
            }}
          </h2>
        </div>
        
        <div class="flex items-center gap-4">
          <div v-if="activeView === 'calendar'" class="flex items-center bg-slate-100 p-1 rounded-xl">
            <button v-for="m in ['day', 'week', 'month']" :key="m" @click="calendarMode = m"
              class="px-4 py-1.5 text-xs font-bold rounded-lg transition-all"
              :class="calendarMode === m ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'"
            >
              {{ m === 'day' ? '日' : m === 'week' ? '周' : '月' }}
            </button>
          </div>

          <div class="flex gap-2">
            <button 
              @click="activeView = (activeView === 'code' ? 'view' : 'code')" 
              class="px-4 py-2 text-xs font-bold rounded-xl transition-all flex items-center gap-2"
              :class="activeView === 'code' ? 'bg-blue-600 text-white' : 'bg-slate-900 text-white hover:bg-slate-800'"
            >
              <Layout v-if="activeView === 'code'" :size="14"/>
              <FileText v-else :size="14"/>
              {{ activeView === 'code' ? '返回视图' : '源码模式' }}
            </button>
          </div>
        </div>
      </header>

      <main class="flex-1 overflow-hidden flex flex-col relative">
        
        <!-- Calendar View -->
        <div v-if="activeView === 'calendar'" class="flex-1 flex flex-col p-6 overflow-hidden">
          <div class="flex justify-between items-center mb-6">
            <div class="flex gap-2">
              <button @click="navigateDate(-1)" class="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"><ChevronLeft :size="20"/></button>
              <button @click="viewDate = new Date()" class="px-6 py-2 bg-white border border-slate-200 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shadow-sm">今天</button>
              <button @click="navigateDate(1)" class="p-2 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors shadow-sm"><ChevronRight :size="20"/></button>
            </div>
            <div class="text-blue-600 font-bold bg-blue-50 px-4 py-2 rounded-full text-sm flex items-center gap-2 shadow-sm border border-blue-100">
                <CalendarDays :size="16"/> {{ calendarMode === 'week' ? '本周日程' : formatDate(viewDate) }}
            </div>
          </div>

          <div class="flex-1 bg-white rounded-3xl border border-slate-200 shadow-sm flex flex-col overflow-hidden">
            <!-- Header Row -->
            <div class="grid border-b border-slate-100 bg-slate-50/50 shrink-0"
                 :class="calendarMode === 'month' ? 'grid-cols-7' : 'grid-cols-[80px_1fr]'">
                <template v-if="calendarMode === 'month'">
                    <div v-for="d in ['周日', '周一', '周二', '周三', '周四', '周五', '周六']" :key="d" 
                         class="py-3 text-center text-[10px] font-black text-slate-400 uppercase tracking-widest border-r last:border-0 border-slate-100">
                         {{d}}
                    </div>
                </template>
                <template v-else>
                    <div class="w-20 border-r border-slate-100" />
                    <div class="grid w-full" :class="calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'">
                        <div v-for="(day, idx) in calendarDays" :key="idx" class="py-3 text-center border-r last:border-0 border-slate-100">
                            <div class="text-[10px] font-black text-slate-400 uppercase tracking-tighter">
                                {{ day ? ['周日', '周一', '周二', '周三', '周四', '周五', '周六'][new Date(day.date).getDay()] : '' }}
                            </div>
                            <div class="text-sm font-black mt-1" :class="day?.date === getToday() ? 'text-blue-600 underline underline-offset-4 decoration-2' : 'text-slate-700'">
                                {{ day ? day.day : '' }}
                            </div>
                        </div>
                    </div>
                </template>
            </div>
            
            <!-- Body -->
            <div ref="scrollRef" class="flex-1 overflow-y-auto custom-scrollbar relative bg-[#fafafa]">
              <div class="h-full" :class="calendarMode === 'month' ? 'grid grid-cols-7' : 'flex'">
                
                <template v-if="calendarMode === 'day' || calendarMode === 'week'">
                    <div class="relative min-h-[1440px] flex flex-1">
                        <!-- Time Column -->
                        <div class="w-20 border-r border-slate-100 bg-slate-50/50 shrink-0 sticky left-0 z-30">
                            <div v-for="hour in hours" :key="hour" class="h-[60px] relative border-b border-slate-50">
                                <span class="absolute -top-2 right-3 text-[10px] font-bold text-slate-300">
                                    {{ String(hour).padStart(2, '0') }}:00
                                </span>
                            </div>
                        </div>
                        
                        <!-- Columns -->
                        <div class="grid flex-1 relative bg-white" :class="calendarMode === 'day' ? 'grid-cols-1' : 'grid-cols-7'">
                            <div v-for="(day, dayIdx) in calendarDays" :key="dayIdx"
                                class="relative border-r last:border-0 border-slate-100"
                                @dragover.prevent
                                @drop="(e) => day && onDrop(e, day.date)">
                                
                                <!-- Time Slots Background & Selection -->
                                <div v-for="mTotal in timeSlots" :key="mTotal"
                                     class="h-[15px] w-full relative group/slot"
                                     :class="mTotal % 60 === 45 ? 'border-b border-slate-100/60' : ''"
                                     @mousedown="day && handleTimeMouseDown(day.date, mTotal)"
                                     @mouseenter="day && handleTimeMouseEnter(day.date, mTotal)">
                                    <div class="absolute inset-x-0 top-0 h-[1px] bg-blue-500/0 group-hover/slot:bg-blue-500/20 pointer-events-none" />
                                    <div v-if="isSelecting && selectionStart?.date === day?.date && 
                                              mTotal >= Math.min(selectionStart.minutes, selectionEnd.minutes) &&
                                              mTotal <= Math.max(selectionStart.minutes, selectionEnd.minutes)"
                                         class="absolute inset-0 bg-blue-100/50 pointer-events-none border-x-2 border-blue-400" />
                                </div>

                                <!-- Tasks -->
                                <template v-if="day">
                                  <div v-for="t in day.tasks" :key="t.id">
                                    <div v-if="parseTaskTime(t.date)" 
                                         draggable="true"
                                         @dragstart="(e) => onDragStart(e, t)"
                                         class="absolute left-1.5 right-1.5 px-2 py-1.5 rounded-xl border shadow-sm transition-all hover:shadow-md cursor-grab active:cursor-grabbing z-10 overflow-hidden group/task"
                                         :class="t.completed ? 'bg-slate-50 border-slate-200 text-slate-400 opacity-60' : 'bg-white border-blue-200 text-slate-800 border-l-4 border-l-blue-500'"
                                         :style="{ top: `${parseTaskTime(t.date).totalMinutes}px`, height: '48px' }">
                                        
                                        <div class="text-[10px] font-bold truncate leading-tight" :class="t.completed ? 'line-through' : ''">{{ t.content }}</div>
                                        <div class="text-[8px] text-slate-400 mt-1 flex items-center justify-between">
                                            <span class="flex items-center gap-1 font-mono"><Clock :size="8"/> {{ formatMinutesToTime(parseTaskTime(t.date).totalMinutes) }}</span>
                                            <button 
                                                @click.stop="handleDeleteTask(t.lineIndex)"
                                                class="opacity-0 group-hover/task:opacity-100 text-red-400 hover:text-red-600 transition-opacity"
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
                         class="min-h-[140px] p-2 border-r border-b border-slate-100 relative"
                         :class="!day ? 'bg-slate-50/30' : 'hover:bg-slate-50/50 transition-colors'">
                        <template v-if="day">
                            <div class="text-[10px] font-black w-6 h-6 flex items-center justify-center rounded-full mb-2"
                                 :class="day.date === getToday() ? 'bg-blue-600 text-white' : 'text-slate-400'">
                                {{ day.day }}
                            </div>
                            <div class="space-y-1">
                                <div v-for="t in day.tasks" :key="t.id" class="text-[9px] truncate px-1.5 py-1 bg-white border border-slate-100 rounded text-slate-600 shadow-xs">
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
        <div v-if="activeView === 'view'" class="flex-1 overflow-y-auto p-8 space-y-4 max-w-3xl mx-auto w-full">
            <div class="flex items-center gap-3 mb-8">
               <div class="p-3 bg-blue-600 text-white rounded-2xl shadow-lg shadow-blue-100">
                  <ListTodo v-if="selectedFilter.value === 'ALL'" :size="24"/>
                  <component v-else :is="getGTDIcon(selectedFilter.value)" :size="24"/>
               </div>
               <div>
                  <h1 class="text-2xl font-black text-slate-800 tracking-tight">
                    {{ selectedFilter.value === 'ALL' ? '所有待办' : selectedFilter.value.split(' / ').pop() }}
                  </h1>
                  <p class="text-xs text-slate-400 font-medium">共 {{ allTasks.filter(t => selectedFilter.value === 'ALL' || t.projectPath.startsWith(selectedFilter.value)).length }} 个任务项</p>
               </div>
            </div>

            <div class="relative group mb-8">
               <Plus class="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors" :size="20"/>
               <input 
                  class="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl outline-none shadow-sm focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all font-medium text-slate-700 placeholder:text-slate-300"
                  :placeholder="selectedFilter.value === 'ALL' ? '捕捉灵感...' : `在 ${selectedFilter.value.split(' / ').pop()} 中添加任务...`"
                  v-model="newTaskInput"
                  @keydown.enter="addTask(null)"
               />
            </div>

            <div class="space-y-3">
              <TaskCard 
                v-for="t in allTasks.filter(t => selectedFilter.value === 'ALL' || t.projectPath.startsWith(selectedFilter.value))" 
                :key="t.id" 
                :task="t" 
                @toggle="handleToggle" 
                @delete="handleDeleteTask" 
              />
              
              <div v-if="allTasks.filter(t => selectedFilter.value === 'ALL' || t.projectPath.startsWith(selectedFilter.value)).length === 0" class="py-24 text-center">
                 <div class="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-300">
                    <CheckCircle2 :size="32"/>
                 </div>
                 <p class="text-slate-400 font-medium italic">"你的清单清空了，真是了不起的专注力。"</p>
              </div>
            </div>
        </div>

        <!-- Code View -->
        <div v-if="activeView === 'code'" class="flex-1 flex flex-col">
            <div class="bg-slate-800 px-4 py-2 border-b border-slate-700 flex justify-between items-center shrink-0">
                <span class="text-[10px] font-mono text-slate-400 uppercase tracking-widest">gtd-storage.md</span>
                <span class="text-[10px] text-slate-500 italic">在此直接编辑 Markdown 同步视图</span>
            </div>
            <textarea 
                class="flex-1 p-10 font-mono text-xs bg-slate-900 text-slate-300 outline-none leading-relaxed resize-none custom-scrollbar"
                v-model="markdown"
                spellcheck="false"
            />
        </div>

        <!-- Quick Add Modal -->
        <div v-if="quickAddDate" class="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
          <div class="bg-white w-full max-w-sm p-6 rounded-3xl shadow-2xl border border-slate-100">
            <div class="flex justify-between items-center mb-6">
              <h3 class="font-black text-slate-800 text-lg">规划时间段</h3>
              <button @click="quickAddDate = null" class="p-2 hover:bg-slate-100 rounded-full text-slate-400 transition-colors"><X :size="18"/></button>
            </div>
            <div class="mb-6 p-4 bg-blue-50 rounded-2xl flex items-center gap-3 text-blue-600 font-bold text-sm border border-blue-100 shadow-inner">
               <Clock :size="18"/> {{ quickAddDate }}
            </div>
            <input 
              autofocus class="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl mb-4 outline-none font-bold text-slate-700 focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all"
              placeholder="这个时段你要做什么？" v-model="newTaskInput"
              @keydown.enter="addTask(quickAddDate)"
            />
            <button @click="addTask(quickAddDate)" class="w-full py-4 bg-blue-600 text-white font-black rounded-2xl hover:bg-blue-700 transition-all shadow-xl shadow-blue-200 active:scale-95">确定加入日程</button>
          </div>
        </div>

      </main>
    </div>
  </div>
</template>