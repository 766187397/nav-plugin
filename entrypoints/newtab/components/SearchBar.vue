<script setup lang="ts">
import { ref } from 'vue'
import type { SearchConfig } from '@/types'

interface Props {
  searchHidden: boolean
  searchDropdownActive: boolean
  searchConfig: SearchConfig
  resolvedUrls: Record<string, string>
  getEngineDefaultIcon: (engineId: string) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  toggleSearchDropdown: []
  selectEngine: [index: number]
  doSearch: [inputEl: HTMLInputElement | undefined]
  searchMouseEnter: [containerEl: HTMLElement | undefined]
  searchMouseLeave: [containerEl: HTMLElement | undefined]
  searchInputFocus: [containerEl: HTMLElement | undefined]
  searchInputBlur: []
}>()

// 暴露给父组件的 DOM refs
const searchInput = ref<HTMLInputElement>()
const searchContainer = ref<HTMLElement>()

defineExpose({ searchInput, searchContainer })
</script>

<template>
  <!-- 搜索框 -->
  <div
    ref="searchContainer"
    class="search-container"
    :class="{ 'search-hidden': searchHidden }"
    @mouseenter="emit('searchMouseEnter', searchContainer)"
    @mouseleave="emit('searchMouseLeave', searchContainer)"
  >
    <div class="search-box">
      <button class="search-engine-btn" title="切换搜索引擎" @click.stop="emit('toggleSearchDropdown')">
        <img
          class="search-engine-icon"
          :src="
            resolvedUrls[searchConfig.engines[searchConfig.currentEngine]?.icon] ||
            getEngineDefaultIcon(searchConfig.engines[searchConfig.currentEngine]?.id || '')
          "
          alt=""
        />
        <svg class="search-engine-arrow" width="10" height="6" viewBox="0 0 10 6">
          <path d="M1 1l4 4 4-4" stroke="currentColor" stroke-width="1.5" fill="none" />
        </svg>
      </button>
      <div class="search-engine-dropdown" :class="{ active: searchDropdownActive }">
        <div class="search-engine-list">
          <div
            v-for="(engine, i) in searchConfig.engines"
            :key="engine.id"
            class="search-engine-item"
            :class="{ active: i === searchConfig.currentEngine }"
            @click="emit('selectEngine', i)"
          >
            <img
              :src="resolvedUrls[engine.icon] || getEngineDefaultIcon(engine.id)"
              :alt="engine.name"
              style="width: 18px; height: 18px; border-radius: 3px; object-fit: contain"
            />
            <span>{{ engine.name }}</span>
          </div>
        </div>
      </div>
      <input
        ref="searchInput"
        class="search-input"
        type="text"
        :placeholder="`在 ${searchConfig.engines[searchConfig.currentEngine]?.name || ''} 中搜索...`"
        autocomplete="off"
        @keydown.enter="emit('doSearch', searchInput)"
        @focus="emit('searchInputFocus', searchContainer)"
        @blur="emit('searchInputBlur')"
      />
      <button class="search-submit-btn" title="搜索" @click="emit('doSearch', searchInput)">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8" />
          <path d="M21 21l-4.35-4.35" />
        </svg>
      </button>
    </div>
  </div>
</template>
