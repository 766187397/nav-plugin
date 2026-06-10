<script setup lang="ts">
import { ref, onMounted, onUnmounted } from "vue";
import { useStorage } from "@/composables/useStorage";
import { useToast } from "@/composables/useToast";
import { useLoading } from "@/composables/useLoading";
import { useConfirm } from "@/composables/useConfirm";
import { useVideoUrlDialog } from "@/composables/useVideoUrlDialog";
import { useIconResolver } from "@/composables/useIconResolver";
import { useBackground } from "@/composables/useBackground";
import { useSearch } from "@/composables/useSearch";
import { useDesktop } from "@/composables/useDesktop";
import { useDock } from "@/composables/useDock";
import { useContextMenu } from "@/composables/useContextMenu";
import { useModal } from "@/composables/useModal";
import { useSettings } from "@/composables/useSettings";
import { useTheme } from "@/composables/useTheme";
import Background from "./components/Background.vue";
import SearchBar from "./components/SearchBar.vue";
import Desktop from "./components/Desktop.vue";
import DockBar from "./components/DockBar.vue";
import ContextMenu from "./components/ContextMenu.vue";
import SettingsPanel from "./components/SettingsPanel.vue";
import IconEditModal from "./components/IconEditModal.vue";
import ConfirmDialog from "./components/ui/ConfirmDialog.vue";
import ToastContainer from "./components/ui/ToastContainer.vue";
import LoadingOverlay from "./components/ui/LoadingOverlay.vue";
import VideoUrlModal from "./components/ui/VideoUrlModal.vue";
import { IconData } from "@/types";

// ── 子组件 template refs（必须在 composable 之前声明，因为回调中引用） ──
const bgRef = ref<InstanceType<typeof Background>>();
const desktopRef = ref<InstanceType<typeof Desktop>>();
const settingsPanelRef = ref<InstanceType<typeof SettingsPanel>>();
const iconEditModalRef = ref<InstanceType<typeof IconEditModal>>();

// ── 核心：存储 ─────────────────────────────────────
const storage = useStorage();
const {
  data,
  saveData,
  loadData,
  generateId,
  compressImage,
  fileToBase64,
  saveCompressedIcon,
  getCompressedIcon,
  saveWallpaper,
  getWallpaper,
  saveVideo,
  getVideo,
  exportAllImages,
  importAllImages,
  clearAllImages,
  initDefaultData,
  migrateData,
} = storage;

// ── 核心：UI 工具 ───────────────────────────────────
const { toasts, showToast } = useToast();
const { loadingActive, loadingText, showLoading, hideLoading } = useLoading();
const { confirmDialogActive, confirmMessage, showConfirm, onConfirmCancel, onConfirmOk } = useConfirm();
const {
  dialogActive: videoUrlDialogActive,
  initialUrl: videoUrlInitial,
  testing: videoUrlTesting,
  testResult: videoUrlTestResult,
  status: videoUrlStatus,
  errorMessage: videoUrlError,
  openVideoUrlDialog,
  probe: videoUrlProbe,
  handleConfirm: videoUrlHandleConfirm,
  retry: videoUrlRetry,
  onClose: onVideoUrlClose,
} = useVideoUrlDialog();

// ── 核心：图标解析 ────────────────────────────────
const { resolvedUrls, resolveImageUrl, getDefaultIcon, getEngineDefaultIcon, resolveAllIconUrls } =
  useIconResolver({
    getCompressedIcon,
    getWallpaper,
    getVideo,
  });

// ── 模块：背景 ─────────────────────────────────
const bg = useBackground(
  data,
  { saveData, getVideo, getWallpaper, saveWallpaper, saveVideo },
  resolveImageUrl,
);
const {
  isRevealing,
  initBackground,
  updateBackgroundFromData,
  setSingleImage,
  setTopLayer,
  setBottomLayer,
  setVideo,
  randomizeWallpaper: bgRandomizeWallpaper,
  applyBackgroundMode,
  onRevealRadiusChange,
  onRevealFeatherChange,
} = bg;

// ── 模块：搜索 ─────────────────────────────────────
const search = useSearch(data, { saveData });
const {
  searchDropdownActive,
  initSearch,
  toggleSearchDropdown,
  selectEngine,
  doSearch: searchDoSearch,
  onSearchMouseEnter,
  onSearchMouseLeave,
  onSearchInputFocus,
  onSearchInputBlur,
} = search;

// ── Module: Desktop ────────────────────────────────────
const desktop = useDesktop(
  data,
  { saveData, generateId, saveCompressedIcon },
  resolveImageUrl,
  showToast,
  showConfirm,
);
const {
  currentPage,
  totalPages,
  dragState,
  initDesktop,
  renderDesktop,
  goToPage,
  addIcon,
  updateIcon,
  removeIcon,
  addPage,
  toggleIconsVisibility,
  handleAddIconFromPopup,
  onDragStart,
  onDragEnd,
  onPageDragOver,
  onPageDrop,
  checkNavProximity,
  onIconClick,
  moveToPage,
  recalcGridSize,
} = desktop;

let _wheelThrottle = 0;
function onDesktopWheelHandler(e: WheelEvent) {
  const now = Date.now();
  if (now - _wheelThrottle < 300) return;
  _wheelThrottle = now;
  if (e.deltaY > 0) goToPage(currentPage.value + 1, true, desktopRef.value?.pagesTrack);
  else if (e.deltaY < 0) goToPage(currentPage.value - 1, true, desktopRef.value?.pagesTrack);
}

// ── 模块：Dock 栏 ───────────────────────────────
const dock = useDock(data, { saveData }, showToast, showConfirm);
const {
  onDockMouseMove,
  onDockMouseLeave,
  onDockItemClick,
  addDockItem,
  removeDockItem,
  updateDockItem,
  removeDockItemWithConfirm,
  reorderDockItem,
} = dock;

// ── 模块：右键菜单 ───────────────────────────────
const ctxMenu = useContextMenu(data, {
  addDesktopIcon: () => modal.addDesktopIcon(),
  addPage: () => {
    addPage();
    renderDesktop(() => {}, desktopRef.value?.pagesTrack);
    goToPage(data.value.pages.length - 1, true, desktopRef.value?.pagesTrack);
  },
  removeCurrentPage: () => {
    removeCurrentPage();
    renderDesktop(() => {}, desktopRef.value?.pagesTrack);
  },
  toggleIconsVisibility: () => {
    toggleIconsVisibility();
    renderDesktop(() => {}, desktopRef.value?.pagesTrack);
  },
  randomizeWallpaper: (images) => bgRandomizeWallpaper(images, bgRef.value?.bgSingle),
  openSettings: (section) => settings.openSettings(section),
  editDesktopIcon: (icon, pi, ii) => modal.editDesktopIcon(icon, pi, ii),
  moveToPage: (pi, ii) => moveToPage(pi, ii),
  editDockIcon: (item, idx) => modal.editDockIcon(item, idx),
  removeDockItem: (idx) => removeDockItem(idx),
  removeIcon: (pi, ii) => {
    removeIcon(pi, ii);
    renderDesktop(() => {}, desktopRef.value?.pagesTrack);
  },
    showConfirm,
  showToast,
});
const {
  contextMenuVisible,
  contextMenuX,
  contextMenuY,
  showContextMenu,
  hideContextMenu,
  contextMenuItems,
  onContextMenuItemClick,
  onAppContextMenu,
} = ctxMenu;

// ── 模块：弹窗 ──────────────────────────────────────
const modal = useModal(
  { generateId, saveData, saveCompressedIcon, compressImage },
  resolveImageUrl,
  showToast,
  showLoading,
  hideLoading,
  showConfirm,
  { addIcon, updateIcon, currentPage },
  { addDockItem, updateDockItem },
  data,
);
const {
  modalActive,
  modalTitle,
  modalIconSrc,
  modalIconVisible,
  fetchIconDisabled,
  fetchIconText,
  fetchNameDisabled,
  fetchNameText,
  addDesktopIcon: modalAddDesktopIcon,
  editDesktopIcon: modalEditDesktopIcon,
  editDockIcon: modalEditDockIcon,
  addDockIcon: modalAddDockIcon,
  addSearchEngine,
  editSearchEngine,
  closeModal,
  onIconFileChange,
  onFetchIcon,
  onFetchName,
  onModalConfirm,
} = modal;

// ── 模块：设置 ────────────────────────────────────
const settings = useSettings(
  data,
  {
    saveData,
    fileToBase64,
    generateId,
    saveWallpaper,
    saveVideo,
    exportAllImages,
    importAllImages,
    clearAllImages,
    migrateData,
  },
  {
    setSingleImage: (src) => setSingleImage(src, bgRef.value?.bgSingle),
    setTopLayer: (src) => setTopLayer(src, bgRef.value?.bgTop),
    setBottomLayer: (src) => setBottomLayer(src, bgRef.value?.bgBottom),
    setVideo: (fileOrUrl) => setVideo(fileOrUrl, bgRef.value?.bgVideo),
    randomizeWallpaper: (images) => bgRandomizeWallpaper(images, bgRef.value?.bgSingle),
    applyBackgroundMode: (mode) =>
      applyBackgroundMode(
        mode,
        bgRef.value?.bgTop,
        bgRef.value?.bgBottom,
        bgRef.value?.bgSingle,
        bgRef.value?.bgVideo,
        bgRef.value?.cursorRing,
      ),
    updateBackgroundFromData: async () =>
      await updateBackgroundFromData(
        bgRef.value?.bgTop,
        bgRef.value?.bgBottom,
        bgRef.value?.bgSingle,
        bgRef.value?.bgVideo,
      ),
    resolveImageUrl: (src) => resolveImageUrl(src),
    loadThemeFromDB: () => storage.loadThemeFromDB(),
    saveThemeToDB: (colors) => storage.saveThemeToDB(colors),
    removeThemeFromDB: () => storage.removeThemeFromDB(),
  },
  showToast,
  showLoading,
  hideLoading,
  showConfirm,
  {
    addDockIcon: () => modal.addDockIcon(),
    editDockIcon: (item, idx) => modal.editDockIcon(item, idx),
    editDesktopIcon: (icon, pi, ii) => modal.editDesktopIcon(icon, pi, ii),
    addSearchEngine,
    editSearchEngine,
  },
  { removeDockItemWithConfirm },
  {
    removeIcon: (pi, ii) => {
        removeIcon(pi, ii);
        renderDesktop(() => {}, desktopRef.value?.pagesTrack);
      },
      addDesktopIcon: () => modalAddDesktopIcon(),
  },
  () => theme.loadThemeColors(),
  openVideoUrlDialog,
);
const {
  settingsActive,
  activeSettingsTab,
  openSettings,
  closeSettings,
  switchSettingsTab,
  onSettingsBgModeChange,
  onSettingsSingleModeChange,
  onUploadSingleImage,
  onUploadTopLayer,
  onUploadBottomLayer,
  onUploadVideo,
  onVideoUrl,
  onAddRandomImage,
  onRemoveRandomImage,
  onAddDockFromSettings,
  onEditDockFromSettings,
  onRemoveDockFromSettings,
  onAddSearchEngine,
  onEditSearchEngine,
  onRemoveSearchEngine,
  onToggleSetting,
  onExportData,
  onImportData,
} = settings;

// ── 模块：主题 ──────────────────────────────────────
const theme = useTheme(
  showToast,
  showConfirm,
  () => storage.loadThemeFromDB(),
  (colors) => storage.saveThemeToDB(colors),
  () => storage.removeThemeFromDB(),
);
const {
  themeColors,
  THEME_COLOR_GROUPS,
  loadThemeColors,
  applySavedThemeToDOM,
  onThemeColorInput,
  onThemeValueChange,
  resetTheme,
  exportTheme,
  importTheme,
  getThemeHexValue,
} = theme;

// 辅助：移除当前页面
function removeCurrentPage() {
  if (data.value.pages.length <= 1) return;
  const idx = currentPage.value;
  data.value.pages.splice(idx, 1);
  if (currentPage.value >= data.value.pages.length) {
    goToPage(data.value.pages.length - 1, false, desktopRef.value?.pagesTrack);
  }
  saveData();
}

// ── 键盘事件 ───────────────────────────────────────────
function onKeyDown(e: KeyboardEvent) {
  if (e.key === "ArrowLeft") goToPage(currentPage.value - 1, true, desktopRef.value?.pagesTrack);
  if (e.key === "ArrowRight") goToPage(currentPage.value + 1, true, desktopRef.value?.pagesTrack);
  if (e.key === "Escape") {
    if (contextMenuVisible.value) hideContextMenu();
    if (settingsActive.value) closeSettings();
    if (modalActive.value) closeModal();
  }
}

// ── 桌面鼠标翻页 proximity ────────────────────────
function onDesktopMouseMove(e: MouseEvent) {
  checkNavProximity(e.clientX, e.clientY, desktopRef.value?.prevBtn, desktopRef.value?.nextBtn);
}
function onDesktopMouseLeave() {
  desktopRef.value?.prevBtn?.classList.remove("nearby");
  desktopRef.value?.nextBtn?.classList.remove("nearby");
}

// ── 图标右键菜单辅助函数 ───────────────────────────
function onIconContextMenu(
  e: MouseEvent,
  icon: import("@/types").IconData,
  pageIndex: number,
  iconIndex: number,
) {
  e.preventDefault();
  e.stopPropagation();
  showContextMenu(e.clientX, e.clientY, "icon", { icon, pageIndex, iconIndex });
}

// ── Dock 右键菜单辅助函数 ───────────────────────────
function onDockItemContextMenu(e: MouseEvent, item: import("@/types").IconData, index: number) {
  e.preventDefault();
  e.stopPropagation();
  showContextMenu(e.clientX, e.clientY, "dock-icon", { item, index });
}

// ── 初始化 ─────────────────────────────────────
onMounted(async () => {
  await initDefaultData();
  await loadData();
  await resolveAllIconUrls(data.value);
  initBackground(bgRef.value?.bgTop, bgRef.value?.bgBottom, bgRef.value?.bgSingle, bgRef.value?.bgVideo, bgRef.value?.cursorRing);
  initSearch();
  initDesktop(() => {}, desktopRef.value?.pagesTrack);
  recalcGridSize();
  let _resizeTimer: ReturnType<typeof setTimeout> | null = null;
  window.addEventListener("resize", () => {
    if (_resizeTimer) clearTimeout(_resizeTimer);
    _resizeTimer = setTimeout(() => { recalcGridSize(); _resizeTimer = null; }, 150);
  });
  loadThemeColors();
  applySavedThemeToDOM();
  document.addEventListener("keydown", onKeyDown);

  if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
      if (message.type === "ADD_ICON") handleAddIconFromPopup(message.payload);
    });
  }
});

onUnmounted(() => {
  document.removeEventListener("keydown", onKeyDown);
});
</script>

<template>
  <div id="app" @contextmenu="onAppContextMenu">
    <!-- 背景层 -->
    <Background ref="bgRef" :is-revealing="isRevealing" :background-mode="data.background.mode" />

    <!-- 搜索框 -->
    <SearchBar
      :search-hidden="data.settings.showSearch === false"
      :search-dropdown-active="searchDropdownActive"
      :search-config="data.search"
      :resolved-urls="resolvedUrls"
      :get-engine-default-icon="getEngineDefaultIcon"
      @toggle-search-dropdown="toggleSearchDropdown"
      @select-engine="(i) => selectEngine(i)"
      @do-search="(el) => searchDoSearch(el)"
      @search-mouse-enter="(el) => onSearchMouseEnter(el)"
      @search-mouse-leave="(el) => onSearchMouseLeave(el)"
      @search-input-focus="(el) => onSearchInputFocus(el)"
      @search-input-blur="onSearchInputBlur" />

    <!-- 桌面区域 -->
    <Desktop
      ref="desktopRef"
      :pages="data.pages"
      :current-page="currentPage"
      :total-pages="totalPages"
      :drag-state="dragState"
      :show-nav-buttons="data.settings.showNavButtons"
      :show-icons="data.settings.showIcons"
      :show-page-indicators="data.settings.showPageIndicators"
      :resolved-urls="resolvedUrls"
      :get-default-icon="getDefaultIcon"
      @go-to-page="(p, anim, track) => goToPage(p, anim, track)"
      @drag-start="(e, id, pi, ii) => onDragStart(e, id, pi, ii)"
      @drag-end="onDragEnd"
      @page-drag-over="(e) => onPageDragOver(e)"
      @page-drop="(e) => onPageDrop(e)"
      @icon-click="(icon) => onIconClick(icon)"
      @icon-context-menu="(e, icon, pi, ii) => onIconContextMenu(e, icon, pi, ii)"
      @wheel="(e) => onDesktopWheelHandler(e)"
      @desktop-mouse-move="(e) => onDesktopMouseMove(e)"
      @desktop-mouse-leave="onDesktopMouseLeave" />

    <!-- Dock 栏 -->
    <DockBar
      ref="dockBarRef"
      :visible="data.settings.showDock === false || data.dock.length === 0 ? false : true"
      :dock-items="data.dock"
      :resolved-urls="resolvedUrls"
      :get-default-icon="getDefaultIcon"
      @dock-mouse-move="(e, el) => onDockMouseMove(e, el)"
      @dock-mouse-leave="(el) => onDockMouseLeave(el)"
      @dock-item-click="(item) => onDockItemClick(item)"
      @dock-item-context-menu="(e, item, i) => onDockItemContextMenu(e, item, i)"
      @dock-reorder="(from, to) => reorderDockItem(from, to)" />

    <!-- 右键菜单 -->
    <ContextMenu
      :visible="contextMenuVisible"
      :x="contextMenuX"
      :y="contextMenuY"
      :items="contextMenuItems"
      @hide="hideContextMenu"
      @item-click="(item) => onContextMenuItemClick(item)" />

    <!-- 设置面板 -->
    <SettingsPanel
      ref="settingsPanelRef"
      :active="settingsActive"
      :active-tab="activeSettingsTab"
      :data="data"
      :resolved-urls="resolvedUrls"
      :theme-color-groups="THEME_COLOR_GROUPS"
      :theme-colors="themeColors"
      :get-theme-hex-value="getThemeHexValue"
      :get-engine-default-icon="getEngineDefaultIcon"
      :get-default-icon="getDefaultIcon"
      @close="closeSettings"
      @overlay-click="
        (e) => {
          if (e.target === settingsPanelRef?.settingsOverlay) closeSettings();
        }
      "
      @switch-tab="(tab) => switchSettingsTab(tab)"
      @bg-mode-change="(m) => onSettingsBgModeChange(m)"
      @single-mode-change="(m) => onSettingsSingleModeChange(m)"
      @upload-single-image="() => onUploadSingleImage()"
      @upload-top-layer="() => onUploadTopLayer()"
      @upload-bottom-layer="() => onUploadBottomLayer()"
      @upload-video="() => onUploadVideo()"
      @video-url="() => onVideoUrl()"
      @add-random-image="() => onAddRandomImage()"
      @remove-random-image="(i) => onRemoveRandomImage(i)"
      @randomize-wallpaper="() => bgRandomizeWallpaper(data.background.randomImages, bgRef?.bgSingle)"
      @reveal-radius-change="(e) => onRevealRadiusChange(e)"
      @reveal-feather-change="(e) => onRevealFeatherChange(e)"
      @theme-color-input="(k, r, v) => onThemeColorInput(k, r, v)"
      @theme-value-change="(k, r, v) => onThemeValueChange(k, r, v)"
      @export-theme="() => exportTheme()"
      @import-theme="() => importTheme()"
      @reset-theme="() => resetTheme()"
      @edit-dock-item="(i) => onEditDockFromSettings(i)"
      @remove-dock-item="(i) => onRemoveDockFromSettings(i)"
      @add-dock-icon="() => onAddDockFromSettings()"
      @dock-reorder="(from, to) => reorderDockItem(from, to)"
      @edit-search-engine="(i) => onEditSearchEngine(i)"
      @remove-search-engine="(i) => onRemoveSearchEngine(i)"
      @add-search-engine="() => onAddSearchEngine()"
      @toggle-setting="(k, v) => onToggleSetting(k, v)"
      @export-data="() => onExportData()"
      @import-data="() => onImportData()" />

    <!-- 图标编辑弹窗 -->
    <IconEditModal
      ref="iconEditModalRef"
      :active="modalActive"
      :title="modalTitle"
      :modal-icon-src="modalIconSrc"
      :modal-icon-visible="modalIconVisible"
      :fetch-icon-disabled="fetchIconDisabled"
      :fetch-icon-text="fetchIconText"
      :fetch-name-disabled="fetchNameDisabled"
      :fetch-name-text="fetchNameText"
      @overlay-click="
        (e) => {
          if (e.target === iconEditModalRef?.iconEditModal) closeModal();
        }
      "
      @close="closeModal"
      @icon-file-change="(e) => onIconFileChange(e)"
      @fetch-icon="(url) => onFetchIcon(url)"
      @fetch-name="(url) => onFetchName(url)"
      @confirm="(name, url) => onModalConfirm(name, url)" />

    <!-- 确认对话框 -->
    <ConfirmDialog
      :active="confirmDialogActive"
      :message="confirmMessage"
      @cancel="onConfirmCancel"
      @ok="onConfirmOk" />

    <!-- 视频 URL 弹窗 -->
    <VideoUrlModal
      :active="videoUrlDialogActive"
      :initial-url="videoUrlInitial"
      :status="videoUrlStatus"
      :error-message="videoUrlError"
      :testing="videoUrlTesting"
      :test-result="videoUrlTestResult"
      @overlay-click="onVideoUrlClose"
      @close="onVideoUrlClose"
      @test="(url) => videoUrlProbe(url)"
      @confirm="(url) => videoUrlHandleConfirm(url)"
      @retry="videoUrlRetry" />

    <!-- Toast 容器 -->
    <ToastContainer :toasts="toasts" />

    <!-- 加载遮罩 -->
    <LoadingOverlay :active="loadingActive" :text="loadingText" />
  </div>
</template>
