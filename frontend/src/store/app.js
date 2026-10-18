/**
 * 全局状态管理
 *
 * 结构说明：
 *   fileList      → 5 个文件槽位，上传后关联对应解析逻辑
 *   params        → 左侧参数配置面板，当前历元时间自动同步到 UTC 字段
 *   epochList     → .O 文件解析后的历元数组，每项 { time, data }
 *   activeIndex   → 当前播放到第几个历元
 *   mapInstance   → Mars3D 地图单例，组件 onMounted 时注册，onUnmounted 时销毁
 *
 * 文件命名规则：
 *   .XX + 固定后缀（.O / .C / .L / .N / .Q），XX 为 00-99 两位数字
 *   固定后缀前的两位数字为随机前缀，不影响校验
 */

import { defineStore } from 'pinia'
import { ref, shallowRef, computed } from 'vue'

export const useAppStore = defineStore('app', () => {
  // ===== 文件列表 =====
  const fileList = ref([
    { placeholder: '.O', file: null, dragOver: false, error: false },
    { placeholder: '.pos', file: null, dragOver: false, error: false },
    { placeholder: '.txt', file: null, dragOver: false, error: false },
  ])

  // ===== 参数配置 =====
  const params = ref([
    { key: 'UTC',      label: 'UTC',      value: '' },
    { key: 'latitude', label: '经度',      value: '' },
    { key: 'longitude',label: '纬度',      value: '' },
    { key: 'height',   label: '高度',      value: '' },
    { key: 'Q',        label: 'Q',        value: '' },
    { key: 'ns',       label: 'ns',       value: '' },
    // { key: 'sde',      label: 'sde(m)',   value: '' },
    // { key: 'sdu',      label: 'sdu(m)',   value: '' },
    // { key: 'sdne',     label: 'sdne(m)',  value: '' },
    // { key: 'sdeu',     label: 'sdeu(m)',  value: '' },
    // { key: 'sdun',     label: 'sdun(m)',  value: '' },
    { key: 'age',      label: 'age(s)',   value: '' },
    { key: 'ratio',    label: 'ratio',   value: '' },
  ])

  // ===== O 文件历元数据 =====
  const epochList   = ref([])
  const activeIndex = ref(0)
  const isPlaying   = ref(false)
  let timer = null // setInterval handle，避免 Vue 响应式追踪

  // 当前历元对象（仅用于 InfoPanel 等只需 time 的场景）
  const currentEpoch = computed(() => epochList.value[activeIndex.value] ?? null)

  /**
   * 历元卫星数据缓存
   * 上传 O 文件时一次性预计算所有历元的过滤结果（历元索引 → 卫星数据数组）
   * 切换时直接查表 O(1)，避免 computed 每次都重新遍历 2000+ 行数据
   *
   * 结构：Map<number, Array<{ sat, col2, col3, col4, col5 }>>
   */
  const epochSatCache = shallowRef(new Map())

  /** 当前网格数据缓存（每次 loadGrid 后更新，供 pos 轨迹高亮用） */
  const gridCache = ref([])

  /**
   * .pos 文件解析结果
   * 结构：Array<{ time: string, lon: number, lat: number, alt: number }>
   */
  const posData = ref([])

  /** .pos 文件是否有数据 */
  const hasPosData = computed(() => posData.value.length > 0)

  /**
   * .text 电离层文件解析结果
   * 结构待确认，先用数组存储
   */
  const ionoData = ref([])

  /** .text 电离层文件是否有数据 */
  const hasIonoData = computed(() => ionoData.value.length > 0)

  // 当前历元卫星数据，直接从缓存查（O(1)）
  const currentEpochSatellites = computed(() => epochSatCache.value.get(activeIndex.value) ?? [])

  // ===== 历元导航 =====

  /**
   * 切换到指定历元，同时同步 UTC 时间到参数面板
   * @param {number} index - epochList 中的下标
   */
  function setActiveEpoch(index) {
    if (!epochList.value.length) return
    activeIndex.value = index
    const p = params.value.find(p => p.key === 'UTC')
    if (p) p.value = epochList.value[index].time
  }

  /**
   * 播放/暂停历元动画
   * - 播放：从当前历元往后每秒推进一帧，到末尾自动停止
   * - 暂停：清空定时器，重置播放状态
   */
  function togglePlay() {
    if (!epochList.value.length) return

    if (isPlaying.value) {
      // 暂停
      clearInterval(timer)
      timer = null
      isPlaying.value = false
      return
    }

    // 从头开始播（如果已在末尾则重置）
    if (activeIndex.value >= epochList.value.length - 1) activeIndex.value = 0

    timer = setInterval(() => {
      if (activeIndex.value >= epochList.value.length - 1) {
        clearInterval(timer)
        timer = null
        isPlaying.value = false
        return
      }
      setActiveEpoch(activeIndex.value + 1)
    }, 3000)
    isPlaying.value = true
  }

  // ===== 历元卫星过滤 =====
  // currentEpochSatellites 已改为直接查 epochSatCache（见上方 epochSatCache 定义）

  // ===== 文件校验 =====

  /**
   * 校验文件名后缀是否符合 .XX + 固定后缀 格式
   * @param {File} file - 待校验文件
   * @param {string} placeholder - 固定后缀（如 '.O'、'.N'）
   * @returns {boolean} 是否合法
   *
   * 示例：Z12345678.26O → suffix='26O'，固定='O'，前缀='26' → 合规
   *       Z12345678.OO  → suffix='OO'，固定='O'，前缀='O'  → 不合规（应为两位数字）
   */
  function validateSuffix(file, placeholder) {
    const name = file.name.toUpperCase()
    const suffix = name.split('.').pop() // 取最后一个 . 后的内容
    if (!suffix) return false
    const fixed = placeholder.replace('.', '').toUpperCase() // 统一大写比较
    if (!suffix.endsWith(fixed)) return false  // 必须以固定后缀结尾
    // .pos 和 .text 文件无前缀限制，直接通过
    if (fixed === 'POS' || fixed === 'TXT') return true
    // 其他文件（如 .O）要求前缀为两位数字
    const prefix = suffix.slice(0, -fixed.length)
    return /^\d{2}$/.test(prefix)
  }

  // ===== RINEX O 文件解析 =====

  /**
   * 解析 RINEX 3.02 观测文件（.26O）
   *
   * 文件结构：
   *   > 2026 04 01 04 59 4.0000000 0 45 0.000000000000   ← 历元头
   *   C06 37975749.994 197749692.479 5 -1629.310 30.080  ← 卫星观测行
   *
   * 输出格式：Array<{ time: string, data: string[][] }>
   *   - time：格式化的 UTC 时间字符串 'YYYY-MM-DD HH:mm:ss'
   *   - data：该历元所有卫星的观测数据，每项为按空格分割的字段数组
   */
  function parseOFile(text) {
    const lines = text.split(/\r?\n/)
    const result = []
    let currentEpoch = null

    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed) continue

      // 历元头：以 '>' 开头，年份后至少跟 4 个数字段
      if (trimmed.startsWith('>') && /^>\s*\d{2,4}\s+\d{1,2}\s+\d{1,2}\s+\d{1,2}\s+\d{1,2}/.test(trimmed)) {
        const parts = trimmed.split(/\s+/)
        currentEpoch = [
          parts[1],              // year
          parts[2].padStart(2, '0'), // month
          parts[3].padStart(2, '0'), // day
        ].join('-') + ' ' + [
          parts[4].padStart(2, '0'),
          parts[5].padStart(2, '0'),
          String(Math.round(parseFloat(parts[6]))).padStart(2, '0')
        ].join(':')
        result.push({ time: currentEpoch, data: [] })
      }
      // 观测行：属于上一个历元，非空且不以 '>' 开头
      else if (currentEpoch !== null && trimmed && !trimmed.startsWith('>')) {
        const fields = trimmed.split(/\s+/).filter(f => f !== '')
        if (fields.length >= 5) {
          result[result.length - 1].data.push(fields)
        }
      }
    }
    return result
  }

  /**
   * 解析 .pos 结果文本格式
   * 格式：%Y/%m/%d HH:MM:SS.SSS  LAT  LON  HEIGHT  Q  ns  ...
   * 字段： 0           1              2     3     4       5  6
   * Q 值含义：1=fix, 2=float, 3=sbas, 4=dgps, 5=single, 6=ppp
   *
   * 返回：Array<{ time: string, lon: number, lat: number, alt: number, q: number }>
   */
  function parsePosFile(text) {
    const result = []
    for (const raw of text.split(/\r?\n/)) {
      const fields = raw.trim().split(/\s+/)
      if (fields.length < 6) continue
      // 跳过注释行（% 或 # 开头）
      if (/^[%#]/.test(fields[0])) continue
      // 跳过不含斜杠的无效行（如表头 "GPST latitude..."）
      if (!fields[0].includes('/')) continue

      const time = fields[0] + ' ' + fields[1]
      const lat  = parseFloat(fields[2])
      const lon  = parseFloat(fields[3])
      const alt  = parseFloat(fields[4])
      const q    = parseInt(fields[5])

      if (isNaN(lat) || isNaN(lon) || isNaN(alt)) continue
      if (lat < -90 || lat > 90 || lon < -180 || lon > 180) continue

      result.push({
        time,
        lon,
        lat,
        alt,
        q,
        ns:     parseFloat(fields[6])  ?? null,
        sdn:    parseFloat(fields[7])  ?? null,
        sde:    parseFloat(fields[8])  ?? null,
        sdu:    parseFloat(fields[9])  ?? null,
        sdne:   parseFloat(fields[10]) ?? null,
        sdeu:   parseFloat(fields[11]) ?? null,
        sdun:   parseFloat(fields[12]) ?? null,
        age:    parseFloat(fields[13]) ?? null,
        ratio:  parseFloat(fields[14]) ?? null,
      })
    }
    return result
  }

  // ===== 电离层 .text 文件解析 =====

  /**
   * 解析电离层 TEC 插值文件（shenzhen_tec_interp.txt）
   *
   * 文件格式：
   *   # 注释头（GBK 编码，乱码无所谓，# 开头跳过）
   *   # 时次 0h          ← 时次标记
   *   14.6436 14.6489 ...  ← 30行 × 60列 TEC 值，空格分隔
   *   （空行分隔）
   *   # 时次 2h
   *   ...（0h~22h，间隔2h，共12个时次）
   *
   * 输出结构：Array<{ hour: number, data: number[] }>
   *   - hour：时次（0, 2, 4, ... 22）
   *   - data：30×60=1800 个 TEC 值的扁平数组（逐行拼接）
   */
  function parseIonoText(text) {
    const result = []
    const lines = text.split(/\r?\n/)
    let currentHour = null
    let currentData = []

    for (const raw of lines) {
      const line = raw.trim()
      if (!line) continue

      // 匹配时次标记：# 时次 0h  或  # ʱ�� 0h（GBK乱码）
      const hourMatch = line.match(/^#\s+\S+\s+(\d+)h$/)
      if (hourMatch) {
        // 遇到新时次，保存上一个
        if (currentHour !== null && currentData.length > 0) {
          result.push({ hour: currentHour, data: currentData })
        }
        currentHour = parseInt(hourMatch[1])
        currentData = []
        continue
      }

      // 跳过其他注释行
      if (line.startsWith('#')) continue

      // 解析数据行：纯数字空格分隔
      const nums = line.split(/\s+/).map(Number).filter(n => !isNaN(n))
      if (nums.length > 0) {
        currentData.push(...nums)
      }
    }

    // 保存最后一个时次
    if (currentHour !== null && currentData.length > 0) {
      result.push({ hour: currentHour, data: currentData })
    }

    console.log(`[parseIonoText] 解析完成: ${result.length} 个时次, 每时次数据量: ${result.map(r => r.data.length).join('/')}`)
    return result
  }

  // ===== 文件上传 & 解析 =====

  /**
   * 处理文件上传入口
   * 1. 校验后缀，不通过 → 显示错误态
   * 2. 通过 → 存入 fileList，触发对应解析器
   * @returns {boolean} 是否上传成功
   */
  function handleFileUpload(file, index) {
    const placeholder = fileList.value[index].placeholder
    if (!validateSuffix(file, placeholder)) {
      fileList.value[index].error = true
      fileList.value[index].file  = null
      return false
    }
    fileList.value[index].error = false
    fileList.value[index].file   = file
    parseFile(file, index)
    return true
  }

  /**
   * 根据槽位类型分发解析逻辑
   * .O → parseOFile → 更新历元列表并自动开始播放
   * .pos → parsePosFile → 更新 posData，供网格高亮使用
   */
  function parseFile(file, fileIndex) {
    const reader = new FileReader()
    reader.onload = (e) => {
      const text = e.target.result
      if (fileList.value[fileIndex].placeholder === '.O') {
        const oData = parseOFile(text)
        initEpochList(oData)
        console.log(`[${fileIndex}] ${file.name} (O文件)`, oData)
      } else if (fileList.value[fileIndex].placeholder === '.pos') {
        const pos = parsePosFile(text)
        posData.value = pos
        console.log(`[${fileIndex}] ${file.name} (.pos)`, pos)
      } else if (fileList.value[fileIndex].placeholder === '.txt') {
        ionoData.value = parseIonoText(text)
        console.log(`[${fileIndex}] ${file.name} (.txt 电离层)`, ionoData.value)
      } else {
        const lines = text.split(/\r?\n/).filter(l => l.trim())
        console.log(`[${fileIndex}] ${file.name}`, lines)
      }
    }
    reader.readAsText(file)
  }

  /**
   * 初始化历元列表并自动启动播放
   * @param {Array} epochs - parseOFile 的返回值
   */
  function initEpochList(epochs) {
    epochList.value = epochs
    activeIndex.value = 0

    // 一次性预计算所有历元的卫星过滤数据，存到缓存 Map
    const allowedC = new Set(['C02', 'C03', 'C04', 'C05'])
    const cache = new Map()
    epochs.forEach((epoch, idx) => {
      let gAdded = false
      const rows = []
      for (const row of epoch.data) {
        const sat = row[0]
        if (allowedC.has(sat)) {
          rows.push({ sat, col2: row[1] ?? '', col3: row[2] ?? '', col4: row[3] ?? '', col5: row[4] ?? '' })
        } else if (sat.startsWith('G') && !gAdded) {
          rows.push({ sat, col2: row[1] ?? '', col3: row[2] ?? '', col4: row[3] ?? '', col5: row[4] ?? '' })
          gAdded = true
        }
      }
      cache.set(idx, rows)
    })
    epochSatCache.value = cache

    if (epochs.length > 0) {
      const p = params.value.find(p => p.key === 'UTC')
      if (p) p.value = epochs[0].time
      // 上传 O 文件后自动开始播放
      if (!isPlaying.value) togglePlay()
    }
  }

  /**
   * 清除指定槽位的文件
   * 槽位 0（.O 文件）清除时同步停止播放、清空历元列表和 UTC 参数
   */
  function clearFile(index) {
    fileList.value[index].file  = null
    fileList.value[index].error = false
    if (index === 0) {
      if (timer) { clearInterval(timer); timer = null; isPlaying.value = false }
      epochList.value   = []
      activeIndex.value = 0
      epochSatCache.value = new Map() // 清空缓存
      const p = params.value.find(p => p.key === 'UTC')
      if (p) p.value = ''
    }
    // .pos 文件清除时清空位置数据
    if (fileList.value[index].placeholder === '.pos') {
      posData.value = []
    }
    // .text 电离层文件清除时清空数据
    if (fileList.value[index].placeholder === '.txt') {
      ionoData.value = []
    }
  }

  // ===== Mars3D 地图实例 =====

  /**
   * Mars3D 地图单例，通过 store 共享给其他组件
   * 注意：地图初始化在 MapPanel.vue onMounted 中执行，
   *       因为需要 DOM 元素已挂载才能创建地图实例。
   */
  let mapInstance = null
  /** 空域网格图层，地图初始化时创建，渲染网格数据时复用 */
  let airspaceGridLayer = null
  /** 网格加载中状态 */
  let gridLoading = false
  function setMapInstance(instance) { mapInstance = instance }
  function getMapInstance()         { return mapInstance }
  function setAirspaceGridLayer(layer) { airspaceGridLayer = layer }
  function getAirspaceGridLayer()      { return airspaceGridLayer }
  function setGridLoading(val)         { gridLoading = val }
  function getGridLoading()            { return gridLoading }

  return {
    // state
    fileList, params, epochList, activeIndex, isPlaying,
    currentEpoch, currentEpochSatellites, gridLoading,
    posData, gridCache, ionoData,
    // computed
    hasPosData, hasIonoData,
    // actions
    setActiveEpoch, togglePlay,
    handleFileUpload, clearFile,
    validateSuffix, parseFile,
    initEpochList,
    setMapInstance, getMapInstance,
    setAirspaceGridLayer, getAirspaceGridLayer,
    setGridLoading, getGridLoading,
  }
})
