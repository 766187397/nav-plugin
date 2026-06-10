<script setup lang="ts">
defineProps<{
  active: boolean
  text: string
}>()
</script>

<template>
  <div class="loading-overlay" :class="{ active }">
    <div class="loading-content">
      <div class="loading-spinner"></div>
      <div class="loading-text">{{ text }}</div>
    </div>
  </div>
</template>
