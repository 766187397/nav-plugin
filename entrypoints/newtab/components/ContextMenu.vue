<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import type { MenuItem } from '@/types'

interface Props {
  visible: boolean
  x: number
  y: number
  items: MenuItem[]
}

defineProps<Props>()

const emit = defineEmits<{
  hide: []
  itemClick: [item: MenuItem]
}>()

const contextMenuEl = ref<HTMLElement>()

function onDocumentClick(e: MouseEvent) {
  if (contextMenuEl.value && !contextMenuEl.value.contains(e.target as Node)) {
    emit('hide')
  }
}

onMounted(() => {
  document.addEventListener('click', onDocumentClick)
})

onUnmounted(() => {
  document.removeEventListener('click', onDocumentClick)
})

defineExpose({ contextMenuEl })
</script>

<template>
  <!-- 右键菜单 -->
  <div
    v-if="visible"
    ref="contextMenuEl"
    class="context-menu"
    :class="{ active: visible }"
    :style="{ left: x + 'px', top: y + 'px' }"
    @click.stop
  >
    <div class="context-menu-items">
      <template v-for="(item, idx) in items" :key="idx">
        <div v-if="item.separator" class="context-menu-separator"></div>
        <div
          v-else
          class="context-menu-item"
          :class="{ danger: item.danger }"
          :style="{ opacity: item.disabled ? 0.4 : 1, pointerEvents: item.disabled ? 'none' : 'auto' }"
          @click.stop="emit('itemClick', item)"
        >
          <span v-if="item.icon" v-html="item.icon"></span>
          <span>{{ item.label }}</span>
        </div>
      </template>
    </div>
  </div>
</template>
