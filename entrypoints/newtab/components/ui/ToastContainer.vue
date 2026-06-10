<script setup lang="ts">
import type { ToastItem } from '@/types'

defineProps<{
  toasts: ToastItem[]
}>()
</script>

<template>
  <div class="toast-container">
    <div v-for="toast in toasts" :key="toast.id" class="toast">{{ toast.message }}</div>
  </div>
</template>
