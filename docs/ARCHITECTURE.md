# 架构说明

## 总体结构

```
浏览器
  │
  ├── 前端（Vite Dev Server :5173 / 静态产物）
  │     · 数据导入与解析（.O / .pos / .txt）
  │     · 三维地图、轨迹、电离层网格
  │     · 图表、数据列表
  │
  └── /api/solver/*  ──代理──▶ 后端（Spring Boot :8080）
                                  · PpkController  接收 multipart 上传
                                  · PpkService     会话目录 / 进程调用 / 结果处理
                                        │
                                        └── ProcessBuilder ──▶ position.exe（解算核心）
```

## 后端

### 请求处理链路

1. `PpkController#solve` 接收 `multipart/form-data`，封装为 `PpkRequest`。
2. `PpkService#execute` 生成 `sessionId`（时间戳 + 随机串），在 `solver.temp-dir` 下创建独立会话目录。
3. 按扩展名把上传文件归类为**观测文件**与**星历文件**：第一个观测文件记为流动站，第二个记为基准站。
4. 拼装命令行并启动子进程，工作目录设为会话目录；同时读取 stdout/stderr、按需向 stdin 补回车。
5. 进程退出码为 0 时定位实际生成的 `.pos`，归一到配置的输出名，返回 `sessionId` 等信息。
6. 前端用 `sessionId` 调 `download` 取回结果。

### 几个关键设计

**路径基准**：`exe-path`、`temp-dir` 支持相对路径，解析基准是 **jar 所在目录**（`ApplicationHome` + CodeSource 双重兜底），而不是启动命令时的当前工作目录。这样从任何目录启动服务都不会找不到解算程序。

**结果文件归一化**：解算程序的输出名跟随第一个输入文件（`base.o` → `base.pos`），若直接按固定名下载会 404。后端在计算成功后按「第一个输入文件主名 + `.pos`」定位，找不到再退回配置名与目录内最新 `.pos`，最后统一复制为 `output-file` 指定的名字，保证下载接口稳定。

**进程管理**：设置超时（默认 600 s），超时强制结束并返回明确错误；子进程会打印 `Press Enter to exit`，因此读取线程之外还起了一个守护线程定期写入回车，避免因等待输入而挂住；Windows 下按 GBK 解码输出，Linux/macOS 按 UTF-8。

**会话隔离**：每次计算一个目录，互不干扰；`cleanup` 接口可删除整个会话目录。目录内只保存本次上传的原始文件与结果，不做跨请求复用。

## 前端

### 状态与解析

`src/store/app.js`（Pinia）集中维护三类数据：

| 槽位 | 文件 | 解析结果 |
| --- | --- | --- |
| `fileList[0]` | 观测文件 | 历元列表、卫星数、头信息 |
| `fileList[1]` | `.pos` | 轨迹点（时间、经纬高、Q 值） |
| `fileList[2]` | `.txt` | 12 个时次的 TEC 网格值 |

计算成功后，`FileUpload.vue` 会把下载到的结果包装成 `File` 注入 `fileList[1]`，从而复用同一套解析与渲染逻辑——这就是「不用手动上传 pos，地图自动出轨迹」的实现方式。

### 地图

`MapPanel.vue` 基于 Mars3D（Cesium）封装：

- 底图：ArcGIS 影像 / 街道 / 地形、CartoDB 深色 / Voyager、OSM，切换时控制图层可见性
- 轨迹：按 `.pos` 点位绘制 `PolylineEntity`，并飞到轨迹范围中心
- 电离层：网格单元 `BoxCombine` 批量渲染，颜色由 TEC 值线性映射（5~50 TECU，蓝→青→绿→黄→红）

### 电离层网格的两条数据路径

- **TEC 数值**：始终来自用户上传的 `.txt`（30 行 × 60 列 × 12 时次，行按纬度升序、列按经度升序）
- **网格几何**：默认由前端按经纬度范围本地生成 30 × 60 网格，与 `.txt` 的行列顺序一一对应；若配置了 `VITE_GRID_API_BASE`，则改由外部网格服务返回，适合已有网格服务能力的部署环境

## 扩展点

| 需求 | 改动位置 |
| --- | --- |
| 换用其他解算程序 | 保持命令行参数兼容即可（`obs [base] nav [-c lat lon h]`），通过 `solver.exe-path` 指向新程序 |
| 支持 RINEX 3 / 多系统星历 | 扩展 `PpkService#detectFileType` 的扩展名规则 |
| 增加解算质量统计 | `PpkResponse` 增字段 + `PpkService` 解析 `.pos` 汇总 |
| 轨迹抽稀 / 断点处理 | `MapPanel.vue` 渲染前对点位按时间差过滤 |
| 更换底图或离线瓦片 | `MapPanel.vue` 的 `basemapList` |
