import { reactive } from 'vue'
import type { AppData, IconData } from '@/types'

const DEFAULT_ICON_SVG = 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="gray"><rect width="20" height="20" x="2" y="2" rx="4"/><text x="12" y="16" text-anchor="middle" fill="white" font-size="10">?</text></svg>' // 默认图标 SVG（灰色问号占位图）

const ENGINE_ICONS: Record<string, string> = { // 搜索引擎内置图标映射表
  google: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzQyODVGNCIgZD0iTTIyLjU2IDEyLjI1YzAtLjc4LS4wNy0xLjUzLS4yLTIuMjVIMTJ2NGg1LjkyYTIuMDYgMi4wNiAwIDAgMS0yLjIgMy4zMnYyaC4yN2MzLjU3LTIuOTIgMy4yOC00Ljc0IDMuMjgtOC44eiIvPjxwYXRoIGZpbGw9IiMzNEE4NTMiIGQ9Ik0xMiAyM2MyLjk3IDAgNS40Ni0uOTggNy4yOC0yLjY2bC0zLjU3LTIuNzdjLS45OC42Ni0yLjIzIDEuMDYtMy43MSAxLjA2LTIuODYgMC01LjI5LTEuOTMtNi4xNi00LjUzSDIuMTh2Mi44QzMuOTkgMjAuNTMgNy43IDIzIDEyIDIzeiIvPjxwYXRoIGZpbGw9IiNGQkJDMDUiIGQ9Ik01Ljg0IDE0LjA5Yy0uMjItLjY2LS4zNS0xLjM2LS4zNS0yLjA5cy4xMy0xLjQzLjM1LTIuMDlWNy4wN0gyLjE4QzEuNDMgOC41NSAxIDEwLjIyIDEgMTJzLjQzIDMuNDUgMS4xOCA0LjkzbDIuODUtMi4yMi44MS0uNjJ6Ii8+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTEyIDUuMzhjMS42MiAzLjA2LjU2IDQuMjEgMS42NGwzLjE1LTMuMVYxNy41NSAyLjA5IDE0Ljk3IDEgMTIgMSA3LjcgMSAzLjk5IDMuNDcgMi4xOCA3LjA3bDMuNjYgMi44Yy44Ny0yLjYgMy4zLTQuNTMgNi4xNi00LjUzeiIvPjwvc3ZnPg==',
  bing: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzAwODA4MCIgZD0iTTUgM3YxNi41bDQuNjcgMi41IDcuMzMtNC4xN1YxMy41bC01LjMtMS44M0w1IDN6bTQuNjcgNS4xN2wzLjMgMS4xNnYzLjM0bC0zLjMgMS44M1Y4LjE3eiIvPjwvc3ZnPg==',
  baidu: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iIzIzMTlEQyIgZD0iTTUuOSAxMS40YzEuNi0uNCAyLjMtMi4yIDEuNy0zLjktLjYtMS43LTIuMy0yLjgtMy45LTIuNC0xLjYuNC0yLjMgMi4yLTEuNyAzLjkuNiAxLjcgMi4zIDIuOCAzLjkgMi40em0yLjMgNC4zYy0uMS0xLjctMS40LTMtMi45LTIuOS0xLjUuMS0yLjcgMS41LTIuNiAzLjIuMSAxLjcgMS40IDMgMi45IDIuOSAxLjUtLjEgMi43LTEuNiAyLjYtMy4yem0zLjgtOS44YzEuNiAwIDIuOS0xLjYgMi45LTMuNVMxMy42LTEgMTItMSA5LjEuNiA5LjEgMi41czEuMyAzLjQgMi45IDMuNHptNi4yIDEuNWMtMS41LS4zLTMuMS44LTMuNiAyLjUtLjUgMS43LjMgMy4zIDEuOCAzLjdjMS41LjMgMy4xLS44IDMuNi0yLjUuNS0xLjctLjMtMy40LTEuOC0zLjd6bS0zLjIgMTAuNmMtLjgtMS4zLTIuMy0yLTMuNC0xLjUtMS4xLjUtMS4zIDItLjUgMy4zLjggMS4zIDIuMyAyIDMuNCAxLjUgMS4xLS41IDEuMy0yIC41LTMuM3oiLz48L3N2Zz4=',
  duckduckgo: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCAyNCAyNCI+PHBhdGggZmlsbD0iI0RFNTgzMyIgZD0iTTEyIDJDNi40OCAyIDIgNi40OCAyIDEyczQuNDggMTAgMTAgMTAgMTAtNC40OCAxMC0xMFMxNy41MiAyIDEyIDJ6bS0xIDE0LjVjLS41NSAwLTEtLjQ1LTEtMXMuNDUtMSAxLTEgMSAuNDUgMSAxLS40NSAxem0yLTRjLS41NSAwLTEtLjQ1LTEtMVY4YzAtLjU1LjQ1LTEgMS0xczEgLjQ1IDEgMXYzLjVjMCAuNTUtLjQ1IDEtMSAxeiIvPjwvc3ZnPg==',
}

const resolvedUrls = reactive<Record<string, string>>({}) // 图标 URL 解析缓存（源地址 → 实际 URL）

/**
 * @description 图标解析与缓存 composable，负责将 idb: 前缀的存储引用解析为实际可访问的 URL
 * @param storage - 存储访问接口，提供从 IndexedDB 获取各类资源的能力
 * @returns 包含图标解析、默认图标获取及批量预加载等工具方法的对象
 */
export function useIconResolver(storage: {
  getCompressedIcon: (key: string) => Promise<string | null>
  getWallpaper: (key: string) => Promise<string | null>
  getVideo: (key: string) => Promise<string | null>
}) {

  /**
   * @description 将图片源地址解析为实际可访问的 URL，支持 idb: 前缀的存储引用和普通 URL
   * @param src - 图片源地址，可为 idb:vid_、idb:wp_、idb: 前缀或普通 URL
   * @returns 解析后的实际 URL 字符串，空字符串表示无效输入
   */
  async function resolveImageUrl(src: string): Promise<string> {
    if (!src) return ''
    if (resolvedUrls[src]) return resolvedUrls[src]
    let url = ''
    if (src.startsWith('idb:vid_')) {
      url = (await storage.getVideo(src)) || ''
    } else if (src.startsWith('idb:wp_')) {
      url = (await storage.getWallpaper(src)) || ''
    } else if (src.startsWith('idb:')) {
      url = (await storage.getCompressedIcon(src)) || ''
    } else {
      url = src
    }
    if (url) resolvedUrls[src] = url
    return url
  }

  /**
   * @description 根据给定 URL 推断站点的 favicon.ico 地址，用于获取网站默认图标
   * @param url - 网站完整 URL 地址
   * @returns 站点的 favicon.ico URL，无法解析时返回默认占位图标
   */
  function getDefaultIcon(url?: string): string {
    if (!url) return DEFAULT_ICON_SVG
    try {
      const u = new URL(url)
      return `${u.origin}/favicon.ico`
    } catch {
      return DEFAULT_ICON_SVG
    }
  }

  /**
   * @description 根据搜索引擎 ID 获取其内置的默认图标
   * @param id - 搜索引擎标识符（如 google、bing 等）
   * @returns 对应搜索引擎的 base64 SVG 数据，未匹配时返回空字符串
   */
  function getEngineDefaultIcon(id: string): string {
    return ENGINE_ICONS[id] || ''
  }

  /**
   * @description 批量预加载 AppData 中所有引用的图标/背景资源 URL 到缓存
   * @param data - 应用配置数据对象，包含页面图标、Dock 项、搜索引擎图标及背景资源等
   */
  async function resolveAllIconUrls(data: AppData): Promise<void> {
    const keys = new Set<string>()
    for (const page of data.pages) {
      for (const icon of page.icons) {
        if (icon?.icon) keys.add(icon.icon)
      }
    }
    for (const item of data.dock) {
      if (item?.icon) keys.add(item.icon)
    }
    for (const engine of data.search.engines) {
      if (engine?.icon) keys.add(engine.icon)
    }
    if (data.background.singleImage) keys.add(data.background.singleImage)
    if (data.background.topLayer) keys.add(data.background.topLayer)
    if (data.background.bottomLayer) keys.add(data.background.bottomLayer)
    if (data.background.videoSrc) keys.add(data.background.videoSrc)
    for (const img of (data.background.randomImages || [])) {
      keys.add(img)
    }
    await Promise.all(Array.from(keys).map(async (key) => {
      try { await resolveImageUrl(key) } catch { /* ignore */ }
    }))
  }

  return { resolvedUrls, resolveImageUrl, getDefaultIcon, getEngineDefaultIcon, resolveAllIconUrls }
}
