import type { IconData, AppData } from '@/types'

/**
 * @description Dock 栏组合式函数，管理 Dock 图标的鼠标悬停放大效果、增删改查操作
 * @param data - 响应式应用数据对象，包含 dock 数组和 settings 配置
 * @param storage - 存储操作对象，用于持久化数据变更
 * @param showToast - 显示提示消息的回调函数
 * @param showConfirm - 显示确认对话框的回调函数，返回用户是否确认
 * @returns Dock 相关的事件处理和方法
 */
export function useDock(
  data: { value: AppData },
  storage: { saveData: () => void },
  showToast: (msg: string) => void,
  showConfirm: (msg: string) => Promise<boolean>,
) {
  /**
   * @description 鼠标在 Dock 区域移动时，根据距离对各图标执行近大远小的缩放效果
   * @param e - 鼠标移动事件对象
   * @param dockContainer - Dock 容器 DOM 元素
   */
  function onDockMouseMove(e: MouseEvent, dockContainer: HTMLElement | undefined) {
    if (!dockContainer) return
    const items = dockContainer.querySelectorAll('.dock-item')
    items.forEach(item => {
      const rect = item.getBoundingClientRect()
      const itemCenterX = rect.left + rect.width / 2
      const distance = Math.abs(e.clientX - itemCenterX)
      const maxDist = 120 // Dock 图标缩放效果的最大影响距离（像素）
      const scale = Math.max(1, 1.5 - (distance / maxDist) * 0.5)
      const clampedScale = distance < maxDist ? scale : 1
      const img = item.querySelector('.dock-item-img') as HTMLElement
      if (img) {
        img.style.width = `calc(var(--dock-icon-size) * ${clampedScale})`
        img.style.height = `calc(var(--dock-icon-size) * ${clampedScale})`
      }
    })
  }

  /**
   * @description 鼠标离开 Dock 区域时，重置所有图标的缩放样式为默认大小
   * @param dockContainer - Dock 容器 DOM 元素
   */
  function onDockMouseLeave(dockContainer: HTMLElement | undefined) {
    if (!dockContainer) return
    const items = dockContainer.querySelectorAll('.dock-item-img')
    items.forEach((img) => { (img as HTMLElement).style.width = ''; (img as HTMLElement).style.height = '' })
  }

  /**
   * @description 点击 Dock 图标时在新标签页打开对应链接
   * @param item - 被点击的 Dock 图标数据
   */
  function onDockItemClick(item: IconData) {
    window.open(item.url, '_blank')
  }

  /**
   * @description 向 Dock 栏添加新图标，上限 10 个
   * @param item - 要添加的图标数据
   */
  function addDockItem(item: IconData) {
    if (data.value.dock.length >= 10) { showToast('Dock 最多支持 10 个图标'); return }
    data.value.dock.push(item)
    storage.saveData()
  }

  /**
   * @description 按索引删除 Dock 图标，当 Dock 为空时自动隐藏 Dock 栏
   * @param index - 要删除的图标在 dock 数组中的索引
   */
  function removeDockItem(index: number) {
    data.value.dock.splice(index, 1)
    storage.saveData()
    if (data.value.dock.length === 0) {
      data.value.settings.showDock = false
      storage.saveData()
    }
  }

  /**
   * @description 按索引更新指定 Dock 图标的数据
   * @param index - 要更新的图标索引
   * @param updatedItem - 更新后的图标数据
   */
  function updateDockItem(index: number, updatedItem: IconData) {
    data.value.dock[index] = updatedItem
    storage.saveData()
  }

  /**
   * @description 弹出确认对话框后删除 Dock 图标
   * @param index - 要删除的图标索引
   */
  async function removeDockItemWithConfirm(index: number) {
    const ok = await showConfirm('确定要删除此 Dock 图标吗？')
    if (!ok) return
    removeDockItem(index)
  }

  function reorderDockItem(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return
    const items = data.value.dock
    const tmp = items[fromIndex]
    items[fromIndex] = items[toIndex]
    items[toIndex] = tmp
    storage.saveData()
  }

  return {
    onDockMouseMove, onDockMouseLeave, onDockItemClick,
    addDockItem, removeDockItem, updateDockItem, removeDockItemWithConfirm,
    reorderDockItem,
  }
}
