/** 图标抓取工具 - 多策略竞速获取网站标题与 favicon */
/** 抓取顺序：直连(HTML+图片) → 第三方图标服务 → 域名兜底(仅标题) */

const FETCH_TIMEOUT = 10000;
const MAX_CONCURRENT_FAVICON = 3;

function parseUrl(url: string) {
  try {
    return new URL(url);
  } catch {
    return null;
  }
}

function normalizeUrl(url: string): string | null {
  if (!url) return null;
  url = url.trim();
  const match = url.match(/^(https?:\/\/[^\/]+)/i);
  if (match) return match[1];
  if (/^[\p{L}0-9]/u.test(url)) return `https://${url.replace(/[\/\?#.].*$/, "")}`;
  return null;
}

function guessNameFromUrl(url: string): string | null {
  try {
    const parts = new URL(url).hostname.split(".");
    if (parts.length >= 2) {
      return parts[parts.length - 2].charAt(0).toUpperCase() + parts[parts.length - 2].slice(1);
    }
  } catch {
    /* ignore */
  }
  return null;
}

/** 通过 jina.ai 第三方服务获取网页标题（CORS 友好） */
async function fetchTitleFromProxy(url: string): Promise<string | null> {
  return withTimeout(
    (async () => {
      try {
        const proxyUrl = `https://r.jina.ai/http://${url.replace(/^https?:\/\//, '')}`
        const r = await fetch(proxyUrl, { redirect: 'follow' })
        if (!r.ok) return null
        const text = await r.text()
        const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
        const firstLine = lines[0]
        if (firstLine && firstLine.length > 0 && firstLine.length < 200) return firstLine
        return null
      } catch {
        return null
      }
    })(),
    FETCH_TIMEOUT,
  )
}

function resolveIconUrl(iconUrl: string, baseUrl: string): string | null {
  if (!iconUrl || !baseUrl) return null;
  iconUrl = iconUrl.trim();
  if (/^https?:\/\//i.test(iconUrl)) return iconUrl;
  if (iconUrl.startsWith("//")) {
    const b = parseUrl(baseUrl);
    return b ? `${b.protocol}${iconUrl}` : null;
  }
  if (iconUrl.startsWith("/")) {
    const b = parseUrl(baseUrl);
    return b ? `${b.protocol}//${b.host}${iconUrl}` : null;
  }
  try {
    return new URL(iconUrl, baseUrl).href;
  } catch {
    return null;
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | null> {
  return Promise.race([p, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]);
}

async function race<T>(promises: Promise<T | null>[]): Promise<T | null> {
  if (promises.length === 0) return null;
  const ac = new AbortController();
  const { signal } = ac;
  const wrapped = promises.map((p) =>
    Promise.race([
      p.then((val) => {
        if (val == null) throw new Error("empty");
        return val;
      }),
      new Promise<never>((_, rej) =>
        signal.addEventListener("abort", () => rej(new Error("cancelled")), { once: true }),
      ),
    ]),
  );
  try {
    const result = await Promise.any(wrapped);
    ac.abort();
    return result;
  } catch {
    return null;
  }
}

/**
 * 获取任意 URL 的文本内容：cors 直连获取
 */
async function fetchText(url: string): Promise<string | null> {
  return withTimeout(
    (async () => {
      try {
        const r = await fetch(url, { mode: "cors", redirect: "follow" });
        return r.ok && r.type !== "opaque" ? r.text() : null;
      } catch { return null; }
    })(),
    FETCH_TIMEOUT,
  );
}

/**
 * 获取图片并转 base64：cors 直连获取
 * 用于 background Service Worker 环境
 */
async function fetchImageToBase64(imgUrl: string): Promise<string | null> {
  const doFetch = async (url: string): Promise<string | null> => {
    try {
      const r = await fetch(url, { mode: "cors", redirect: "follow" });
      if (!r.ok || r.type === "opaque") return null;
      const buf = await r.arrayBuffer();
      if (!buf || buf.byteLength < 100) return null;
      const bytes = new Uint8Array(buf);
      let binary = "";
      const chunk = 8192;
      for (let i = 0; i < bytes.length; i += chunk) {
        binary += String.fromCharCode.apply(null, Array.from(bytes.slice(i, i + chunk)));
      }
      const ct = r.headers.get("content-type") || "";
      let mime = "image/png";
      if (/x-icon/.test(ct)) mime = "image/x-icon";
      else if (/jpeg/.test(ct)) mime = "image/jpeg";
      else if (/gif/.test(ct)) mime = "image/gif";
      else if (/webp/.test(ct)) mime = "image/webp";
      else if (/svg/.test(ct)) mime = "image/svg+xml";
      return `data:${mime};base64,${btoa(binary)}`;
    } catch {
      return null;
    }
  };

  return withTimeout(doFetch(imgUrl), FETCH_TIMEOUT);
}

/** canvas 方式转 base64（newtab DOM 环境） */
function canvasImageToBase64(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const c = document.createElement("canvas");
        c.width = img.naturalWidth;
        c.height = img.naturalHeight;
        c.getContext("2d")!.drawImage(img, 0, 0);
        const d = c.toDataURL("image/png");
        resolve(d && d.length > 100 ? d : null);
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
    setTimeout(() => resolve(null), 5000);
  });
}

function extractTitle(html: string): string | null {
  const m = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (m?.[1]) return m[1].trim();
  const og = html.match(/<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i);
  if (og?.[1]) return og[1].trim();
  return null;
}

function extractIconHrefs(html: string): string[] {
  const results: string[] = [];
  const re = /<link[\s\S]*?>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const tag = m[0];
    const relM = tag.match(/\brel=["']?([\s\S]*?)["']?(?:\s|\/?>)/i);
    if (!relM) continue;
    const rel = relM[1].toLowerCase().trim();
    if (!/^(icon|shortcut\s*icon|shortcut-icon|apple-touch-icon(?:-precomposed)?)$/.test(rel)) continue;
    const hrefM = tag.match(/\bhref=["']([^"']+)["']/i);
    if (hrefM) results.push(hrefM[1]);
  }
  return results;
}

/** 第三方 favicon 源候选列表（按国内可用性优先排序，竞速时取前 N 个） */
function buildFaviconCandidates(hostname: string, protocol: string, host: string): string[] {
  return [
    `https://api.xinac.net/icon/?url=${hostname}`,
    `${protocol}//${host}/favicon.ico`,
    `https://favicon.im/${hostname}`,
    `https://icon.horse/icon/${hostname}`,
  ];
}

export const IconFetcher = {
  /**
   * 抓取标题：直连HTML → 第三方代理 → 域名猜测
   */
  async fetchTitle(url: string): Promise<string | null> {
    if (!url) return null;
    const baseUrl = normalizeUrl(url);
    if (!baseUrl) return null;
    // 阶段1: 直连 HTML
    const html = await fetchText(baseUrl);
    const title = extractTitle(html || "");
    if (title) return title;
    // 阶段2: 第三方代理服务
    const proxyTitle = await fetchTitleFromProxy(baseUrl);
    if (proxyTitle) return proxyTitle;
    // 兜底: 域名猜测
    return guessNameFromUrl(baseUrl);
  },

  /**
   * 抓取 favicon（newtab DOM 环境）
   * 1. 直连 HTML 解析 link → canvas 转图
   * 2. 第三方并行: xinac / favicon.ico / favicon.im（取前3个竞速）
   */
  async fetchFavicon(url: string): Promise<string | null> {
    if (!url) return null;
    const baseUrl = normalizeUrl(url);
    if (!baseUrl) return null;
    const parsed = parseUrl(baseUrl);
    if (!parsed) return null;

    const html = await withTimeout(
      (async () => {
        try {
          const r = await fetch(baseUrl, { mode: "cors", headers: { Accept: "text/html" }, redirect: "follow" });
          return r.ok && r.type !== "opaque" ? r.text() : null;
        } catch { return null; }
      })(),
      FETCH_TIMEOUT,
    );

    if (html) {
      const hrefs = extractIconHrefs(html);
      if (hrefs.length > 0) {
        const candidates = hrefs
          .map((h) => {
            const resolved = resolveIconUrl(h, baseUrl);
            return resolved ? canvasImageToBase64(resolved) : Promise.resolve<string | null>(null);
          })
          .filter(Boolean) as Promise<string | null>[];
        if (candidates.length > 0) {
          const r = await race(candidates);
          if (r) return r;
        }
      }
    }

    const candidates = buildFaviconCandidates(parsed.hostname, parsed.protocol, parsed.host)
      .slice(0, MAX_CONCURRENT_FAVICON)
      .map((u) => canvasImageToBase64(u));
    return race(candidates);
  },

  /**
   * 抓取 favicon（background Service Worker）
   * 1. 直连 HTML 解析 link → 直连图片转 base64
   * 2. 第三方并行: favicon.ico / favicon.im / icon.horse
   */
  async fetchFaviconInBg(url: string): Promise<string | null> {
    if (!url) return null;
    const baseUrl = normalizeUrl(url);
    if (!baseUrl) return null;
    const parsed = parseUrl(baseUrl);
    if (!parsed) return null;

    // 阶段1: 直连 HTML → 解析 link 标签 → 每个图标 URL 转 base64
    const html = await withTimeout(
      (async () => {
        try {
          const r = await fetch(baseUrl, {
            mode: "cors",
            headers: { Accept: "text/html" },
            redirect: "follow",
          });
          return r.ok && r.type !== "opaque" ? r.text() : null;
        } catch {
          return null;
        }
      })(),
      FETCH_TIMEOUT,
    );

    if (html) {
      const hrefs = extractIconHrefs(html);
      if (hrefs.length > 0) {
        const candidates = hrefs
          .map((h) => {
            const resolved = resolveIconUrl(h, baseUrl);
            return resolved ? fetchImageToBase64(resolved) : Promise.resolve<string | null>(null);
          })
          .filter(Boolean) as Promise<string | null>[];
        if (candidates.length > 0) {
          const r = await race(candidates);
          if (r) return r;
        }
      }
    }

    // 阶段2: 第三方并行（取前 N 个国内优先源竞速）
    const bgCandidates = buildFaviconCandidates(parsed.hostname, parsed.protocol, parsed.host)
      .slice(0, MAX_CONCURRENT_FAVICON)
      .map((u) => fetchImageToBase64(u));
    return race(bgCandidates);
  },
} as const;
