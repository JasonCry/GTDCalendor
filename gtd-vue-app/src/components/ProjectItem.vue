<script setup>
import { ChevronDown, ChevronRight, Edit2, Check, X, Trash2 } from 'lucide-vue-next';
import { defineProps, defineEmits, ref, nextTick } from 'vue';

const props = defineProps({
  node: { type: Object, required: true },
  expanded: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  icon: { type: [Object, Function], default: null }, 
  tip: { type: String, default: '' }
});

const emit = defineEmits(['toggle', 'select', 'rename', 'delete', 'drop-task']);

const hasChildren = props.node.children.length > 0;
const isEditing = ref(false);
const editName = ref('');
const inputRef = ref(null);
const isDragOver = ref(false);

const onDragOver = (e) => {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  isDragOver.value = true;
};

const onDrop = (e) => {
  isDragOver.value = false;
  try {
    const taskData = JSON.parse(e.dataTransfer.getData('task'));
    emit('drop-task', taskData.lineIndex, props.node.path);
  } catch (err) {
    console.error('Drop error:', err);
  }
};

const startRenaming = (e) => {
  e.stopPropagation();
  editName.value = props.node.name;
  isEditing.value = true;
  nextTick(() => inputRef.value?.focus());
};

const saveRename = () => {
  if (editName.value.trim() && editName.value !== props.node.name) {
    emit('rename', props.node.path, editName.value.trim());
  }
  isEditing.value = false;
};

const cancelRename = () => {
  isEditing.value = false;
};
</script>

<template>
  <div class="group/proj relative">
    <div 
      class="flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer transition-all border-2 border-transparent"
      :class="[
        active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100',
        isDragOver ? 'border-blue-400 bg-blue-50' : ''
      ]"
      @click="emit('select', node)"
      @dragover="onDragOver"
      @dragleave="isDragOver = false"
      @drop.stop="onDrop"
      :title="tip"
    >
      <button 
        class="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors" 
        @click.stop="emit('toggle', node.path)"
      >
        <template v-if="hasChildren">
          <ChevronDown v-if="expanded" :size="16" class="stroke-[3]"/>
          <ChevronRight v-else :size="16" class="stroke-[3]"/>
        </template>
        <template v-else>
          <component :is="icon" v-if="icon" :size="16" class="text-slate-400"/>
          <div v-else class="w-4" />
        </template>
      </button>
      
      <div v-if="isEditing" class="flex-1 flex items-center gap-1" @click.stop>
        <input 
          ref="inputRef"
          v-model="editName" 
          class="flex-1 bg-white border border-blue-300 rounded px-1.5 py-0.5 text-sm font-bold outline-none"
          @keydown.enter="saveRename"
          @keydown.esc="cancelRename"
        />
        <button @click="saveRename" class="text-emerald-500 hover:bg-emerald-50 p-1 rounded transition-colors"><Check :size="14"/></button>
      </div>
      <template v-else>
        <span class="text-sm truncate flex-1 tracking-tight" :class="active ? 'font-black' : 'font-bold'">
          {{ node.displayName || node.name }}
        </span>
        
        <button 
          @click="startRenaming"
          class="opacity-0 group-hover/proj:opacity-100 p-1 text-slate-300 hover:text-blue-500 rounded transition-all"
          title="重命名项目"
        >
          <Edit2 :size="12"/>
        </button>

        <button 
          @click.stop="emit('delete', node.path)"
          class="opacity-0 group-hover/proj:opacity-100 p-1 text-slate-300 hover:text-red-500 rounded transition-all"
          title="删除项目"
        >
          <Trash2 :size="12"/>
        </button>

        <span class="text-[10px] font-bold text-slate-400 px-1">
          {{ node.incompleteCount || 0 }}
        </span>
      </template>
    </div>
    
    <!-- Restrict to 2 levels (level 1 nodes can show children, level 2 nodes cannot) -->
    <div v-if="expanded && node.level < 2" class="ml-5 border-l-2 border-slate-50 pl-1 mt-1">
      <ProjectItem 
        v-for="child in node.children" 
        :key="child.path"
        :node="child"
        :expanded="expanded" 
        :active="active"
        @select="(n) => emit('select', n)"
        @toggle="(p) => emit('toggle', p)"
        @rename="(p, n) => emit('rename', p, n)"
        @delete="(p) => emit('delete', p)"
        @drop-task="(l, p) => emit('drop-task', l, p)"
        :tip="tip"
        :icon="icon"
      />
    </div>
  </div>
</template>



