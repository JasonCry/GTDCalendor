<script setup>
import { ChevronDown, ChevronRight, Hash } from 'lucide-vue-next';
import { defineProps, defineEmits } from 'vue';

const props = defineProps({
  node: { type: Object, required: true },
  expanded: { type: Boolean, default: false },
  active: { type: Boolean, default: false },
  icon: { type: Object, default: null }, // Expecting a Vue Component or VNode
  tip: { type: String, default: '' }
});

const emit = defineEmits(['toggle', 'select']);

const hasChildren = props.node.children.length > 0;
</script>

<template>
  <div class="group/proj relative">
    <div 
      class="flex items-center gap-2 px-3 py-2.5 rounded-2xl cursor-pointer transition-all"
      :class="active ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:bg-slate-100'"
      @click="emit('select', node)"
      :title="tip"
    >
      <button 
        class="w-5 h-5 flex items-center justify-center text-slate-400 hover:text-blue-500 transition-colors" 
        @click.stop="emit('toggle', node.path)"
      >
        <template v-if="hasChildren">
          <ChevronDown v-if="expanded" :size="14" class="stroke-[3]"/>
          <ChevronRight v-else :size="14" class="stroke-[3]"/>
        </template>
        <template v-else>
          <component :is="icon" v-if="icon" :size="14"/>
          <Hash v-else :size="14" class="opacity-30"/>
        </template>
      </button>
      
      <span class="text-xs truncate flex-1 tracking-tight" :class="active ? 'font-black' : 'font-bold'">
        {{ node.name }}
      </span>
      
      <span v-if="hasChildren" class="text-[9px] bg-white border border-slate-200 text-slate-400 px-1.5 py-0.5 rounded-lg group-hover/proj:border-blue-200 group-hover/proj:text-blue-400 transition-all font-bold shadow-sm">
        {{ node.children.length }}
      </span>
    </div>
    
    <div v-if="expanded" class="ml-5 border-l-2 border-slate-50 pl-1 mt-1">
      <ProjectItem 
        v-for="child in node.children" 
        :key="child.path"
        :node="child"
        :expanded="expanded" 
        :active="active"
        @select="(n) => emit('select', n)"
        @toggle="(p) => emit('toggle', p)"
        :tip="tip"
        :icon="icon"
      />
      <!-- Note: In a real recursive state passed down, 'expanded' logic might need a lookup map passed as a prop, 
           but here we are simplifying. The parent handles the map. -->
    </div>
  </div>
</template>
