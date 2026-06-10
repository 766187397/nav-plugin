<script setup lang="ts">
import { ref, onMounted } from "vue";

const pageUrl = ref("");
const pageTitle = ref("获取中...");
const pageFavicon = ref("");
const saving = ref(false);
const saved = ref(false);
const saveTarget = ref<"desktop" | "dock">("desktop");

onMounted(async () => {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url || !tab.title) {
      pageTitle.value = "无法获取页面信息";
      return;
    }
    const url = tab.url;
    if (
      url.startsWith("chrome://") ||
      url.startsWith("edge://") ||
      url.startsWith("about:") ||
      url.startsWith("chrome-extension://")
    ) {
      pageTitle.value = "[系统页面]";
      pageUrl.value = url;
      return;
    }
    pageUrl.value = url;
    pageTitle.value = tab.title;
    if (tab.favIconUrl) pageFavicon.value = tab.favIconUrl;
  } catch (e) {
    console.error("Failed to get tab info:", e);
    pageTitle.value = "获取失败";
  }
});

async function handleSave() {
  if (
    !pageUrl.value ||
    !pageTitle.value ||
    pageTitle.value === "获取中..." ||
    pageTitle.value === "无法获取页面信息"
  )
    return;

  saving.value = true;
  try {
    // 只传基本信息给 newtab，由 newtab 用 IconFetcher 抓取图标并写入 IDB
    chrome.runtime
      .sendMessage({
        type: "ADD_ICON",
        payload: {
          name: pageTitle.value,
          url: pageUrl.value,
          target: saveTarget.value,
        },
      })
      .catch(() => {
        /* newtab 未打开时忽略 */
      });

    saved.value = true;
    setTimeout(() => window.close(), 1000);
  } catch (e) {
    console.error("Send failed:", e);
    alert("请先打开新标签页后再使用此功能");
  } finally {
    saving.value = false;
  }
}
</script>

<template>
  <div class="popup-container">
    <div class="page-info-card">
      <img v-if="pageFavicon" :src="pageFavicon" class="page-favicon" alt="" />
      <div v-else class="page-favicon placeholder">📄</div>
      <div class="page-info-text">
        <div class="page-title">{{ pageTitle }}</div>
        <div class="page-url">{{ pageUrl }}</div>
      </div>
    </div>

    <div v-if="saved" class="saved-state">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <path d="M20 6L9 17l-5-5" />
      </svg>
      <span>{{ saveTarget === "desktop" ? "已添加到桌面" : "已添加到 Dock" }}</span>
    </div>

    <div v-else class="action-buttons">
      <div class="target-selector">
        <button
          class="save-btn"
          :class="{ active: saveTarget === 'desktop' }"
          @click="saveTarget = 'desktop'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          桌面图标
        </button>
        <button class="save-btn" :class="{ active: saveTarget === 'dock' }" @click="saveTarget = 'dock'">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            <path d="M9 12h6" />
          </svg>
          Dock 栏
        </button>
      </div>
      <button
        class="confirm-btn"
        :disabled="saving || !pageTitle || pageTitle === '获取中...'"
        @click="handleSave">
        {{ saving ? "保存中..." : "添加" }}
      </button>
    </div>

    <div class="popup-footer">打开新标签页可管理所有图标</div>
  </div>
</template>
