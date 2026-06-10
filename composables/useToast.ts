import { ref } from 'vue'
import type { ToastItem } from '@/types'

let toastIdCounter = 0 // Toast 消息自增 ID 计数器
const toasts = ref<ToastItem[]>([]) // 当前显示的 Toast 消息列表
const DEFAULT_DURATION = 3000 // Toast 默认显示时长（毫秒）

/**
 * @description Toast 提示 composable，提供轻量级消息提示功能，消息自动消失
 * @returns {Object} 包含 toasts 响应式列表和 showToast 方法
 */
export function useToast() {
  /**
   * @description 显示一条 Toast 提示消息，可指定显示时长
   * @param {string} message - 要显示的提示文本
   * @param {number} [duration] - 自定义显示时长（毫秒），默认 3000
   */
  function showToast(message: string, duration: number = DEFAULT_DURATION) {
    const id = ++toastIdCounter
    toasts.value.push({ id, message })
    setTimeout(() => {
      toasts.value = toasts.value.filter(t => t.id !== id)
    }, duration)
  }

  return { toasts, showToast }
}
