<template>
  <section class="panel-section chart-panel">
    <div class="section-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <span>误差分析</span>
      <div class="header-actions">
        <!-- <span v-if="posData.length" class="epoch-count">{{ posData.length }} 历元</span>
        <div class="legend-toggles">
          <button
            v-for="item in SERIES_CONFIG"
            :key="item.key"
            class="legend-btn"
            :class="{ active: visibleSeries.has(item.key) }"
            :style="{ '--series-color': item.color }"
            @click="toggleSeries(item.key)"
            :title="item.label"
          >{{ item.label }}</button>
        </div>
        <button class="action-btn" @click="clearData" title="清除数据">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6l-1 14H6L5 6" />
            <path d="M10 11v6M14 11v6" />
          </svg>
        </button> -->
      </div>
    </div>

    <!-- 无 pos 数据时显示提示 -->
    <div v-if="!posData.length" class="chart-empty">
      <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <p>加载 .pos 文件后显示误差曲线</p>
      <p class="hint">上传位置 → 第五槽位 (.pos)</p>
    </div>

    <div v-else class="chart-wrapper">
      <v-chart class="params-chart" :option="chartOption" autoresize />
    </div>

    <!-- 底部图例徽章 -->
    <div v-if="posData.length" class="params-footer">
      <div v-for="item in SERIES_CONFIG" :key="item.key" class="param-badge">
        <span class="badge-dot" :style="{ background: item.color }"></span>
        <span class="badge-label">{{ item.label }}</span>
        <span class="badge-value">{{ currentValues[item.key] ?? '—' }}</span>
      </div>
    </div>
  </section>
</template>

<script setup>
import { ref, computed, watch } from 'vue'
import { storeToRefs } from 'pinia'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { useAppStore } from '@/store/app'

use([CanvasRenderer, LineChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, MarkLineComponent])

defineOptions({ name: 'ChartPanel' })
const store = useAppStore()
const { posData } = storeToRefs(store)

// ── 配置 ──────────────────────────────────────────────
const SERIES_CONFIG = [
  { key: 'sdn',   label: 'sdn(m)',   color: '#58a6ff' },
  { key: 'sde',   label: 'sde(m)',   color: '#3fb950' },
  { key: 'sdu',   label: 'sdu(m)',   color: '#f0883e' },
  { key: 'sdne',  label: 'sdne(m)',  color: '#a371f7' },
  { key: 'sdeu',  label: 'sdeu(m)',  color: '#ff7b72' },
  { key: 'sdun',  label: 'sdun(m)',  color: '#8b949e' },
]

// ── 系列显示开关 ──────────────────────────────────────
const visibleSeries = ref(new Set(SERIES_CONFIG.map(s => s.key)))

function toggleSeries(key) {
  const s = visibleSeries.value
  if (s.has(key)) {
    if (s.size > 1) s.delete(key) // 至少保留一条
  } else {
    s.add(key)
  }
}

// ── 时间轴 + 每条线数据 ────────────────────────────────
const timeLabels = ref([])
const seriesData  = ref({ sdn: [], sde: [], sdu: [], sdne: [], sdeu: [], sdun: [] })

function buildChartData(data) {
  timeLabels.value = []
  SERIES_CONFIG.forEach(({ key }) => { seriesData.value[key] = [] })

  if (!data.length) return

  for (const pt of data) {
    // 只保留 HH:MM:SS 方便显示
    timeLabels.value.push(pt.time.slice(11, 19))
    SERIES_CONFIG.forEach(({ key }) => {
      const v = pt[key]
      seriesData.value[key].push(v != null ? +v.toFixed(4) : null)
    })
  }
}

// posData 变化时自动重算
watch(posData, (val) => { buildChartData(val) }, { immediate: true })

// ── 当前最新值（底部徽章） ──────────────────────────────
const currentValues = computed(() => {
  const result = {}
  SERIES_CONFIG.forEach(({ key }) => {
    const arr = seriesData.value[key]
    const last = arr.length ? arr[arr.length - 1] : null
    result[key] = last
  })
  return result
})

// ── ECharts 配置 ──────────────────────────────────────
const chartOption = computed(() => {
  const visible = SERIES_CONFIG.filter(s => visibleSeries.value.has(s.key))
  const minY = -0.05
  const maxY = visible.length ? Math.max(...visible.map(s => {
    const arr = seriesData.value[s.key]
    return arr.length ? Math.max(...arr.filter(v => v != null)) : 0
  }), 0.05) : 0.1

  return {
    backgroundColor: 'transparent',
    animation: false,
    grid: { top: 24, right: 16, bottom: 48, left: 52, containLabel: false },

    tooltip: {
      trigger: 'axis',
      backgroundColor: '#1c2128',
      borderColor: '#30363d',
      borderWidth: 1,
      textStyle: { color: '#e6edf3', fontSize: 12, fontFamily: "'SF Mono', monospace" },
      formatter(params) {
        let html = `<div style="font-weight:600;margin-bottom:5px;font-size:11px;color:#8b949e">${params[0]?.axisValue ?? ''}</div>`
        params.forEach(p => {
          if (p.value == null) return
          html += `<div style="display:flex;align-items:center;gap:8px;margin:2px 0">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${p.color}"></span>
            <span style="flex:1;color:#8b949e">${p.seriesName}</span>
            <span style="font-weight:700;color:#e6edf3;margin-left:12px">${p.value.toFixed(4)}</span>
          </div>`
        })
        return html
      },
    },

    legend: { show: false },

    xAxis: {
      type: 'category',
      boundaryGap: false,
      data: timeLabels.value,
      axisLine:  { lineStyle: { color: '#30363d' } },
      axisTick:  { lineStyle: { color: '#30363d' } },
      splitLine: { show: false },
      axisLabel: {
        color: '#6e7681',
        fontSize: 10,
        fontFamily: "'SF Mono', monospace",
        interval: Math.max(0, Math.floor(timeLabels.value.length / 8) - 1),
        rotate: timeLabels.value.length > 10 ? 30 : 0,
      },
    },

    yAxis: {
      type: 'value',
      min: minY,
      max: maxY,
      axisLine:  { show: true, lineStyle: { color: '#30363d' } },
      axisTick:  { show: true, lineStyle: { color: '#30363d' } },
      splitLine: { lineStyle: { color: '#21262d', type: 'dashed' } },
      axisLabel: {
        color: '#8b949e',
        fontSize: 10,
        fontFamily: "'SF Mono', monospace",
        formatter: v => v.toFixed(3),
      },
      markLine: {
        silent: true,
        symbol: 'none',
        lineStyle: { color: '#484f58', type: 'solid', width: 1 },
        data: [{ yAxis: 0 }],
        label: { show: false },
      },
    },

    series: SERIES_CONFIG.map(({ key, label, color }) => ({
      name: label,
      type: 'line',
      smooth: false,
      symbol: 'none',
      lineStyle: { width: key.startsWith('sd') && key.length > 3 ? 1 : 1.5, color, type: key.startsWith('sd') && key.length > 3 ? 'dashed' : 'solid' },
      itemStyle: { color },
      data: seriesData.value[key],
      connectNulls: false,
    })),

    dataZoom: [
      { type: 'inside', xAxisIndex: 0 },
      {
        type: 'slider',
        xAxisIndex: 0,
        height: 16,
        bottom: 4,
        borderColor: '#30363d',
        backgroundColor: '#161b22',
        fillerColor: 'rgba(88,166,255,0.12)',
        handleStyle: { color: '#58a6ff', borderColor: '#58a6ff' },
        textStyle: { color: '#6e7681', fontSize: 9 },
      },
    ],
  }
})

function clearData() {
  timeLabels.value = []
  SERIES_CONFIG.forEach(({ key }) => { seriesData.value[key] = [] })
}
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

.chart-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.panel-section {
  background: $bg-surface;
  border: 1px solid $border;
  border-radius: $radius;
}

.section-header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 16px;
  height: 42px;
  border-bottom: 1px solid $border;
  font-size: 13px;
  font-weight: 600;
  color: $text-primary;
  letter-spacing: 0.3px;
  flex-shrink: 0;

  svg { color: $accent; flex-shrink: 0; }

  .header-actions {
    margin-left: auto;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: nowrap;
    overflow: hidden;

    .epoch-count {
      font-size: 11px;
      color: $text-muted;
      font-family: 'SF Mono', monospace;
      padding: 2px 8px;
      background: $bg-elevated;
      border: 1px solid $border;
      border-radius: 20px;
      flex-shrink: 0;
    }

    .legend-toggles {
      display: flex;
      gap: 4px;
      flex-wrap: nowrap;
    }

    .legend-btn {
      font-size: 10px;
      font-family: 'SF Mono', monospace;
      padding: 2px 7px;
      border-radius: 20px;
      border: 1px solid var(--series-color);
      color: var(--series-color);
      background: transparent;
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;

      &.active {
        background: color-mix(in srgb, var(--series-color) 15%, transparent);
      }
      &:hover { opacity: 0.8; }
    }

    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 26px; height: 26px;
      background: transparent;
      border: 1px solid $border;
      border-radius: $radius-sm;
      color: $text-muted;
      cursor: pointer;
      transition: all 0.15s;
      flex-shrink: 0;
      &:hover { background: $bg-hover; color: $danger; border-color: $danger; }
      &:active { transform: scale(0.93); }
    }
  }
}

.chart-wrapper {
  flex: 1;
  min-height: 0;
  padding: 8px 4px 0;
  .params-chart { width: 100%; height: 100%; }
}

.chart-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: $text-muted;

  svg { color: $border; }

  p {
    font-size: 13px;
    margin: 0;
    &.hint { font-size: 11px; color: $text-muted; opacity: 0.6; }
  }
}

.params-footer {
  display: flex;
  align-items: center;
  justify-content: space-around;
  gap: 4px;
  padding: 8px 10px;
  border-top: 1px solid $border;
  flex-shrink: 0;
  overflow-x: auto;
  &::-webkit-scrollbar { display: none; }
}

.param-badge {
  display: flex;
  align-items: center;
  gap: 5px;
  flex-shrink: 0;
  padding: 4px 8px;
  background: $bg-elevated;
  border: 1px solid $border;
  border-radius: 20px;

  .badge-dot   { width: 7px; height: 7px; border-radius: 50%; flex-shrink: 0; }
  .badge-label { font-size: 10px; color: $text-muted; font-family: 'SF Mono', monospace; }
  .badge-value { font-size: 11px; color: $text-primary; font-family: 'SF Mono', monospace; font-weight: 700; }
}
</style>
