<script setup lang="ts">
import type { DisplaySettings } from '@/types'

interface Props {
  active: boolean
  settings: DisplaySettings
}

defineProps<Props>()

const emit = defineEmits<{
  toggleSetting: [key: string, value: boolean]
}>()

const toggles = [
  { key: 'showSearch', label: '搜索框常驻' },
  { key: 'showNavButtons', label: '显示翻页按钮' },
  { key: 'showPageIndicators', label: '显示分页指示器' },
  { key: 'showDock', label: '显示 Dock 栏' },
  { key: 'showIcons', label: '显示桌面图标' },
]
</script>

<template>
  <div class="settings-panel" :class="{ active }" data-panel="display">
    <section class="settings-section" data-section="display">
      <h3>显示设置</h3>
      <div class="settings-section-content">
        <div
          v-for="t in toggles"
          :key="t.key"
          class="setting-toggle"
        >
          <span class="setting-toggle-label">{{ t.label }}</span>
          <label class="toggle-switch">
            <input
              type="checkbox"
              :checked="(settings as unknown as Record<string, unknown>)[t.key] !== false"
              @change="(e) => emit('toggleSetting', t.key, (e.target as HTMLInputElement).checked)"
            />
            <span class="toggle-slider"></span>
          </label>
        </div>
      </div>
    </section>
  </div>
</template>
