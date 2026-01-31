<script setup>
import { CheckCircle2, Circle, Trash2, Clock } from 'lucide-vue-next';

const props = defineProps({
  task: { type: Object, required: true }
});

const emit = defineEmits(['toggle', 'delete']);
</script>

<template>
  <div 
    class="flex items-center gap-4 p-5 bg-white border rounded-3xl transition-all shadow-sm group"
    :class="task.completed ? 'border-slate-100 opacity-60' : 'border-slate-200 hover:border-blue-300 hover:shadow-md'"
  >
    <button 
      @click="emit('toggle', task.lineIndex, task.completed)" 
      class="transition-all"
      :class="task.completed ? 'text-emerald-500' : 'text-slate-200 hover:text-blue-500 hover:scale-110 active:scale-90'"
    >
      <CheckCircle2 v-if="task.completed" :size="24"/>
      <Circle v-else :size="24"/>
    </button>
    
    <div class="flex-1 min-w-0">
      <h4 
        class="font-bold text-sm truncate transition-all"
        :class="task.completed ? 'text-slate-300 line-through' : 'text-slate-800'"
      >
        {{ task.content }}
      </h4>
      <div class="flex items-center gap-4 mt-1.5">
         <div v-if="task.date" class="text-[10px] text-blue-500 font-black bg-blue-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-blue-100">
            <Clock :size="10"/> {{ task.date }}
         </div>
         <div class="text-[10px] text-slate-400 font-bold tracking-tight uppercase">
            # {{ task.projectPath.split(' / ').pop() }}
         </div>
      </div>
    </div>
    
    <button 
      @click="emit('delete', task.lineIndex)"
      class="opacity-0 group-hover:opacity-100 p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
      title="删除任务"
    >
       <Trash2 :size="16"/>
    </button>
  </div>
</template>
