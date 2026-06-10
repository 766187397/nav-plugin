<script setup lang="ts">
import { ref } from 'vue'
import type { AppData, ThemeColorGroup } from '@/types'
import AppearancePanel from './settings/AppearancePanel.vue'
import IconsPanel from './settings/IconsPanel.vue'
import SearchPanel from './settings/SearchPanel.vue'
import DisplayPanel from './settings/DisplayPanel.vue'
import DataPanel from './settings/DataPanel.vue'

interface Props {
  active: boolean
  activeTab: string
  data: AppData
  resolvedUrls: Record<string, string>
  themeColorGroups: ThemeColorGroup[]
  themeColors: Record<string, string>
  getThemeHexValue: (key: string) => string
  getEngineDefaultIcon: (engineId: string) => string
  getDefaultIcon: (url: string) => string
}

defineProps<Props>()

const emit = defineEmits<{
  close: []
  overlayClick: [e: MouseEvent]
  switchTab: [tab: string]
  // Appearance
  bgModeChange: [mode: string]
  singleModeChange: [mode: string]
  uploadSingleImage: []
  uploadTopLayer: []
  uploadBottomLayer: []
  uploadVideo: []
  videoUrl: []
  addRandomImage: []
  removeRandomImage: [index: number]
  randomizeWallpaper: []
  revealRadiusChange: [e: Event]
  revealFeatherChange: [e: Event]
  themeColorInput: [key: string, isRgba: boolean, value: string]
  themeValueChange: [key: string, isRgba: boolean, value: string]
  exportTheme: []
  importTheme: []
  resetTheme: []
  // Icons
  editDockItem: [index: number]
  removeDockItem: [index: number]
  addDockIcon: []
  dockReorder: [fromIndex: number, toIndex: number]
  // Search
  editSearchEngine: [index: number]
  removeSearchEngine: [index: number]
  addSearchEngine: []
  // Display
  toggleSetting: [key: string, value: boolean]
  // Data
  exportData: []
  importData: []
}>()

const settingsOverlay = ref<HTMLElement>()
const settingsDrawer = ref<HTMLElement>()

defineExpose({ settingsOverlay, settingsDrawer })

const tabLabels: Record<string, string> = {
  appearance: '外观',
  icons: '图标',
  search: '搜索',
  display: '显示',
  data: '数据',
}
</script>

<template>
  <div
    ref="settingsOverlay"
    class="settings-overlay"
    :class="{ active }"
    @click="(e) => emit('overlayClick', e as MouseEvent)"
  >
    <div ref="settingsDrawer" class="settings-drawer">
      <div class="settings-header">
        <h2>设置</h2>
        <button class="settings-close-btn" title="关闭" @click="emit('close')">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="settings-body">
        <div class="settings-tabs">
          <button
            v-for="tab in ['appearance', 'icons', 'search', 'display', 'data']"
            :key="tab"
            class="settings-tab"
            :class="{ active: activeTab === tab }"
            :data-tab="tab"
            @click="emit('switchTab', tab)"
          >
            {{ tabLabels[tab] }}
          </button>
        </div>
        <div class="settings-panels">
          <AppearancePanel
            :active="activeTab === 'appearance'"
            :data="data"
            :resolved-urls="resolvedUrls"
            :theme-color-groups="themeColorGroups"
            :theme-colors="themeColors"
            :get-theme-hex-value="getThemeHexValue"
            @bg-mode-change="(m) => emit('bgModeChange', m)"
            @single-mode-change="(m) => emit('singleModeChange', m)"
            @upload-single-image="() => emit('uploadSingleImage')"
            @upload-top-layer="() => emit('uploadTopLayer')"
            @upload-bottom-layer="() => emit('uploadBottomLayer')"
            @upload-video="() => emit('uploadVideo')"
            @video-url="() => emit('videoUrl')"
            @add-random-image="() => emit('addRandomImage')"
            @remove-random-image="(i) => emit('removeRandomImage', i)"
            @randomize-wallpaper="() => emit('randomizeWallpaper')"
            @reveal-radius-change="(e) => emit('revealRadiusChange', e)"
            @reveal-feather-change="(e) => emit('revealFeatherChange', e)"
            @theme-color-input="(k, r, v) => emit('themeColorInput', k, r, v)"
            @theme-value-change="(k, r, v) => emit('themeValueChange', k, r, v)"
            @export-theme="() => emit('exportTheme')"
            @import-theme="() => emit('importTheme')"
            @reset-theme="() => emit('resetTheme')"
          />
          <IconsPanel
            :active="activeTab === 'icons'"
            :dock-items="data.dock"
            :resolved-urls="resolvedUrls"
            @edit-dock-item="(i) => emit('editDockItem', i)"
            @remove-dock-item="(i) => emit('removeDockItem', i)"
            @add-dock-icon="() => emit('addDockIcon')"
            @dock-reorder="(from, to) => emit('dockReorder', from, to)"
          />
          <SearchPanel
            :active="activeTab === 'search'"
            :engines="data.search.engines"
            :resolved-urls="resolvedUrls"
            :get-engine-default-icon="getEngineDefaultIcon"
            @edit-engine="(i) => emit('editSearchEngine', i)"
            @remove-engine="(i) => emit('removeSearchEngine', i)"
            @add-engine="() => emit('addSearchEngine')"
          />
          <DisplayPanel
            :active="activeTab === 'display'"
            :settings="data.settings"
            @toggle-setting="(k, v) => emit('toggleSetting', k, v)"
          />
          <DataPanel
            :active="activeTab === 'data'"
            @export-data="() => emit('exportData')"
            @import-data="() => emit('importData')"
          />
        </div>
      </div>
    </div>
  </div>
</template>
