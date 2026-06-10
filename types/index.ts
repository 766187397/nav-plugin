export interface IconData {
  id: string;
  name: string;
  url: string;
  icon: string;
  iconType: 'idb' | 'url';
}

export interface PageData {
  id: string;
  icons: (IconData | null)[];
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export interface BackgroundConfig {
  mode: 'single' | 'double' | 'video';
  singleMode: 'fixed' | 'random';
  singleImage: string;
  randomImages: string[];
  topLayer: string;
  bottomLayer: string;
  videoSrc: string;
  revealRadius: number | null;
  revealFeather: number | null;
}

export interface SearchConfig {
  engines: SearchEngine[];
  currentEngine: number;
}

export interface DisplaySettings {
  iconSize: number;
  gridCols: number;
  gridRows: number;
  showIcons: boolean;
  showNavButtons: boolean;
  showPageIndicators: boolean;
  showDock: boolean;
  showSearch: boolean;
}

export interface AppData {
  version: number;
  background: BackgroundConfig;
  search: SearchConfig;
  pages: PageData[];
  dock: IconData[];
  settings: DisplaySettings;
}

export interface ContextMenuData {
  icon?: IconData;
  pageIndex?: number;
  iconIndex?: number;
  item?: IconData;
  index?: number;
}

export interface MenuItem {
  separator?: boolean;
  label?: string;
  icon?: string;
  danger?: boolean;
  action?: () => void;
  disabled?: boolean;
}

export interface DragState {
  isDragging: boolean;
  dragIconId: string;
  dragPageIndex: number;
  dragIconIndex: number;
  _pageFlipTimer: ReturnType<typeof setTimeout> | null;
  _placeholderEl: HTMLElement | null;
  _placeholderType: string | null;
}

export interface ThemeColorVar {
  key: string;
  label: string;
  isRgba: boolean;
}

export interface ThemeColorGroup {
  title: string;
  vars: ThemeColorVar[];
}

export type ModalMode = 'add-desktop' | 'edit-desktop' | 'add-dock' | 'edit-dock' | 'add-engine' | 'edit-engine';

export interface ToastItem {
  id: number;
  message: string;
}
