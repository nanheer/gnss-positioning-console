/**
 * 网格几何数据
 *
 * 两种数据来源：
 *   1）配置了 VITE_GRID_API_BASE 时，调用外部网格服务（POST {base}/getGridAndAttribute）；
 *   2）未配置时，按传入的经纬度范围在本地生成规则网格，开箱即可运行。
 *
 * 单个网格单元的字段约定：
 *   centerLongitude / centerLatitude  网格中心经纬度（度）
 *   rlon / rlat                       网格半宽 / 半高（度）
 *   height                            网格高度（米）
 *   centerAltitude                    网格中心高度（米）
 *   attribute.B                       业务属性（0 表示空闲，非 0 表示占用）
 */

const GRID_API_BASE = (import.meta.env.VITE_GRID_API_BASE || '').replace(/\/+$/, '')
const GRID_API_TOKEN = import.meta.env.VITE_GRID_API_TOKEN || ''

/** 默认网格行列数 */
const DEFAULT_ROWS = 20
const DEFAULT_COLS = 30

/** 默认网格高度与中心高度（米），与电离层可视化层保持一致 */
const DEFAULT_HEIGHT = 200000
const DEFAULT_ALTITUDE = 350000

function clampInt(value, min, max, fallback) {
  const n = Number(value)
  if (!Number.isFinite(n)) return fallback
  return Math.max(min, Math.min(max, Math.round(n)))
}

/**
 * 在本地按经纬度范围生成规则网格
 * @param {object} opts
 * @param {Array}  opts.cube     - 经纬度点数组 [{ longitude, latitude }, ...]
 * @param {number} [opts.rows]   - 行数（纬度方向）
 * @param {number} [opts.cols]   - 列数（经度方向）
 * @returns {Array} 网格单元数组
 */
export function buildLocalGrid({ cube = [], rows = DEFAULT_ROWS, cols = DEFAULT_COLS } = {}) {
  const lons = cube.map((p) => Number(p.longitude)).filter(Number.isFinite)
  const lats = cube.map((p) => Number(p.latitude)).filter(Number.isFinite)
  if (!lons.length || !lats.length) return []

  const west = Math.min(...lons)
  const east = Math.max(...lons)
  const south = Math.min(...lats)
  const north = Math.max(...lats)
  if (!(east > west) || !(north > south)) return []

  const cellW = (east - west) / cols
  const cellH = (north - south) / rows
  const data = []

  // 行按纬度升序、列按经度升序，便于与 .txt 的行列顺序一一对应
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      data.push({
        centerLongitude: west + cellW * (c + 0.5),
        centerLatitude: south + cellH * (r + 0.5),
        rlon: cellW / 2,
        rlat: cellH / 2,
        height: DEFAULT_HEIGHT,
        centerAltitude: DEFAULT_ALTITUDE,
        attribute: { B: 0 },
      })
    }
  }
  return data
}

/**
 * 获取网格及属性数据
 * @param {object} params
 * @param {Array}  params.cube        - 坐标点数组 [{ longitude, latitude }, ...]
 * @param {number} [params.layer]     - 图层层级（传给外部服务，用于控制网格密度）
 * @param {number} [params.rows]      - 本地生成时的行数
 * @param {number} [params.cols]      - 本地生成时的列数
 * @returns {Promise<{ data: Array }>}
 */
export async function getGridAndAttribute(params = {}) {
  const { rows, cols, ...rest } = params

  if (GRID_API_BASE) {
    const headers = { 'Content-Type': 'application/json;charset=UTF-8' }
    if (GRID_API_TOKEN) headers.Authorization = GRID_API_TOKEN

    const resp = await fetch(`${GRID_API_BASE}/getGridAndAttribute`, {
      method: 'POST',
      headers,
      body: JSON.stringify(rest),
    })
    if (!resp.ok) {
      throw new Error(`网格服务请求失败 ${resp.status}`)
    }
    return resp.json()
  }

  return {
    data: buildLocalGrid({
      cube: rest.cube,
      rows: clampInt(rows, 1, 200, DEFAULT_ROWS),
      cols: clampInt(cols, 1, 200, DEFAULT_COLS),
    }),
  }
}

export default { getGridAndAttribute, buildLocalGrid }
