import { defineConfig } from 'wxt';

export default defineConfig({
  modules: ['@wxt-dev/module-vue'],
  manifest: {
    name: 'Nav Plugin - 新标签页',
    description: 'macOS 风格浏览器新标签页，双层动态壁纸、智能搜索栏、桌面图标管理',
    version: '1.0.0',
    permissions: ['storage', 'activeTab'],
    host_permissions: ['<all_urls>'],
    chrome_url_overrides: {
      newtab: 'newtab/index.html',
    },
    icons: {
      '16': 'icon/16.png',
      '32': 'icon/32.png',
      '48': 'icon/48.png',
      '96': 'icon/96.png',
      '128': 'icon/128.png',
    },
    action: {
      default_popup: 'popup/index.html',
      default_title: '添加当前页面到导航',
    },
  },
});
