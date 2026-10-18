<template>
  <section class="panel-section params-section">
    <div class="section-header">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="3"/>
        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
      </svg>
      <span>定位结果</span>
    </div>

    <!-- UTC 单独一行 -->
    <div class="utc-row">
      <label class="utc-label">UTC</label>
      <input v-model="utcParam.value" type="text" class="utc-input" placeholder="—" readonly />
    </div>

    <!-- 其余参数网格 -->
    <div class="params-grid">
      <div v-for="param in otherParams" :key="param.key" class="param-item">
        <label class="param-label">{{ param.label }}</label>
        <input v-model="param.value" type="text" class="param-input" placeholder="—" />
      </div>
    </div>
  </section>
</template>

<script setup>
import { computed } from 'vue'
import { useAppStore } from '@/store/app'

defineOptions({ name: 'ParamsConfig' })
const store = useAppStore()

const utcParam = computed(() => store.params.find(p => p.key === 'UTC'))
const otherParams = computed(() => store.params.filter(p => p.key !== 'UTC'))
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

.params-section {
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
    height: 42px;
    border-bottom: 1px solid $border;
    font-size: 13px;
    font-weight: 600;
    color: $text-primary;
    letter-spacing: 0.3px;
    flex-shrink: 0;

    svg { color: $accent; flex-shrink: 0; }
  }
}

// UTC 单独一行
.utc-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 16px;
  border-bottom: 1px solid $border;
  background: rgba($accent, 0.03);
  flex-shrink: 0;
}

.utc-label {
  font-size: 12px;
  color: $accent;
  font-weight: 600;
  font-family: 'SF Mono', monospace;
  flex-shrink: 0;
  letter-spacing: 0.5px;
}

.utc-input {
  flex: 1;
  background: transparent;
  border: none;
  border-bottom: 1px solid rgba($accent, 0.3);
  color: $text-primary;
  font-size: 13px;
  font-family: 'SF Mono', monospace;
  font-weight: 600;
  padding: 2px 4px;
  outline: none;
  letter-spacing: 0.5px;
  transition: border-color 0.2s;

  &:focus { border-bottom-color: $accent; }
  &::placeholder { color: $text-muted; font-weight: 400; }
}

// 其余参数网格
.params-grid {
  flex: 1;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 2px;
  padding: 6px;
  align-content: start;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: $bg-surface; }
  &::-webkit-scrollbar-thumb { background: $border; border-radius: 2px; }
}

.param-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: $radius-sm;
  border: 1px solid transparent;
  transition: background 0.15s, border-color 0.15s;

  &:hover { background: $bg-hover; border-color: $border; }
}

.param-label {
  font-size: 11px;
  color: $text-muted;
  white-space: nowrap;
  font-family: 'SF Mono', monospace;
  flex-shrink: 0;
  max-width: 70px;
  overflow: hidden;
  text-overflow: ellipsis;
}

.param-input {
  flex: 1;
  min-width: 0;
  background: transparent;
  border: none;
  border-bottom: 1px solid $border;
  color: $text-primary;
  font-size: 12px;
  font-family: 'SF Mono', monospace;
  padding: 1px 2px;
  outline: none;
  transition: border-color 0.2s;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;

  &:focus { border-bottom-color: $accent; }
  &::placeholder { color: $text-muted; opacity: 0.5; }
}
</style>
