import { ref, computed, reactive } from 'vue'
import type { ContextMenuData, MenuItem, AppData, IconData } from '@/types'

/** 右键菜单图标名称到 SVG 字符串的映射表 */
const SVG_MAP: Record<string, string> = {
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12h14"/></svg>',
  layout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>',
  eye: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>',
  image: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="M21 15l-5-5L5 21"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>',
  settings: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>',
  external: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  move: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
}

/**
 * @description 根据图标名称从 SVG_MAP 中获取对应的 SVG 字符串
 * @param name - 图标名称（如 'plus'、'trash' 等）
 * @returns 对应的 SVG 字符串，未找到时返回空字符串
 */
function svg(name: string): string {
  return SVG_MAP[name] || ''
}

/**
 * @description 右键菜单组合式函数，管理桌面/图标/Dock 图标的右键菜单显示、菜单项生成与点击处理
 * @param data - 响应式应用数据对象
 * @param callbacks - 右键菜单各项操作对应的回调函数集合
 * @returns 右键菜单相关的状态和方法
 */
export function useContextMenu(
  data: { value: AppData },
  callbacks: {
    addDesktopIcon: () => void
    addPage: () => void
    removeCurrentPage: () => void
    toggleIconsVisibility: () => void
    randomizeWallpaper: (images: string[]) => void
    openSettings: (section?: string) => void
    editDesktopIcon: (icon: IconData, pageIndex: number, iconIndex: number) => void
    moveToPage: (pageIndex: number, iconIndex: number) => void
    editDockIcon: (item: IconData, index: number) => void
    removeDockItem: (index: number) => void
    removeIcon: (pageIndex: number, iconIndex: number) => void
    showConfirm: (msg: string) => Promise<boolean>
    showToast: (msg: string) => void
  },
) {
  const contextMenuVisible = ref(false) // 右键菜单是否可见
  const contextMenuX = ref(0) // 右键菜单显示位置的 X 坐标
  const contextMenuY = ref(0) // 右键菜单显示位置的 Y 坐标
  const contextMenuType = ref('desktop') // 当前右键菜单类型：desktop / icon / dock-icon
  const contextMenuData = ref<ContextMenuData>({}) // 当前右键菜单关联的上下文数据（如图标信息、索引等）

  /**
   * @description 在指定坐标显示右键菜单，自动处理边界防溢出
   * @param x - 菜单显示的 X 坐标
   * @param y - 菜单显示的 Y 坐标
   * @param type - 菜单类型标识
   * @param menuData - 菜单项所需的上下文数据
   */
  function showContextMenu(x: number, y: number, type: string, menuData: ContextMenuData = {}) {
    contextMenuVisible.value = true
    contextMenuType.value = type
    contextMenuData.value = menuData
    const menuWidth = 180 // 右键菜单预估宽度（像素）
    const menuHeight = 200 // 右键菜单预估高度（像素）
    if (x + menuWidth > window.innerWidth) x = window.innerWidth - menuWidth - 10
    if (y + menuHeight > window.innerHeight) y = window.innerHeight - menuHeight - 10
    contextMenuX.value = x
    contextMenuY.value = y
  }

  /**
   * @description 隐藏右键菜单
   */
  function hideContextMenu() {
    contextMenuVisible.value = false
  }

  /** 根据当前菜单类型和上下文数据动态计算生成的菜单项列表 */
  const contextMenuItems = computed((): MenuItem[] => {
    const type = contextMenuType.value
    const d = contextMenuData.value
    switch (type) {
      case 'desktop': {
        const bgData = data.value.background
        const isRandomMode = bgData.mode === 'single' && bgData.singleMode === 'random' && bgData.randomImages && bgData.randomImages.length > 0
        const items: MenuItem[] = [
          { label: '添加导航地址', icon: svg('plus'), action: () => callbacks.addDesktopIcon() },
          { label: '添加新页面', icon: svg('layout'), action: () => callbacks.addPage() },
          { label: '删除此页面', icon: svg('trash'), danger: true, action: () => callbacks.showConfirm('确定要删除当前页面吗？会连带删除所有图标！').then(ok => { if (ok) callbacks.removeCurrentPage() }), disabled: data.value.pages.length <= 1 },
          { separator: true },
          { label: '显示/隐藏图标', icon: svg('eye'), action: () => callbacks.toggleIconsVisibility() },
        ]
        if (isRandomMode) {
          items.push({ label: '随机壁纸', icon: svg('shuffle'), action: () => callbacks.randomizeWallpaper(bgData.randomImages) })
        }
        items.push({ label: '更换壁纸', icon: svg('image'), action: () => callbacks.openSettings('wallpaper') })
        items.push({ separator: true })
        items.push({ label: '设置', icon: svg('settings'), action: () => callbacks.openSettings() })
        return items
      }
      case 'icon': {
        const icon = d.icon as IconData
        const pageIndex = d.pageIndex as number
        const iconIndex = d.iconIndex as number
        return [
          { label: '打开', icon: svg('external'), action: () => window.open(icon.url, '_blank') },
          { separator: true },
          { label: '编辑', icon: svg('edit'), action: () => callbacks.editDesktopIcon(icon, pageIndex, iconIndex) },
          { label: '移动到其他页面', icon: svg('move'), action: () => callbacks.moveToPage(pageIndex, iconIndex) },
          { separator: true },
          { label: '删除', danger: true, action: () => callbacks.showConfirm('确定要删除「' + icon.name + '」吗？').then(ok => { if (ok) callbacks.removeIcon(pageIndex, iconIndex) }) },
        ]
      }
      case 'dock-icon': {
        const item = d.item as IconData
        const index = d.index as number
        return [
          { label: '打开', icon: svg('external'), action: () => window.open(item.url, '_blank') },
          { separator: true },
          { label: '编辑', icon: svg('edit'), action: () => callbacks.editDockIcon(item, index) },
          { label: '删除', danger: true, action: () => callbacks.showConfirm('确定要删除「' + item.name + '」吗？').then(ok => { if (ok) callbacks.removeDockItem(index) }) },
        ]
      }
      default: return []
    }
  })

  /**
   * @description 处理右键菜单项点击：跳过禁用项，关闭菜单后执行对应操作
   * @param item - 被点击的菜单项
   */
  function onContextMenuItemClick(item: MenuItem) {
    if (item.disabled) return
    hideContextMenu()
    item.action?.()
  }

  /**
   * @description 应用级右键菜单事件处理器，根据点击目标判断是否弹出桌面右键菜单
   * @param e - 鼠标事件对象
   */
  function onAppContextMenu(e: MouseEvent) {
    const target = e.target as HTMLElement
    const icon = target.closest('.desktop-icon')
    const dockItem = target.closest('.dock-item')
    const desktop = target.closest('.desktop')
    const background = target.closest('.background')
    const inApp = target.closest('#app')
    if (icon || dockItem) return
    if (desktop || background || (inApp && !target.closest('.search-box') && !target.closest('.settings-overlay') && !target.closest('.modal-overlay'))) {
      e.preventDefault()
      showContextMenu(e.clientX, e.clientY, 'desktop')
    }
  }

  return {
    contextMenuVisible, contextMenuX, contextMenuY,
    showContextMenu, hideContextMenu, contextMenuItems,
    onContextMenuItemClick, onAppContextMenu,
  }
}
