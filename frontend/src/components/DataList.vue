<template>
  <section class="panel-section chart-section">
    <div class="section-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
      <span>数据列表</span>
      <div class="epoch-nav">
        <button class="nav-btn play-btn" @click="store.togglePlay()"
          :disabled="store.epochList.length === 0"
          :class="{ active: store.isPlaying }"
          :title="store.isPlaying ? '暂停' : '播放'">
          <svg v-if="store.isPlaying" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <rect x="6" y="4" width="4" height="16" rx="1"/>
            <rect x="14" y="4" width="4" height="16" rx="1"/>
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
            <polygon points="5 3 19 12 5 21 5 3"/>
          </svg>
        </button>
        <button class="nav-btn" @click="store.setActiveEpoch(Math.max(0, store.activeIndex - 1))"
          :disabled="store.epochList.length === 0">◀</button>
        <span class="epoch-counter">{{ store.activeIndex + 1 }} / {{ store.epochList.length }}</span>
        <button class="nav-btn"
          @click="store.setActiveEpoch(Math.min(store.epochList.length - 1, store.activeIndex + 1))"
          :disabled="store.epochList.length === 0">▶</button>
      </div>
    </div>

    <!--
      虚拟滚动：只渲染可见行，不一次性塞 2000+ DOM 节点
      keyField 标识每行唯一性，itemSize 固定行高（42px）供虚拟算法计算
      当历元切换时 items 整体替换，RecycleScroller 自动重置滚动位置
    -->
    <RecycleScroller v-if="epochItems.length > 0" class="scroller" :items="epochItems" :item-size="42"
      key-field="sat" v-slot="{ item }">
      <div class="table-row">
        <span class="td-sat">{{ item.sat }}</span>
        <span class="td-val">{{ item.col2 }}</span>
        <span class="td-val">{{ item.col3 }}</span>
        <span class="td-val">{{ item.col4 }}</span>
        <span class="td-val">{{ item.col5 }}</span>
      </div>
    </RecycleScroller>

    <div v-else class="empty-hint">暂无数据</div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { storeToRefs } from 'pinia'
import { RecycleScroller } from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import { useAppStore } from '@/store/app'

defineOptions({ name: 'DataList' })
const store = useAppStore()

// 只追踪 activeIndex 引用，不追踪卫星数据数组内部变化
const { activeIndex } = storeToRefs(store)

const epochItems = computed(() => store.currentEpochSatellites)

/**
 * 历元表格当前显示内容由 store.currentEpochSatellites 驱动（computed）。
 * 内容 = store.epochList[store.activeIndex] 中过滤后的卫星数据（C02-C05 + 第一条 G）。
 *
 * 历元导航：
 *   - ◀ / ▶ 按钮：点击后调用 store.setActiveEpoch()，同步更新 UTC 参数并触发 computed 重算
 *   - 播放逻辑：store.togglePlay() 在 .O 文件上传时由 store 自动触发（initEpochList 中调用）
 *   - 手动翻页时播放不会自动停止，用户可随时手动控制
 *
 * 虚拟滚动优化：
 *   - RecycleScroller 只渲染可视区域内的行（每行 42px），2400+ 行时只渲染 ~10 行 DOM
 *   - 历元切换时 items 整体替换，RecycleScroller 自动 reset
 */
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

.chart-section {
  height: 300px;
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
    flex-shrink: 0;

    svg { color: $accent; flex-shrink: 0; }
  }
}

/* 虚拟滚动容器，必须设高度 */
.scroller {
  flex: 1;
  overflow-y: auto;
  overflow-x: auto;

  &::-webkit-scrollbar { width: 5px; height: 5px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb { background: $border; border-radius: 4px; }
  &::-webkit-scrollbar-thumb:hover { background: $border-light; }
}

/* 固定行高 42px，与 RecycleScroller :item-size="42" 保持一致 */
.table-row {
  height: 42px;
  display: flex;
  align-items: center;
  border-bottom: 1px solid rgba($border, 0.4);
  transition: background 0.1s;
  cursor: default;

  &:hover { background: $bg-hover; }

  .td-sat {
    min-width: 80px;
    text-align: center;
    color: $accent;
    font-weight: 500;
    font-size: 12.5px;
    flex-shrink: 0;
    padding: 0 4px;
  }

  .td-val {
    flex: 1;
    font-size: 12.5px;
    font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
    color: $text-primary;
    padding: 0 10px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    min-width: 0;
  }
}

.empty-hint {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: $text-muted;
  font-size: 12px;
}

.epoch-nav {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-left: auto;
}

.epoch-counter {
  font-size: 11.5px;
  color: $accent;
  font-family: 'SF Mono', 'Cascadia Code', 'Consolas', monospace;
  min-width: 60px;
  text-align: center;
}

.nav-btn {
  background: $bg-elevated;
  border: 1px solid $border;
  color: $text-primary;
  border-radius: 4px;
  padding: 2px 8px;
  cursor: pointer;
  font-size: 12px;
  transition: background 0.15s, border-color 0.15s;

  &:hover:not(:disabled) {
    background: $bg-hover;
    border-color: $accent;
    color: $accent;
  }

  &:disabled { opacity: 0.35; cursor: not-allowed; }
}

.play-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 26px;
  padding: 0;
  color: $text-muted;

  &.active {
    color: $accent;
    border-color: $accent;
    background: rgba($accent, 0.1);
  }

  &:hover:not(:disabled) {
    color: $accent;
    border-color: $accent;
  }
}
</style>
