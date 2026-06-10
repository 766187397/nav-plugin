<script setup lang="ts">
import type { SearchEngine } from '@/types'

interface Props {
  active: boolean
  engines: SearchEngine[]
  resolvedUrls: Record<string, string>
  getEngineDefaultIcon: (engineId: string) => string
}

defineProps<Props>()

const emit = defineEmits<{
  editEngine: [index: number]
  removeEngine: [index: number]
  addEngine: []
}>()
</script>

<template>
  <div class="settings-panel" :class="{ active }" data-panel="search">
    <section class="settings-section" data-section="search-engines">
      <h3>搜索引擎</h3>
      <div class="settings-section-content">
        <div v-for="(engine, i) in engines" :key="engine.id" class="icon-list-item">
          <img
            :src="resolvedUrls[engine.icon] || ''"
            :alt="engine.name"
            @error="($event.target as HTMLImageElement).src = ''"
          />
          <div class="icon-list-item-info">
            <div class="icon-list-item-name">{{ engine.name }}</div>
            <div class="icon-list-item-url">{{ engine.url }}</div>
          </div>
          <div class="icon-list-item-actions">
            <button class="edit-btn" title="编辑" @click="emit('editEngine', i)">&#9998;</button>
            <button class="delete-btn" title="删除" @click="emit('removeEngine', i)">
              &#10005;
            </button>
          </div>
        </div>
        <button class="add-item-btn" @click="emit('addEngine')">+ 添加搜索引擎</button>
      </div>
    </section>
  </div>
</template>
