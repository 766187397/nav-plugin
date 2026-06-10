<script setup lang="ts">
import { ref } from 'vue'

interface Props {
  active: boolean
  title: string
  modalIconSrc: string
  modalIconVisible: boolean
  fetchIconDisabled: boolean
  fetchIconText: string
  fetchNameDisabled: boolean
  fetchNameText: string
}

defineProps<Props>()

const emit = defineEmits<{
  overlayClick: [e: MouseEvent]
  close: []
  iconFileChange: [e: Event]
  fetchIcon: [url: string]
  fetchName: [url: string]
  confirm: [name: string, url: string]
}>()

// 暴露给父组件的 DOM refs（composable 需要）
const iconEditModal = ref<HTMLElement>()
const iconPreview = ref<HTMLImageElement>()
const iconUrlInput = ref<HTMLInputElement>()
const iconNameInput = ref<HTMLInputElement>()
const iconFileInput = ref<HTMLInputElement>()

defineExpose({
  iconEditModal,
  iconPreview,
  iconUrlInput,
  iconNameInput,
  iconFileInput,
})
</script>

<template>
  <!-- 图标编辑弹窗 -->
  <div
    ref="iconEditModal"
    class="modal-overlay"
    :class="{ active }"
    @click="(e) => emit('overlayClick', e as MouseEvent)"
  >
    <div class="modal">
      <h3 class="modal-title">{{ title }}</h3>
      <div class="modal-body">
        <label class="modal-field">
          <span>网址</span>
          <input ref="iconUrlInput" type="text" name="iconUrl" placeholder="https://example.com" />
        </label>
        <label class="modal-field">
          <span>名称</span>
          <div class="name-input-row">
            <input ref="iconNameInput" type="text" name="iconName" placeholder="输入名称" />
            <button
              type="button"
              class="btn-icon-fetch-name"
              :disabled="fetchNameDisabled"
              @click="() => emit('fetchName', iconUrlInput?.value.trim() || '')"
            >
              {{ fetchNameText }}
            </button>
          </div>
        </label>
        <div class="modal-field">
          <span>图标</span>
          <div class="icon-source">
            <div class="icon-preview-wrapper">
              <img
                ref="iconPreview"
                class="icon-preview"
                :src="modalIconSrc"
                alt="预览"
                :style="{ display: modalIconVisible ? 'block' : 'none' }"
              />

            </div>
            <div class="icon-source-actions">
              <button type="button" class="btn-icon-upload" @click="iconFileInput?.click()">
                上传图片
              </button>
              <button
                type="button"
                class="btn-icon-fetch"
                :disabled="fetchIconDisabled"
                @click="() => emit('fetchIcon', iconUrlInput?.value.trim() || '')"
              >
                {{ fetchIconText }}
              </button>
            </div>
          </div>
        </div>
        <input
          ref="iconFileInput"
          type="file"
          name="iconFile"
          accept="image/*"
          hidden
          @change="(e) => emit('iconFileChange', e as Event)"
        />
      </div>
      <div class="modal-footer">
        <button class="btn btn-cancel" @click="emit('close')">取消</button>
        <button
          class="btn btn-primary"
          @click="
            () =>
              emit(
                'confirm',
                iconNameInput?.value.trim() || '',
                iconUrlInput?.value.trim() || '',
              )
          "
        >
          确定
        </button>
      </div>
    </div>
  </div>
</template>
