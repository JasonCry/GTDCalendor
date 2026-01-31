<script setup>
import {
  CheckCircle2, Circle, Trash2, Clock, ChevronDown, ChevronRight, ChevronUp, Tag, 
  Edit3, Check, X as CloseIcon, AlertCircle, ListTodo, Calendar, CornerDownRight,
  AlertTriangle
} from 'lucide-vue-next';
import { ref, watch, nextTick, computed } from 'vue';
import { isBefore, parseISO, isValid } from 'date-fns';

const props = defineProps({
  task: { type: Object, required: true }
});

const emit = defineEmits(['toggle', 'toggle-subtask', 'make-subtask', 'delete', 'update', 'convert-to-project', 'dragstart']);

const showNotes = ref(false);
const isEditing = ref(false);
const isSubtaskDropTarget = ref(false);

const isOverdue = computed(() => {
  if (!props.task.date || props.task.completed) return false;
  try {
    const dStr = props.task.date.includes(' ') ? props.task.date.replace(' ', 'T') : props.task.date;
    const taskDate = parseISO(dStr);
    return isValid(taskDate) && isBefore(taskDate, new Date());
  } catch (e) { return false; }
});
const onSubtaskDragOver = (e) => {
  e.preventDefault();
  e.stopPropagation();
  e.dataTransfer.dropEffect = 'move';
  isSubtaskDropTarget.value = true;
};

const onSubtaskDrop = (e) => {
  e.preventDefault();
  e.stopPropagation();
  isSubtaskDropTarget.value = false;
  try {
    const rawData = e.dataTransfer.getData('task');
    if (!rawData) return;
    const taskData = JSON.parse(rawData);
    if (taskData.lineIndex !== props.task.lineIndex) {
      emit('make-subtask', taskData.lineIndex, props.task.lineIndex);
    }
  } catch (err) {
    console.error('Subtask drop error:', err);
  }
};
const editForm = ref({
  content: '',
  priority: null,
  tags: '',
  date: '',
  recurrence: null
});

const datePart = computed({
  get: () => editForm.value.date ? editForm.value.date.split(' ')[0] : '',
  set: (val) => {
    const time = timePart.value || '';
    editForm.value.date = val ? (time ? `${val} ${time}` : val) : (time ? ` ${time}` : '');
  }
});

const timePart = computed({
  get: () => {
    if (!editForm.value.date) return '';
    const parts = editForm.value.date.split(' ');
    return parts.length > 1 ? parts[1] : '';
  },
  set: (val) => {
    const date = datePart.value || '';
    if (val) {
      editForm.value.date = date ? `${date} ${val}` : ` ${val}`;
    } else {
      editForm.value.date = date;
    }
  }
});

const contentInput = ref(null);

const startEditing = () => {
  editForm.value = {
    content: props.task.content,
    priority: props.task.priority,
    tags: props.task.tags.join(' '),
    date: props.task.date || '',
    recurrence: props.task.recurrence || null
  };
  isEditing.value = true;
  nextTick(() => {
    if (contentInput.value) contentInput.value.focus();
  });
};

const cancelEditing = () => {
  isEditing.value = false;
};

const saveEditing = () => {
  const tagsArray = editForm.value.tags.split(/\s+/).filter(t => t.length > 0);
  emit('update', props.task.lineIndex, {
    content: editForm.value.content,
    priority: editForm.value.priority,
    tags: tagsArray,
    date: editForm.value.date || null,
    recurrence: editForm.value.recurrence || null
  });
  isEditing.value = false;
};

const formatContent = (text) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" class="text-blue-500 hover:underline inline-flex items-center gap-0.5" onclick="event.stopPropagation()">${url}</a>`;
  });
};

const getPriorityColor = (prio) => {
  if (prio === 1) return 'text-red-500 bg-red-50 border-red-100';
  if (prio === 2) return 'text-amber-500 bg-amber-50 border-amber-100';
  if (prio === 3) return 'text-blue-500 bg-blue-50 border-blue-100';
  return 'text-slate-400 bg-slate-50 border-slate-100';
};
</script>

<template>
  <div 
    class="flex flex-col p-4 bg-white dark:bg-slate-800 border rounded-3xl transition-all shadow-sm group cursor-grab active:cursor-grabbing"
    :class="task.completed ? 'border-slate-100 dark:border-slate-700 opacity-60' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md'"
    draggable="true"
    @dragstart="emit('dragstart', $event, task)"
  >
    <div v-if="!isEditing" class="flex items-start gap-3">
      <button 
        @click.stop="emit('toggle', task.lineIndex, task.completed)" 
        class="mt-1 transition-all shrink-0"
        :class="task.completed ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-200 dark:text-slate-600 hover:text-blue-500 hover:scale-110 active:scale-90'"
      >
        <CheckCircle2 v-if="task.completed" :size="20"/>
        <Circle v-else :size="20"/>
      </button>
      
      <div class="flex-1 min-w-0" @click="startEditing">
        <div class="flex items-center gap-2 flex-wrap mb-1">
          <span v-if="task.priority" 
                class="text-[10px] font-black px-1.5 py-0.5 rounded border"
                :class="getPriorityColor(task.priority)">
            P{{ task.priority }}
          </span>
          <h4 
            class="font-bold text-sm transition-all break-words"
            :class="task.completed ? 'text-slate-300 dark:text-slate-600 line-through' : 'text-slate-800 dark:text-slate-100'"
            v-html="formatContent(task.content)"
          ></h4>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
           <div v-if="task.date" class="text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 border transition-colors"
                :class="isOverdue ? 'text-red-600 bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800' : 'text-blue-500 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800'">
              <AlertTriangle v-if="isOverdue" :size="10" class="animate-pulse"/>
              <Clock v-else :size="10"/> {{ task.date }}
           </div>

           <div v-if="task.recurrence" class="text-[10px] text-amber-600 dark:text-amber-400 font-black bg-amber-50 dark:bg-amber-900/30 px-2 py-0.5 rounded-full flex items-center gap-1 border border-amber-100 dark:border-amber-800">
              <Repeat :size="10"/> {{ task.recurrence === 'day' ? '每天' : task.recurrence === 'week' ? '每周' : '每月' }}
           </div>
           
           <div v-if="task.tags && task.tags.length" class="flex items-center gap-1">
              <div v-for="tag in task.tags" :key="tag" 
                   class="text-[9px] text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                <Tag :size="8"/> {{ tag }}
              </div>
           </div>

           <div class="text-[10px] text-slate-400 dark:text-slate-500 font-bold tracking-tight uppercase">
              # {{ task.projectPath.split(' / ').pop() }}
           </div>
        </div>
      </div>
      
      <div class="flex items-center gap-1 shrink-0">
        <button v-if="task.notes && task.notes.length" 
                @click="showNotes = !showNotes"
                class="p-2 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all">
          <ChevronDown v-if="!showNotes" :size="16"/>
          <ChevronUp v-else :size="16"/>
        </button>
        <button 
          @click="startEditing"
          class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
          title="编辑任务"
        >
           <Edit3 :size="16"/>
        </button>
        <button 
          @click.stop="emit('convert-to-project', task.lineIndex)"
          class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-600 hover:text-blue-500 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-xl transition-all"
          title="转换为清单"
        >
           <ListTodo :size="16"/>
        </button>
        <button 
          @click="emit('delete', task.lineIndex)"
          class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-xl transition-all"
          title="删除任务"
        >
           <Trash2 :size="16"/>
        </button>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-else class="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div class="flex gap-3 items-start">
        <div class="mt-2 text-blue-500 dark:text-blue-400 shrink-0"><Edit3 :size="20"/></div>
        <textarea 
          ref="contentInput"
          v-model="editForm.content"
          class="flex-1 p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold text-slate-700 dark:text-slate-200 min-h-[80px] resize-none"
          placeholder="任务内容..."
        ></textarea>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-8">
        <div class="space-y-2">
          <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">优先级 & 截止日期</label>
          <div class="flex flex-col gap-2">
            <div class="flex gap-2">
              <select v-model="editForm.priority" class="w-24 p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none dark:text-slate-200">
                <option :value="null">无</option>
                <option :value="1">P1</option>
                <option :value="2">P2</option>
                <option :value="3">P3</option>
              </select>
              <div class="flex-1 flex gap-1">
                <div class="relative flex-1">
                  <Calendar class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none" :size="12"/>
                  <input type="date" v-model="datePart" class="w-full pl-8 pr-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all dark:text-slate-200" />
                </div>
                <div class="relative w-28">
                  <Clock class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-600 pointer-events-none" :size="12"/>
                  <input type="time" v-model="timePart" class="w-full pl-8 pr-2 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all dark:text-slate-200" />
                </div>
              </div>
            </div>
            <input type="text" v-model="editForm.date" placeholder="手动编辑日期 (如: 2024-05-20 14:00)" class="w-full p-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-[10px] font-bold outline-none text-slate-400 dark:text-slate-500 italic" />
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">重复周期</label>
          <div class="relative">
            <Repeat class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" :size="14"/>
            <select v-model="editForm.recurrence" class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none dark:text-slate-200 appearance-none transition-all focus:border-blue-500">
              <option :value="null">不重复</option>
              <option value="day">每天</option>
              <option value="week">每周</option>
              <option value="month">每月</option>
            </select>
          </div>
        </div>

        <div class="space-y-2">
          <label class="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest px-1">标签 (空格分隔)</label>
          <div class="relative">
            <Tag class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600" :size="14"/>
            <input v-model="editForm.tags" class="w-full pl-9 pr-4 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all dark:text-slate-200" placeholder="工作 生活 灵感..." />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 ml-8 pt-2">
        <button @click="cancelEditing" class="px-4 py-2 text-xs font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-xl transition-all flex items-center gap-2">
          <CloseIcon :size="14"/> 取消
        </button>
        <button @click="saveEditing" class="px-6 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 dark:shadow-blue-900/20 transition-all flex items-center gap-2 active:scale-95">
          <Check :size="14"/> 保存更改
        </button>
      </div>
    </div>

    <!-- Subtasks Section -->
    <div v-if="!isEditing && task.subtasks && task.subtasks.length" class="mt-3 ml-8 space-y-2 border-l-2 border-slate-100 dark:border-slate-700/50 pl-4">
      <div v-for="sub in task.subtasks" :key="sub.lineIndex" 
           class="flex items-center gap-2 group/sub cursor-pointer"
           @click.stop="emit('toggle-subtask', sub.lineIndex, sub.completed)">
        <button class="transition-all shrink-0"
                :class="sub.completed ? 'text-emerald-500/70 dark:text-emerald-400/60' : 'text-slate-300 dark:text-slate-600 hover:text-blue-400'">
          <CheckCircle2 v-if="sub.completed" :size="14"/>
          <Circle v-else :size="14"/>
        </button>
        <span class="text-xs transition-all font-medium"
              :class="sub.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-600 dark:text-slate-200'">
          {{ sub.content }}
        </span>
      </div>
    </div>

    <!-- Indent to Subtask Drop Zone (Right-shifted strip) -->
    <div 
      v-if="!isEditing"
      @dragover.stop="onSubtaskDragOver"
      @dragleave.stop="isSubtaskDropTarget = false"
      @drop.stop="onSubtaskDrop"
      class="ml-12 mt-1 rounded-xl transition-all duration-200 flex items-center justify-center border-2 border-dashed border-transparent"
      :class="isSubtaskDropTarget ? 'h-12 border-blue-400 bg-blue-50/50 dark:bg-blue-900/30 py-4' : 'h-1'"
    >
      <span v-if="isSubtaskDropTarget" class="text-[10px] font-black text-blue-500 dark:text-blue-400 uppercase tracking-widest flex items-center gap-2 animate-pulse">
        <CornerDownRight :size="14"/> 松开以建立子任务 (缩进)
      </span>
    </div>

    <!-- Notes Section -->

    <div v-if="showNotes && !isEditing && task.notes && task.notes.length" class="mt-3 pl-8 pr-4 py-3 bg-slate-50 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-2">
      <div v-for="(note, nIdx) in task.notes" :key="nIdx" 
           class="text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words"
           v-html="formatContent(note)">
      </div>
    </div>
  </div>
</template>


