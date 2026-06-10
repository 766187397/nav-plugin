import { ref } from 'vue'

const loadingActive = ref(false) // Loading 遮罩层是否显示
const loadingText = ref('处理中...') // Loading 显示的提示文案，默认值

/**
 * @description 全局 Loading 状态管理 composable，控制加载遮罩层的显示与隐藏
 * @returns {Object} 包含 loadingActive、loadingText 响应式状态及 showLoading/hideLoading 方法
 */
export function useLoading() {
  /**
   * @description 显示 Loading 遮罩层
   * @param {string} [text] - 自定义提示文案，默认为"处理中..."
   */
  function showLoading(text?: string) {
    loadingText.value = text || '处理中...'
    loadingActive.value = true
  }

  /** @description 隐藏 Loading 遮罩层 */
  function hideLoading() {
    loadingActive.value = false
  }

  return { loadingActive, loadingText, showLoading, hideLoading }
}
