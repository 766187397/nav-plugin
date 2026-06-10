<script setup lang="ts">
import { ref } from 'vue'
import type { IconData } from '@/types'

interface Props {
  active: boolean
  dockItems: IconData[]
  resolvedUrls: Record<string, string>
}

defineProps<Props>()

const emit = defineEmits<{
  editDockItem: [index: number]
  removeDockItem: [index: number]
  addDockIcon: []
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
</script>

<template>
  <div class="settings-panel" :class="{ active }" data-panel="icons">
    <!-- Dock 图标列表 -->
    <section class="settings-section" data-section="dock-icons">
      <h3>Dock 图标</h3>
      <div class="settings-section-content">
        <div
          v-for="(item, i) in dockItems"
          :key="item.id"
          class="icon-list-item"
          :class="{ 'icon-drag-over': dragOverIndex === i }"
          draggable="true"
          :data-dock-index="i"
          @dragstart="(e) => onDragStart(e as DragEvent, i)"
          @dragover="(e) => onDragOver(e as DragEvent, i)"
          @dragleave="onDragLeave"
          @drop="(e) => onDrop(e as DragEvent, i)"
        >
          <img
            :src="resolvedUrls[item.icon] || ''"
            :alt="item.name"
            @error="($event.target as HTMLImageElement).src = ''"
          />
          <div class="icon-list-item-info">
            <div class="icon-list-item-name">{{ item.name }}</div>
            <div class="icon-list-item-url">{{ item.url }}</div>
          </div>
          <div class="icon-list-item-actions">
            <button class="edit-btn" title="编辑" @click="emit('editDockItem', i)">
              &#9998;
            </button>
            <button class="delete-btn" title="删除" @click="emit('removeDockItem', i)">
              &#10005;
            </button>
          </div>
        </div>
        <button class="add-item-btn" @click="emit('addDockIcon')">+ 添加 Dock 图标</button>
      </div>
    </section>
  </div>
</template>
