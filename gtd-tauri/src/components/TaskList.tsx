import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import TaskCard from './TaskCard';
import { Task } from '../types/gtd';

interface TaskListProps {
  tasks: Task[];
  selectedTaskId: string | null;
  selectedSubtaskLineIndex: number | null;
  isBatchMode: boolean;
  selectedTaskIds: Set<string>;
  onToggle: (idx: number, status: boolean) => void;
  onDelete: (idx: number) => void;
  onSelect: (id: string) => void;
  onOpenDetail: (task: Task) => void;
  onOpenSubtaskDetail?: (lineIndex: number) => void;
  onDragStart: (e: React.DragEvent, task: Task) => void;
  onDragEnd?: () => void;
  onMakeSubtask: (sourceIdx: number, targetIdx: number) => void;
  onPromoteSubtask?: (subtaskLineIndex: number) => void;
  isSubtaskDragging: boolean;
  dragOverTaskId: string | null;
  getDraggedTaskData?: (dt: DataTransfer) => { lineIndex: number; lineCount?: number; isSubtask?: boolean } | null;
  usePointerDrag: boolean;
  onPointerDragStart?: (task: Task, clientX?: number, clientY?: number) => void;
  isDraggingAnyTask: boolean;
  onTaskDrop: (e: React.DragEvent, targetLineIdx: number) => void;
  setDragOverTaskIdThrottled: (id: string | null) => void;
  isTauriEnv: boolean;
  useMotion?: boolean;
  useVirtual?: boolean;
  useFixedHeight?: boolean;
  compact?: boolean;
  switching?: boolean;
  scrollParentRef?: React.RefObject<HTMLElement>;
  estimateHeight?: number;
  overscan?: number;
}

const TaskList: React.FC<TaskListProps> = React.memo(({
  tasks,
  selectedTaskId,
  selectedSubtaskLineIndex,
  isBatchMode,
  selectedTaskIds,
  onToggle,
  onDelete,
  onSelect,
  onOpenDetail,
  onOpenSubtaskDetail,
  onDragStart,
  onDragEnd,
  onMakeSubtask,
  onPromoteSubtask,
  isSubtaskDragging,
  dragOverTaskId,
  getDraggedTaskData,
  usePointerDrag,
  onPointerDragStart,
  isDraggingAnyTask,
  onTaskDrop,
  setDragOverTaskIdThrottled,
  isTauriEnv,
  useMotion = true,
  useVirtual = false,
  useFixedHeight = false,
  compact = false,
  switching = false,
  scrollParentRef,
  estimateHeight = 56,
  overscan = 8
}) => {
  const heightMapRef = useRef(new Map<string, number>());
  const [measureTick, setMeasureTick] = useState(0);
  const measureRafRef = useRef<number | null>(null);
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const totalCount = tasks.length;

  const offsets = useMemo(() => {
    if (!useVirtual || useFixedHeight) return null;
    const arr = new Array(totalCount + 1);
    arr[0] = 0;
    for (let i = 0; i < totalCount; i++) {
      const t = tasks[i];
      const h = heightMapRef.current.get(t.id) ?? estimateHeight;
      arr[i + 1] = arr[i] + h;
    }
    return arr;
  }, [tasks, totalCount, estimateHeight, measureTick, useVirtual, useFixedHeight]);

  const totalHeight = useVirtual
    ? (useFixedHeight ? totalCount * estimateHeight : (offsets?.[totalCount] ?? 0))
    : 0;

  const findStartIndex = useCallback((value: number) => {
    if (useFixedHeight) return Math.max(0, Math.min(totalCount - 1, Math.floor(value / estimateHeight)));
    let lo = 0;
    let hi = totalCount;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if ((offsets?.[mid + 1] ?? 0) < value) lo = mid + 1;
      else hi = mid;
    }
    return lo;
  }, [offsets, totalCount, useFixedHeight, estimateHeight]);

  const { start, end } = useMemo(() => {
    if (!useVirtual || totalCount === 0) return { start: 0, end: totalCount };
    const startPx = Math.max(0, scrollTop - overscan * estimateHeight);
    const endPx = scrollTop + viewportHeight + overscan * estimateHeight;
    const startIdx = findStartIndex(startPx);
    let endIdx = findStartIndex(endPx);
    if (endIdx < totalCount) endIdx += 1;
    const maxEnd = switching ? Math.min(startIdx + 5, totalCount) : Math.min(endIdx, totalCount);
    return { start: startIdx, end: maxEnd };
  }, [useVirtual, totalCount, scrollTop, viewportHeight, overscan, estimateHeight, findStartIndex, switching]);

  useEffect(() => {
    if (!useVirtual || !scrollParentRef?.current) return;
    const el = scrollParentRef.current;
    const onScroll = () => setScrollTop(el.scrollTop);
    onScroll();
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [useVirtual, scrollParentRef]);

  useLayoutEffect(() => {
    if (!useVirtual || !scrollParentRef?.current) return;
    const el = scrollParentRef.current;
    const setSize = () => setViewportHeight(el.clientHeight);
    setSize();
    if (typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => setSize());
      ro.observe(el);
      return () => ro.disconnect();
    }
  }, [useVirtual, scrollParentRef]);

  const registerMeasure = useCallback((id: string) => (el: HTMLDivElement | null) => {
    if (useFixedHeight || switching) return;
    if (!el) return;
    const h = el.getBoundingClientRect().height;
    const prev = heightMapRef.current.get(id);
    if (prev !== h) {
      heightMapRef.current.set(id, h);
      if (measureRafRef.current != null) return;
      measureRafRef.current = requestAnimationFrame(() => {
        measureRafRef.current = null;
        setMeasureTick(t => t + 1);
      });
    }
  }, [useFixedHeight, switching]);

  useEffect(() => {
    if (!useVirtual || useFixedHeight || switching) return;
    const next = new Map<string, number>();
    for (const t of tasks) {
      const h = heightMapRef.current.get(t.id);
      if (h != null) next.set(t.id, h);
    }
    heightMapRef.current = next;
  }, [useVirtual, useFixedHeight, switching, tasks]);

  useEffect(() => {
    return () => {
      if (measureRafRef.current != null) cancelAnimationFrame(measureRafRef.current);
      measureRafRef.current = null;
    };
  }, []);

  if (!useMotion) {
    return (
      <div className="space-y-2">
        {(switching ? tasks.slice(0, 5) : tasks).map(task => (
          <div
            key={task.id}
            className="relative"
            data-drop="task-row"
            data-drop-target-line={String(task.lineIndex)}
            onDragOver={!isTauriEnv ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverTaskIdThrottled(task.id);
            } : undefined}
            onDragLeave={!isTauriEnv ? () => setDragOverTaskIdThrottled(null) : undefined}
            onDrop={!isTauriEnv ? (e) => {
              setDragOverTaskIdThrottled(null);
              onTaskDrop(e, task.lineIndex);
            } : undefined}
          >
            {isSubtaskDragging && dragOverTaskId === task.id && (
              <div className="absolute left-0 right-0 -top-1 z-10 h-0.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] pointer-events-none" aria-hidden />
            )}
            <TaskCard
              task={task}
              isActive={selectedTaskId === task.id || (selectedSubtaskLineIndex != null && task.subtasks.some(s => s.lineIndex === selectedSubtaskLineIndex))}
              isBatchMode={isBatchMode}
              selected={selectedTaskIds.has(task.id)}
              compact={compact}
              onToggle={onToggle}
              onDelete={onDelete}
              onSelect={onSelect}
              onOpenDetail={onOpenDetail}
              onOpenSubtaskDetail={onOpenSubtaskDetail}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onMakeSubtask={onMakeSubtask}
              onPromoteSubtask={onPromoteSubtask}
              isSubtaskDragging={isSubtaskDragging}
              isPromoteDropTarget={dragOverTaskId === task.id}
              getDraggedTaskData={getDraggedTaskData}
              usePointerDrag={usePointerDrag}
              onPointerDragStart={onPointerDragStart}
              isDraggingAnyTask={isDraggingAnyTask}
            />
          </div>
        ))}
      </div>
    );
  }
  if (useVirtual) {
    return (
      <div className="relative" style={{ height: totalHeight }}>
        {tasks.slice(start, end).map((task, i) => {
          const idx = start + i;
          const top = useFixedHeight ? idx * estimateHeight : (offsets?.[idx] ?? 0);
          return (
            <div
              key={task.id}
              ref={registerMeasure(task.id)}
              className="absolute left-0 right-0"
              style={{ transform: `translateY(${top}px)` }}
              data-drop="task-row"
              data-drop-target-line={String(task.lineIndex)}
              onDragOver={!isTauriEnv ? (e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                setDragOverTaskIdThrottled(task.id);
              } : undefined}
              onDragLeave={!isTauriEnv ? () => setDragOverTaskIdThrottled(null) : undefined}
              onDrop={!isTauriEnv ? (e) => {
                setDragOverTaskIdThrottled(null);
                onTaskDrop(e, task.lineIndex);
              } : undefined}
            >
              {isSubtaskDragging && dragOverTaskId === task.id && (
                <div className="absolute left-0 right-0 -top-1 z-10 h-0.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] pointer-events-none" aria-hidden />
              )}
              <TaskCard
                task={task}
                isActive={selectedTaskId === task.id || (selectedSubtaskLineIndex != null && task.subtasks.some(s => s.lineIndex === selectedSubtaskLineIndex))}
                isBatchMode={isBatchMode}
                selected={selectedTaskIds.has(task.id)}
                compact={compact}
                onToggle={onToggle}
                onDelete={onDelete}
                onSelect={onSelect}
                onOpenDetail={onOpenDetail}
                onOpenSubtaskDetail={onOpenSubtaskDetail}
                onDragStart={onDragStart}
                onDragEnd={onDragEnd}
                onMakeSubtask={onMakeSubtask}
                onPromoteSubtask={onPromoteSubtask}
                isSubtaskDragging={isSubtaskDragging}
                isPromoteDropTarget={dragOverTaskId === task.id}
                getDraggedTaskData={getDraggedTaskData}
                usePointerDrag={usePointerDrag}
                onPointerDragStart={onPointerDragStart}
                isDraggingAnyTask={isDraggingAnyTask}
              />
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <AnimatePresence mode="popLayout">
        {(switching ? tasks.slice(0, 5) : tasks).map(task => (
          <motion.div
            key={task.id}
            layout={false}
            data-drop="task-row"
            data-drop-target-line={String(task.lineIndex)}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.15 }}
            className="relative"
            onDragOver={!isTauriEnv ? (e) => {
              e.preventDefault();
              e.dataTransfer.dropEffect = 'move';
              setDragOverTaskIdThrottled(task.id);
            } : undefined}
            onDragLeave={!isTauriEnv ? () => setDragOverTaskIdThrottled(null) : undefined}
            onDrop={!isTauriEnv ? (e) => {
              setDragOverTaskIdThrottled(null);
              onTaskDrop(e, task.lineIndex);
            } : undefined}
          >
            {isSubtaskDragging && dragOverTaskId === task.id && (
              <div className="absolute left-0 right-0 -top-1 z-10 h-0.5 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)] pointer-events-none" aria-hidden />
            )}
            <TaskCard
              task={task}
              isActive={selectedTaskId === task.id || (selectedSubtaskLineIndex != null && task.subtasks.some(s => s.lineIndex === selectedSubtaskLineIndex))}
              isBatchMode={isBatchMode}
              selected={selectedTaskIds.has(task.id)}
              compact={compact}
              onToggle={onToggle}
              onDelete={onDelete}
              onSelect={onSelect}
              onOpenDetail={onOpenDetail}
              onOpenSubtaskDetail={onOpenSubtaskDetail}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
              onMakeSubtask={onMakeSubtask}
              onPromoteSubtask={onPromoteSubtask}
              isSubtaskDragging={isSubtaskDragging}
              isPromoteDropTarget={dragOverTaskId === task.id}
              getDraggedTaskData={getDraggedTaskData}
              usePointerDrag={usePointerDrag}
              onPointerDragStart={onPointerDragStart}
              isDraggingAnyTask={isDraggingAnyTask}
            />
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
});

TaskList.displayName = 'TaskList';

export default TaskList;
