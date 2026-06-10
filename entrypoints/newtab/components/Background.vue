<script setup lang="ts">
import { ref } from 'vue'

defineProps<{
  isRevealing: boolean
  backgroundMode: string
}>()

// 暴露给父组件的 DOM refs（composable init 需要）
const bgVideo = ref<HTMLVideoElement>()
const bgSingle = ref<HTMLElement>()
const bgBottom = ref<HTMLElement>()
const bgTop = ref<HTMLElement>()
const cursorRing = ref<HTMLElement>()

defineExpose({ bgVideo, bgSingle, bgBottom, bgTop, cursorRing })
</script>

<template>
  <!-- 背景 -->
  <div class="background">
    <video ref="bgVideo" class="bg-video" muted loop playsinline disablePictureInPicture></video>
    <div ref="bgSingle" class="bg-layer bg-single"></div>
    <div ref="bgBottom" class="bg-layer bg-bottom"></div>
    <div
      ref="bgTop"
      class="bg-layer bg-top"
      :class="{ 'mask-hidden': !isRevealing && backgroundMode === 'double' }"
    ></div>
  </div>
  <div
    ref="cursorRing"
    class="cursor-ring"
    :class="{ visible: isRevealing && backgroundMode === 'double' }"
  ></div>
</template>
