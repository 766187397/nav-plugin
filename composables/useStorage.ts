import { ref } from 'vue'
import type { AppData, IconData } from '../types'

// ── 存储常量 ───────────────────────────────────────────
const DB_NAME = 'NewTabDB' // IndexedDB 数据库名称
const DB_VERSION = 4 // 数据库版本号（升级时触发 onupgradeneeded 创建新表）
const STORE_APPDATA = 'appData' // 应用配置数据（pages/dock/search/settings/background）存储表
const STORE_ICONS = 'icons' // 图标图片数据存储表（压缩后的 base64）
const STORE_WALLPAPERS = 'wallpapers' // 壁纸图片数据存储表
const STORE_VIDEOS = 'videos' // 视频文件数据存储表
const STORE_THEME = 'theme' // 自定义主题颜色存储表
const INIT_FLAG_KEY = 'newtab_initialized_v4' // 首次初始化标记（唯一保留在 localStorage 中的键）

// 视频文件大小上限（MB），防止浏览器崩溃
const MAX_VIDEO_SIZE_MB = 30
const MAX_VIDEO_SIZE = MAX_VIDEO_SIZE_MB * 1024 * 1024

// ── 默认应用数据 ───────────────────────────────────────
const DEFAULT_DATA: AppData = {
  version: 2,
  background: {
    mode: 'single',
    singleMode: 'fixed',
    singleImage: '',
    randomImages: [],
    topLayer: '',
    bottomLayer: '',
    videoSrc: '',
    revealRadius: null,
    revealFeather: null,
  },
  search: {
    engines: [],
    currentEngine: 0,
  },
  pages: [{ id: 'default-page-1', icons: [] }],
  dock: [],
  settings: {
    iconSize: 56,
    gridCols: 7,
    gridRows: 4,
    showIcons: true,
    showNavButtons: true,
    showPageIndicators: true,
    showDock: true,
    showSearch: true,
  },
}

// ── 通用工具函数 ───────────────────────────────────────

/** 生成唯一 ID（时间戳 + 随机字符串） */
export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 将 File 对象读取为 base64 Data URL 字符串 */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => resolve(e.target?.result as string)
    reader.readAsDataURL(file)
  })
}

/** 压缩图片为指定最大尺寸的 JPEG base64，用于图标缩略图 */
export function compressImage(file: File, maxSize = 64): Promise<string> {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        let w = img.naturalWidth
        let h = img.naturalHeight
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.8))
      }
      img.onerror = () => resolve('')
      img.src = e.target?.result as string
    }
    reader.readAsDataURL(file)
  })
}

// ── IndexedDB 通用 Store 封装 ──────────────────────────
class IDBStore<T = unknown> {
  private _db: Promise<IDBDatabase>
  private _store: string

  constructor(dbPromise: Promise<IDBDatabase>, storeName: string) {
    this._db = dbPromise
    this._store = storeName
  }

  async put(key: string, value: T): Promise<void> {
    const db = await this._db
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readwrite')
      tx.objectStore(this._store).put(value, key)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject((e.target as IDBTransaction).error)
    })
  }

  async get(key: string): Promise<T | null> {
    const db = await this._db
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readonly')
      const req = tx.objectStore(this._store).get(key)
      req.onsuccess = () => resolve(req.result ?? null)
      req.onerror = (e) => reject((e.target as IDBRequest).error)
    })
  }

  async delete(key: string): Promise<void> {
    const db = await this._db
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readwrite')
      tx.objectStore(this._store).delete(key)
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject((e.target as IDBTransaction).error)
    })
  }

  async getAll(): Promise<T[]> {
    const db = await this._db
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readonly')
      const req = tx.objectStore(this._store).getAll()
      req.onsuccess = () => resolve(req.result || [])
      req.onerror = (e) => reject((e.target as IDBRequest).error)
    })
  }

  async getAllEntries(): Promise<[string, T][]> {
    const db = await this._db
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readonly')
      const store = tx.objectStore(this._store)
      const entries: [string, T][] = []
      const req = store.openCursor()
      req.onsuccess = (e) => {
        const cursor = (e.target as IDBRequest<IDBCursorWithValue>).result
        if (cursor) {
          entries.push([cursor.key as string, cursor.value])
          cursor.continue()
        } else {
          resolve(entries)
        }
      }
      req.onerror = (e) => reject((e.target as IDBRequest).error)
    })
  }

  async clear(): Promise<void> {
    const db = await this._db
    return new Promise((resolve, reject) => {
      const tx = db.transaction(this._store, 'readwrite')
      tx.objectStore(this._store).clear()
      tx.oncomplete = () => resolve()
      tx.onerror = (e) => reject((e.target as IDBTransaction).error)
    })
  }
}

// ── 数据库连接管理 ─────────────────────────────────────
let _dbPromise: Promise<IDBDatabase> | null = null

/** 打开/创建 IndexedDB 数据库连接（单例模式） */
function openDB(): Promise<IDBDatabase> {
  if (_dbPromise) return _dbPromise
  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_ICONS)) db.createObjectStore(STORE_ICONS)
      if (!db.objectStoreNames.contains(STORE_WALLPAPERS)) db.createObjectStore(STORE_WALLPAPERS)
      if (!db.objectStoreNames.contains(STORE_VIDEOS)) db.createObjectStore(STORE_VIDEOS)
      if (!db.objectStoreNames.contains(STORE_APPDATA)) db.createObjectStore(STORE_APPDATA)
      if (!db.objectStoreNames.contains(STORE_THEME)) db.createObjectStore(STORE_THEME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = (e) => reject((e.target as IDBOpenDBRequest).error)
  })
  return _dbPromise
}

// Store 单例缓存
let _iconStore: IDBStore<{ createdAt: number; value: string }> | null = null
let _wpStore: IDBStore<{ data: string; createdAt: number }> | null = null
let _videoStore: IDBStore<{ data: string; fileName: string; fileType: string; fileSize: number; createdAt: number }> | null = null
let _appDataStore: IDBStore<AppData> | null = null
let _themeStore: IDBStore<Record<string, string>> | null = null

async function getIconStore() {
  if (!_iconStore) _iconStore = new IDBStore(openDB(), STORE_ICONS)
  return _iconStore
}
async function getWallpaperStore() {
  if (!_wpStore) _wpStore = new IDBStore(openDB(), STORE_WALLPAPERS)
  return _wpStore
}
async function getVideoStore() {
  if (!_videoStore) _videoStore = new IDBStore(openDB(), STORE_VIDEOS)
  return _videoStore
}
async function getAppDataStore() {
  if (!_appDataStore) _appDataStore = new IDBStore(openDB(), STORE_APPDATA)
  return _appDataStore
}
async function getThemeStore() {
  if (!_themeStore) _themeStore = new IDBStore(openDB(), STORE_THEME)
  return _themeStore
}

// ── 数据迁移与兼容 ─────────────────────────────────────
/**
 * 补全旧版本数据的缺失字段，确保结构完整
 * 支持从任意旧版本迁移到最新结构
 */
export function migrateData(data: Partial<AppData>): AppData {
  if (!data.version) data.version = 1
  if (!data.background)
    data.background = { mode: 'single', singleMode: 'fixed', singleImage: '', randomImages: [], topLayer: '', bottomLayer: '', videoSrc: '', revealRadius: null, revealFeather: null }
  else {
    if (!data.background.mode) data.background.mode = 'single'
    if (!data.background.singleMode) data.background.singleMode = 'fixed'
    if (!data.background.singleImage) data.background.singleImage = ''
    if (!data.background.randomImages) data.background.randomImages = []
    if (!data.background.topLayer) data.background.topLayer = ''
    if (!data.background.bottomLayer) data.background.bottomLayer = ''
    if (!data.background.videoSrc) data.background.videoSrc = ''
    if (data.background.revealRadius === undefined) data.background.revealRadius = null
    if (data.background.revealFeather === undefined) data.background.revealFeather = null
  }
  if (!data.search) data.search = DEFAULT_DATA.search
  if (!data.pages || data.pages.length === 0) data.pages = [{ id: generateId(), icons: [] }]
  if (!data.dock) data.dock = []
  if (!data.settings) data.settings = DEFAULT_DATA.settings
  return data as AppData
}

/**
 * 从 localStorage 迁移旧数据到 IndexedDB（仅执行一次）
 * 迁移完成后清除 localStorage 中的业务数据
 * localStorage 仅保留 INIT_FLAG_KEY 初始化标记
 */
async function migrateLocalStorageToIDB(): Promise<void> {
  const oldDataRaw = localStorage.getItem('newtab_data')
  if (!oldDataRaw) return // 没有旧数据，无需迁移

  try {
    const oldData = JSON.parse(oldDataRaw)
    const migrated = migrateData(oldData)

    // 写入 IDB 的 appData 表
    const store = await getAppDataStore()
    await store.put('current', migrated)

    // 同时迁移主题数据
    const themeRaw = localStorage.getItem('newtab_custom_theme')
    if (themeRaw) {
      try {
        const themeColors = JSON.parse(themeRaw)
        const tStore = await getThemeStore()
        await tStore.put('custom', themeColors)
      } catch { /* 忽略无效的主题数据 */ }
    }

    // 清除 localStorage 中的业务数据（只保留初始化标记）
    localStorage.removeItem('newtab_data')
    localStorage.removeItem('newtab_custom_theme')
    console.log('[Storage] 已将 localStorage 数据迁移至 IndexedDB')
  } catch (e) {
    console.error('[Storage] 迁移失败:', e)
  }
}

// ── 应用配置数据读写（IndexedDB）───────────────────────
/** 从 IndexedDB 加载应用配置数据，若不存在则返回默认值 */
async function loadDataFromIDB(): Promise<AppData> {
  const store = await getAppDataStore()
  const record = await store.get('current')
  return record ? migrateData(record) : structuredClone(DEFAULT_DATA)
}

/** 保存应用配置数据到 IndexedDB */
async function saveDataToIDB(data: AppData): Promise<void> {
  const store = await getAppDataStore()
  const plain = JSON.parse(JSON.stringify(data))
  await store.put('current', plain)
}

// ── 图片 URL 解析 ──────────────────────────────────────
/** 判断 src 是否为需要从 IDB 解析的引用类型 */
export function resolveImageUrl(src: string): string | null {
  if (!src) return null
  if (src.startsWith('idb:') || src.startsWith('/')) return src
  return src
}

/** 异步解析图标引用：从 IDB 读取 idb: 前缀的图片数据，返回真实 data URL */
export async function resolveIconData(src: string): Promise<string> {
  if (!src) return ''
  if (src.startsWith('idb:')) {
    const store = await getIconStore()
    const id = src.replace(/^idb:/, '')
    const record = await store.get(id)
    return record?.value || ''
  }
  return src
}

// ── 初始化默认数据 ─────────────────────────────────────
/**
 * 首次安装时从 default.json 加载默认数据（含预设图标图片）
 * 仅当 INIT_FLAG_KEY 不存在时执行一次
 */
export async function initDefaultData(): Promise<boolean> {
  if (localStorage.getItem(INIT_FLAG_KEY)) return false

  try {
    const resp = await fetch('/default.json')
    if (!resp.ok) return false

    const text = await resp.text()
    const data = JSON.parse(text)
    if (!data.version || !data.pages) return false

    // 提取图片资源
    const images = (data as Record<string, unknown>)._images as Record<string, { value: string }> | undefined
    delete (data as Record<string, unknown>)._images

    // 迁移并保存配置到 IDB
    const migrated = migrateData(data)
    await saveDataToIDB(migrated)

    // 导入图标图片到 IDB
    if (images && typeof images === 'object') {
      const iconS = await getIconStore()
      await iconS.clear()
      for (const [key, imgData] of Object.entries(images)) {
        const value = typeof imgData === 'object' && imgData?.value ? imgData.value : (typeof imgData === 'string' ? imgData : '')
        if (value) {
          try { await iconS.put(key, { createdAt: Date.now(), value }) } catch (e) { console.warn(`导入图片 ${key} 失败:`, e) }
        }
      }
    }

    localStorage.setItem(INIT_FLAG_KEY, '1')
    return true
  } catch (e) {
    console.error('[Storage] 初始化默认数据失败:', e)
    return false
  }
}

// ── Composable 主入口 ──────────────────────────────────
export function useStorage() {
  const data = ref<AppData>(structuredClone(DEFAULT_DATA))

  /** 保存当前数据到 IndexedDB */
  async function saveData(): Promise<void> {
    await saveDataToIDB(data.value)
  }

  /** 从 IndexedDB 重新加载数据 */
  async function loadData(): Promise<void> {
    // 先检查是否需要从 localStorage 迁移旧数据
    await migrateLocalStorageToIDB()
    data.value = await loadDataFromIDB()
  }

  // ── 图标操作（IDB icons 表）───────────────────────────
  /** 将 base64/URL 图片压缩为指定最大尺寸的 JPEG */
  function compressIconDataUrl(dataUrl: string, maxSize = 128): Promise<string> {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        let w = img.naturalWidth
        let h = img.naturalHeight
        if (w > maxSize || h > maxSize) {
          const ratio = Math.min(maxSize / w, maxSize / h)
          w = Math.round(w * ratio)
          h = Math.round(h * ratio)
        }
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        ctx!.drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.onerror = () => reject(new Error('图标加载失败'))
      img.src = dataUrl
    })
  }

  /** 保存压缩后的图标图片到 IDB，返回 idb 引用键 */
  async function saveCompressedIcon(dataUrl: string): Promise<string> {
    const compressed = await compressIconDataUrl(dataUrl, 128)
    const id = `icon_${generateId()}`
    const store = await getIconStore()
    await store.put(id, { createdAt: Date.now(), value: compressed })
    return `idb:${id}`
  }

  /** 根据 idb 键读取压缩图标数据 */
  async function getCompressedIcon(idbKey: string): Promise<string | null> {
    if (!idbKey || !idbKey.startsWith('idb:')) return null
    const id = idbKey.slice(4)
    const store = await getIconStore()
    const record = await store.get(id)
    return record ? record.value : null
  }

  /** 根据 idb 键删除压缩图标 */
  async function deleteCompressedIcon(idbKey: string): Promise<void> {
    if (!idbKey || !idbKey.startsWith('idb:')) return
    const id = idbKey.slice(4)
    const store = await getIconStore()
    await store.delete(id)
  }

  // ── 壁纸操作（IDB wallpapers 表）──────────────────────
  /** 保存壁纸图片到 IDB，返回 idb:wp_ 引用键 */
  async function saveWallpaper(key: string, dataUrl: string): Promise<string> {
    const store = await getWallpaperStore()
    await store.put(key, { data: dataUrl, createdAt: Date.now() })
    return `idb:wp_${key}`
  }

  /** 根据 idb:wp_ 键读取壁纸图片数据 */
  async function getWallpaper(idbKey: string): Promise<string | null> {
    if (!idbKey || !idbKey.startsWith('idb:wp_')) return null
    const key = idbKey.slice(7)
    const store = await getWallpaperStore()
    const record = await store.get(key)
    return record ? record.data : null
  }

  // ── 视频操作（IDB videos 表）──────────────────────────
  /** 校验视频文件大小是否在允许范围内 */
  function checkVideoSize(file: File | null): { valid: boolean; error?: string } {
    if (!file) return { valid: false, error: '未选择文件' }
    if (!file.type.startsWith('video/')) return { valid: false, error: '请选择视频文件' }
    if (file.size > MAX_VIDEO_SIZE) {
      return { valid: false, error: `视频文件过大（${(file.size / 1024 / 1024).toFixed(1)}MB），最大支持 ${MAX_VIDEO_SIZE_MB}MB` }
    }
    return { valid: true }
  }

  /** 保存视频文件到 IDB，返回 idb:vid_ 引用键 */
  async function saveVideo(file: File): Promise<string> {
    const check = checkVideoSize(file)
    if (!check.valid) throw new Error(check.error!)
    const base64 = await fileToBase64(file)
    const id = `video_${generateId()}`
    const store = await getVideoStore()
    await store.put(id, { data: base64, fileName: file.name, fileType: file.type, fileSize: file.size, createdAt: Date.now() })
    return `idb:vid_${id}`
  }

  /** 根据 idb:vid_ 键读取视频数据 */
  async function getVideo(idbKey: string): Promise<string | null> {
    if (!idbKey || !idbKey.startsWith('idb:vid_')) return null
    const id = idbKey.slice(8)
    const store = await getVideoStore()
    const record = await store.get(id)
    return record ? record.data : null
  }

  /** 根据 idb:vid_ 键删除视频 */
  async function deleteVideo(idbKey: string): Promise<void> {
    if (!idbKey || !idbKey.startsWith('idb:vid_')) return
    const id = idbKey.slice(8)
    const store = await getVideoStore()
    await store.delete(id)
  }

  // ── 批量操作（导出/导入/清空）────────────────────────
  /** 导出所有媒体资源（图标+壁纸+视频）用于备份 */
  async function exportAllImages(): Promise<Record<string, unknown>> {
    const [iconEntries, wpEntries, vidEntries] = await Promise.all([
      (await getIconStore()).getAllEntries(),
      (await getWallpaperStore()).getAllEntries(),
      (await getVideoStore()).getAllEntries(),
    ])
    const result: Record<string, unknown> = {}
    iconEntries.forEach(([key, val]) => { result[key] = val })
    wpEntries.forEach(([key, val]) => { result[key] = val })
    vidEntries.forEach(([key, val]) => { result[key] = val })
    return result
  }

  /** 从备份数据导入媒体资源到对应 IDB 表 */
  async function importAllImages(imagesData: Record<string, unknown>): Promise<void> {
    const [iconS, wpS, vidS] = await Promise.all([getIconStore(), getWallpaperStore(), getVideoStore()])
    for (const [key, val] of Object.entries(imagesData)) {
      try {
        if (key.startsWith('icon_')) await iconS.put(key, val as never)
        else if (key.startsWith('wp_')) await wpS.put(key, val as never)
        else if (key.startsWith('video_')) await vidS.put(key, val as never)
      } catch { /* 跳过无法导入的条目 */ }
    }
  }

  /** 清空所有媒体资源的 IDB 存储 */
  async function clearAllImages(): Promise<void> {
    const [iconS, wpS, vidS] = await Promise.all([getIconStore(), getWallpaperStore(), getVideoStore()])
    await iconS.clear()
    await wpS.clear()
    await vidS.clear()
  }

  // ── 主题数据操作（IDB theme 表）───────────────────────
  /** 从 IDB 读取自定义主题颜色配置 */
  async function loadThemeFromDB(): Promise<Record<string, string> | null> {
    const store = await getThemeStore()
    return await store.get('custom')
  }

  /** 保存自定义主题颜色配置到 IDB */
  async function saveThemeToDB(colors: Record<string, string>): Promise<void> {
    const store = await getThemeStore()
    await store.put('custom', colors)
  }

  /** 重置自定义主题（从 IDB 中删除） */
  async function removeThemeFromDB(): Promise<void> {
    const store = await getThemeStore()
    await store.delete('custom')
  }

  return {
    data,
    saveData,
    loadData,
    generateId,
    compressImage,
    fileToBase64,
    saveCompressedIcon,
    getCompressedIcon,
    deleteCompressedIcon,
    saveWallpaper,
    getWallpaper,
    checkVideoSize,
    saveVideo,
    getVideo,
    deleteVideo,
    exportAllImages,
    importAllImages,
    clearAllImages,
    resolveImageUrl,
    initDefaultData,
    migrateData,
    // 主题相关（供 useTheme 调用）
    loadThemeFromDB,
    saveThemeToDB,
    removeThemeFromDB,
  }
}
