<script setup lang="ts">
import { ref } from 'vue'
import type { PageData, IconData, DragState } from '@/types'

interface Props {
  pages: PageData[]
  currentPage: number
  totalPages: number
  dragState: DragState
  showNavButtons: boolean
  showIcons: boolean
  showPageIndicators: boolean
  resolvedUrls: Record<string, string>
  getDefaultIcon: (url: string) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  goToPage: [page: number, animate?: boolean, trackEl?: HTMLElement | undefined]
  dragStart: [e: DragEvent, iconId: string, pageIndex: number, iconIndex: number]
  dragEnd: []
  pageDragOver: [e: DragEvent]
  pageDrop: [e: DragEvent]
  iconClick: [icon: IconData]
  iconContextMenu: [e: MouseEvent, icon: IconData, pageIndex: number, iconIndex: number]
  wheel: [e: WheelEvent]
  desktopMouseMove: [e: MouseEvent]
  desktopMouseLeave: []
}>()

// 暴露给父组件的 DOM refs
const pagesTrack = ref<HTMLElement>()
const pagesViewport = ref<HTMLElement>()
const pageIndicators = ref<HTMLElement>()
const prevBtn = ref<HTMLElement>()
const nextBtn = ref<HTMLElement>()

defineExpose({ pagesTrack, pagesViewport, pageIndicators, prevBtn, nextBtn })

// 触摸手势状态（组件内部管理）
let _touchStartX = 0
let _touchDeltaX = 0

function onViewportTouchStart(e: TouchEvent) {
  _touchStartX = e.touches[0].clientX
}
function onViewportTouchMove(e: TouchEvent) {
  _touchDeltaX = e.touches[0].clientX - _touchStartX
}
function onViewportTouchEnd() {
  if (Math.abs(_touchDeltaX) > 50) {
    if (_touchDeltaX < 0) emit('goToPage', props.currentPage + 1)
    else emit('goToPage', props.currentPage - 1)
  }
  _touchDeltaX = 0
}
</script>

<template>
  <!-- 桌面 -->
  <div
    class="desktop"
    @wheel="emit('wheel', $event as WheelEvent)"
    @mousemove="emit('desktopMouseMove', $event as MouseEvent)"
    @mouseleave="emit('desktopMouseLeave')"
  >
    <button
      ref="prevBtn"
      class="page-nav page-prev"
      title="上一页"
      :disabled="currentPage <= 0"
      :class="{ 'force-hidden': showNavButtons === false }"
      @click="emit('goToPage', currentPage - 1, true, pagesTrack)"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M15 18l-6-6 6-6" />
      </svg>
    </button>
    <div
      ref="pagesViewport"
      class="pages-viewport"
      @touchstart="onViewportTouchStart"
      @touchmove="onViewportTouchMove"
      @touchend="onViewportTouchEnd"
    >
      <div ref="pagesTrack" class="pages-track">
        <div
          v-for="(page, pi) in pages"
          :key="page.id"
          class="page"
          :data-page-id="page.id"
          :data-page-index="pi"
          @dragover="(e) => emit('pageDragOver', e as DragEvent)"
          @drop="(e) => emit('pageDrop', e as DragEvent)"
        >
          <template v-for="(icon, ii) in page.icons" :key="ii">
            <div
              v-if="icon"
              class="desktop-icon"
              :class="{
                'hidden-icon': showIcons === false,
                dragging: dragState.isDragging && dragState.dragIconId === icon.id,
                'drag-over': false,
              }"
              :data-icon-id="icon.id"
              :data-page-index="pi"
              :data-icon-index="ii"
              :title="icon.name"
              draggable="true"
              @dragstart="(e) => emit('dragStart', e as DragEvent, icon.id, pi, ii)"
              @dragend="emit('dragEnd')"
              @click="emit('iconClick', icon)"
              @contextmenu="(e) => emit('iconContextMenu', e as MouseEvent, icon, pi, ii)"
            >
              <img
                class="desktop-icon-img"
                :src="resolvedUrls[icon.icon] || getDefaultIcon(icon.url)"
                :alt="icon.name"
                loading="lazy"
                @error="($event.target as HTMLImageElement).src = getDefaultIcon(icon.url)" />
              <span class="desktop-icon-name">{{ icon.name }}</span>
            </div>
            <div v-else class="grid-spacer" :data-icon-index="ii" :data-page-index="pi"></div>
          </template>
        </div>
      </div>
    </div>
    <button
      ref="nextBtn"
      class="page-nav page-next"
      title="下一页"
      :disabled="currentPage >= totalPages - 1"
      :class="{ 'force-hidden': showNavButtons === false }"
      @click="emit('goToPage', currentPage + 1, true, pagesTrack)"
    >
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M9 18l6-6-6-6" />
      </svg>
    </button>
    <div ref="pageIndicators" class="page-indicators">
      <div
        v-for="i in totalPages"
        :key="i"
        class="page-dot"
        :class="{ active: i - 1 === currentPage }"
        @click="emit('goToPage', i - 1, true, pagesTrack)"
      ></div>
    </div>
  </div>
</template>
