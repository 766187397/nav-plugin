<script setup lang="ts">
defineProps<{
  active: boolean
}>()

const emit = defineEmits<{
  exportData: []
  importData: []
}>()
</script>

<template>
  <div class="settings-panel" :class="{ active }" data-panel="data">
    <section class="settings-section" data-section="data-management">
      <h3>数据管理</h3>
      <div class="settings-section-content">
        <div class="data-management-actions">
          <button class="data-btn" @click="emit('exportData')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            导出数据
          </button>
          <button class="data-btn" @click="emit('importData')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" />
            </svg>
            导入数据
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
