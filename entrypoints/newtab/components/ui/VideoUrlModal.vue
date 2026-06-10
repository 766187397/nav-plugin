<script setup lang="ts">
import { ref, watch, nextTick } from 'vue'
import type { VideoUrlTestResult, VideoUrlDialogStatus } from '@/composables/useVideoUrlDialog'

interface Props {
  active: boolean
  initialUrl: string
  status: VideoUrlDialogStatus
  errorMessage: string
  testing: boolean
  testResult: VideoUrlTestResult | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  overlayClick: [e: MouseEvent]
  close: []
  test: [url: string]
  confirm: [url: string]
  retry: []
}>()

const urlInput = ref<HTMLInputElement>()
const currentUrl = ref('')

watch(() => props.active, async (v) => {
  if (v && props.status === 'input') {
    currentUrl.value = props.initialUrl || ''
    await nextTick()
    urlInput.value?.focus()
  }
})

function handleConfirm() {
  emit('confirm', currentUrl.value.trim())
}
</script>

<template>
  <div
    class="modal-overlay"
    :class="{ active }"
    @click="(e) => emit('overlayClick', e as MouseEvent)"
  >
    <div class="modal modal-video-url" @click.stop>
      <h3 class="modal-title">设置视频背景 URL</h3>

      <!-- input 阶段 -->
      <div v-if="status === 'input'" class="modal-body">
        <label class="modal-field">
          <span>视频地址（支持 mp4 / webm，需服务器允许跨域）</span>
          <input
            ref="urlInput"
            v-model="currentUrl"
            type="text"
            class="modal-input"
            placeholder="https://example.com/video.mp4"
            @keydown.enter="handleConfirm"
          />
        </label>

        <div
          v-if="testResult"
          class="url-test-feedback"
          :class="testResult.ok ? 'ok' : 'fail'"
        >
          <span class="url-test-icon">{{ testResult.ok ? '✓' : '✕' }}</span>
          <span class="url-test-text">{{ testResult.message }}</span>
        </div>

        <div class="modal-hint">
          <div>提示：</div>
          <ul>
            <li>可点击「探测」按钮提前检查 URL 是否可访问</li>
            <li>部分服务器禁止跨域访问（CORS）或要求鉴权，会导致 403</li>
            <li>建议使用 <code>https://</code> 协议并支持 CORS 的资源</li>
          </ul>
        </div>
      </div>

      <!-- loading 阶段 -->
      <div v-else-if="status === 'loading'" class="modal-body modal-state-body">
        <div class="state-spinner"></div>
        <div class="state-title">正在加载视频...</div>
        <div class="state-desc">这可能需要几秒到十几秒，取决于网络和视频大小</div>
        <div class="state-tip">加载过程中请勿关闭弹窗</div>
      </div>

      <!-- success 阶段 -->
      <div v-else-if="status === 'success'" class="modal-body modal-state-body">
        <div class="state-icon state-icon-success">✓</div>
        <div class="state-title">已应用</div>
        <div class="state-desc">视频背景已成功设置</div>
      </div>

      <!-- error 阶段 -->
      <div v-else-if="status === 'error'" class="modal-body modal-state-body">
        <div class="state-icon state-icon-error">✕</div>
        <div class="state-title">加载失败</div>
        <div class="state-desc state-desc-error">{{ errorMessage }}</div>
        <div class="state-tip">请检查 URL 是否正确、服务器是否允许跨域访问</div>
      </div>

      <!-- footer 按状态变化 -->
      <div v-if="status === 'input'" class="modal-footer">
        <button class="btn btn-cancel" @click="emit('close')">取消</button>
        <button
          type="button"
          class="btn btn-icon-fetch"
          :disabled="!currentUrl.trim() || testing"
          @click="() => emit('test', currentUrl.trim())"
        >
          {{ testing ? '探测中...' : '探测' }}
        </button>
        <button
          class="btn btn-primary"
          :disabled="!currentUrl.trim()"
          @click="handleConfirm"
        >
          确定
        </button>
      </div>
      <div v-else-if="status === 'loading'" class="modal-footer">
        <button class="btn btn-cancel" disabled>加载中...</button>
      </div>
      <div v-else-if="status === 'success'" class="modal-footer">
        <button class="btn btn-primary" disabled>应用成功</button>
      </div>
      <div v-else-if="status === 'error'" class="modal-footer">
        <button class="btn btn-cancel" @click="emit('close')">关闭</button>
        <button class="btn btn-primary" @click="emit('retry')">重新输入</button>
      </div>
    </div>
  </div>
</template>
