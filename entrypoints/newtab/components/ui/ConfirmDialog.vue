<script setup lang="ts">
defineProps<{
  active: boolean
  message: string
}>()

const emit = defineEmits<{
  cancel: []
  ok: []
}>()
</script>

<template>
  <div class="confirm-dialog" :class="{ active }">
    <div class="confirm-content">
      <p class="confirm-message">{{ message }}</p>
      <div class="confirm-actions">
        <button class="btn btn-cancel" @click="emit('cancel')">取消</button>
        <button class="btn btn-primary" @click="emit('ok')">确定</button>
      </div>
    </div>
  </div>
</template>
