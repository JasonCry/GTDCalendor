<script setup>
import { 
  CheckCircle2, Circle, Trash2, Clock, ChevronDown, ChevronRight, ChevronUp, Tag, 
  Edit3, Check, X as CloseIcon, AlertCircle, ListTodo, Calendar, CornerDownRight,
  AlertTriangle, Square, CheckSquare, Repeat
} from 'lucide-vue-next';
import { ref, watch, nextTick, computed } from 'vue';
import { isBefore, parseISO, isValid } from 'date-fns';

const props = defineProps({
  task: { type: Object, required: true },
  isBatchMode: { type: Boolean, default: false },
  selected: { type: Boolean, default: false },
  isActive: { type: Boolean, default: false }
});

const emit = defineEmits(['toggle', 'toggle-subtask', 'delete', 'update', 'convert-to-project', 'dragstart', 'select-task', 'open-detail', 'make-subtask']);

const isSubtaskDropTarget = ref(false);

const isOverdue = computed(() => {
  if (!props.task.date || props.task.completed) return false;
  try {
    const dStr = props.task.date.includes(' ') ? props.task.date.replace(' ', 'T') : props.task.date;
    const taskDate = parseISO(dStr);
    return isValid(taskDate) && isBefore(taskDate, new Date());
  } catch (e) { return false; }
});

const formatContent = (text) => {
  if (!text) return '';
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  return text.replace(urlRegex, (url) => {
    return `<a href="${url}" target="_blank" class="text-blue-500 hover:underline inline-flex items-center gap-0.5" onclick="event.stopPropagation()">${url}</a>`;
  });
};

const getPriorityColor = (prio) => {
  if (prio === 1) return 'text-red-500 bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900';
  if (prio === 2) return 'text-amber-500 bg-amber-50 dark:bg-amber-950/20 border-amber-100 dark:border-amber-900';
  if (prio === 3) return 'text-blue-500 bg-blue-50 dark:bg-blue-900/20 border-blue-100 dark:border-blue-800';
  return 'text-slate-400 bg-slate-50 dark:bg-slate-900/20 border-slate-100 dark:border-slate-800';
};

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
</script>

<template>
  <div 
    class="flex flex-col p-2 px-3 bg-white dark:bg-slate-800 border rounded-2xl transition-all shadow-sm group cursor-grab active:cursor-grabbing mb-1"
    :class="[
      task.completed ? 'border-slate-100 dark:border-slate-700 opacity-60' : 'border-slate-200 dark:border-slate-700 hover:border-blue-300 dark:hover:border-blue-500 hover:shadow-md',
      selected ? 'border-blue-500 ring-2 ring-blue-500/20' : '',
      isActive ? 'border-blue-500 bg-blue-50/30 dark:bg-blue-900/20' : ''
    ]"
    draggable="true"
    @dragstart="emit('dragstart', $event, task)"
    @click="emit('open-detail', task)"
  >
    <div class="flex items-center gap-3">
      <!-- Batch Select Checkbox -->
      <button v-if="isBatchMode" 
              @click.stop="emit('select-task', task.id)"
              class="transition-all shrink-0 text-blue-600 dark:text-blue-400">
        <CheckSquare v-if="selected" :size="18" class="fill-current/10"/>
        <Square v-else :size="18"/>
      </button>

      <button v-else
              @click.stop="emit('toggle', task.lineIndex, task.completed)" 
              class="transition-all shrink-0"
              :class="task.completed ? 'text-emerald-500 dark:text-emerald-400' : 'text-slate-200 dark:text-slate-600 hover:text-blue-500 hover:scale-110 active:scale-90'"
      >
        <CheckCircle2 v-if="task.completed" :size="18"/>
        <Circle v-else :size="18"/>
      </button>
      
      <div class="flex-1 flex items-center gap-2 min-w-0">
        <span v-if="task.priority" 
              class="text-[9px] font-black px-1 py-0.5 rounded border shrink-0"
              :class="getPriorityColor(task.priority)">
          P{{ task.priority }}
        </span>
        
        <h4 
          class="font-bold text-sm transition-all truncate leading-tight flex-1"
          :class="task.completed ? 'text-slate-300 dark:text-slate-600 line-through' : 'text-slate-800 dark:text-slate-100'"
          v-html="formatContent(task.content)"
        ></h4>

        <!-- Tiny info tags for compact view -->
        <div class="flex items-center gap-1.5 shrink-0 ml-auto">
           <div v-if="task.date" class="text-[9px] font-black flex items-center gap-0.5"
                :class="isOverdue ? 'text-red-500' : 'text-blue-500 dark:text-blue-400'">
              <Clock :size="10"/>
              <span class="hidden sm:inline">{{ task.date.split(' ')[0].split('-').slice(1).join('/') }}</span>
           </div>
           
           <div v-if="task.subtasks?.length" class="text-[9px] font-bold text-slate-400 flex items-center gap-0.5">
              <ListTodo :size="10"/> {{ task.subtasks.filter(s => s.completed).length }}/{{ task.subtasks.length }}
           </div>

           <Repeat v-if="task.recurrence" :size="10" class="text-amber-500"/>
        </div>
      </div>
      
      <div class="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
        <button 
          @click.stop="emit('delete', task.lineIndex)"
          class="p-1.5 text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-all"
        >
           <Trash2 :size="14"/>
        </button>
      </div>
    </div>

    <!-- Subtasks Section (Restored for V0.0.9) -->
    <div v-if="task.subtasks && task.subtasks.length" class="mt-2 ml-7 space-y-1.5 border-l-2 border-slate-100 dark:border-slate-700/50 pl-3 pb-1">
      <div v-for="sub in task.subtasks" :key="sub.lineIndex" 
           class="flex items-center gap-2 group/sub cursor-pointer"
           @click.stop="emit('toggle-subtask', sub.lineIndex, sub.completed)">
        <button class="transition-all shrink-0"
                :class="sub.completed ? 'text-emerald-500/70 dark:text-emerald-400/60' : 'text-slate-300 dark:text-slate-600 hover:text-blue-400'">
          <CheckCircle2 v-if="sub.completed" :size="14"/>
          <Circle v-else :size="14"/>
        </button>
        <span class="text-xs transition-all font-medium"
              :class="sub.completed ? 'text-slate-400 dark:text-slate-500 line-through' : 'text-slate-600 dark:text-slate-300'">
          {{ sub.content }}
        </span>
      </div>
    </div>

    <!-- Drop Zone for Subtask conversion -->
    <div 
      @dragover.stop="onSubtaskDragOver"
      @dragleave.stop="isSubtaskDropTarget = false"
      @drop.stop="onSubtaskDrop"
      class="ml-8 mt-0.5 rounded-lg transition-all duration-200 flex items-center justify-center border-2 border-dashed border-transparent"
      :class="isSubtaskDropTarget ? 'h-8 border-blue-400 bg-blue-50/50 dark:bg-blue-900/30' : 'h-0.5'"
    >
      <span v-if="isSubtaskDropTarget" class="text-[8px] font-black text-blue-500 dark:text-blue-400 uppercase">建立子任务</span>
    </div>
  </div>
</template>