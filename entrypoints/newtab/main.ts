import { createApp } from 'vue'
import App from './App.vue'
import './style.css'

// 在挂载前注入自定义主题 CSS 变量（避免闪烁）
try {
  const raw = localStorage.getItem('newtab_custom_theme')
  if (raw) {
    const colors = JSON.parse(raw)
    let css = ''
    for (const k in colors) {
      if (Object.prototype.hasOwnProperty.call(colors, k)) {
        css += `${k}:${colors[k]};`
      }
    }
    if (css) {
      const styleEl = document.createElement('style')
      styleEl.textContent = `:root{${css}}`
      document.head.insertBefore(styleEl, document.firstChild)
    }
  }
} catch {
  // 忽略解析错误
}

createApp(App).mount('#app')
