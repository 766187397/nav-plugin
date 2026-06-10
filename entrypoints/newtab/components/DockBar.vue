<script setup lang="ts">
import { ref } from 'vue'
import type { IconData } from '@/types'

interface Props {
  visible: boolean
  dockItems: IconData[]
  resolvedUrls: Record<string, string>
  getDefaultIcon: (url: string) => string
}

defineProps<Props>()

const emit = defineEmits<{
  dockMouseMove: [e: MouseEvent, containerEl: HTMLElement | undefined]
  dockMouseLeave: [containerEl: HTMLElement | undefined]
  dockItemClick: [item: IconData]
  dockItemContextMenu: [e: MouseEvent, item: IconData, index: number]
  dockReorder: [fromIndex: number, toIndex: number]
}>()

const dragOverIndex = ref<number>(-1)

function onDragStart(e: DragEvent, index: number) {
  e.dataTransfer!.effectAllowed = 'move'
  e.dataTransfer!.setData('text/plain', String(index))
}

function onDragOver(e: DragEvent, index: number) {
  e.preventDefault()
  e.dataTransfer!.dropEffect = 'move'
  dragOverIndex.value = index
}

function onDrop(e: DragEvent, toIndex: number) {
  e.preventDefault()
  const fromIndex = parseInt(e.dataTransfer!.getData('text/plain'))
  if (!isNaN(fromIndex)) emit('dockReorder', fromIndex, toIndex)
  dragOverIndex.value = -1
}

function onDragLeave() { dragOverIndex.value = -1 }

// 暴露给父组件的 DOM ref
const dockContainerEl = ref<HTMLElement>()

defineExpose({ dockContainerEl })
</script>

<template>
  <!-- Dock 栏 -->
  <div class="dock" :style="{ display: visible === false || dockItems.length === 0 ? 'none' : '' }">
    <div
      ref="dockContainerEl"
      class="dock-container"
      @mousemove="(e) => emit('dockMouseMove', e as MouseEvent, dockContainerEl)"
      @mouseleave="() => emit('dockMouseLeave', dockContainerEl)"
    >
      <div
        v-for="(item, index) in dockItems"
        :key="item.id"
        class="dock-item"
        :class="{ 'dock-drag-over': dragOverIndex === index }"
        draggable="true"
        :data-dock-index="index"
        @click="emit('dockItemClick', item)"
        @contextmenu="(e) => emit('dockItemContextMenu', e as MouseEvent, item, index)"
        @dragstart="(e) => onDragStart(e as DragEvent, index)"
        @dragover="(e) => onDragOver(e as DragEvent, index)"
        @dragleave="onDragLeave"
        @drop="(e) => onDrop(e as DragEvent, index)"
      >
        <img
          class="dock-item-img"
          :src="resolvedUrls[item.icon] || getDefaultIcon(item.url)"
          :alt="item.name"
          @error="($event.target as HTMLImageElement).src = getDefaultIcon(item.url)"
        />
        <div class="dock-item-tooltip">{{ item.name }}</div>
      </div>
    </div>
  </div>
</template>
