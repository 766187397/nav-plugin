import { reactive, ref } from 'vue'
import type { IconData, PageData, DragState, AppData } from '@/types'

const EDGE_THRESHOLD = 80 // 触发页面边缘翻页的像素阈值
const FLIP_INTERVAL = 600 // 翻页定时器间隔（毫秒）
const GRID_COLS = 8
const GRID_ROWS = 4
const GRID_SIZE = GRID_COLS * GRID_ROWS
const PADDING_X = 30
const PADDING_Y = 12

/** 根据视口尺寸计算格子大小，设置CSS变量 */
function recalcGridSize() {
  const vp = document.querySelector('.pages-viewport') as HTMLElement | null
  if (!vp) return
  const rect = vp.getBoundingClientRect()
  const availW = rect.width - PADDING_X * 2
  const availH = rect.height - PADDING_Y * 2
  const maxColGap = Math.min(28, availW * 0.03)
  const maxRowGap = Math.min(16, availH * 0.03)
  const cellW = (availW - (GRID_COLS - 1) * maxColGap) / GRID_COLS
  const cellH = (availH - (GRID_ROWS - 1) * maxRowGap) / GRID_ROWS
  const cellSize = Math.min(cellW, cellH)
  const iconSize = Math.max(32, cellSize * 0.58)
  const nameFontSize = Math.max(10, cellSize * 0.13)
  document.documentElement.style.setProperty('--cell-size', `${cellSize}px`)
  document.documentElement.style.setProperty('--col-gap', `${maxColGap}px`)
  document.documentElement.style.setProperty('--row-gap', `${maxRowGap}px`)
  document.documentElement.style.setProperty('--icon-size', `${iconSize}px`)
  document.documentElement.style.setProperty('--name-font-size', `${nameFontSize}px`)
}

/** 将页面图标数组归一化为固定 32 格（8×4），不足补 null，多余截断 */
function normalizePageIcons(icons: (IconData | null)[]): (IconData | null)[] {
  const arr = [...icons]
  while (arr.length < GRID_SIZE) arr.push(null as unknown as IconData)
  return arr.slice(0, GRID_SIZE)
}

/** 移除数组末尾连续的 null 元素 */
function trimTrailingNulls(arr: (IconData | null)[]) {
  while (arr.length && arr[arr.length - 1] === null) arr.pop()
}

/**
 * @description 桌面导航核心 composable，管理桌面图标、分页、拖拽、导航等全部交互逻辑
 * @param data - 响应式应用数据（包含 pages、dock、settings 等）
 * @param storage - 存储操作接口（saveData、generateId、saveCompressedIcon）
 * @param resolveImageUrl - 将图标引用解析为可显示 URL 的函数
 * @param showToast - 显示提示消息的函数
 * @param showConfirm - 显示确认对话框的函数，返回用户是否确认
 * @returns 桌面状态与方法集合（当前页码、拖拽状态、各类操作方法等）
 */
export function useDesktop(
  data: { value: AppData },
  storage: {
    saveData: () => void
    generateId: () => string
    saveCompressedIcon: (dataUrl: string) => Promise<string>
  },
  resolveImageUrl: (src: string) => Promise<string>,
  showToast: (msg: string) => void,
  showConfirm: (msg: string) => Promise<boolean>,
) {
  const currentPage = ref(0) // 当前显示的页面索引
  const totalPages = ref(0) // 总页面数
  let touchStartX = 0 // 触摸起始 X 坐标
  let touchDeltaX = 0 // 触摸水平偏移量
  let wheelThrottle = 0 // 滚轮事件节流时间戳

  const dragState = reactive<DragState>({ // 拖拽交互状态
    isDragging: false,
    dragIconId: '',
    dragPageIndex: -1,
    dragIconIndex: -1,
    _pageFlipTimer: null,
    _placeholderEl: null,
    _placeholderType: null,
  })

  /** 初始化桌面渲染 */
  function initDesktop(renderFn: () => void, pagesTrack?: HTMLElement) {
    renderDesktop(renderFn, pagesTrack)
  }

  /** 重新渲染桌面：更新总页数、校正当前页、应用可见性设置后调用渲染回调 */
  function renderDesktop(renderFn: () => void, pagesTrack?: HTMLElement) {
    data.value.pages.forEach(p => { p.icons = normalizePageIcons(p.icons) })
    const pages = data.value.pages
    totalPages.value = pages.length
    goToPage(Math.min(currentPage.value, totalPages.value - 1), false, pagesTrack)
    applyVisibilitySettings()
    renderFn()
  }

  /**
   * @description 跳转到指定页面并移动页面轨道
   * @param index - 目标页索引
   * @param animate - 是否启用过渡动画，默认 true
   * @param pagesTrack - 页面容器 DOM 元素，用于执行位移动画
   */
  function goToPage(index: number, animate = true, pagesTrack?: HTMLElement) {
    if (index < 0 || index >= totalPages.value) return
    currentPage.value = index
    if (pagesTrack) {
      pagesTrack.style.transition = animate ? 'transform 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94)' : 'none'
      pagesTrack.style.transform = `translateX(-${index * 100}%)`
    }
  }

  /**
   * @description 在指定页面添加图标，优先填充空位，无空位则追加到末尾
   * @param pageIndex - 目标页面索引
   * @param icon - 要添加的图标数据
   */
  function addIcon(pageIndex: number, icon: IconData) {
    if (pageIndex >= data.value.pages.length) pageIndex = data.value.pages.length - 1
    const icons = data.value.pages[pageIndex].icons
    const emptyIdx = icons.indexOf(null as unknown as IconData)
    if (emptyIdx !== -1) {
      icons[emptyIdx] = icon
    } else {
      icons.push(icon)
    }
    storage.saveData()
  }

  /** 从指定页面移除指定位置的图标，并清理尾部空位 */
  function removeIcon(pageIndex: number, iconIndex: number) {
    if (data.value.pages[pageIndex]?.icons[iconIndex]) {
      data.value.pages[pageIndex].icons[iconIndex] = null as unknown as IconData
      storage.saveData()
    }
  }

  /** 更新指定位置图标的完整数据 */
  function updateIcon(pageIndex: number, iconIndex: number, updatedIcon: IconData) {
    if (data.value.pages[pageIndex]?.icons[iconIndex]) {
      data.value.pages[pageIndex].icons[iconIndex] = updatedIcon
      storage.saveData()
    }
  }

  /** 新增一页空白桌面 */
  function addPage() {
    data.value.pages.push({ id: storage.generateId(), icons: [] })
    storage.saveData()
  }

  /** 删除当前页（至少保留一页） */
  function removeCurrentPage() {
    if (data.value.pages.length <= 1) { showToast('至少保留一页'); return }
    data.value.pages.splice(currentPage.value, 1)
    storage.saveData()
    if (currentPage.value >= data.value.pages.length) currentPage.value = data.value.pages.length - 1
  }

  /**
   * @description 将图标从一个位置移动到另一个位置，支持跨页和同页移动
   * @param fromPage - 源页面索引
   * @param fromIndex - 源图标索引
   * @param toPage - 目标页面索引
   * @param toIndex - 目标图标索引（-1 表示追加到目标页末尾）
   */
  function moveIcon(fromPage: number, fromIndex: number, toPage: number, toIndex: number) {
    if (fromIndex === toIndex && fromPage === toPage) return
    const fromIcons = data.value.pages[fromPage].icons
    const toIcons = data.value.pages[toPage].icons
    const movingIcon = fromIcons[fromIndex]
    if (!movingIcon) return

    const targetIcon = toIcons[toIndex]
    fromIcons[fromIndex] = targetIcon
    toIcons[toIndex] = movingIcon

    storage.saveData()
  }

  /** 切换桌面图标的显示/隐藏状态 */
  function toggleIconsVisibility() {
    data.value.settings.showIcons = !data.value.settings.showIcons
    storage.saveData()
  }

  /**
   * @description 根据设置项控制页面指示器和 Dock 栏的可见性
   * @param pageIndicators - 页面指示器 DOM 元素（可选）
   */
  function applyVisibilitySettings(pageIndicators?: HTMLElement) {
    const s = data.value.settings
    if (pageIndicators) pageIndicators.style.display = s.showPageIndicators === false ? 'none' : ''
    const dockEl = document.querySelector('.dock') as HTMLElement
    if (dockEl) dockEl.style.display = s.showDock === false ? 'none' : ''
  }

  /**
   * @description 向后台脚本发送消息并等待响应，超时 15 秒返回 null
   * @template T - 响应数据类型
   * @param message - 发送给后台的消息对象
   * @returns 后台脚本的响应数据，失败或超时返回 null
   */
  function sendToBg<T>(message: { type: string; [key: string]: unknown }): Promise<T> {
    return new Promise((resolve) => {
      if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
        resolve(null as T)
        return
      }
      chrome.runtime.sendMessage(message, (resp: T) => {
        resolve(resp ?? (null as T))
      })
      setTimeout(() => resolve(null as T), 15000)
    })
  }

  /**
   * @description 处理从 Popup 发起的添加图标请求，自动抓取 favicon 并保存到对应位置
   * @param payload - 包含名称、网址和目标位置（desktop/dock）的数据
   */
  async function handleAddIconFromPopup(payload: { name: string; url: string; target: 'desktop' | 'dock' }) {
    const iconData: IconData = {
      id: storage.generateId(),
      name: payload.name,
      url: payload.url,
      icon: '',
      iconType: 'url',
    }

    try {
      const { base64 } = await sendToBg<{ base64: string | null }>({ type: 'FETCH_FAVICON', url: payload.url })
      if (base64) {
        const idbKey = await storage.saveCompressedIcon(base64)
        iconData.icon = idbKey
        iconData.iconType = 'idb'
        await resolveImageUrl(idbKey)
      }
    } catch { /* ignore */ }

    if (payload.target === 'dock') {
      if (data.value.dock.length >= 10) return
      data.value.dock.push(iconData)
    } else {
      const lastPage = data.value.pages[data.value.pages.length - 1]
      lastPage.icons.push(iconData)
    }

    storage.saveData()
  }

  // ── Drag & Drop ──────────────────────────────────────

  /** 开始拖拽图标，记录源位置信息 */
  function onDragStart(e: DragEvent, iconId: string, pageIndex: number, iconIndex: number) {
    dragState.isDragging = true
    dragState.dragIconId = iconId
    dragState.dragPageIndex = pageIndex
    dragState.dragIconIndex = iconIndex
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move'
      e.dataTransfer.setData('text/plain', '')
    }
  }

  /** 结束拖拽：清除占位符、重置所有拖拽状态 */
  function onDragEnd() {
    if (dragState._pageFlipTimer) { clearTimeout(dragState._pageFlipTimer); dragState._pageFlipTimer = null }
    removePlaceholder()
    dragState.isDragging = false
    dragState.dragIconId = ''
    dragState.dragPageIndex = -1
    dragState.dragIconIndex = -1
  }

  /** 页面拖拽悬停处理：阻止默认行为、检测边缘翻页、更新占位符 */
  function onPageDragOver(e: DragEvent) {
    e.preventDefault()
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
    checkEdgeFlip(e)
    const cell = getTargetCell(e)
    showPlaceholder(cell, e)
  }

  /** 页面放置处理：计算目标格子、执行图标移动、结束拖拽 */
  function onPageDrop(e: DragEvent) {
    e.preventDefault()
    if (dragState._pageFlipTimer) { clearTimeout(dragState._pageFlipTimer); dragState._pageFlipTimer = null }
    removePlaceholder()
    if (!dragState.isDragging) return
    const cell = getTargetCell(e)
    if (!cell) return
    if (cell.pageIndex === dragState.dragPageIndex && cell.iconIndex === dragState.dragIconIndex) return
    moveIcon(dragState.dragPageIndex, dragState.dragIconIndex, cell.pageIndex, cell.iconIndex)
    onDragEnd()
  }

  /**
   * @description 根据拖拽事件坐标计算目标网格单元格位置
   * @param e - 拖拽事件对象
   * @returns 目标页面索引与图标索引，或无法确定时返回 null
   */
  function getTargetCell(e: DragEvent): { pageIndex: number; iconIndex: number } | null {
    const el = document.elementFromPoint(e.clientX, e.clientY)
    if (!el) return null

    const iconEl = el.closest('[data-icon-index]') as HTMLElement | null
    if (!iconEl) return null

    const pageEl = iconEl.closest('[data-page-index]') as HTMLElement | null
    if (!pageEl) return null

    const pageIndex = parseInt(pageEl.dataset.pageIndex || '')
    const iconIndex = parseInt(iconEl.dataset.iconIndex || '')
    if (isNaN(pageIndex) || isNaN(iconIndex)) return null

    return { pageIndex, iconIndex }
  }

  /** 在目标位置显示拖拽占位符（复用已有图标高亮或创建浮动占位元素） */
  function showPlaceholder(cell: { pageIndex: number; iconIndex: number } | null, _e: DragEvent) {
    if (!cell) { removePlaceholder(); return }
    const pages = document.querySelectorAll('.page')
    const pageEl = pages[cell.pageIndex] as HTMLElement | undefined
    if (!pageEl) return
    removePlaceholder()
    const existingIcon = Array.from(pageEl.querySelectorAll('.desktop-icon'))
      .find(el => parseInt((el as HTMLElement).dataset.iconIndex || '') === cell.iconIndex)
    if (existingIcon && (existingIcon as HTMLElement).dataset.iconId !== dragState.dragIconId) {
      existingIcon.classList.add('drag-over')
      dragState._placeholderEl = existingIcon as HTMLElement
      dragState._placeholderType = 'icon'
      return
    }
    const style = getComputedStyle(document.documentElement)
    const colGap = 28, rowGap = 16, paddingX = 30, paddingY = 12
    const pageRect = pageEl.getBoundingClientRect()
    const cellW = (pageRect.width - paddingX * 2 - (GRID_COLS - 1) * colGap) / GRID_COLS
    const refIcon = pageEl.querySelector('.desktop-icon')
    const cellH = refIcon ? refIcon.getBoundingClientRect().height : (parseFloat(style.getPropertyValue('--icon-size')) || 56) + 30
    const c = cell.iconIndex % GRID_COLS
    const r = Math.floor(cell.iconIndex / GRID_COLS)
    const left = paddingX + c * (cellW + colGap)
    const top = paddingY + r * (cellH + rowGap)
    const placeholder = document.createElement('div')
    placeholder.className = 'grid-placeholder'
    placeholder.style.cssText = `position:absolute;left:${left}px;top:${top}px;width:${cellW}px;height:${cellH}px;pointer-events:none;`
    pageEl.appendChild(placeholder)
    dragState._placeholderEl = placeholder
    dragState._placeholderType = 'float'
  }

  /** 移除当前拖拽占位符（恢复图标样式或删除浮动占位元素） */
  function removePlaceholder() {
    if (!dragState._placeholderEl) return
    if (dragState._placeholderType === 'icon') {
      dragState._placeholderEl.classList.remove('drag-over')
    } else {
      dragState._placeholderEl.remove()
    }
    dragState._placeholderEl = null
    dragState._placeholderType = null
  }

  /** 检测拖拽是否靠近视口边缘，若是则调度定时翻页 */
  function checkEdgeFlip(e: DragEvent) {
    const viewport = document.querySelector('.pages-viewport')
    if (!viewport) return
    const rect = viewport.getBoundingClientRect()
    const x = e.clientX
    if (x < rect.left + EDGE_THRESHOLD) schedulePageFlip(-1)
    else if (x > rect.right - EDGE_THRESHOLD) schedulePageFlip(1)
    else { if (dragState._pageFlipTimer) { clearTimeout(dragState._pageFlipTimer); dragState._pageFlipTimer = null } }
  }

  /**
   * @description 调度延迟翻页，防止重复触发
   * @param direction - 翻页方向：-1 为上一页，+1 为下一页
   */
  function schedulePageFlip(direction: number) {
    if (dragState._pageFlipTimer) return
    dragState._pageFlipTimer = setTimeout(() => {
      const targetPage = currentPage.value + direction
      if (targetPage >= 0 && targetPage < totalPages.value) {
        const pagesTrack = document.querySelector('.pages-track') as HTMLElement | null
        goToPage(targetPage, true, pagesTrack || undefined)
      }
      dragState._pageFlipTimer = null
    }, FLIP_INTERVAL)
  }

  // ── Navigation ───────────────────────────────────────

  /**
   * @description 创建滚轮切换页面的处理器（含 300ms 节流）
   * @param pagesTrack - 页面轨道 DOM 元素
   * @returns WheelEvent 事件处理函数
   */
  function onDesktopWheel(pagesTrack?: HTMLElement) {
    return (e: WheelEvent) => {
      const now = Date.now()
      if (now - wheelThrottle < 300) return
      wheelThrottle = now
      if (e.deltaY > 0) goToPage(currentPage.value + 1, true, pagesTrack)
      else if (e.deltaY < 0) goToPage(currentPage.value - 1, true, pagesTrack)
    }
  }

  /** 记录触摸起始 X 坐标 */
  function onViewportTouchStart(e: TouchEvent) {
    touchStartX = e.touches[0].clientX
  }

  /** 计算触摸水平偏移量 */
  function onViewportTouchMove(e: TouchEvent) {
    touchDeltaX = e.touches[0].clientX - touchStartX
  }

  /**
   * @description 触摸结束处理器，偏移超过 50px 时触发翻页
   * @param pagesTrack - 页面轨道 DOM 元素
   * @returns 触摸结束事件处理函数
   */
  function onViewportTouchEnd(pagesTrack?: HTMLElement) {
    return () => {
      if (Math.abs(touchDeltaX) > 50) {
        if (touchDeltaX < 0) goToPage(currentPage.value + 1, true, pagesTrack)
        else goToPage(currentPage.value - 1, true, pagesTrack)
      }
      touchDeltaX = 0
    }
  }

  /**
   * @description 检测鼠标是否接近导航按钮并切换高亮状态
   * @param x - 鼠标 X 坐标
   * @param y - 鼠标 Y 坐标
   * @param prevBtn - 上一页按钮元素
   * @param nextBtn - 下一页按钮元素
   */
  function checkNavProximity(x: number, y: number, prevBtn?: HTMLElement, nextBtn?: HTMLElement) {
    const threshold = 80
    if (!prevBtn || !nextBtn) return
    const prevRect = prevBtn.getBoundingClientRect()
    const nextRect = nextBtn.getBoundingClientRect()
    const nearPrev = Math.abs(x - (prevRect.left + prevRect.width / 2)) < threshold &&
      Math.abs(y - (prevRect.top + prevRect.height / 2)) < threshold
    const nearNext = Math.abs(x - (nextRect.left + nextRect.width / 2)) < threshold &&
      Math.abs(y - (nextRect.top + nextRect.height / 2)) < threshold
    prevBtn.classList.toggle('nearby', nearPrev && currentPage.value > 0)
    nextBtn.classList.toggle('nearby', nearNext && currentPage.value < totalPages.value - 1)
  }

  /** 图标点击处理：非拖拽状态下在新标签页打开链接 */
  function onIconClick(icon: IconData) {
    if (dragState.isDragging) return
    window.open(icon.url, '_blank')
  }

  /**
   * @description 将图标移动到另一页（仅多页时有效）
   * @param pageIndex - 图标当前所在页索引
   * @param iconIndex - 图标在当前页的索引
   */
  function moveToPage(pageIndex: number, iconIndex: number) {
    if (data.value.pages.length <= 1) { showToast('只有一页，无法移动'); return }
    const targetPage = pageIndex === 0 ? 1 : 0
    moveIcon(pageIndex, iconIndex, targetPage, -1)
  }

  return {
    currentPage, totalPages, dragState,
    initDesktop, renderDesktop, goToPage,
    addIcon, removeIcon, updateIcon, addPage, removeCurrentPage,
    moveIcon, toggleIconsVisibility, applyVisibilitySettings,
    handleAddIconFromPopup, sendToBg,
    onDragStart, onDragEnd, onPageDragOver, onPageDrop,
    onDesktopWheel, onViewportTouchStart, onViewportTouchMove, onViewportTouchEnd,
    checkNavProximity, onIconClick, moveToPage,
    recalcGridSize,
  }
}
