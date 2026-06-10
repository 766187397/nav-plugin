import { ref } from 'vue'
import type { AppData } from '@/types'

const DEFAULT_BG = '/bg.jpeg' // 默认背景图路径

/**
 * @description 背景管理 composable，负责背景图的显示/切换、双图层擦除效果、视频播放及壁纸随机切换
 * @param data - 响应式应用配置数据（ref 包裹的 AppData）
 * @param storage - 存储访问接口，提供数据持久化和媒体资源读写能力
 * @param resolveImageUrl - 图标 URL 解析函数，用于将存储引用转为实际 URL
 * @returns 背景状态 ref、初始化方法及各类背景设置方法
 */
export function useBackground(data: { value: AppData }, storage: {
  saveData: () => void
  getVideo: (key: string) => Promise<string | null>
  getWallpaper: (key: string) => Promise<string | null>
  saveWallpaper: (key: string, dataUrl: string) => Promise<string>
  saveVideo: (file: File) => Promise<string>
}, resolveImageUrl: (src: string) => Promise<string>) {
  const isRevealing = ref(false) // 双图层模式下是否正在显示擦除揭示效果
  const revealRadius = ref(200) // 擦除揭示区域的半径（像素）
  const revealFeather = ref(60) // 擦除揭示边缘羽化程度（像素）
  let bgRafId: number | null = null // 鼠标移动时 mask 更新的 requestAnimationFrame ID，用于节流
  const currentRandomIndex = ref(-1) // 当前随机壁纸索引，用于避免连续重复

  /**
   * @description 初始化背景：从配置恢复参数、渲染初始背景、绑定鼠标事件
   * @param bgTop - 上层背景 DOM 元素（双图层模式使用）
   * @param bgBottom - 下层背景 DOM 元素
   * @param bgSingle - 单层背景 DOM 元素
   * @param bgVideo - 视频背景 DOM 元素
   * @param cursorRing - 光标环指示器 DOM 元素
   */
  function initBackground(bgTop: HTMLElement | undefined, bgBottom: HTMLElement | undefined, bgSingle: HTMLElement | undefined, bgVideo: HTMLVideoElement | undefined, cursorRing: HTMLElement | undefined) {
    const bgData = data.value.background
    if (bgData.revealRadius != null) revealRadius.value = bgData.revealRadius
    if (bgData.revealFeather != null) revealFeather.value = bgData.revealFeather
    updateBackgroundFromData(bgTop, bgBottom, bgSingle, bgVideo)
    if (bgData.mode === 'double') {
      isRevealing.value = false
      bgTop?.classList.add('mask-hidden')
      cursorRing?.classList.remove('visible')
    }
    document.addEventListener('mousemove', (e) => onMouseMove(e, bgTop, cursorRing))
    document.addEventListener('mouseleave', () => onMouseLeave(bgTop, cursorRing))
  }

  /**
   * @description 鼠标移动事件处理，通过 rAF 节流更新擦除遮罩位置
   * @param e - 鼠标事件对象
   * @param bgTop - 上层背景元素
   * @param cursorRing - 光标环元素
   */
  function onMouseMove(e: MouseEvent, bgTop: HTMLElement | undefined, cursorRing: HTMLElement | undefined) {
    if (data.value.background.mode !== 'double') return
    if (bgRafId) return
    bgRafId = requestAnimationFrame(() => {
      updateMask(e.clientX, e.clientY, bgTop, cursorRing)
      bgRafId = null
    })
  }

  /**
   * @description 鼠标离开窗口时隐藏擦除效果和光标环
   * @param bgTop - 上层背景元素
   * @param cursorRing - 光标环元素
   */
  function onMouseLeave(bgTop: HTMLElement | undefined, cursorRing: HTMLElement | undefined) {
    isRevealing.value = false
    bgTop?.classList.add('mask-hidden')
    cursorRing?.classList.remove('visible')
  }

  /**
   * @description 根据鼠标坐标更新 CSS 变量以驱动遮罩动画和光标环位置
   * @param x - 鼠标水平坐标
   * @param y - 鼠标垂直坐标
   * @param bgTop - 上层背景元素
   * @param cursorRing - 光标环元素
   */
  function updateMask(x: number, y: number, bgTop: HTMLElement | undefined, cursorRing: HTMLElement | undefined) {
    if (!isRevealing.value) {
      isRevealing.value = true
      bgTop?.classList.remove('mask-hidden')
      cursorRing?.classList.add('visible')
    }
    const vw = window.innerWidth
    const vh = window.innerHeight
    const xPercent = ((x / vw) * 100) + '%'
    const yPercent = ((y / vh) * 100) + '%'
    if (bgTop) {
      bgTop.style.setProperty('--reveal-x', xPercent)
      bgTop.style.setProperty('--reveal-y', yPercent)
      bgTop.style.setProperty('--reveal-radius', revealRadius.value + 'px')
      bgTop.style.setProperty('--reveal-feather', revealFeather.value + 'px')
    }
    if (cursorRing) {
      const ringSize = Math.max(12, revealRadius.value / 6)
      cursorRing.style.width = ringSize + 'px'
      cursorRing.style.height = ringSize + 'px'
    }
  }

  /**
   * @description 根据当前配置数据的模式（single/double/video）更新各背景层的显示状态与内容
   * @param bgTop - 上层背景元素
   * @param bgBottom - 下层背景元素
   * @param bgSingle - 单层背景元素
   * @param bgVideo - 视频背景元素
   */
  async function updateBackgroundFromData(bgTop?: HTMLElement, bgBottom?: HTMLElement, bgSingle?: HTMLElement, bgVideo?: HTMLVideoElement | undefined) {
    const bg = data.value.background
    const mode = bg.mode || 'single'

    if (mode === 'video') {
      if (bgVideo) bgVideo.style.display = 'block'
      if (bgSingle) bgSingle.style.display = 'none'
      if (bgBottom) bgBottom.style.display = 'none'
      if (bgTop) bgTop.style.display = 'none'
      if (bgVideo && bg.videoSrc && !bgVideo.src) {
        playVideo(bg.videoSrc, bgVideo)
      } else if (bgVideo && !bg.videoSrc) {
        bgVideo.style.background = 'linear-gradient(135deg, #0f0c29, #302b63, #24243e)'
        bgVideo.style.objectFit = 'cover'
      }
      return
    }

    if (bgVideo) {
      bgVideo.style.display = 'none'
      bgVideo.pause()
    }
    if (bgSingle) bgSingle.style.display = mode === 'single' ? 'block' : 'none'
    if (bgBottom) bgBottom.style.display = mode === 'double' ? 'block' : 'none'
    if (bgTop) bgTop.style.display = mode === 'double' ? 'block' : 'none'

    if (mode === 'single') {
      const subMode = bg.singleMode || 'fixed'
      if (subMode === 'random' && bg.randomImages && bg.randomImages.length > 0) {
        await randomizeWallpaper(bg.randomImages, bgSingle)
      } else if (bg.singleImage) {
        const url = await resolveImageUrl(bg.singleImage)
        setBackground(bgSingle!, url || bg.singleImage)
      } else {
        setBackground(bgSingle!, DEFAULT_BG)
      }
      return
    }

    if (mode === 'double') {
      if (bg.bottomLayer) {
        const url = await resolveImageUrl(bg.bottomLayer)
        setBackground(bgBottom!, url || bg.bottomLayer)
      } else {
        setBackground(bgBottom!, DEFAULT_BG)
      }
      if (bg.topLayer) {
        const url = await resolveImageUrl(bg.topLayer)
        setBackground(bgTop!, url || bg.topLayer)
      } else {
        setBackground(bgTop!, DEFAULT_BG)
      }
      bgTop?.classList.add('mask-hidden')
    }
  }

  /**
   * @description 设置指定 DOM 元素的 backgroundImage 样式
   * @param layer - 目标背景容器元素
   * @param src - 图片 URL 地址，为空时清除背景图
   */
  function setBackground(layer: HTMLElement, src: string) {
    if (!layer) return
    if (!src) { layer.style.backgroundImage = ''; return }
    layer.style.backgroundImage = `url(${src})`
  }

  /**
   * @description 加载并播放视频背景，支持 idb 存储引用和普通 URL
   * @param src - 视频源地址或 idb 键名
   * @param bgVideo - 视频 HTML 元素
   * @returns Promise：resolve 表示视频 loadeddata 触发，reject 表示加载失败/超时
   */
  function playVideo(src: string, bgVideo: HTMLVideoElement): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!src || !bgVideo) { reject(new Error('视频源或播放器为空')); return }
      const VIDEO_LOAD_TIMEOUT_MS = 15000 // 视频加载超时时间（15 秒）

      let settled = false
      const cleanup = () => {
        bgVideo.removeEventListener('loadeddata', onLoaded)
        bgVideo.removeEventListener('error', onErr)
        clearTimeout(timeoutId)
      }
      const onLoaded = () => {
        if (settled) return
        settled = true
        cleanup()
        // 显式调用 play()，浏览器在 autoplay 策略下可能不会自动开始播放
        bgVideo.play().catch(() => { /* autoplay 被策略阻止时静默忽略 */ })
        resolve()
      }
      const onErr = () => {
        if (settled) return
        settled = true
        cleanup()
        const err = bgVideo.error
        let msg = '视频加载失败'
        if (err) {
          switch (err.code) {
            case 1: msg = '视频加载被中止'; break
            case 2: msg = '网络错误，无法加载视频（可能 CORS 限制）'; break
            case 3: msg = '视频解码失败，格式可能不受支持'; break
            case 4: msg = '视频源不可用（404/403 或服务器拒绝）'; break
            default: msg = '视频加载失败：未知错误'
          }
        }
        reject(new Error(msg))
      }
      bgVideo.addEventListener('loadeddata', onLoaded, { once: true })
      bgVideo.addEventListener('error', onErr, { once: true })
      const timeoutId = setTimeout(() => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error(`视频加载超时（${VIDEO_LOAD_TIMEOUT_MS / 1000}秒），URL 可能无法访问或网络较慢`))
      }, VIDEO_LOAD_TIMEOUT_MS)

      // 解析视频源（idb 引用或直链），并设置 src 触发加载
      ;(async () => {
        try {
          let finalSrc = src
          if (src.startsWith('idb:vid_')) {
            const resolved = await storage.getVideo(src)
            if (!resolved) { settled = true; cleanup(); reject(new Error('视频源在本地存储中已失效')); return }
            finalSrc = resolved
          } else if (src.startsWith('idb:wp_')) {
            const resolved = await storage.getWallpaper(src)
            if (!resolved) { settled = true; cleanup(); reject(new Error('视频源在本地存储中已失效')); return }
            finalSrc = resolved
          } else {
            // 远程 URL：用 fetch Range 探测 Content-Type（避免 video 元素静默卡死）
            try {
              const probeResp = await fetch(finalSrc, {
                method: 'GET',
                mode: 'cors',
                headers: { Range: 'bytes=0-1' },
              })
              const ct = probeResp.headers.get('content-type') || ''
              // 已知非视频类型直接报错，省得 video 元素什么都不触发
              if (ct && !ct.startsWith('video/') && !ct.startsWith('application/octet-stream') && !ct.startsWith('binary/')) {
                settled = true
                cleanup()
                reject(new Error(`资源不是视频文件（Content-Type: ${ct}），请检查 URL`))
                return
              }
            } catch {
              // fetch 探测失败（CORS 拒绝、404、网络错误等）不影响后续，让 video 元素继续尝试
            }
          }
          bgVideo.src = finalSrc
          // 主动调用 load() 显式触发加载（部分浏览器在 src 变化时不会自动重置）
          bgVideo.load()
        } catch (e) {
          if (settled) return
          settled = true
          cleanup()
          reject(new Error('视频源解析失败：' + (e instanceof Error ? e.message : '未知错误')))
        }
      })()
    })
  }

  /**
   * @description 设置单层模式的背景图片，自动处理本地文件入库并持久化配置
   * @param src - 图片源地址、本地路径或 File 对象的数据引用
   * @param bgSingle - 单层背景容器元素
   */
  async function setSingleImage(src: string, bgSingle?: HTMLElement) {
    let idbKey = src
    if (src && !src.startsWith('idb:') && !src.startsWith('http') && !src.startsWith('/')) {
      idbKey = await storage.saveWallpaper('singleImage', src)
    }
    data.value.background.singleImage = idbKey
    storage.saveData()
    const resolved = await resolveImageUrl(idbKey)
    setBackground(bgSingle!, resolved || src)
  }

  /**
   * @description 设置双图层模式的上层背景图片，自动处理本地文件入库并持久化配置
   * @param src - 图片源地址或本地路径
   * @param bgTop - 上层背景容器元素
   */
  async function setTopLayer(src: string, bgTop?: HTMLElement) {
    let idbKey = src
    if (src && !src.startsWith('idb:') && !src.startsWith('http') && !src.startsWith('/')) {
      idbKey = await storage.saveWallpaper('topLayer', src)
    }
    data.value.background.topLayer = idbKey
    storage.saveData()
    const resolved = await resolveImageUrl(idbKey)
    setBackground(bgTop!, resolved || src)
  }

  /**
   * @description 设置双图层模式的下层背景图片，自动处理本地文件入库并持久化配置
   * @param src - 图片源地址或本地路径
   * @param bgBottom - 下层背景容器元素
   */
  async function setBottomLayer(src: string, bgBottom?: HTMLElement) {
    let idbKey = src
    if (src && !src.startsWith('idb:') && !src.startsWith('http') && !src.startsWith('/')) {
      idbKey = await storage.saveWallpaper('bottomLayer', src)
    }
    data.value.background.bottomLayer = idbKey
    storage.saveData()
    const resolved = await resolveImageUrl(idbKey)
    setBackground(bgBottom!, resolved || src)
  }

  /**
   * @description 设置视频背景，支持 File 对象直接上传或 URL/路径字符串，自动持久化配置
   * @param fileOrUrl - 视频文件对象或来源地址字符串
   * @param bgVideo - 视频播放器 HTML 元素
   * @returns 视频加载完成的 Promise，加载失败/超时时 reject
   */
  async function setVideo(fileOrUrl: string | File, bgVideo?: HTMLVideoElement): Promise<void> {
    let idbKey: string = typeof fileOrUrl === 'string' ? fileOrUrl : ''
    if (fileOrUrl instanceof File) {
      idbKey = await storage.saveVideo(fileOrUrl)
    } else if (fileOrUrl && !fileOrUrl.startsWith('idb:') && !fileOrUrl.startsWith('http') && !fileOrUrl.startsWith('/')) {
      idbKey = await storage.saveWallpaper('video', fileOrUrl)
    }
    data.value.background.videoSrc = idbKey
    storage.saveData()
    if (bgVideo) {
      await playVideo(idbKey, bgVideo)
    }
  }

  /**
   * @description 从候选列表中随机选取一张壁纸（避免与上次重复）并应用到单层背景
   * @param images - 候选壁纸 URL/键名数组
   * @param bgSingle - 单层背景容器元素
   */
  async function randomizeWallpaper(images: string[], bgSingle?: HTMLElement) {
    if (!images || images.length === 0) return
    let newIndex: number
    if (images.length === 1) {
      newIndex = 0
    } else {
      do { newIndex = Math.floor(Math.random() * images.length) } while (newIndex === currentRandomIndex.value)
    }
    currentRandomIndex.value = newIndex
    const pick = images[newIndex]
    const url = await resolveImageUrl(pick)
    setBackground(bgSingle!, url || pick)
  }

  /**
   * @description 切换背景显示模式（single/double/video），同步更新配置数据和 DOM 状态
   * 与 HTML 版本 applyMode 保持一致：处理 video 显隐/播放/重置，然后立即刷新背景
   * @param mode - 目标模式标识符
   * @param bgTop - 上层背景元素
   * @param bgBottom - 下层背景元素
   * @param bgSingle - 单层背景元素
   * @param bgVideo - 视频播放器元素
   * @param cursorRing - 光标环元素
   */
  async function applyBackgroundMode(mode: string, bgTop?: HTMLElement, bgBottom?: HTMLElement, bgSingle?: HTMLElement, bgVideo?: HTMLVideoElement | undefined, cursorRing?: HTMLElement) {
    data.value.background.mode = mode as AppData['background']['mode']
    storage.saveData()

    // 处理视频元素的显示/隐藏（与 HTML 版本 background.js:94-120 一致）
    if (mode === 'video') {
      if (bgVideo) bgVideo.style.display = 'block'
      await playVideo(data.value.background.videoSrc || '', bgVideo!)
    } else {
      if (bgVideo) {
        bgVideo.style.display = 'none'
        bgVideo.pause()
        bgVideo.removeAttribute('src')
        bgVideo.load()
      }
    }

    // 立即根据新模式刷新所有背景层（HTML 版本在 applyMode 末尾调用了 updateFromData）
    await updateBackgroundFromData(bgTop, bgBottom, bgSingle, bgVideo)

    // 双图层模式初始化遮罩状态
    if (mode === 'double') {
      isRevealing.value = false
      bgTop?.classList.add('mask-hidden')
      cursorRing?.classList.remove('visible')
    }
  }

  return {
    isRevealing, revealRadius, revealFeather,
    initBackground, updateBackgroundFromData, setBackground,
    setSingleImage, setTopLayer, setBottomLayer, setVideo,
    randomizeWallpaper, applyBackgroundMode,
    onRevealRadiusChange(e: Event) { // 擦除半径滑块 change 事件处理器
      const val = parseInt((e.target as HTMLInputElement).value)
      revealRadius.value = val
      data.value.background.revealRadius = val
      storage.saveData()
    },
    onRevealFeatherChange(e: Event) { // 羽化程度滑块 change 事件处理器
      const val = parseInt((e.target as HTMLInputElement).value)
      revealFeather.value = val
      data.value.background.revealFeather = val
      storage.saveData()
    },
  }
}
