<template>
  <header class="top-nav">

    <nav class="nav-tabs">
      <div v-for="tab in tabs" :key="tab.id" class="nav-tab" :class="{ active: tab.id === 'page1' }">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
        </svg>
        {{ tab.name }}
      </div>
    </nav>
    <div class="nav-right">
      <div class="status-dot"></div>
      <span class="status-text">在线</span>
    </div>
  </header>
</template>

<script setup>
defineOptions({ name: 'TopNav' })

/**
 * 顶部导航标签栏
 * tabs 数组定义所有标签，当前 'page1' 硬编码为 active。
 * 后续可改为响应式：从 store 或 router 获取当前路由高亮对应标签。
 */
const tabs = [
  { id: 'page1', name: '页面一' },
  { id: 'page2', name: '页面二' },
  { id: 'page3', name: '系统'   },
  { id: 'page4', name: '页面三' },
  { id: 'page5', name: '页面四' },
]
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

.top-nav {
  display: flex;
  align-items: center;
  height: 56px;
  padding: 0 20px;
  background: $bg-surface;
  border-bottom: 1px solid $border;
  flex-shrink: 0;
  gap: 32px;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 15px;
  font-weight: 600;
  color: $accent-hover;
  letter-spacing: 0.5px;
  flex-shrink: 0;
}

.nav-tabs {
  display: flex;
  gap: 4px;
  flex: 1;
}

.nav-tab {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border-radius: $radius-sm;
  font-size: 13.5px;
  color: $text-secondary;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
  user-select: none;

  svg { opacity: 0.7; flex-shrink: 0; }

  &:hover {
    background: $bg-hover;
    color: $text-primary;
    svg { opacity: 1; }
  }

  &.active {
    background: rgba($accent, 0.12);
    border-color: rgba($accent, 0.3);
    color: $accent-hover;
    svg { opacity: 1; color: $accent-hover; }
  }
}

.nav-right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;

  .status-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: $success;
    box-shadow: 0 0 6px $success;
    animation: pulse 2s ease-in-out infinite;
  }

  .status-text {
    font-size: 13px;
    color: $success;
  }
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50%       { opacity: 0.5; }
}
</style>
