<template>
    <div class="page">
        <TopNav />

        <div class="main-content">
            <!-- 左侧 -->
            <aside class="left-panel">
                <FileUpload />
                <ParamsConfig />
                <ChartPanel />
            </aside>

            <!-- 右侧 -->
            <main class="right-panel">
                <div class="right-top">
                    <MapPanel />
                    <InfoPanel />
                </div>
                <div class="right-bottom">
                    <DataList />
                </div>
            </main>
        </div>
    </div>
</template>

<script setup>
import TopNav from '@/components/TopNav.vue'
import FileUpload from '@/components/FileUpload.vue'
import ParamsConfig from '@/components/ParamsConfig.vue'
import ChartPanel from '@/components/ChartPanel.vue'
import MapPanel from '@/components/MapPanel.vue'
import InfoPanel from '@/components/InfoPanel.vue'
import DataList from '@/components/DataList.vue'
</script>

<style lang="scss" scoped>
@use '@/styles/global.scss' as *;

.page {
    height: 100vh;
    display: flex;
    flex-direction: column;
    background: $bg-base;
    color: $text-primary;
    font-family: -apple-system, BlinkMacSystemFont, 'PingFang SC', 'Microsoft YaHei', sans-serif;
    overflow: hidden;
}

.main-content {
    display: flex;
    flex: 1;
    overflow: hidden;
    gap: 12px;
    padding: 12px;
}

.left-panel {
    width: 440px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow-y: auto;

    &::-webkit-scrollbar {
        width: 4px;
    }

    &::-webkit-scrollbar-track {
        background: transparent;
    }

    &::-webkit-scrollbar-thumb {
        background: $border;
        border-radius: 4px;
    }

    :deep(.chart-panel) {
        flex: 1;
        min-height: 260px;
        max-height: 480px;
    }
}

.right-panel {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    overflow: hidden;

    .right-top {
        display: flex;
        gap: 12px;
        flex: 1;
        min-height: 0;
    }

    .right-bottom {
        flex: 0 0 300px;
    }
}
</style>
