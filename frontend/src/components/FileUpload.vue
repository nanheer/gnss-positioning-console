<template>
  <section class="panel-section upload-section">
    <div class="section-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
        <polyline points="17 8 12 3 7 8" />
        <line x1="12" y1="3" x2="12" y2="15" />
      </svg>
      <span>定位解算</span>
    </div>

    <!-- ===== 定位模式选择 ===== -->
    <div class="mode-section">
      <div class="mode-label">定位模式选择</div>
      <div class="mode-options">
        <label class="radio-label" @click="positionMode = 'spp'">
          <span class="radio-circle" :class="{ active: positionMode === 'spp' }"></span>
          SPP
          <span class="radio-desc">（标准单点定位）</span>
        </label>
        <label class="radio-label" @click="positionMode = 'ppk'">
          <span class="radio-circle" :class="{ active: positionMode === 'ppk' }"></span>
          PPK
        </label>
      </div>
    </div>
    <!-- ===== 开始计算 ===== -->
    <div class="calc-section">
      <button class="btn-calc" :class="{ disabled: !canCalculate || calculating }"
        :disabled="!canCalculate || calculating" @click="startCalc">
        <svg v-if="calculating" class="spinner" width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2">
          <circle cx="12" cy="12" r="10" stroke-dasharray="32" />
        </svg>
        <svg v-else width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
        {{ calculating ? '计算中...' : '开始计算' }}
      </button>
      <div v-if="calcError" class="calc-error">{{ calcError }}</div>
    </div>
    <!-- ===== PPK 基准站坐标输入（可选） ===== -->
    <div v-if="positionMode === 'ppk'" class="ppk-section">
      <div class="ppk-title">基准站坐标输入（可选）</div>
      <div class="coord-grid">
        <div class="coord-item">
          <label class="coord-hint">纬度/X</label>
          <input v-model="ppkLat" type="text" class="coord-input" placeholder="例：22.543099" />
        </div>
        <div class="coord-item">
          <label class="coord-hint">经度/Y</label>
          <input v-model="ppkLng" type="text" class="coord-input" placeholder="例：114.057868" />
        </div>
        <div class="coord-item">
          <label class="coord-hint">高程/Z</label>
          <input v-model="ppkAlt" type="text" class="coord-input" placeholder="例：100.0" />
        </div>
      </div>
      <div class="coord-tip">按「纬度 经度 高程」填写；留空则自动用基准站单点解算结果</div>
    </div>

    <!-- ===== 文件上传 ===== -->
    <div class="file-section">
      <div v-if="positionMode === 'ppk'" class="upload-tip">
        PPK 需上传 3 个文件：① 流动站O文件 ② 基准站O文件 ③ 星历文件（顺序不可颠倒）
      </div>
      <div v-for="(item, index) in currentFiles" :key="index" class="file-slot">
        <span class="slot-label">{{ item.label }}</span>
        <div class="file-item" :class="{ 'has-file': item.file, 'drag-over': item.dragOver, 'has-error': item.error }"
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
            <span v-else-if="item.error" class="file-error">{{ item.errMsg }}</span>
            <span v-else class="file-placeholder">点击或拖拽上传</span>
            <span v-if="item.file" class="file-size">{{ formatSize(item.file.size) }}</span>
          </div>

          <div class="file-actions">
            <button class="btn-browse" @click="triggerUpload(index)">
              {{ item.file ? '更换' : '浏览' }}
            </button>
            <button v-if="item.file" class="btn-clear" @click="clearFile(index)">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          <input :ref="el => fileInputs[index] = el" type="file" class="hidden-input"
            @change="onFileChange($event, index)" />
        </div>
      </div>
    </div>

    <!-- ===== 结果文件 ===== -->
    <div class="file-section">
      <span class="slot-label">结果文件</span>
      <div class="result-display" :class="{ 'has-result': resultPath }">
        <div class="result-icon">
          <svg v-if="resultPath" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            stroke-width="2">
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <svg v-else width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" />
            <polyline points="13 2 13 9 20 9" />
          </svg>
        </div>
        <div class="result-info">
          <span v-if="resultPath" class="result-path">{{ resultPath }}</span>
          <span v-else class="result-placeholder">计算完成后显示结果路径</span>
        </div>
      </div>
    </div>


  </section>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useAppStore } from '@/store/app'

defineOptions({ name: 'FileUpload' })

const store = useAppStore()

// ===== 定位模式 =====
const positionMode = ref('spp')

// ===== PPK 坐标 =====
const ppkLat = ref('')
const ppkLng = ref('')
const ppkAlt = ref('')

// ===== SPP 文件槽位 (2) =====
const sppFiles = ref([
  { label: '流动站观测值O文件', file: null, dragOver: false, error: false, errMsg: '' },
  { label: '星历文件', file: null, dragOver: false, error: false, errMsg: '' },
])

// ===== PPK 文件槽位 (3) =====
// 注意：第一个观测文件会被当作「流动站」，第二个当作「基准站」，
// 顺序不能颠倒，否则 exe 会把基准站当流动站解算，轨迹结果错误。
const ppkFiles = ref([
  { label: '流动站观测值O文件（rover）', file: null, dragOver: false, error: false, errMsg: '' },
  { label: '基准站观测值O文件（base）', file: null, dragOver: false, error: false, errMsg: '' },
  { label: '星历文件', file: null, dragOver: false, error: false, errMsg: '' },
])

// ===== 结果文件路径（计算完成后后端返回） =====
const resultPath = ref('')
const calculating = ref(false)
const calcError = ref('')

// ===== 文件输入 refs =====
const fileInputs = ref([])

/** 当前模式下的文件列表 */
const currentFiles = computed(() =>
  positionMode.value === 'spp' ? sppFiles.value : ppkFiles.value
)

/** 是否所有必选文件已上传且无错误 */
const canCalculate = computed(() => {
  const files = currentFiles.value
  return files.length > 0 && files.every(f => f.file && !f.error)
})

// =====  O 文件格式校验 =====
function validateOFile(file) {
  const name = file.name.toLowerCase()
  // .o / .obs / 年份型后缀（.26o、.25O 等，如 Z35256661089045-05-20260401-040000.26O）
  return /\.(o|obs)$/.test(name) || /\.\d{2}o$/.test(name.slice(-4))
}

// ===== 星历文件格式校验 =====
function validateEphFile(file) {
  const name = file.name.toLowerCase()
  return /\.(nav|rnx|sp3|eph|clk|brdc|igs|orb)$/.test(name) || /\.\d{2}(n|g|l|p)$/.test(name.slice(-4))
}

// ===== 触发浏览 =====
function triggerUpload(index) {
  fileInputs.value[index]?.click()
}

// ===== 浏览选择 =====
function onFileChange(event, index) {
  const file = event.target.files[0]
  if (!file) return

  const files = currentFiles.value
  const slot = files[index]

  // O 文件校验（第一个 & 第二个槽都是 O 文件）
  const isOFileSlot = index < files.length - 1 // 最后一个槽是星历文件
  const isEphSlot = index === files.length - 1

  if (isOFileSlot && !validateOFile(file)) {
    slot.error = true
    slot.errMsg = '仅限 .O 观测文件'
    slot.file = null
  } else if (isEphSlot && !validateEphFile(file)) {
    slot.error = true
    slot.errMsg = '仅限星历文件（.nav / .sp3 / .rnx / .eph）'
    slot.file = null
  } else {
    slot.error = false
    slot.errMsg = ''
    slot.file = file
  }

  if (fileInputs.value[index]) fileInputs.value[index].value = ''
}

// ===== 拖拽 =====
function onDrop(event, index) {
  const files = currentFiles.value
  files[index].dragOver = false
  const file = event.dataTransfer.files[0]
  if (!file) return

  // 复用 onFileChange 校验逻辑
  const slot = files[index]
  const isOFileSlot = index < files.length - 1
  const isEphSlot = index === files.length - 1

  if (isOFileSlot && !validateOFile(file)) {
    slot.error = true
    slot.errMsg = '仅限 .O 观测文件'
    slot.file = null
  } else if (isEphSlot && !validateEphFile(file)) {
    slot.error = true
    slot.errMsg = '仅限星历文件（.nav / .sp3 / .rnx / .eph）'
    slot.file = null
  } else {
    slot.error = false
    slot.errMsg = ''
    slot.file = file
  }
}

// ===== 清除 =====
function clearFile(index) {
  const files = currentFiles.value
  files[index].file = null
  files[index].error = false
  files[index].errMsg = ''
}

// ===== 开始计算 =====
async function startCalc() {
  if (!canCalculate.value || calculating.value) return

  const files = currentFiles.value
  calculating.value = true
  calcError.value = ''
  resultPath.value = ''

  try {
    const formData = new FormData()
    files.forEach(f => {
      formData.append('files', f.file)
    })

    // PPK 模式：附加基准站坐标
    // position.exe 的 -c 参数顺序为「纬度 经度 高程」，坐标顺序不能颠倒，否则该参数会被忽略
    if (positionMode.value === 'ppk') {
      if (ppkLat.value) formData.append('coordX', ppkLat.value)
      if (ppkLng.value) formData.append('coordY', ppkLng.value)
      if (ppkAlt.value) formData.append('coordZ', ppkAlt.value)
      if (ppkLng.value || ppkLat.value || ppkAlt.value) {
        formData.append('coordType', 'auto')
      }
    }

    console.log('[FileUpload] 发送计算请求...')
    const res = await fetch('/api/solver/solve', {
      method: 'POST',
      body: formData,
    })
    const data = await res.json()
    console.log('[FileUpload] 计算响应:', data)

    if (!data.success) {
      calcError.value = data.message || '计算失败'
      return
    }

    // 计算成功 → 下载结果文件 → 注入 store.pos 槽位
    const downloadRes = await fetch(`/api/solver/download/${data.sessionId}`)
    if (downloadRes.ok) {
      const blob = await downloadRes.blob()
      const resultFileName = `${data.sessionId}.pos`
      const resultFile = new File([blob], resultFileName, { type: 'text/plain' })

      // 注入 store.fileList[1]（.pos 槽位），触发解析 + 地图/图表更新
      store.handleFileUpload(resultFile, 1)

      resultPath.value = resultFileName
      console.log('[FileUpload] 结果已注入, 模式:', data.mode, '耗时:', data.elapsedMs, 'ms')
    } else {
      calcError.value = '结果文件下载失败'
    }
  } catch (e) {
    calcError.value = '计算服务未启动，请确认后端已运行'
    console.error('[FileUpload] 计算请求失败', e)
  } finally {
    calculating.value = false
  }
}

/** 格式化文件大小 */
function formatSize(bytes) {
  if (!bytes) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

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

// ===== 定位模式 =====
.mode-section {
  padding: 10px;
  margin: 0 10px;

  .mode-label {
    font-size: 12px;
    color: $text-muted;
    margin-bottom: 8px;
  }

  .mode-options {
    display: flex;
    gap: 24px;
  }
}

.radio-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: $text-primary;
  font-weight: 600;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  user-select: none;
  transition: color 0.2s;

  &:hover {
    color: $accent-hover;
  }
}

.radio-circle {
  flex-shrink: 0;
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 2px solid $border-light;
  background: transparent;
  transition: all 0.2s;

  &.active {
    border-color: $accent;
    background: $accent;
    box-shadow: inset 0 0 0 3px $bg-surface;
  }
}

.radio-desc {
  font-weight: 400;
  font-size: 11px;
  color: $text-muted;
  font-family: inherit;
}

// ===== PPK 基准站坐标 =====
.ppk-section {
  padding: 0 10px 10px;
  margin: 0 10px;
  border-top: 1px solid $border;

  .ppk-title {
    font-size: 12px;
    color: $text-secondary;
    margin: 10px 0 8px;
  }

  .coord-tip {
    margin-top: 6px;
    font-size: 11px;
    line-height: 1.4;
    color: $text-muted;
  }
}

.coord-grid {
  display: flex;
  gap: 6px;
}

.coord-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
  overflow: hidden;
}

.coord-hint {
  font-size: 11px;
  color: $text-muted;
}

.coord-input {
  height: 30px;
  padding: 0 6px;
  border: 1px solid $border-light;
  border-radius: $radius-sm;
  background: $bg-elevated;
  color: $text-primary;
  font-size: 12px;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  outline: none;
  transition: border-color 0.2s;

  &::placeholder {
    color: $text-muted;
    font-size: 11px;
  }

  &:focus {
    border-color: $accent;
  }
}

// ===== 文件上传 =====
.file-section {
  padding: 0 10px;
  margin: 0 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  .upload-tip {
    font-size: 11px;
    line-height: 1.5;
    color: $text-muted;
    padding: 6px 8px;
    border-radius: $radius-sm;
    border: 1px dashed $border-light;
    background: $bg-elevated;
  }
}

.slot-label {
  font-size: 11.5px;
  color: $text-secondary;
  line-height: 1;
}

.file-slot {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

// ===== 文件条目 =====
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

// ===== 结果文件展示（只读） =====
.result-display {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 10px;
  border-radius: $radius-sm;
  border: 1px solid $border;
  background: $bg-elevated;
  min-height: 42px;

  .result-icon {
    flex-shrink: 0;
    color: $text-muted;
    display: flex;
    align-items: center;
  }

  .result-info {
    flex: 1;
    min-width: 0;
  }

  .result-path {
    font-size: 11.5px;
    color: $success;
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    word-break: break-all;
  }

  .result-placeholder {
    font-size: 12px;
    color: $text-muted;
  }

  &.has-result {
    border-color: rgba($success, 0.4);
    background: $success-glow;

    .result-icon {
      color: $success;
    }
  }
}

// ===== 计算按钮 =====
.calc-section {
  padding: 10px;
  margin: 0 10px 10px;
}

.btn-calc {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  height: 36px;
  border: none;
  border-radius: $radius-sm;
  background: linear-gradient(135deg, #5B6DFF, #8B5CFF);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.5px;

  svg {
    flex-shrink: 0;
  }

  &:hover {
    background: linear-gradient(135deg, #4A5CE6, #7A4BE6);
    box-shadow: 0 2px 8px rgba(91, 109, 255, 0.35);
  }

  &:active {
    transform: scale(0.98);
  }

  &.disabled {
    background: $bg-elevated;
    color: $text-muted;
    cursor: not-allowed;
    border: 1px solid $border-light;
    pointer-events: none;

    svg {
      opacity: 0.4;
    }
  }
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.calc-error {
  margin-top: 6px;
  font-size: 11.5px;
  color: $danger;
  text-align: center;
}
</style>
