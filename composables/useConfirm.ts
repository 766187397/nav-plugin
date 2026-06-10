import { ref } from 'vue'

const confirmDialogActive = ref(false) // 确认对话框是否可见
const confirmMessage = ref('') // 确认对话框展示的消息内容
let confirmResolve: ((value: boolean) => void) | null = null // 确认操作的 Promise resolve 回调引用

/**
 * @description 确认对话框 composable，基于 Promise 的确认交互，返回用户点击确定或取消的结果
 * @returns {Object} 包含对话框状态、消息内容及操作方法
 */
export function useConfirm() {
  /**
   * @description 弹出确认对话框，返回 Promise，用户点确定则 resolve(true)，取消则 resolve(false)
   * @param {string} message - 确认对话框展示的提示文本
   * @returns {Promise<boolean>} 用户选择结果：true 表示确认，false 表示取消
   */
  function showConfirm(message: string): Promise<boolean> {
    return new Promise((resolve) => {
      confirmMessage.value = message
      confirmDialogActive.value = true
      confirmResolve = resolve
    })
  }

  /** @description 用户点击取消按钮，关闭对话框并返回 false */
  function onConfirmCancel() {
    confirmDialogActive.value = false
    if (confirmResolve) { confirmResolve(false); confirmResolve = null }
  }

  /** @description 用户点击确定按钮，关闭对话框并返回 true */
  function onConfirmOk() {
    confirmDialogActive.value = false
    if (confirmResolve) { confirmResolve(true); confirmResolve = null }
  }

  return { confirmDialogActive, confirmMessage, showConfirm, onConfirmCancel, onConfirmOk }
}
