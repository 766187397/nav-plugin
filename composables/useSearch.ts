import { ref } from 'vue'
import type { AppData } from '@/types'

/**
 * @description 搜索功能组合式函数，管理搜索栏的显示/隐藏、搜索引擎切换、搜索执行等逻辑
 * @param data - 响应式应用数据对象，包含 search 和 settings 配置
 * @param storage - 存储操作对象，用于持久化数据变更
 * @returns 搜索相关的状态和方法
 */
export function useSearch(data: { value: AppData }, storage: { saveData: () => void }) {
  const searchDropdownActive = ref(false) // 搜索引擎下拉菜单是否展开
  const searchHovering = ref(false) // 鼠标是否悬停在搜索区域
  let searchHoverTimer: ReturnType<typeof setTimeout> | null = null // 搜索区域鼠标离开延迟隐藏定时器

  /**
   * @description 初始化搜索栏可见性状态
   */
  function initSearch() {
    applySearchVisibility(undefined)
  }

  /**
   * @description 切换搜索引擎下拉菜单的显示/隐藏状态
   */
  function toggleSearchDropdown() {
    searchDropdownActive.value = !searchDropdownActive.value
  }

  /**
   * @description 关闭搜索引擎下拉菜单
   */
  function closeSearchDropdown() {
    searchDropdownActive.value = false
  }

  /**
   * @description 选择指定索引的搜索引擎并保存配置
   * @param index - 目标搜索引擎在 engines 数组中的索引
   */
  function selectEngine(index: number) {
    data.value.search.currentEngine = index
    storage.saveData()
    searchDropdownActive.value = false
  }

  /**
   * @description 使用当前选中的搜索引擎执行搜索，打开新标签页跳转
   * @param searchInput - 搜索输入框 DOM 元素引用
   */
  function doSearch(searchInput: HTMLInputElement | undefined) {
    const query = searchInput?.value.trim()
    if (!query) return
    const engine = data.value.search.engines[data.value.search.currentEngine || 0]
    if (engine) window.open(engine.url + encodeURIComponent(query), '_blank')
    if (searchInput) searchInput.value = ''
  }

  /**
   * @description 根据设置决定搜索容器的可见性，通过 CSS 类控制显隐
   * @param searchContainer - 搜索容器 DOM 元素，传入 undefined 时仅读取配置不操作 DOM
   */
  function applySearchVisibility(searchContainer: HTMLElement | undefined) {
    const show = data.value.settings.showSearch !== false
    if (searchContainer) {
      if (show) {
        searchContainer.classList.remove('search-hidden', 'search-visible')
      } else {
        searchContainer.classList.add('search-hidden')
        searchContainer.classList.remove('search-visible')
      }
    }
  }

  /**
   * @description 鼠标进入搜索区域时显示搜索容器（用于隐藏模式下 hover 显示）
   * @param searchContainer - 搜索容器 DOM 元素
   */
  function onSearchMouseEnter(searchContainer: HTMLElement | undefined) {
    if (searchHoverTimer) clearTimeout(searchHoverTimer)
    searchHovering.value = true
    searchContainer?.classList.add('search-visible')
    searchContainer?.classList.remove('search-hidden')
  }

  /**
   * @description 鼠标离开搜索区域时延迟隐藏搜索容器（仅在搜索栏设置为隐藏时生效）
   * @param searchContainer - 搜索容器 DOM 元素
   */
  function onSearchMouseLeave(searchContainer: HTMLElement | undefined) {
    if (data.value.settings.showSearch !== false) return
    searchHovering.value = false
    if (document.activeElement?.tagName === 'INPUT' || searchDropdownActive.value) return
    searchHoverTimer = setTimeout(() => {
      if (searchHovering.value) return
      searchContainer?.classList.remove('search-visible')
      searchContainer?.classList.add('search-hidden')
    }, 300)
  }

  /**
   * @description 搜索输入框获焦时显示搜索容器（复用 mouseEnter 逻辑）
   * @param searchContainer - 搜索容器 DOM 元素
   */
  function onSearchInputFocus(searchContainer: HTMLElement | undefined) {
    onSearchMouseEnter(searchContainer)
  }

  /**
   * @description 搜索输入框失焦后延迟检查是否需要隐藏搜索容器
   */
  function onSearchInputBlur() {
    setTimeout(() => { if (!searchHovering.value) onSearchMouseLeave(undefined) }, 150)
  }

  return {
    searchDropdownActive,
    initSearch, toggleSearchDropdown, closeSearchDropdown,
    selectEngine, doSearch, applySearchVisibility,
    onSearchMouseEnter, onSearchMouseLeave, onSearchInputFocus, onSearchInputBlur,
  }
}
