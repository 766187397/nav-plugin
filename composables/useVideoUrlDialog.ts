import { ref } from 'vue'

export interface VideoUrlTestResult {
  ok: boolean
  message: string
}

export type VideoUrlDialogStatus = 'input' | 'loading' | 'success' | 'error'

const dialogActive = ref(false) // 弹窗是否显示
const initialUrl = ref('') // 编辑时回填的 URL
const testing = ref(false) // 是否正在探测
const testResult = ref<VideoUrlTestResult | null>(null)
const status = ref<VideoUrlDialogStatus>('input') // 弹窗当前阶段
const errorMessage = ref('') // 加载失败时的错误描述
let onConfirmHandler: ((url: string) => Promise<{ ok: boolean; error?: string }>) | null = null
let resolveFn: ((value: boolean) => void) | null = null

const PROBE_TIMEOUT_MS = 8000 // 探测超时时间
const SUCCESS_AUTO_CLOSE_MS = 1500 // 成功后自动关闭弹窗的延迟

/**
 * @description 视频 URL 输入弹窗 composable，支持输入、探测、加载、错误、重试全流程
 * @returns 弹窗状态、探测/确认/关闭方法
 */
export function useVideoUrlDialog() {

  /**
   * @description 探测 URL 是否可访问（HEAD 请求 + 超时控制）
   * @param url - 待探测的视频地址
   * @returns 探测结果
   */
  async function testUrl(url: string): Promise<VideoUrlTestResult> {
    if (!/^https?:\/\//i.test(url)) {
      return { ok: false, message: 'URL 格式错误：必须以 http:// 或 https:// 开头' }
    }
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS)
    try {
      const resp = await fetch(url, {
        method: 'HEAD',
        mode: 'cors',
        signal: controller.signal,
      })
      clearTimeout(timeoutId)
      if (resp.ok) {
        const contentType = resp.headers.get('content-type') || ''
        if (!contentType.startsWith('video/') && !contentType.startsWith('application/')) {
          return {
            ok: true,
            message: `可访问（${resp.status}），但响应类型为 ${contentType || '未知'}，请确认是视频文件`,
          }
        }
        return { ok: true, message: `可访问（${resp.status} ${resp.statusText || ''}）` }
      }
      if (resp.status === 403) {
        return { ok: false, message: '403 禁止访问：服务器拒绝请求，可能未配置 CORS 或需要鉴权' }
      }
      if (resp.status === 404) {
        return { ok: false, message: '404 未找到：URL 地址无效或资源已被删除' }
      }
      return { ok: false, message: `请求失败：HTTP ${resp.status} ${resp.statusText || ''}` }
    } catch (err: unknown) {
      clearTimeout(timeoutId)
      if (err instanceof DOMException && err.name === 'AbortError') {
        return { ok: false, message: `请求超时（${PROBE_TIMEOUT_MS / 1000}秒），URL 可能无法访问或网络较慢` }
      }
      if (err instanceof TypeError) {
        return {
          ok: false,
          message: '网络/CORS 错误：浏览器无法访问该资源（可能是跨域限制、网络中断或协议错误）',
        }
      }
      return { ok: false, message: '探测失败：' + (err instanceof Error ? err.message : '未知错误') }
    }
  }

  /**
   * @description 打开视频 URL 弹窗
   * @param currentUrl - 当前已有的 URL（编辑时回填）
   * @param onConfirm - 用户点击确定时执行的回调，接收 URL 字符串，返回成功/失败结果
   * @returns Promise，resolve 为 true 表示确认并应用成功，false 表示取消或失败后取消
   */
  function openVideoUrlDialog(
    currentUrl: string,
    onConfirm: (url: string) => Promise<{ ok: boolean; error?: string }>,
  ): Promise<boolean> {
    initialUrl.value = currentUrl
    testResult.value = null
    status.value = 'input'
    errorMessage.value = ''
    onConfirmHandler = onConfirm
    dialogActive.value = true
    return new Promise((resolve) => { resolveFn = resolve })
  }

  /**
   * @description 触发探测（由 UI 在 input 阶段调用）
   * @param url - 待探测的 URL
   */
  async function probe(url: string) {
    testing.value = true
    testResult.value = null
    try {
      testResult.value = await testUrl(url)
    } finally {
      testing.value = false
    }
  }

  /**
   * @description 用户在 input 阶段点击「确定」：进入 loading 阶段并执行 onConfirm
   * @param url - 用户输入的 URL
   */
  async function handleConfirm(url: string) {
    if (!url.trim()) return
    status.value = 'loading'
    testResult.value = null
    errorMessage.value = ''
    if (!onConfirmHandler) return
    try {
      const result = await onConfirmHandler(url.trim())
      if (result.ok) {
        status.value = 'success'
        setTimeout(() => {
          dialogActive.value = false
          if (resolveFn) { resolveFn(true); resolveFn = null }
        }, SUCCESS_AUTO_CLOSE_MS)
      } else {
        status.value = 'error'
        errorMessage.value = result.error || '加载失败'
      }
    } catch (e) {
      status.value = 'error'
      errorMessage.value = e instanceof Error ? e.message : '加载失败'
    }
  }

  /** 用户在 error 阶段点击「重新输入」：回到 input 阶段 */
  function retry() {
    status.value = 'input'
    errorMessage.value = ''
  }

  /** 用户主动关闭（取消/遮罩/ESC 等） */
  function onClose() {
    dialogActive.value = false
    if (resolveFn) { resolveFn(false); resolveFn = null }
  }

  return {
    dialogActive, initialUrl, testing, testResult,
    status, errorMessage,
    openVideoUrlDialog, probe, handleConfirm, retry, onClose,
  }
}
