<script setup>
import { 
  CheckCircle2, Circle, Trash2, Clock, ChevronDown, ChevronRight, ChevronUp, Tag, 
  Edit3, Check, X as CloseIcon, AlertCircle, ListTodo
} from 'lucide-vue-next';
import { ref, watch, nextTick } from 'vue';

const props = defineProps({
  task: { type: Object, required: true }
});

const emit = defineEmits(['toggle', 'delete', 'update', 'convert-to-project', 'dragstart']);

const showNotes = ref(false);
const isEditing = ref(false);
const editForm = ref({
  content: '',
  priority: null,
  tags: '',
  date: ''
});

const contentInput = ref(null);

const startEditing = () => {
  editForm.value = {
    content: props.task.content,
    priority: props.task.priority,
    tags: props.task.tags.join(' '),
    date: props.task.date || ''
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
    date: editForm.value.date || null
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
    class="flex flex-col p-4 bg-white border rounded-3xl transition-all shadow-sm group cursor-grab active:cursor-grabbing"
    :class="task.completed ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'"
    draggable="true"
    @dragstart="emit('dragstart', $event, task)"
  >
    <div v-if="!isEditing" class="flex items-start gap-3">
      <button 
        @click.stop="emit('toggle', task.lineIndex, task.completed)" 
        class="mt-1 transition-all shrink-0"
        :class="task.completed ? 'text-emerald-500' : 'text-slate-200 hover:text-blue-500 hover:scale-110 active:scale-90'"
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
            :class="task.completed ? 'text-slate-300 line-through' : 'text-slate-800'"
            v-html="formatContent(task.content)"
          ></h4>
        </div>

        <div class="flex items-center gap-3 flex-wrap">
           <div v-if="task.date" class="text-[10px] text-blue-500 font-black bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-100">
              <Clock :size="10"/> {{ task.date }}
           </div>
           
           <div v-if="task.tags && task.tags.length" class="flex items-center gap-1">
              <div v-for="tag in task.tags" :key="tag" 
                   class="text-[9px] text-slate-500 font-bold bg-slate-100 px-1.5 py-0.5 rounded-lg flex items-center gap-0.5">
                <Tag :size="8"/> {{ tag }}
              </div>
           </div>

           <div class="text-[10px] text-slate-400 font-bold tracking-tight uppercase">
              # {{ task.projectPath.split(' / ').pop() }}
           </div>
        </div>
      </div>
      
      <div class="flex items-center gap-1 shrink-0">
        <button v-if="task.notes && task.notes.length" 
                @click="showNotes = !showNotes"
                class="p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all">
          <ChevronDown v-if="!showNotes" :size="16"/>
          <ChevronUp v-else :size="16"/>
        </button>
        <button 
          @click="startEditing"
          class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
          title="编辑任务"
        >
           <Edit3 :size="16"/>
        </button>
        <button 
          @click.stop="emit('convert-to-project', task.lineIndex)"
          class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition-all"
          title="转换为清单"
        >
           <ListTodo :size="16"/>
        </button>
        <button 
          @click="emit('delete', task.lineIndex)"
          class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
          title="删除任务"
        >
           <Trash2 :size="16"/>
        </button>
      </div>
    </div>

    <!-- Edit Mode -->
    <div v-else class="space-y-4 animate-in fade-in zoom-in-95 duration-200">
      <div class="flex gap-3 items-start">
        <div class="mt-2 text-blue-500 shrink-0"><Edit3 :size="20"/></div>
        <textarea 
          ref="contentInput"
          v-model="editForm.content"
          class="flex-1 p-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-4 focus:ring-blue-500/10 focus:border-blue-500 transition-all text-sm font-bold text-slate-700 min-h-[80px] resize-none"
          placeholder="任务内容..."
        ></textarea>
      </div>
      
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 ml-8">
        <div class="space-y-2">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">优先级 & 日期</label>
          <div class="flex gap-2">
            <select v-model="editForm.priority" class="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none">
              <option :value="null">无优先级</option>
              <option :value="1">P1 (高)</option>
              <option :value="2">P2 (中)</option>
              <option :value="3">P3 (低)</option>
            </select>
            <input type="text" v-model="editForm.date" placeholder="YYYY-MM-DD HH:mm" class="flex-1 p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none" />
          </div>
        </div>
        <div class="space-y-2">
          <label class="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">标签 (空格分隔)</label>
          <div class="relative">
            <Tag class="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" :size="14"/>
            <input v-model="editForm.tags" class="w-full pl-9 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500 transition-all" placeholder="工作 生活 灵感..." />
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 ml-8 pt-2">
        <button @click="cancelEditing" class="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-100 rounded-xl transition-all flex items-center gap-2">
          <CloseIcon :size="14"/> 取消
        </button>
        <button @click="saveEditing" class="px-6 py-2 text-xs font-bold bg-blue-600 text-white rounded-xl hover:bg-blue-700 shadow-lg shadow-blue-200 transition-all flex items-center gap-2 active:scale-95">
          <Check :size="14"/> 保存更改
        </button>
      </div>
    </div>

    <!-- Notes Section -->
    <div v-if="showNotes && !isEditing && task.notes && task.notes.length" class="mt-3 pl-8 pr-4 py-3 bg-slate-50 rounded-2xl border border-slate-100 space-y-2">
      <div v-for="(note, nIdx) in task.notes" :key="nIdx" 
           class="text-xs text-slate-500 leading-relaxed break-words"
           v-html="formatContent(note)">
      </div>
    </div>
  </div>
</template>


