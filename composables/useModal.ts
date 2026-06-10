import { ref, nextTick } from 'vue'
import type { IconData, ModalMode, AppData } from '@/types'
import { IconFetcher } from '@/utils/iconFetcher'

/**
 * @description 模态框 composable，管理添加/编辑图标、Dock 项、搜索引擎的弹窗交互
 * @param storage - 存储操作接口（generateId、saveData、saveCompressedIcon、compressImage）
 * @param resolveImageUrl - 将图标引用解析为可显示 URL 的函数
 * @param showToast - 显示提示消息的函数
 * @param showLoading - 显示加载状态的函数
 * @param hideLoading - 隐藏加载状态的函数
 * @param showConfirm - 显示确认对话框的函数
 * @param desktopCallbacks - 桌面图标的增删改回调及当前页索引
 * @param dockCallbacks - Dock 栏项的增删改回调
 * @param data - 响应式应用数据（包含 pages、dock、search 等）
 * @returns 模态框状态与方法集合（开关控制、各类打开/编辑/确认方法等）
 */
export function useModal(
  storage: {
    generateId: () => string
    saveData: () => void
    saveCompressedIcon: (dataUrl: string) => Promise<string>
    compressImage: (file: File, maxSize?: number) => Promise<string>
  },
  resolveImageUrl: (src: string) => Promise<string>,
  showToast: (msg: string) => void,
  showLoading: (text?: string) => void,
  hideLoading: () => void,
  showConfirm: (msg: string) => Promise<boolean>,
  desktopCallbacks: {
    addIcon: (pageIndex: number, icon: IconData) => void
    updateIcon: (pageIndex: number, iconIndex: number, updatedIcon: IconData) => void
    currentPage: { value: number }
  },
  dockCallbacks: {
    addDockItem: (item: IconData) => void
    updateDockItem: (index: number, updatedItem: IconData) => void
  },
  data: { value: AppData },
) {
  const modalActive = ref(false) // 模态框是否显示
  const modalMode = ref<ModalMode>('add-desktop') // 当前模态框模式（决定提交行为）
  const modalTitle = ref('编辑图标') // 模态框标题文字
  const modalPageIndex = ref(0) // 编辑目标所在的桌面页面索引
  const modalIconIndex = ref(0) // 编辑目标在页面中的图标索引
  const modalDockIndex = ref(0) // 编辑目标在 Dock 栏中的索引
  const modalEngineIndex = ref(0) // 编辑目标在搜索引擎列表中的索引
  const modalIconSrc = ref('') // 图标预览图的 base64 或 URL
  const modalIconVisible = ref(false) // 是否显示图标预览
  const fetchIconDisabled = ref(false) // 抓取图标按钮是否禁用
  const fetchIconText = ref('抓取图标') // 抓取图标按钮文字
  const fetchNameDisabled = ref(false) // 抓取名称按钮是否禁用
  const fetchNameText = ref('抓取名称') // 抓取名称按钮文字

  /**
   * @description 打开模态框并设置模式与标题，重置图标预览状态
   * @param mode - 模态框操作模式
   * @param title - 显示的标题文字
   */
  function openModal(mode: ModalMode, title: string) {
    modalTitle.value = title
    modalMode.value = mode
    modalIconSrc.value = ''
    modalIconVisible.value = false
    modalActive.value = true
  }

  /** 打开"添加导航地址"弹窗，定位到当前页并清空输入 */
  function addDesktopIcon() {
    openModal('add-desktop', '添加导航地址')
    modalPageIndex.value = desktopCallbacks.currentPage.value
    nextTick(() => resetInputs())
  }

  /**
   * @description 打开"编辑导航地址"弹窗，回填现有数据并加载图标预览
   * @param icon - 被编辑的图标数据
   * @param pageIndex - 所在页面索引
   * @param iconIndex - 在页面中的图标索引
   */
  function editDesktopIcon(icon: IconData, pageIndex: number, iconIndex: number) {
    openModal('edit-desktop', '编辑导航地址')
    modalPageIndex.value = pageIndex
    modalIconIndex.value = iconIndex
    modalActive.value = true
    nextTick(async () => {
      fillInputs(icon.name, icon.url)
      const url = await resolveImageUrl(icon.icon || '')
      showIconPreview(url || '')
    })
  }

  /**
   * @description 打开"编辑 Dock 图标"弹窗，回填数据并加载图标预览
   * @param item - 被编辑的 Dock 项数据
   * @param index - 在 Dock 栏中的索引
   */
  function editDockIcon(item: IconData, index: number) {
    openModal('edit-dock', '编辑 Dock 图标')
    modalDockIndex.value = index
    modalActive.value = true
    nextTick(async () => {
      fillInputs(item.name, item.url)
      const url = await resolveImageUrl(item.icon || '')
      showIconPreview(url || '')
    })
  }

  /** 打开"添加 Dock 图标"弹窗并清空输入 */
  function addDockIcon() {
    openModal('add-dock', '添加 Dock 图标')
    nextTick(() => resetInputs())
  }

  /** 打开"添加搜索引擎"弹窗并清空输入 */
  function addSearchEngine() {
    openModal('add-engine', '添加搜索引擎')
    nextTick(() => resetInputs())
  }

  /**
   * @description 打开"编辑搜索引擎"弹窗，回填数据并加载图标预览
   * @param index - 在搜索引擎列表中的索引
   */
  function editSearchEngine(index: number) {
    const engine = data.value.search.engines[index]
    openModal('edit-engine', '编辑搜索引擎')
    modalEngineIndex.value = index
    modalActive.value = true
    nextTick(async () => {
      fillInputs(engine.name, engine.url)
      if (engine.icon) {
        const url = await resolveImageUrl(engine.icon)
        showIconPreview(url || '')
      } else {
        showIconPreview('')
      }
    })
  }

  /**
   * @description 更新图标预览状态与图片源
   * @param src - 图片 URL 或 base64 字符串，空值则隐藏预览
   */
  function showIconPreview(src: string) {
    if (src) {
      modalIconSrc.value = src
      modalIconVisible.value = true
    } else {
      modalIconSrc.value = ''
      modalIconVisible.value = false
    }
  }

  /** 关闭模态框 */
  function closeModal() {
    modalActive.value = false
  }

  /** 清空名称和网址输入框 */
  function resetInputs() {
    const nameInput = document.querySelector('input[name="iconName"]') as HTMLInputElement
    const urlInput = document.querySelector('input[name="iconUrl"]') as HTMLInputElement
    if (nameInput) nameInput.value = ''
    if (urlInput) urlInput.value = ''
  }

  /**
   * @description 填充名称和网址输入框
   * @param name - 名称值
   * @param url - 网址值
   */
  function fillInputs(name: string, url: string) {
    const nameInput = document.querySelector('input[name="iconName"]') as HTMLInputElement
    const urlInput = document.querySelector('input[name="iconUrl"]') as HTMLInputElement
    if (nameInput) nameInput.value = name
    if (urlInput) urlInput.value = url
  }

  /**
   * @description 处理图标文件上传选择：压缩图片后更新预览
   * @param e - 文件输入框 change 事件
   */
  async function onIconFileChange(e: Event) {
    const file = (e.target as HTMLInputElement).files?.[0]
    if (!file) return
    showLoading('正在处理图片...')
    try {
      const base64 = await storage.compressImage(file, 128)
      showIconPreview(base64)
    } finally { hideLoading() }
  }

  /**
   * @description 通过前端直接抓取指定网址的 favicon 并显示预览（与 HTML 版本一致）
   * @param url - 目标网址
   */
  async function onFetchIcon(url: string) {
    if (!url) { showToast('请先输入网址'); return }
    fetchIconDisabled.value = true
    fetchIconText.value = '抓取中...'
    showLoading('正在抓取图标...')
    try {
      const favicon = await IconFetcher.fetchFavicon(url)
      if (favicon) { showIconPreview(favicon); showToast('图标抓取成功') }
      else showToast('未能抓取到图标，请手动上传')
    } catch (err: unknown) {
      showToast('抓取失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      fetchIconDisabled.value = false
      fetchIconText.value = '抓取图标'
      hideLoading()
    }
  }

  /**
   * @description 通过前端直接抓取指定网址的页面标题并填入名称输入框（与 HTML 版本一致）
   * @param url - 目标网址
   */
  async function onFetchName(url: string) {
    if (!url) { showToast('请先输入网址'); return }
    fetchNameDisabled.value = true
    fetchNameText.value = '抓取中...'
    showLoading('正在获取名称...')
    try {
      let title: string | null = null
      // 插件环境：通过 background script 获取（绕过 CORS）
      if (typeof chrome !== 'undefined' && chrome.runtime?.sendMessage) {
        title = await new Promise<string | null>((resolve) => {
          chrome.runtime.sendMessage({ type: 'FETCH_TITLE', url }, (resp: { title: string | null }) => {
            resolve(resp?.title || null)
          })
          setTimeout(() => resolve(null), 15000)
        })
      }
      // 网页版回退：直接前端抓取
      if (!title) {
        title = await IconFetcher.fetchTitle(url)
      }
      if (title) {
        const nameInput = document.querySelector('input[name="iconName"]') as HTMLInputElement
        if (nameInput) nameInput.value = title
        showToast('名称获取成功')
      }
      else showToast('未能获取名称，请手动输入')
    } catch (err: unknown) {
      showToast('获取失败：' + (err instanceof Error ? err.message : '未知错误'))
    } finally {
      fetchNameDisabled.value = false
      fetchNameText.value = '抓取名称'
      hideLoading()
    }
  }

  /**
   * @description 模态框确认提交：校验输入、保存图标、根据模式执行对应操作后关闭弹窗
   * @param name - 图标名称
   * @param url - 图标链接地址
   */
  async function onModalConfirm(name: string, url: string) {
    let finalUrl = url.trim() || ''
    const rawIcon = modalIconSrc.value

    if (!name || !finalUrl) { showToast('请填写名称和网址'); return }
    if (!/^https?:\/\//i.test(finalUrl)) finalUrl = 'https://' + finalUrl

    let iconRef = ''
    if (rawIcon) {
      showLoading('正在保存图标...')
      try {
        iconRef = await storage.saveCompressedIcon(rawIcon)
      } catch (err: unknown) {
        showToast('图标保存失败：' + (err instanceof Error ? err.message : '未知错误'))
        hideLoading()
        return
      } finally { hideLoading() }
    }
    if (iconRef) await resolveImageUrl(iconRef)

    const iconData: IconData = { id: storage.generateId(), name, url: finalUrl, icon: iconRef, iconType: iconRef ? 'idb' : 'url' }

    switch (modalMode.value) {
      case 'add-desktop': {
        const pi = modalPageIndex.value || desktopCallbacks.currentPage.value
        desktopCallbacks.addIcon(pi, iconData)
        break
      }
      case 'edit-desktop': {
        const pi = modalPageIndex.value
        const ii = modalIconIndex.value
        iconData.id = data.value.pages[pi]?.icons[ii]?.id || iconData.id
        desktopCallbacks.updateIcon(pi, ii, iconData)
        break
      }
      case 'add-dock': {
        dockCallbacks.addDockItem(iconData)
        break
      }
      case 'edit-dock': {
        const di = modalDockIndex.value
        iconData.id = data.value.dock[di]?.id || iconData.id
        dockCallbacks.updateDockItem(di, iconData)
        break
      }
      case 'add-engine': {
        data.value.search.engines.push({ id: storage.generateId(), name, url: finalUrl.replace('%s', ''), icon: iconRef })
        storage.saveData()
        break
      }
      case 'edit-engine': {
        const ei = modalEngineIndex.value
        data.value.search.engines[ei] = { ...data.value.search.engines[ei], name, url: finalUrl.replace('%s', ''), icon: iconRef || data.value.search.engines[ei].icon }
        storage.saveData()
        break
      }
    }

    closeModal()
  }

  return {
    modalActive, modalMode, modalTitle,
    modalPageIndex, modalIconIndex, modalDockIndex, modalEngineIndex,
    modalIconSrc, modalIconVisible,
    fetchIconDisabled, fetchIconText, fetchNameDisabled, fetchNameText,
    addDesktopIcon, editDesktopIcon, editDockIcon, addDockIcon,
    addSearchEngine, editSearchEngine,
    showIconPreview, closeModal,
    onIconFileChange, onFetchIcon, onFetchName, onModalConfirm,
  }
}
