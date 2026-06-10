import { ref } from 'vue'
import type { AppData, IconData } from '@/types'


/**
 * 设置面板组合式函数，管理所有设置相关的状态与操作
 * @param data - 响应式应用数据对象（包含背景、搜索、图标等配置）
 * @param storage - 存储操作接口集合（数据持久化、图片/视频处理、导入导出等）
 * @param bgFns - 背景相关操作接口（切换模式、设置图片/视频、更新背景等）
 * @param showToast - 轻提示消息回调
 * @param showLoading - 显示加载遮罩回调
 * @param hideLoading - 隐藏加载遮罩回调
 * @param showConfirm - 确认对话框回调，返回用户是否确认
 * @param modalCallbacks - 弹窗操作回调集合（增删改 Dock 图标、桌面图标、搜索引擎）
 * @param dockCallbacks - Dock 栏操作回调（带确认删除）
 * @param desktopCallbacks - 桌面图标操作回调（删除、新增）
 * @param loadThemeColors - 加载主题颜色回调
 * @returns 设置面板所需的状态与方法集合
 */
export function useSettings(
  data: { value: AppData },
  storage: {
    saveData: () => void
    fileToBase64: (file: File) => Promise<string>
    generateId: () => string
    saveWallpaper: (key: string, dataUrl: string) => Promise<string>
    saveVideo: (file: File) => Promise<string>
    exportAllImages: () => Promise<Record<string, unknown>>
    importAllImages: (images: Record<string, unknown>) => Promise<void>
    clearAllImages: () => Promise<void>
    migrateData: (data: Partial<AppData>) => AppData
  },
  bgFns: {
    setSingleImage: (src: string) => Promise<void>
    setTopLayer: (src: string) => Promise<void>
    setBottomLayer: (src: string) => Promise<void>
    setVideo: (fileOrUrl: string | File) => Promise<void>
    randomizeWallpaper: (images: string[]) => void
    applyBackgroundMode: (mode: string) => void
    updateBackgroundFromData: () => Promise<void>
    resolveImageUrl: (src: string) => Promise<string>
    loadThemeFromDB: () => Promise<Record<string, string> | null>
    saveThemeToDB: (colors: Record<string, string>) => Promise<void>
    removeThemeFromDB: () => Promise<void>
  },
  showToast: (msg: string, duration?: number) => void,
  showLoading: (text?: string) => void,
  hideLoading: () => void,
  showConfirm: (msg: string) => Promise<boolean>,
  modalCallbacks: {
    addDockIcon: () => void
    editDockIcon: (item: IconData, index: number) => void
    editDesktopIcon: (icon: IconData, pageIndex: number, iconIndex: number) => void
    addSearchEngine: () => void
    editSearchEngine: (index: number) => void
  },
  dockCallbacks: {
    removeDockItemWithConfirm: (index: number) => Promise<void>
  },
  desktopCallbacks: {
    removeIcon: (pageIndex: number, iconIndex: number) => void
    addDesktopIcon: () => void
  },
  loadThemeColors: () => void,
  openVideoUrlDialog: (
    currentUrl: string,
    onConfirm: (url: string) => Promise<{ ok: boolean; error?: string }>,
  ) => Promise<boolean>,
) {
  const settingsActive = ref(false) // 设置面板是否打开
  const activeSettingsTab = ref('appearance') // 当前激活的设置标签页标识

  /**
   * 打开设置面板，可指定初始定位到的设置分区
   * @param section - 可选的设置分区标识（如 wallpaper、dock-icons 等），用于自动跳转对应 Tab 并滚动到目标区域
   */
  function openSettings(section?: string) {
    settingsActive.value = true
    if (section) {
      const panelMap: Record<string, string> = { // 分区标识到 Tab 标识的映射表
        wallpaper: 'appearance', 'background-effect': 'appearance',
        'desktop-icons': 'icons', 'dock-icons': 'icons',
        'search-engines': 'search', display: 'display',
        'data-management': 'data',
      }
      const targetTab = panelMap[section]
      if (targetTab) {
        activeSettingsTab.value = targetTab
        setTimeout(() => {
          const target = document.querySelector(`[data-section="${section}"]`)
          if (target) target.scrollIntoView({ behavior: 'smooth' })
        }, 350)
      }
    }
    loadThemeColors()
  }

  /** 关闭设置面板 */
  function closeSettings() {
    settingsActive.value = false
  }

  /**
   * 切换当前激活的设置标签页
   * @param tab - 目标标签页标识
   */
  function switchSettingsTab(tab: string) {
    activeSettingsTab.value = tab
  }

  /**
   * 背景模式变更处理（如纯色/图片/视频等大类切换）
   * @param mode - 目标背景模式标识
   */
  function onSettingsBgModeChange(mode: string) {
    bgFns.applyBackgroundMode(mode)
  }

  /**
   * 单图模式下子模式变更处理（固定 / 随机）
   * @param mode - 单图子模式：'fixed' 或 'random'
   */
  function onSettingsSingleModeChange(mode: string) {
    data.value.background.singleMode = mode as 'fixed' | 'random'
    storage.saveData()
    bgFns.updateBackgroundFromData()
  }

  /** 上传并设置单张背景图 */
  async function onUploadSingleImage() {
    await uploadImageFile((base64) => bgFns.setSingleImage(base64))
  }

  /** 上传并设置顶层叠加背景图 */
  async function onUploadTopLayer() {
    await uploadImageFile((base64) => bgFns.setTopLayer(base64))
  }

  /** 上传并设置底层背景图 */
  async function onUploadBottomLayer() {
    await uploadImageFile((base64) => bgFns.setBottomLayer(base64))
  }

  /** 上传并设置背景视频文件 */
  async function onUploadVideo() {
    await uploadVideoFile((videoIdbKey) => bgFns.setVideo(videoIdbKey))
  }

  /**
   * @description 通过自定义弹窗输入 URL 设置背景视频，加载/成功/错误状态全部在弹窗内展示
   */
  async function onVideoUrl() {
    const ok = await openVideoUrlDialog(
      data.value.background.videoSrc || '',
      async (url: string) => {
        if (!/^https?:\/\//i.test(url)) {
          return { ok: false, error: 'URL 格式错误：必须以 http:// 或 https:// 开头' }
        }
        try {
          await bgFns.setVideo(url)
          return { ok: true }
        } catch (e) {
          return { ok: false, error: e instanceof Error ? e.message : '视频加载失败' }
        }
      },
    )
    if (ok) showToast('视频背景已应用', 3000)
  }

  /** 批量添加随机壁纸图片（上限 20 张），上传后立即预热 URL 缓存 */
  async function onAddRandomImage() {
    const input = createFileInput('image/*', true)
    const MAX_RANDOM = 20 // 随机壁纸最大数量限制
    input.addEventListener('change', async (e) => {
      const files = Array.from((e.target as HTMLInputElement).files || [])
      if (!files.length) return
      const remain = MAX_RANDOM - (data.value.background.randomImages || []).length
      if (remain <= 0) { showToast('已达到 20 张上限'); return }
      const toAdd = files.slice(0, remain)
      showLoading(`正在处理 ${toAdd.length} 张图片...`)
      try {
        const newKeys: string[] = []
        for (const file of toAdd) {
          const base64 = await storage.fileToBase64(file)
          let idbKey = base64
          if (!base64.startsWith('idb:') && !base64.startsWith('http') && !base64.startsWith('/')) {
            idbKey = await storage.saveWallpaper('random_' + storage.generateId(), base64)
          }
          if (!data.value.background.randomImages) data.value.background.randomImages = []
          data.value.background.randomImages.push(idbKey)
          newKeys.push(idbKey)
        }
        storage.saveData()
        // 预热新图片的 resolvedUrls 缓存，解决列表中首次显示异常的问题
        await Promise.all(newKeys.map(key => bgFns.resolveImageUrl(key)))
        bgFns.updateBackgroundFromData()
        showToast(`成功添加 ${toAdd.length} 张图片`)
      } finally { hideLoading() }
    })
    input.click()
  }

  /**
   * 删除指定索引的随机壁纸图片
   * @param idx - 要删除的图片在列表中的索引
   */
  async function onRemoveRandomImage(idx: number) {
    const ok = await showConfirm('确定要删除这张随机图片吗？')
    if (!ok) return
    data.value.background.randomImages.splice(idx, 1)
    storage.saveData()
    bgFns.updateBackgroundFromData()
  }

  /** 从设置面板触发添加 Dock 图标 */
  function onAddDockFromSettings() {
    modalCallbacks.addDockIcon()
  }

  /**
   * 从设置面板触发编辑指定 Dock 图标
   * @param index - 要编辑的 Dock 图标索引
   */
  function onEditDockFromSettings(index: number) {
    const item = data.value.dock[index]
    modalCallbacks.editDockIcon(item, index)
  }

  /**
   * 从设置面板触发删除指定 Dock 图标（带确认弹窗）
   * @param index - 要删除的 Dock 图标索引
   */
  async function onRemoveDockFromSettings(index: number) {
    await dockCallbacks.removeDockItemWithConfirm(index)
  }

  /** 从设置面板触发添加搜索引擎 */
  function onAddSearchEngine() {
    modalCallbacks.addSearchEngine()
  }

  /**
   * 从设置面板触发编辑指定搜索引擎
   * @param index - 要编辑的搜索引擎索引
   */
  function onEditSearchEngine(index: number) {
    modalCallbacks.editSearchEngine(index)
  }

  /**
   * 删除指定搜索引擎，若当前选中索引越界则归零
   * @param index - 要删除的搜索引擎索引
   */
  function onRemoveSearchEngine(index: number) {
    data.value.search.engines.splice(index, 1)
    if (data.value.search.currentEngine >= data.value.search.engines.length) {
      data.value.search.currentEngine = 0
    }
    storage.saveData()
  }

  /**
   * 通用开关设置项变更处理
   * @param key - 设置项字段名
   * @param checked - 开关当前是否选中
   */
  function onToggleSetting(key: string, checked: boolean) {
    ;(data.value.settings as unknown as Record<string, unknown>)[key] = checked
    storage.saveData()
  }

  /** 导出全部数据（含图片资源与自定义主题）为 JSON 备份文件 */
  async function onExportData() {
    try {
      const exportData = JSON.parse(JSON.stringify(data.value))
      const images = await storage.exportAllImages()
      ;(exportData as Record<string, unknown>)._images = images
      // 从 IDB 读取自定义主题数据
      const themeColors = await bgFns.loadThemeFromDB()
      if (themeColors) { (exportData as Record<string, unknown>)._customTheme = themeColors }
      const json = JSON.stringify(exportData, null, 2)
      downloadBlob(json, `newtab-backup-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`, 'application/json')
      showToast('数据导出成功')
    } catch (e: unknown) {
      showToast('导出失败：' + (e instanceof Error ? e.message : '未知错误'))
    }
  }

  /** 导入备份 JSON 文件，覆盖当前全部数据并刷新页面 */
  function onImportData() {
    const input = createFileInput('.json')
    input.addEventListener('change', async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0]
      if (!file) return
      try {
        const text = await file.text()
        const importData = JSON.parse(text)
        if (!importData.version || !importData.pages) { showToast('无效的备份文件'); return }
        const ok = await showConfirm('导入将覆盖当前所有数据，确定继续吗？')
        if (!ok) return
        // 导入媒体资源到 IDB
        const images = importData._images || {}
        delete importData._images
        await storage.clearAllImages()
        await storage.importAllImages(images)
        // 导入应用配置到 IDB（不再使用 localStorage）
        const customTheme = importData._customTheme
        delete importData._customTheme
        const migrated = storage.migrateData(importData)
        data.value = migrated
        await storage.saveData() // 通过 saveData 写入 IDB
        // 导入主题数据到 IDB
        if (customTheme) {
          await bgFns.saveThemeToDB(customTheme as Record<string, string>)
        } else {
          await bgFns.removeThemeFromDB()
        }
        showToast('数据导入成功，页面即将刷新')
        setTimeout(() => location.reload(), 1000)
      } catch (err: unknown) {
        showToast('导入失败：' + (err instanceof Error ? err.message : '未知错误'))
      }
    })
    input.click()
  }

  // ── Internal helpers ─────────────────────────────────

  /**
   * 创建文件选择器并上传单张图片，获取 base64 后执行回调
   * @param onBase64 - 图片转 base64 完成后的回调
   */
  function uploadImageFile(onBase64: (base64: string) => Promise<void>) {
    return new Promise<void>((resolve) => {
      const input = createFileInput('image/*')
      input.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) { resolve(); return }
        showLoading('正在处理图片...')
        try {
          const base64 = await storage.fileToBase64(file)
          await onBase64(base64)
        } finally { hideLoading(); resolve() }
      })
      input.click()
    })
  }

  /**
   * 创建文件选择器并上传视频文件，存储后返回 IDB key 再执行回调
   * @param onVideoIdbKey - 视频存储完成后的回调，参数为 IDB 存储键
   */
  function uploadVideoFile(onVideoIdbKey: (idbKey: string) => Promise<void>) {
    return new Promise<void>((resolve) => {
      const input = createFileInput('video/*')
      input.addEventListener('change', async (e) => {
        const file = (e.target as HTMLInputElement).files?.[0]
        if (!file) { resolve(); return }
        showLoading('正在处理视频...')
        try {
          const videoIdbKey = await storage.saveVideo(file)
          await onVideoIdbKey(videoIdbKey)
        } catch (err: unknown) {
          showToast(err instanceof Error ? err.message : '视频处理失败')
        } finally { hideLoading(); resolve() }
      })
      input.click()
    })
  }

  /**
   * 创建隐藏的文件选择 input 元素
   * @param accept - 接受的文件 MIME 类型（如 'image/*'、'.json'）
   * @param multiple - 是否允许多选，默认 false
   * @returns 创建好的 HTMLInputElement
   */
  function createFileInput(accept: string, multiple = false): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = accept
    if (multiple) input.multiple = true
    return input
  }

  /**
   * 在浏览器中触发下载 Blob 内容为文件
   * @param content - 文件文本内容
   * @param filename - 下载时的文件名
   * @param type - 文件 MIME 类型
   */
  function downloadBlob(content: string, filename: string, type: string) {
    const blob = new Blob([content], { type })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  return {
    settingsActive, activeSettingsTab,
    openSettings, closeSettings, switchSettingsTab,
    onSettingsBgModeChange, onSettingsSingleModeChange,
    onUploadSingleImage, onUploadTopLayer, onUploadBottomLayer,
    onUploadVideo, onVideoUrl,
    onAddRandomImage, onRemoveRandomImage,
    onAddDockFromSettings, onEditDockFromSettings, onRemoveDockFromSettings,
    onAddSearchEngine, onEditSearchEngine, onRemoveSearchEngine,
    onToggleSetting, onExportData, onImportData,
  }
}
