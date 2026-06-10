import { reactive } from 'vue'
import type { ThemeColorGroup } from '@/types'

/** 主题颜色分组配置，用于设置面板中按组展示可自定义的 CSS 变量 */
export const THEME_COLOR_GROUPS: ThemeColorGroup[] = [
  {
    title: '主题色',
    vars: [
      { key: '--color-accent', label: '主强调', isRgba: false },
      { key: '--color-accent-hover', label: '强调悬停', isRgba: false },
      { key: '--color-accent-subtle', label: '微强调', isRgba: true },
      { key: '--color-accent-glow', label: '强调光晕', isRgba: true },
    ],
  },
  { title: '基础背景', vars: [{ key: '--color-bg', label: '背景色', isRgba: false }] },
  {
    title: '表面层',
    vars: [
      { key: '--color-surface', label: '表面色', isRgba: true },
      { key: '--color-surface-hover', label: '悬停色', isRgba: true },
      { key: '--color-border', label: '边框色', isRgba: true },
    ],
  },
  {
    title: '文字',
    vars: [
      { key: '--color-text', label: '主文字', isRgba: true },
      { key: '--color-text-secondary', label: '次要文字', isRgba: true },
    ],
  },
  {
    title: '危险/删除',
    vars: [
      { key: '--color-danger', label: '主危险', isRgba: false },
      { key: '--color-danger-hover', label: '危险悬停', isRgba: false },
      { key: '--color-danger-subtle', label: '微危险', isRgba: true },
    ],
  },
  {
    title: '毛玻璃',
    vars: [
      { key: '--glass-bg', label: '玻璃背景', isRgba: true },
      { key: '--glass-border', label: '玻璃边框', isRgba: true },
    ],
  },
]

/** 主题 CSS 变量默认值映射表，作为用户未自定义时的回退值 */
export const CSS_DEFAULTS: Record<string, string> = {
  '--color-accent': '#4DBCD8',
  '--color-accent-hover': '#6DD0E8',
  '--color-accent-subtle': 'rgba(77, 188, 216, 0.07)',
  '--color-accent-glow': 'rgba(77, 188, 216, 0.25)',
  '--color-bg': '#101824',
  '--color-surface': 'rgba(78, 188, 216, 0.05)',
  '--color-surface-hover': 'rgba(78, 188, 216, 0.11)',
  '--color-border': 'rgba(100, 160, 180, 0.13)',
  '--color-text': 'rgba(232, 234, 240, 0.92)',
  '--color-text-secondary': 'rgba(160, 170, 185, 0.6)',
  '--color-danger': '#E57373',
  '--color-danger-hover': '#EF9A9A',
  '--color-danger-subtle': 'rgba(229, 115, 115, 0.13)',
  '--glass-bg': 'rgba(16, 24, 36, 0.78)',
  '--glass-border': 'rgba(100, 140, 165, 0.12)',
}

/**
 * 主题管理组合式函数，负责自定义颜色的读取、编辑、持久化与导入导出
 * 所有持久化操作均通过 IndexedDB 完成，不使用 localStorage 存储业务数据
 *
 * @param showToast - 轻提示消息回调
 * @param showConfirm - 确认对话框回调，返回用户是否确认
 * @param loadTheme - 从 IDB 加载已保存的主题颜色（由 useStorage 提供）
 * @param saveTheme - 保存主题颜色到 IDB（由 useStorage 提供）
 * @param removeTheme - 从 IDB 删除自定义主题（由 useStorage 提供）
 * @returns 主题相关的状态、配置常量及操作方法集合
 */
export function useTheme(
  showToast: (msg: string) => void,
  showConfirm: (msg: string) => Promise<boolean>,
  loadTheme: () => Promise<Record<string, string> | null>,
  saveTheme: (colors: Record<string, string>) => Promise<void>,
  removeTheme: () => Promise<void>,
) {
  /** 当前各 CSS 变量的实际颜色值（key 为变量名，value 为颜色字符串） */
  const themeColors = reactive<Record<string, string>>({})

  /**
   * 从 IndexedDB 加载已保存的主题颜色，回退到 CSS_DEFAULTS 默认值
   * 需要在组件 onMounted 中异步调用
   */
  async function loadThemeColors() {
    try {
      const saved = await loadTheme()
      const current = saved || CSS_DEFAULTS
      THEME_COLOR_GROUPS.forEach(g => {
        g.vars.forEach(v => {
          themeColors[v.key] = current[v.key] || CSS_DEFAULTS[v.key] || ''
        })
      })
    } catch { /* 忽略加载失败 */ }
  }

  /**
   * 将 IndexedDB 中已保存的自定义主题颜色直接应用到 documentElement 的内联样式
   * 需要在组件 onMounted 中异步调用
   */
  async function applySavedThemeToDOM() {
    try {
      const saved = await loadTheme()
      if (saved) {
        Object.entries(saved).forEach(([k, v]) => {
          document.documentElement.style.setProperty(k, v)
        })
      }
    } catch { /* ignore */ }
  }

  /** 将当前主题颜色快照写入 IndexedDB 持久化 */
  async function saveThemeColors() {
    await saveTheme({ ...themeColors })
  }

  /**
   * 颜色选择器输入变更处理，根据是否为 rgba 类型自动转换并同步到 DOM 与 IDB
   * @param varKey - CSS 变量名（如 --color-accent）
   * @param isRgba - 该变量是否为 rgba 类型
   * @param hexValue - 用户输入的颜色值（通常为 hex 格式）
   */
  function onThemeColorInput(varKey: string, isRgba: boolean, hexValue: string) {
    if (isRgba) {
      const existing = themeColors[varKey] || ''
      themeColors[varKey] = hexToRgba(hexValue, existing)
    } else {
      themeColors[varKey] = hexValue
    }
    document.documentElement.style.setProperty(varKey, themeColors[varKey])
    saveThemeColors()
  }

  /**
   * 颜色文本框直接输入变更处理，自动补全 rgba 前缀后同步到 DOM 与 IDB
   * @param varKey - CSS 变量名
   * @param isRgba - 该变量是否为 rgba 类型
   * @param value - 用户直接输入的颜色原始字符串
   */
  function onThemeValueChange(varKey: string, isRgba: boolean, value: string) {
    if (!value) return
    let newVal = value.trim()
    if (isRgba && !newVal.startsWith('rgba') && !newVal.startsWith('rgb')) {
      newVal = hexToRgba(newVal, '')
    }
    themeColors[varKey] = newVal
    document.documentElement.style.setProperty(varKey, newVal)
    saveThemeColors()
  }

  /** 重置所有自定义颜色为默认值（需用户确认），清除 DOM 内联样式后重新加载默认配色 */
  async function resetTheme() {
    const ok = await showConfirm('确定要恢复默认主题色吗？')
    if (!ok) return
    await removeTheme()
    THEME_COLOR_GROUPS.forEach(g => {
      g.vars.forEach(v => {
        document.documentElement.style.removeProperty(v.key)
      })
    })
    await loadThemeColors()
  }

  /** 导出当前自定义主题为 JSON 文件（含名称、版本、时间戳和颜色数据） */
  function exportTheme() {
    const colors = { ...themeColors }
    const themeData = { name: '自定义主题', version: 1, exportedAt: new Date().toISOString(), colors }
    const json = JSON.stringify(themeData, null, 2)
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `nav-theme-${Date.now()}.json`; a.click()
    URL.revokeObjectURL(url)
    showToast('主题导出成功')
  }

  /** 从 JSON 文件导入主题（需用户确认覆盖），导入后立即应用并持久化到 IDB */
  function importTheme() {
    const input = document.createElement('input')
    input.type = 'file'; input.accept = '.json'
    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const themeData = JSON.parse(text)
        if (!themeData.colors || typeof themeData.colors !== 'object') { showToast('无效的主题文件'); return }
        const ok = await showConfirm(`导入主题「${themeData.name || '未知'}」将覆盖当前自定义颜色，确定继续吗？`)
        if (!ok) return
        Object.entries(themeData.colors).forEach(([k, v]) => {
          document.documentElement.style.setProperty(k, v as string)
        })
        Object.assign(themeColors, themeData.colors)
        await saveThemeColors()
        showToast('主题导入成功')
      } catch (err: unknown) {
        showToast('导入失败：' + (err instanceof Error ? err.message : '未知错误'))
      }
    })
    input.click()
  }

  /**
   * 将 hex 颜色值转换为 rgba 格式，保留参考值的透明度分量
   * @param hex - 十六进制颜色值（如 #RRGGBB）
   * @param referenceRgba - 参考的 rgba 字符串，用于提取透明度；若无法解析则默认 0.5
   * @returns 转换后的 rgba 字符串
   */
  function hexToRgba(hex: string, referenceRgba: string): string {
    const r = parseInt(hex.slice(1, 3), 16)
    const g = parseInt(hex.slice(3, 5), 16)
    const b = parseInt(hex.slice(5, 7), 16)
    let a = 1
    if (referenceRgba && referenceRgba.match(/rgba?\([^)]+\)/)) {
      const match = referenceRgba.match(/[\d.]+(?=\))/)
      if (match) a = parseFloat(match[match.length - 1]) || 1
    }
    if (a === 1) a = 0.5
    return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`
  }

  /**
   * 将 rgba/rgb 颜色值转换为 hex 格式（丢弃透明度信息）
   * @param rgba - rgb 或 rgba 格式的颜色字符串
   * @returns 转换后的 hex 颜色值（如 #RRGGBB），解析失败返回 #888888
   */
  function rgbaToHex(rgba: string): string {
    const match = rgba.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
    if (!match) return '#888888'
    return '#' + [match[1], match[2], match[3]].map(x => parseInt(x).toString(16).padStart(2, '0')).join('')
  }

  /**
   * 获取指定 CSS 变量当前值的 hex 表示（用于颜色选择器回显）
   * @param varKey - CSS 变量名
   * @returns hex 颜色字符串；若当前值为空或解析失败则返回 #888888 占位
   */
  function getThemeHexValue(varKey: string): string {
    const val = themeColors[varKey] || ''
    if (val.startsWith('#')) return val
    if (val.startsWith('rgba') || val.startsWith('rgb')) return rgbaToHex(val)
    return '#888888'
  }

  return {
    themeColors, THEME_COLOR_GROUPS, CSS_DEFAULTS,
    loadThemeColors, applySavedThemeToDOM,
    onThemeColorInput, onThemeValueChange,
    resetTheme, exportTheme, importTheme,
    hexToRgba, rgbaToHex, getThemeHexValue,
  }
}
