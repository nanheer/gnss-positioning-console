<!--
 * @Description: 数据概览 — 数据导入（.O / .pos / .txt 文件上传入口，对接 store.fileList）
-->
<template>
  <section class="panel-section info-container">
    <div class="section-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <line x1="18" y1="20" x2="18" y2="10" />
        <line x1="12" y1="20" x2="12" y2="4" />
        <line x1="6" y1="20" x2="6" y2="14" />
      </svg>
      <span>数据导入</span>
    </div>

    <div class="file-list">
      <div v-for="(item, index) in store.fileList" :key="index" class="file-item"
        :class="{ 'has-file': item.file, 'drag-over': item.dragOver, 'has-error': item.error }"
        @dragover.prevent="item.dragOver = true" @dragleave="item.dragOver = false"
        @drop.prevent="onDrop($event, index)">
        <div class="file-icon">
          <svg v-if="item.error" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <svg v-else-if="item.file" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
        </div>

        <div class="file-info">
          <span v-if="item.file" class="file-name">{{ item.file.name }}</span>
          <span v-else-if="item.error" class="file-error">后缀错误，仅限 {{ item.placeholder }}</span>
          <span v-else class="file-placeholder">{{ item.placeholder }}</span>
          <span v-if="item.file" class="file-size">{{ formatSize(item.file.size) }}</span>
        </div>

        <div class="file-actions">
          <button class="btn-browse" @click="triggerUpload(index)">
            {{ item.file ? '更换' : '浏览' }}
          </button>
          <button v-if="item.file" class="btn-clear" @click="store.clearFile(index)">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <input :ref="el => fileInputs[index] = el" type="file" class="hidden-input"
          @change="onFileChange($event, index)" />
      </div>

      <div class="file-hint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="16" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12.01" y2="8" />
        </svg>
        支持拖拽上传，文件名格式：<strong>.XX</strong> + 固定后缀
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref } from 'vue'
import { useAppStore } from '@/store/app'

defineOptions({ name: 'InfoPanel' })

const store = useAppStore()

const fileInputs = ref([])

function triggerUpload(index) {
  fileInputs.value[index]?.click()
}

function onFileChange(event, index) {
  const file = event.target.files[0]
  if (!file) return
  store.handleFileUpload(file, index)
  if (fileInputs.value[index]) fileInputs.value[index].value = ''
}

function onDrop(event, index) {
  store.fileList[index].dragOver = false
  const file = event.dataTransfer.files[0]
  if (!file) return
  store.handleFileUpload(file, index)
}

function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

.info-container {
  flex: 0 0 250px;
  display: flex;
  flex-direction: column;
}

.panel-section {
  background: $bg-surface;
  border: 1px solid $border;
  border-radius: $radius;

  .section-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 16px;
    height: 44px;
    border-bottom: 1px solid $border;
    font-size: 13.5px;
    font-weight: 600;
    color: $text-primary;
    letter-spacing: 0.3px;

    svg {
      color: $accent;
      flex-shrink: 0;
    }
  }
}

.file-list {
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.file-hint {
  display: flex;
  align-items: center;
  gap: 5px;
  padding: 6px 8px;
  font-size: 11px;
  color: $text-muted;
  border-radius: $radius-sm;

  svg {
    flex-shrink: 0;
  }

  strong {
    color: $text-secondary;
    font-weight: 600;
  }
}

.file-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: $radius-sm;
  border: 1px solid $border;
  background: $bg-elevated;
  transition: all 0.2s;
  min-height: 42px;

  &:hover {
    border-color: $border-light;
    background: $bg-hover;
  }

  &.has-file {
    border-color: rgba($success, 0.4);
    background: $success-glow;
  }

  &.has-error {
    border-color: rgba($danger, 0.5);
    background: rgba($danger, 0.08);

    .file-icon {
      color: $danger;
    }

    .file-error {
      font-size: 11.5px;
      color: $danger;
    }
  }

  &.drag-over {
    border-color: $accent;
    background: $accent-glow;
    box-shadow: 0 0 0 1px $accent;
  }

  .file-icon {
    flex-shrink: 0;
    color: $text-muted;
    display: flex;
    align-items: center;
  }

  &.has-file .file-icon {
    color: $success;
  }

  .file-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;

    .file-name {
      font-size: 12px;
      color: $text-primary;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .file-placeholder {
      font-size: 12px;
      color: $text-muted;
    }

    .file-size {
      font-size: 11px;
      color: $success;
    }
  }

  .file-actions {
    display: flex;
    align-items: center;
    gap: 4px;
    flex-shrink: 0;
  }

  .btn-browse {
    padding: 3px 10px;
    border: 1px solid $border-light;
    border-radius: $radius-sm;
    background: $bg-elevated;
    color: $text-secondary;
    font-size: 12px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover {
      border-color: $accent;
      color: $accent-hover;
      background: $accent-glow;
    }
  }

  .btn-clear {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: 4px;
    background: transparent;
    color: $text-muted;
    cursor: pointer;
    transition: all 0.15s;

    &:hover {
      background: rgba($danger, 0.15);
      color: $danger;
    }
  }
}

.hidden-input {
  display: none;
}
</style>
