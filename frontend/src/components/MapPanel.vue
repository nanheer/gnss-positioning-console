<template>
  <section class="panel-section map-container">
    <div class="section-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6" />
        <line x1="8" y1="2" x2="8" y2="18" />
        <line x1="16" y1="6" x2="16" y2="22" />
      </svg>
      <span>地图</span>
      <div class="section-toggle">
        <button :class="{ active: viewMode === 'trajectory' }" @click="viewMode = 'trajectory'">无人机轨迹</button>
        <button :class="{ active: viewMode === 'grid' }" @click="loadIonosphereGrid">电离层网格</button>
      </div>
      <button class="btn-trajectory" :disabled="!store.posData.length" @click="renderTrajectory">
        渲染轨迹
      </button>
    </div>
    <div id="mars3dContainer" class="mars3d-container"></div>
    <!-- TEC 色标 -->
    <div v-if="showColorbar" class="tec-colorbar">
      <div class="colorbar-title">TEC (TECU)</div>
      <div class="colorbar-bar">
        <div class="colorbar-gradient"></div>
        <div class="colorbar-labels">
          <span>50</span><span>38.75</span><span>27.5</span><span>16.25</span><span>5</span>
        </div>
      </div>
    </div>
    <!-- 网格加载中 -->
    <div v-if="loading" class="grid-loading">
      <div class="grid-loading-dot"></div>
      <span>加载网格...</span>
    </div>
  </section>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import * as mars3d from 'mars3d'
import Cesium from 'mars3d-cesium'

import { useAppStore } from '@/store/app'
import { szfw } from '@/static/szfw'

const store = useAppStore()
const loading = ref(false)
/** 视图模式：trajectory=无人机轨迹，grid=电离层网格 */
const viewMode = ref('trajectory')
/** 是否显示 TEC 色标 */
const showColorbar = ref(false)

/**
 * 射线法判断点是否在多边形内
 * @param {number} lon 经度
 * @param {number} lat 纬度
 * @param {Array<{longitude:number,latitude:number}>} polygon 多边形顶点
 */
function isPointInPolygon(lon, lat, polygon) {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].longitude, yi = polygon[i].latitude
    const xj = polygon[j].longitude, yj = polygon[j].latitude
    if ((yi > lat) !== (yj > lat) &&
        lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** 判断点是否在深圳市范围内（szfw 任一多边形内） */
function isInShenzhen(lon, lat) {
  return szfw.some(polygon => isPointInPolygon(lon, lat, polygon))
}

/** 电离层网格固定范围（纬度 22.4~22.9，经度 113.7~114.7） */
const IONO_BOUNDS = {
  south: 22.4, north: 22.9,
  west: 113.7, east: 114.7,
}
const IONO_LEVEL = 6

/** TEC 色标范围 */
const TEC_MIN = 5
const TEC_MAX = 50

/**
 * TEC 值 → 颜色映射（5~50 TECU）
 * 蓝(5) → 青 → 绿 → 黄 → 红(50)
 */
function tecToColor(tec) {
  const t = Math.max(0, Math.min(1, (tec - TEC_MIN) / (TEC_MAX - TEC_MIN)))
  // 4段线性插值：蓝→青→绿→黄→红
  let r, g, b
  if (t < 0.25) {
    const s = t / 0.25
    r = 0; g = Math.round(s * 255); b = 255
  } else if (t < 0.5) {
    const s = (t - 0.25) / 0.25
    r = 0; g = 255; b = Math.round((1 - s) * 255)
  } else if (t < 0.75) {
    const s = (t - 0.5) / 0.25
    r = Math.round(s * 255); g = 255; b = 0
  } else {
    const s = (t - 0.75) / 0.25
    r = 255; g = Math.round((1 - s) * 255); b = 0
  }
  return new Cesium.Color(r / 255, g / 255, b / 255, 0.7)
}

/** 点击「电离层网格」按钮：API 获取网格 + TEC 数据着色 */
async function loadIonosphereGrid() {
  viewMode.value = 'grid'
  const map = store.getMapInstance()
  const gridLayer = store.getAirspaceGridLayer()
  if (!map || !gridLayer) return

  // 检查是否有 ionoData
  if (!store.ionoData.length) {
    console.warn('[ionoGrid] 请先上传 .txt 电离层文件')
    return
  }

  // 屏蔽 cameraChanged 自动请求
  ionoGridLoading = true

  const { south, north, west, east } = IONO_BOUNDS
  const cube = [
    { longitude: west,  latitude: south },
    { longitude: east,  latitude: south },
    { longitude: east,  latitude: north },
    { longitude: west,  latitude: north },
    { longitude: west,  latitude: south },
  ]

    // 构建 12 时次 TEC 查找表 { hour → data[] }
    const tecByHour = {}
    store.ionoData.forEach(h => { tecByHour[h.hour] = h.data })

    // 根据 UTC 参数获取当前时次
    function getCurrentIonoHour() {
      const utcVal = store.params.find(p => p.key === 'UTC')?.value
      if (!utcVal) return 0
      // 支持两种格式: '2026-04-01 04:00:04' 或 '2026 04 01 04 00 0.0000000'
      const hourStr = utcVal.includes('-')
        ? utcVal.split(' ')[1]?.split(':')[0]   // '2026-04-01 04:00:04'
        : utcVal.split(/\s+/)[3]                // '2026 04 01 04 00 0.0000000'
      const hour = parseInt(hourStr)
      if (isNaN(hour)) return 0
      // 取偶数时次（0,2,4,...22），向最近偶数靠拢
      return Math.round(hour / 2) * 2
    }

    // 当前时次 → TEC 数据
    let currentHour = getCurrentIonoHour()
    // 确保时次存在
    if (!tecByHour[currentHour]) currentHour = store.ionoData[0].hour
    let tecFlat = tecByHour[currentHour]
    console.log(`[ionoGrid] UTC → 时次 ${currentHour}h, ${tecFlat.length} 个 TEC 值`)

  store.setGridLoading(true)
  loading.value = true
  showColorbar.value = true

  try {
    // 飞到目标区域中心
    const centerLon = (west + east) / 2
    const centerLat = (south + north) / 2
    const spanLon = east - west
    const spanLat = north - south
    const radius = Math.max(spanLon, spanLat) * 111000 * 0.7
    map.flyToPoint(new mars3d.LngLatPoint(centerLon, centerLat, 0), {
      radius,
      duration: 1.5,
    })
    await new Promise(r => setTimeout(r, 1600))

    // 获取网格结构：默认本地生成 30 行 × 60 列（与 .txt 的行列顺序一一对应），
    // 若配置了 VITE_GRID_API_BASE 则改由外部网格服务返回
    const apiResult = await getGridAndAttribute({ cube, layer: IONO_LEVEL, rows: 30, cols: 60 })
    let gridData = []
    if (apiResult && apiResult.data) {
      // 过滤：只保留中心点在 IONO_BOUNDS 范围内的网格
      gridData = apiResult.data.filter(g =>
        g.centerLatitude >= IONO_BOUNDS.south && g.centerLatitude <= IONO_BOUNDS.north &&
        g.centerLongitude >= IONO_BOUNDS.west && g.centerLongitude <= IONO_BOUNDS.east
      )
      console.log(`[ionoGrid] API 返回 ${apiResult.data.length} → 过滤后 ${gridData.length}`)
    }

    if (!gridData.length) {
      console.warn('[ionoGrid] 无网格数据')
      return
    }

    // 按 lat 升序、lon 升序排序（和 .txt 文件 30行×60列 顺序一致）
    gridData.sort((a, b) => {
      if (a.centerLatitude !== b.centerLatitude) return a.centerLatitude - b.centerLatitude
      return a.centerLongitude - b.centerLongitude
    })

    // 按 grid 索引存储所有时次的 TEC（用于后续时次切换）
    const tecAllByGridIdx = []
    gridData.forEach((grid, idx) => {
      const tecAll = {}
      store.ionoData.forEach(h => { tecAll[h.hour] = h.data[idx] })
      tecAllByGridIdx.push(tecAll)
    })

    // 构建渲染数据：当前时次着色
    const arrData = []
    gridData.forEach((grid, idx) => {
      const tecAll = tecAllByGridIdx[idx]
      const tec = tecAll[currentHour]
      if (tec === undefined || isNaN(tec)) return

      const centerLonG = grid.centerLongitude
      const centerLatG = grid.centerLatitude
      const position = new mars3d.LngLatPoint(centerLonG, centerLatG, grid.centerAltitude ?? 350000)

      // rlon/rlat 是度数，转成米
      const degPerMeterLon = 111320 * Math.cos((centerLatG * Math.PI) / 180)
      const boxW = grid.rlon * 2 * degPerMeterLon
      const boxD = grid.rlat * 2 * 111320

      // 深圳范围外的网格隐藏（极小尺寸+透明），保留索引对应关系
      const inSz = isInShenzhen(centerLonG, centerLatG)

      arrData.push({
        position,
        style: {
          dimensions: inSz
            ? new Cesium.Cartesian3(boxW, boxD, grid.height ?? 200000)
            : new Cesium.Cartesian3(1, 1, 1),
          color: inSz ? tecToColor(tec) : Cesium.Color.BLACK,
          opacity: inSz ? 0.7 : 0,
        },
        attr: { ...grid, tec, tecAll, inShenzhen: inSz, _dim: { boxW, boxD, boxH: grid.height ?? 200000 } },
      })
    })

    gridLayer.clear()
    let graphic = new mars3d.graphic.BoxCombine({
      instances: arrData,
      style: {
        outline: true,
        outlineWidth: 1,
        outlineColor: 'white',
        outlineOpacity: 0.15,
      },
    })
    gridLayer.addGraphic(graphic)
    gridLayer.enabledEvent = true

    // UTC 变化时，更新网格颜色（无需重新渲染）
    store.$subscribe(() => {
      const newHour = getCurrentIonoHour()
      if (newHour === currentHour) return
      if (!tecByHour[newHour]) return
      currentHour = newHour
      tecFlat = tecByHour[newHour]
      console.log(`[ionoGrid] 切换时次 → ${currentHour}h`)

      // 遍历更新每个网格的颜色（范围外保持隐藏）
      const instances = graphic.instances
      instances.forEach((inst, idx) => {
        const tec = tecAllByGridIdx[idx]?.[currentHour]
        if (tec !== undefined && !isNaN(tec)) {
          if (inst.attr?.inShenzhen) {
            inst.style.color = tecToColor(tec)
          }
          // 范围外网格保持 opacity=0，不更新颜色
        }
      })
      // 重新设置 instances 触发刷新
      graphic.instances = [...instances]
    })

    console.log(`[ionoGrid] 渲染完成: ${arrData.length} 个网格`)
  } catch (err) {
    console.error('[ionoGrid] 渲染失败:', err)
  } finally {
    store.setGridLoading(false)
    loading.value = false
    setTimeout(() => { ionoGridLoading = false }, 1000)
  }
}
import { getGridAndAttribute } from '@/api'
import { watch } from 'vue'

defineOptions({ name: 'MapPanel' })

/**
 * 上传 pos 文件后自动飞过去
 */
watch(
  () => store.posData,
  (newPosData) => {
    if (!newPosData || newPosData.length === 0) return
    const map = store.getMapInstance()
    if (!map) return

    const lonArr = newPosData.map((p) => p.lon)
    const latArr = newPosData.map((p) => p.lat)
    const lonMin = Math.min(...lonArr)
    const lonMax = Math.max(...lonArr)
    const latMin = Math.min(...latArr)
    const latMax = Math.max(...latArr)

    map.flyToPoint(
      new mars3d.LngLatPoint((lonMin + lonMax) / 2, (latMin + latMax) / 2, 200),
      {
        radius: Math.max(lonMax - lonMin, latMax - latMin) * 111000 * 1.2,
        duration: 1.5,
      },
    )
  },
)

/** 底图列表 */
const basemapList = [
  {
    id: 'arcgis-img', label: '影像', name: 'ArcGIS World Imagery',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
  },
  {
    id: 'arcgis-street', label: '街道', name: 'ArcGIS World Street Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'
  },
  {
    id: 'arcgis-topo', label: '地形', name: 'ArcGIS World Topo Map',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}'
  },
  {
    id: 'carto-dark', label: '深色', name: 'CartoDB Dark All',
    url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
  },
  {
    id: 'carto-voyager', label: 'Voyager', name: 'CartoDB Voyager',
    url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png'
  },
  {
    id: 'osm', label: 'OSM', name: 'OpenStreetMap',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png'
  },
]

const activeBasemap = ref('arcgis-img')

/** 切换底图：所有底图已预加载，setBasemap 控制哪层可见 */
function switchBasemap(id) {
  const map = store.getMapInstance()
  if (!map) return
  map.setBasemap(id)
  activeBasemap.value = id
}

// ===== 网格渲染工具函数 =====

/**
 * 计算两点间的地表距离（米）
 * 用于将经纬度偏移量 rlon/rlat 换算为 Cartesian3 的 dimensions
 */
function calculateEdgeLength(cartesian1, cartesian2) {
  return Cesium.Cartesian3.distance(cartesian1, cartesian2)
}

/**
 * 判断点是否在 szfw[0] 多边形范围内（射线法）
 * @param {number} lon - 经度
 * @param {number} lat - 纬度
 * @returns {boolean}
 */
function isPointInSzfw0(lon, lat) {
  const polygon = szfw[0]
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0], yi = polygon[i][1]
    const xj = polygon[j][0], yj = polygon[j][1]
    const intersect = ((yi > lat) !== (yj > lat)) && (lon < (xj - xi) * (lat - yi) / (yj - yi) + xi)
    if (intersect) inside = !inside
  }
  return inside
}

/**
 * 判断视图4角是否都在 szfw[0] 范围内
 * @param {Array} corners - [{lon, lat}, ...] 4角坐标
 * @returns {boolean} true=4角都在范围内
 */
function isViewWithinSzfw0(corners) {
  return corners.every(c => isPointInSzfw0(c.lon, c.lat))
}

/**
 * 渲染空域网格
 *
 * 将后端返回的网格数据以 BoxCombine（合并盒子）方式绘制到地图上。
 * - 绿色：attribute.B === 0（合规）
 * - 红色：attribute.B !== 0（不合规）
 * - 每个盒子尺寸由 rlon/rlat/height 决定，中心位置由 centerLongitude/centerLatitude/centerAltitude 决定
 *
 * @param {Array}   resData           - 后端返回的网格数组
 * @param {object}  airspaceGridLayer - Mars3D 图层实例
 */
function showAirspaceGridFormColor(resData = [], airspaceGridLayer = null) {
  if (!airspaceGridLayer) return

  // 清除旧数据
  airspaceGridLayer.clear()

  const arrData = []
  resData.forEach((grid) => {
    const centerLon = grid.centerLongitude
    const centerLat = grid.centerLatitude
    const position = new mars3d.LngLatPoint(centerLon, centerLat, grid.centerAltitude)

    // rlon/rlat 是经纬度偏移量，转成米用于 Cartesian3 dimensions
    const dlonlen = calculateEdgeLength(
      Cesium.Cartesian3.fromDegrees(centerLon - grid.rlon, centerLat, 0),
      Cesium.Cartesian3.fromDegrees(centerLon + grid.rlon, centerLat, 0),
    )
    const dlatlen = calculateEdgeLength(
      Cesium.Cartesian3.fromDegrees(centerLon, centerLat - grid.rlat),
      Cesium.Cartesian3.fromDegrees(centerLon, centerLat + grid.rlat),
    )

    arrData.push({
      position,
      style: {
        dimensions: new Cesium.Cartesian3(dlonlen, dlatlen, grid.height),
        color: grid?.attribute?.B === 0 ? Cesium.Color.GREEN : Cesium.Color.RED,
        opacity: 0.1,
      },
      attr: grid,
    })
  })

  // 合并渲染所有盒子，减少 draw call
  const graphic = new mars3d.graphic.BoxCombine({
    instances: arrData,
    style: {
      outline: true,
      outlineWidth: 1,
      outlineColor: 'white',
      outlineOpacity: 0.1,
    },
  })

  airspaceGridLayer.addGraphic(graphic)
  airspaceGridLayer.enabledEvent = true

  // 缓存网格数据，供 pos 轨迹高亮使用（用 splice 触发 Vue 响应式更新）
  store.gridCache.splice(0, store.gridCache.length, ...resData)
}

/** 轨迹图层（渲染 pos 轨迹和高亮网格） */
let trajectoryLayer = null
/** 防抖定时器 */
let trajectoryRenderTimer = null

/**
 * 渲染无人机轨迹：先画轨迹线 + 打印经纬度范围对比
 * 带防抖，防止连续点击
 */
async function renderTrajectory() {
  // 防抖：如果正在渲染中，忽略后续点击
  if (trajectoryRenderTimer) {
    console.log('[轨迹] 正在渲染中，跳过')
    return
  }

  const map = store.getMapInstance()
  if (!map) {
    console.error('[轨迹] map 实例不存在')
    return
  }

  // 设置防抖，1秒后清除标记
  trajectoryRenderTimer = setTimeout(() => {
    trajectoryRenderTimer = null
  }, 1000)

  const posData = store.posData
  const gridCache = store.gridCache
  if (!posData.length) {
    console.warn('[轨迹] posData 为空')
    return
  }

  // 创建 / 清空轨迹图层
  if (!trajectoryLayer) {
    trajectoryLayer = new mars3d.layer.GraphicLayer()
    map.addLayer(trajectoryLayer)
  }
  trajectoryLayer.clear()
  map.entities.removeAll() // 清除上次高亮的网格
  viewMode.value = 'trajectory' // 自动切换到无人机轨迹视图

  // 等待网格请求完成
  if (store.getGridLoading()) {
    console.log('[轨迹] 等待网格加载完成...')
    await new Promise(resolve => {
      const interval = setInterval(() => {
        if (!store.getGridLoading()) {
          clearInterval(interval)
          resolve()
        }
      }, 200)
    })
    console.log('[轨迹] 网格加载完成，开始渲染轨迹')
  }

  // ---- 视角飞到 pos 数据范围中心 ----
  const lonArr = posData.map((p) => p.lon)
  const latArr = posData.map((p) => p.lat)
  const posLonMin = Math.min(...lonArr)
  const posLonMax = Math.max(...lonArr)
  const posLatMin = Math.min(...latArr)
  const posLatMax = Math.max(...latArr)
  // 等视角飞完再渲染网格，避免动画期间加入导致第一次看不到
  await map.flyToPoint(
    new mars3d.LngLatPoint((posLonMin + posLonMax) / 2, (posLatMin + posLatMax) / 2, 200),
    {
      radius: Math.max(posLonMax - posLonMin, posLatMax - posLatMin) * 111000 * 1.2,
      duration: 1.5,
    },
  )

  let gridLonMin = 0, gridLonMax = 0, gridLatMin = 0, gridLatMax = 0
  if (gridCache.length) {
    gridLonMin = Math.min(...gridCache.map((g) => g.centerLongitude))
    gridLonMax = Math.max(...gridCache.map((g) => g.centerLongitude))
    gridLatMin = Math.min(...gridCache.map((g) => g.centerLatitude))
    gridLatMax = Math.max(...gridCache.map((g) => g.centerLatitude))
  }

  console.log(
    `[轨迹] pos 经度范围: [${posLonMin.toFixed(6)}, ${posLonMax.toFixed(6)}]  |  pos 纬度范围: [${posLatMin.toFixed(6)}, ${posLatMax.toFixed(6)}]`,
  )
  console.log(
    `[轨迹] 网格经度范围: [${gridLonMin.toFixed(6)}, ${gridLonMax.toFixed(6)}]  |  网格纬度范围: [${gridLatMin.toFixed(6)}, ${gridLatMax.toFixed(6)}]`,
  )
  console.log(
    `[轨迹] 第1个 pos 点 lon=${lonArr[0].toFixed(6)}, lat=${latArr[0].toFixed(6)}`,
  )
  if (gridCache.length) {
    const firstGrid = gridCache[0]
    console.log(
      `[轨迹] 第1个网格 lon=${firstGrid.centerLongitude.toFixed(6)}, lat=${firstGrid.centerLatitude.toFixed(6)}, rlon=${firstGrid.rlon}m, rlat=${firstGrid.rlat}m`,
    )
  }

  if (!gridCache.length) {
    console.warn('[轨迹] gridCache 为空，请先确保网格已加载')
    return
  }

  // ---- 网格高亮（仅当 pos 与网格区域有明显重叠时）----
  const matchedGrids = new Set()

  posData.forEach(({ lon, lat }) => {
    // rlon/rlat 本身就是度数（约等于 gridSizeDeg/2），直接用，不用再转
    gridCache.forEach((grid) => {
      const halfLonDeg = grid.rlon
      const halfLatDeg = grid.rlat
      if (
        lon >= grid.centerLongitude - halfLonDeg &&
        lon <= grid.centerLongitude + halfLonDeg &&
        lat >= grid.centerLatitude - halfLatDeg &&
        lat <= grid.centerLatitude + halfLatDeg
      ) {
        matchedGrids.add(grid)
      }
    })
  })

  // ---- 渲染蓝色匹配网格 ----
  matchedGrids.forEach((grid) => {
    const centerLon = grid.centerLongitude
    const centerLat = grid.centerLatitude

    // 用 Cesium.Entity + box Graphics（标准 Cesium 方式，BoxEntity 可能不存在）
    // rlon/rlat 是度数，转成米用于 Cesium.Cartesian3 dimensions
    const degPerMeterLon = 111320 * Math.cos((centerLat * Math.PI) / 180)
    const degPerMeterLat = 111320
    const boxW = grid.rlon * 2 * degPerMeterLon
    const boxD = grid.rlat * 2 * degPerMeterLat

    const entity = new Cesium.Entity({
      position: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, grid.centerAltitude ?? 0),
      box: {
        dimensions: new Cesium.Cartesian3(boxW, boxD, grid.height ?? 20),
        fill: true,
        material: Cesium.Color.CORNFLOWERBLUE.withAlpha(0.4),
        outline: true,
        outlineColor: Cesium.Color.CORNFLOWERBLUE,
      },
    })
    map.entities.add(entity)
  })

  // ---- 采样抽稀：每 20 个点连一条线 ----
  // const step = 20
  // let sampledIndices = posData.map((_, i) => i).filter((i) => i % step === 0)
  // // 确保最后一个点也被包含
  // if (sampledIndices[sampledIndices.length - 1] !== posData.length - 1) {
  //   sampledIndices.push(posData.length - 1)
  // }
  // const sampledPoints = sampledIndices.map((i) => posData[i])

  // // 绘制轨迹线
  // const positions = sampledPoints.map(
  //   (p) => new mars3d.LngLatPoint(p.lon, p.lat, p.alt ?? 0)
  // )
  // const polylineEntity = new mars3d.graphic.PolylinePrimitive({
  //   positions,
  //   style: {
  //     color: '#ff4444',
  //     width: 2,
  //     opacity: 0.8,
  //     clampToGround: true,
  //   },
  // })
  // trajectoryLayer.addGraphic(polylineEntity)

  // console.log(`[轨迹] 命中网格 ${matchedGrids.size} 个，轨迹点 ${posData.length} 个，采样后 ${sampledPoints.length} 个`)
}

// ===== 网格图层动态更新 =====

/** 防抖定时器句柄 */
let gridUpdateTimer = null
/** 电离层网格加载期间，屏蔽 cameraChanged 触发的自动请求 */
let ionoGridLoading = false
/** 上一次请求使用的 layer，防止重复请求 */
let lastGridLayer = null

/** 上一次的视图状态，用于判断是否需要重新请求 */
let lastViewState = { span: 0 }

/**
 * 根据视野跨度计算 level
 * 层级越低 = 视野越大 = 网格越稀疏
 * 层级越高 = 视野越小 = 网格越密集
 * @param {number} span - 视野跨度（度）
 * @returns {number} level
 */
function calcLevelBySpan(span) {
  if (span >= 1.0) return 5
  if (span >= 0.3) return 6
  if (span >= 0.1) return 7
  if (span >= 0.05) return 8
  if (span >= 0.02) return 9
  if (span >= 0.01) return 10
  if (span >= 0.005) return 11
  if (span >= 0.003) return 12
  if (span >= 0.002) return 13
  if (span >= 0.001) return 14
  if (span >= 0.0005) return 15
  return 16
}

/**
 * 视图变化时重新请求网格数据（带防抖和去重）
 * 仅在缩放或平移时触发，角度变化不触发
 * @param {object} map - Mars3D 地图实例
 */
function updateGridByCamera(map) {
  // 电离层网格模式下，完全禁用缩放自动查询
  if (viewMode.value === 'grid') return
  // 电离层网格加载期间，屏蔽自动请求
  if (ionoGridLoading) return
  if (gridUpdateTimer) clearTimeout(gridUpdateTimer)
  gridUpdateTimer = setTimeout(async () => {
    const rect = map.scene.camera.computeViewRectangle()
    if (!rect) return

    const { west, south, east, north } = rect
    const spanLon = (east - west) * (180 / Math.PI)
    const spanLat = (north - south) * (180 / Math.PI)
    const span = Math.max(spanLon, spanLat)

    // 计算中心点
    // 计算当前 level
    const level = calcLevelBySpan(span)

    // 判断是否需要重新请求：
    // 1. level 变化（缩放）
    // 2. 平移（span 变化超过 0.001°）
    const levelChanged = level !== lastGridLayer
    const spanChanged = Math.abs(span - lastViewState.span) > 0.001

    if (!levelChanged && !spanChanged) {
      console.log(`[cameraChanged] 仅角度变化，跳过`)
      return
    }

    // 更新状态
    lastGridLayer = level
    lastViewState.span = span

    console.log(`[cameraChanged] span=${span.toFixed(4)}° level=${level} ${spanChanged && !levelChanged ? '平移' : '缩放'} 请求网格`)
    await loadGrid(map)
  }, 500)
}

/**
 * 发起网格请求
 * @param {object} map - Mars3D 地图实例
 */
async function loadGrid(map) {
  const gridLayer = store.getAirspaceGridLayer()
  if (!gridLayer) return

  store.setGridLoading(true)
  loading.value = true

  // 至少展示 400ms，避免 camera 事件触发早于地图 ready 时闪烁
  await new Promise(r => setTimeout(r, 400))

  try {
    const rect = map.scene.camera.computeViewRectangle()
    if (!rect) return

    const { west, south, east, north } = rect
    const spanLon = (east - west) * (180 / Math.PI)
    const spanLat = (north - south) * (180 / Math.PI)
    const span = Math.max(spanLon, spanLat)

    let level, cube
    const corners = getScreenCorners(map)
    const levelBySpan = calcLevelBySpan(span)

    // 无法获取有效的4角坐标时，才 fallback 到 szfw[0]
    if (corners.length < 4) {
      console.warn('[szfwGrid] 屏幕四角坐标获取不足，使用 szfw[0]')
      level = levelBySpan
      cube = szfw[0]
    } else {
      level = levelBySpan
      // 始终用4角坐标（闭合多边形），格式: [{ longitude, latitude }, ...]
      const pts = corners.map(c => ({ longitude: c.lon, latitude: c.lat }))
      cube = [...pts, pts[0]]
    }

    console.log(`[szfwGrid] span=${span.toFixed(4)}° level=${level} cube=${Array.isArray(cube[0]) ? '4角' : 'szfw[0]'}`)

    gridLayer.clear()
    const data = await getGridAndAttribute({ cube, layer: level })
    console.log(`[szfwGrid] level=${level} 请求成功:`, data)
    if (data && data.data) {
      showAirspaceGridFormColor(data.data, gridLayer)
    }
  } catch (err) {
    console.error(`[szfwGrid] level=${level} 请求失败:`, err)
  } finally {
    store.setGridLoading(false)
    loading.value = false
  }
}

/**
 * 获取屏幕4角经纬度
 * @param {object} map - Mars3D 地图实例
 * @returns {Array} [{lon, lat}, ...] 4角坐标
 */
function getScreenCorners(map) {
  const canvas = map.scene.canvas
  const w = canvas.clientWidth
  const h = canvas.clientHeight
  const screenPoints = [
    { x: 0, y: 0 },           // 左上
    { x: w, y: 0 },           // 右上
    { x: w, y: h },           // 右下
    { x: 0, y: h },           // 左下
  ]
  return screenPoints.map(({ x, y }) => {
    const ray = map.scene.camera.getPickRay({ x, y })
    const cartesian = map.scene.globe.pick(ray, map.scene)
    if (!cartesian) return null
    const c = Cesium.Cartographic.fromCartesian(cartesian)
    return {
      lon: Cesium.Math.toDegrees(c.longitude),
      lat: Cesium.Math.toDegrees(c.latitude),
    }
  }).filter(Boolean)
}

// ===== 数据请求 =====

/**
 * 获取深圳范围网格数据并渲染
 * 根据视野跨度自动判断层级和cube参数
 */
const getszfwGrid = async () => {
  const map = store.getMapInstance()
  if (!map) return
  await loadGrid(map)
}
/**
 * 地图初始化
 *
 * Mars3D 地图必须在 DOM 元素挂载后才能创建（需要获取容器 div）。
 * 地图实例注册到 store，供其他组件（轨迹渲染等）通过 store.getMapInstance() 获取。
 * terrain.show = false：不加载地形，保持 2D 底图显示。
 */
onMounted(() => {
  const mapInstance = new mars3d.Map('mars3dContainer', {
    scene: {
      show: true,
      // 初始定位到深圳
      center: { lng: 114.05, lat: 22.55, alt: 10000, heading: 0, },
    },
    basemaps: [
      {
        id: 'arcgis-img', name: 'ArcGIS World Imagery',
        type: 'xyz', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        show: true,
      },
      {
        id: 'arcgis-street', name: 'ArcGIS World Street Map',
        type: 'xyz', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        show: false,
      },
      {
        id: 'arcgis-topo', name: 'ArcGIS World Topo Map',
        type: 'xyz', url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        show: false,
      },
      {
        id: 'carto-dark', name: 'CartoDB Dark All',
        type: 'xyz', url: 'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        show: false,
      },
      {
        id: 'carto-voyager', name: 'CartoDB Voyager',
        type: 'xyz', url: 'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
        show: false,
      },
      {
        id: 'osm', name: 'OpenStreetMap',
        type: 'xyz', url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        show: false,
      },
    ],
    terrain: { show: false },
    control: {
      locationBar: { fps: true },
      toolBar: { left: '10px', top: '10px' },
    },
  })
  store.setMapInstance(mapInstance)

  // 创建空域网格图层
  const gridLayer = new mars3d.layer.GraphicLayer()
  mapInstance.addLayer(gridLayer)
  store.setAirspaceGridLayer(gridLayer)

  // 监听相机变化，缩放时动态更新网格 layer
  mapInstance.on(mars3d.EventType.cameraChanged, () => updateGridByCamera(mapInstance))

  // 地图初始化后请求网格数据
  getszfwGrid()
})

/**
 * 组件销毁时销毁地图实例
 * 避免地图 WebGL 上下文泄露和内存占用。
 */
onUnmounted(() => {
  if (gridUpdateTimer) clearTimeout(gridUpdateTimer)
  const inst = store.getMapInstance()
  if (inst) { inst.destroy(); store.setMapInstance(null) }
  store.setAirspaceGridLayer(null)
})
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

.map-container {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
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

    >span {
      flex-shrink: 0;
    }

    .section-toggle {
      display: flex;
      margin-left: auto;
      border: 1px solid $border;
      border-radius: 6px;
      overflow: hidden;

      button {
        padding: 4px 12px;
        font-size: 12px;
        font-weight: 500;
        border: none;
        background: transparent;
        color: $text-secondary;
        cursor: pointer;
        transition: all 0.15s;

        &:not(:last-child) {
          border-right: 1px solid $border;
        }

        &.active {
          background: $accent;
          color: #fff;
        }

        &:hover:not(.active) {
          background: rgba($accent, 0.08);
          color: $accent;
        }
      }
    }

    .btn-trajectory {
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 500;
      border: 1px solid $accent;
      border-radius: 6px;
      background: transparent;
      color: $accent;
      cursor: pointer;
      transition: all 0.15s;
      margin-left: 8px;

      &:hover:not(:disabled) {
        background: $accent;
        color: #fff;
      }

      &:disabled {
        opacity: 0.35;
        cursor: not-allowed;
        border-color: $border;
        color: $text-secondary;
      }
    }
  }
}

.mars3d-container {
  flex: 1;
  min-height: 0;
}

// 底图切换按钮组
.basemap-switcher {
  display: flex;
  gap: 4px;
  margin-left: auto;
  align-items: center;

  .basemap-btn {
    padding: 3px 8px;
    border-radius: $radius-sm;
    border: 1px solid $border;
    background: $bg-elevated;
    color: $text-secondary;
    font-size: 11.5px;
    cursor: pointer;
    transition: all 0.15s;
    white-space: nowrap;

    &:hover {
      background: $bg-hover;
      color: $text-primary;
      border-color: $accent;
    }

    &.active {
      background: $accent;
      border-color: $accent;
      color: #fff;
      font-weight: 600;
    }
  }
}

// 网格加载中
.grid-loading {
  position: absolute;
  top: 12px;
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 14px;
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid $border;
  border-radius: 20px;
  color: $text-secondary;
  font-size: 12px;
  pointer-events: none;
  z-index: 10;

  .grid-loading-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $accent;
    animation: pulse 1s ease-in-out infinite;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.4; transform: scale(0.7); }
}

// TEC 色标
.tec-colorbar {
  position: absolute;
  right: 16px;
  top: 50%;
  transform: translateY(-50%);
  background: rgba(0, 0, 0, 0.75);
  border: 1px solid $border;
  border-radius: 8px;
  padding: 10px 12px;
  z-index: 10;
  pointer-events: none;
  user-select: none;

  .colorbar-title {
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: $text-secondary;
    margin-bottom: 6px;
  }

  .colorbar-bar {
    display: flex;
    gap: 6px;
  }

  .colorbar-gradient {
    width: 16px;
    height: 180px;
    border-radius: 4px;
    background: linear-gradient(to bottom, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff);
  }

  .colorbar-labels {
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    height: 180px;
    font-size: 10.5px;
    color: $text-secondary;
  }
}
</style>
