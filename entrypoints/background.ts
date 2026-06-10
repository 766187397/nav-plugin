import { IconFetcher } from '@/utils/iconFetcher'

export default defineBackground(() => {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message.type === 'ADD_ICON') {
      chrome.tabs.query({ url: chrome.runtime.getURL('newtab/index.html*') }, (tabs) => {
        for (const tab of tabs) {
          if (tab.id) {
            chrome.tabs.sendMessage(tab.id, message).catch(() => { /* ignore */ })
          }
        }
      })
      sendResponse({ ok: true })
      return true
    }

    if (message.type === 'FETCH_FAVICON') {
      const url = message.url as string
      IconFetcher.fetchFaviconInBg(url)
        .then((base64) => sendResponse({ base64: base64 || null }))
        .catch(() => sendResponse({ base64: null }))
      return true
    }

    if (message.type === 'FETCH_TITLE') {
      const url = message.url as string
      IconFetcher.fetchTitle(url)
        .then((title) => sendResponse({ title: title || null }))
        .catch(() => sendResponse({ title: null }))
      return true
    }
  })
});
