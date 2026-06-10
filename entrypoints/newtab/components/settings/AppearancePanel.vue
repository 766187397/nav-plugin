<script setup lang="ts">
import type { AppData, ThemeColorGroup } from '@/types'

interface Props {
  active: boolean
  data: AppData
  resolvedUrls: Record<string, string>
  themeColorGroups: ThemeColorGroup[]
  themeColors: Record<string, string>
  getThemeHexValue: (key: string) => string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  bgModeChange: [mode: string]
  singleModeChange: [mode: string]
  uploadSingleImage: []
  uploadTopLayer: []
  uploadBottomLayer: []
  uploadVideo: []
  videoUrl: []
  addRandomImage: []
  removeRandomImage: [index: number]
  randomizeWallpaper: []
  revealRadiusChange: [e: Event]
  revealFeatherChange: [e: Event]
  themeColorInput: [key: string, isRgba: boolean, value: string]
  themeValueChange: [key: string, isRgba: boolean, value: string]
  exportTheme: []
  importTheme: []
  resetTheme: []
}>()
</script>

<template>
  <div class="settings-panel" :class="{ active }" data-panel="appearance">
    <!-- 壁纸设置 -->
    <section class="settings-section" data-section="wallpaper">
      <h3>壁纸设置</h3>
      <div class="settings-section-content">
        <div style="display: flex; gap: 8px; margin-bottom: 16px; flex-wrap: wrap">
          <button
            v-for="m in [
              { value: 'single', label: '单层图片' },
              { value: 'double', label: '双层图片' },
              { value: 'video', label: '视频背景' },
            ]"
            :key="m.value"
            class="mode-option-btn"
            :class="{ active: data.background.mode === m.value }"
            @click="emit('bgModeChange', m.value)"
          >
            {{ m.label }}
          </button>
        </div>

        <!-- 视频模式 -->
        <template v-if="data.background.mode === 'video'">
          <div class="wallpaper-field">
            <label>视频文件（静音循环播放）</label>
            <div
              class="wallpaper-preview"
              style="
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                color: var(--color-text-secondary);
              "
            >
              {{ data.background.videoSrc ? "已设置视频源" : "未设置" }}
            </div>
            <div class="wallpaper-actions">
              <button class="btn btn-sm btn-icon-upload" @click="emit('uploadVideo')">上传视频</button>
              <button class="btn btn-sm" @click="emit('videoUrl')">视频URL</button>
            </div>
          </div>
        </template>

        <!-- 单层图片模式 -->
        <template v-else-if="data.background.mode === 'single'">
          <div style="display: flex; gap: 8px; margin-bottom: 12px">
            <button
              v-for="m in [
                { value: 'fixed', label: '固定图片' },
                { value: 'random', label: '随机列表' },
              ]"
              :key="m.value"
              class="mode-option-btn"
              :class="{ active: data.background.singleMode === m.value }"
              @click="emit('singleModeChange', m.value)"
            >
              {{ m.label }}
            </button>
          </div>

          <!-- 固定图片子模式 -->
          <template v-if="data.background.singleMode === 'fixed'">
            <div class="wallpaper-field">
              <label>背景图片</label>
              <img
                v-if="data.background.singleImage"
                class="wallpaper-preview"
                :src="resolvedUrls[data.background.singleImage] || data.background.singleImage"
              />
              <div class="wallpaper-actions">
                <button class="btn btn-sm btn-icon-upload" @click="emit('uploadSingleImage')">
                  上传图片
                </button>
              </div>
            </div>
          </template>

          <!-- 随机列表子模式 -->
          <template v-else>
            <div
              style="
                display: flex;
                align-items: center;
                justify-content: space-between;
                margin-bottom: 10px;
              "
            >
              <span style="font-size: 12px; color: var(--color-text-secondary)">
                已添加 {{ (data.background.randomImages || []).length }} 张图片，每次打开页面时随机选取一张作为背景
              </span>
              <button
                v-if="(data.background.randomImages || []).length > 0"
                class="btn btn-sm"
                style="padding: 4px 12px; font-size: 12px"
                @click="emit('randomizeWallpaper')"
              >
                换一张
              </button>
            </div>
            <div
              v-for="(imgSrc, idx) in data.background.randomImages || []"
              :key="idx"
              style="
                display: flex;
                align-items: center;
                gap: 8px;
                padding: 6px 8px;
                background: var(--color-surface);
                border: 1px solid var(--color-border);
                border-radius: var(--radius-sm);
                margin-bottom: 6px;
              "
            >
              <img
                style="
                  width: 64px;
                  height: 40px;
                  border-radius: 4px;
                  object-fit: cover;
                  flex-shrink: 0;
                "
                :src="resolvedUrls[imgSrc] || imgSrc"
              />
              <span
                style="
                  font-size: 12px;
                  color: var(--color-text);
                  overflow: hidden;
                  text-overflow: ellipsis;
                  white-space: nowrap;
                  flex: 1;
                  min-width: 0;
                "
              >图片 {{ idx + 1 }}</span
              >
              <button
                title="删除"
                style="
                  width: 24px;
                  height: 24px;
                  border: none;
                  border-radius: 6px;
                  background: transparent;
                  color: var(--color-text-secondary);
                  cursor: pointer;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                "
                @click="emit('removeRandomImage', idx)"
              >
                &#10005;
              </button>
            </div>
            <button
              v-if="(data.background.randomImages || []).length < 20"
              class="add-item-btn"
              @click="emit('addRandomImage')"
            >
              + 添加图片（{{ (data.background.randomImages || []).length }}/20）
            </button>
            <div v-else class="add-item-btn" style="pointer-events: none; opacity: 0.5">
              已达上限 20 张
            </div>
          </template>
        </template>

        <!-- 双层图片模式 -->
        <template v-else-if="data.background.mode === 'double'">
          <div class="wallpaper-field">
            <label>上层壁纸（鼠标移入时隐藏此层）</label>
            <img
              v-if="data.background.topLayer"
              class="wallpaper-preview"
              :src="resolvedUrls[data.background.topLayer] || data.background.topLayer"
            />
            <div class="wallpaper-actions">
              <button class="btn btn-sm btn-icon-upload" @click="emit('uploadTopLayer')">
                上传图片
              </button>
            </div>
          </div>
          <div class="wallpaper-field">
            <label>下层壁纸（鼠标移入时显示此层）</label>
            <img
              v-if="data.background.bottomLayer"
              class="wallpaper-preview"
              :src="resolvedUrls[data.background.bottomLayer] || data.background.bottomLayer"
            />
            <div class="wallpaper-actions">
              <button class="btn btn-sm btn-icon-upload" @click="emit('uploadBottomLayer')">
                上传图片
              </button>
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- 背景效果 -->
    <section class="settings-section" data-section="background-effect">
      <h3>背景效果</h3>
      <div class="settings-section-content">
        <template v-if="data.background.mode !== 'double'">
          <div style="font-size: 12px; color: var(--color-text-secondary); padding: 8px 0">
            仅「双层图片」模式可用
          </div>
        </template>
        <template v-else>
          <div class="setting-slider">
            <div class="setting-slider-label">
              <span>透视半径</span>
              <span class="setting-slider-value">{{ data.background.revealRadius ?? 120 }}px</span>
            </div>
            <input
              type="range"
              min="40"
              max="400"
              :value="data.background.revealRadius ?? 120"
              @input="(e) => emit('revealRadiusChange', e as Event)"
            />
            <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: -2px">
              鼠标移入时显示下层图片的区域大小
            </div>
          </div>
          <div class="setting-slider">
            <div class="setting-slider-label">
              <span>边缘羽化</span>
              <span class="setting-slider-value">{{ data.background.revealFeather ?? 50 }}px</span>
            </div>
            <input
              type="range"
              min="0"
              max="150"
              :value="data.background.revealFeather ?? 50"
              @input="(e) => emit('revealFeatherChange', e as Event)"
            />
            <div style="font-size: 11px; color: var(--color-text-secondary); margin-top: -2px">
              透明区域边缘的模糊过渡范围
            </div>
          </div>
        </template>
      </div>
    </section>

    <!-- 自定义主题 -->
    <section class="settings-section" data-section="custom-theme">
      <h3>自定义主题</h3>
      <div class="settings-section-content">
        <div v-for="group in themeColorGroups" :key="group.title" class="theme-color-group">
          <div class="theme-color-group-title">{{ group.title }}</div>
          <div v-for="v in group.vars" :key="v.key" class="theme-color-row">
            <label>{{ v.label }}<span class="var-name">{{ v.key }}</span></label>
            <div class="theme-color-picker-wrap">
              <input
                type="color"
                :value="getThemeHexValue(v.key)"
                @input="
                  (e) =>
                    emit(
                      'themeColorInput',
                      v.key,
                      v.isRgba,
                      (e.target as HTMLInputElement).value,
                    )
                "
              />
              <input
                type="text"
                class="theme-color-value"
                :value="themeColors[v.key]"
                @change="
                  (e) =>
                    emit(
                      'themeValueChange',
                      v.key,
                      v.isRgba,
                      (e.target as HTMLInputElement).value,
                    )
                "
              />
            </div>
          </div>
        </div>
        <div class="theme-actions">
          <button class="theme-btn" @click="emit('exportTheme')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" /></svg
            >导出主题
          </button>
          <button class="theme-btn" @click="emit('importTheme')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="17 8 12 3 7 8" />
              <line x1="12" y1="3" x2="12" y2="15" /></svg
            >导入主题
          </button>
          <button class="theme-btn" @click="emit('resetTheme')">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
              <path d="M3 3v5h5" /></svg
            >恢复默认
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
