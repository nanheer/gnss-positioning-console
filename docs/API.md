# 接口文档

后端提供 4 个 REST 接口，用于把「上传观测文件 → 调用解算程序 → 取回结果」串成一条链路。

- 服务地址：`http://localhost:8080`
- 基础路径：`/api/solver`
- 数据格式：JSON（上传使用 `multipart/form-data`）
- 字符编码：UTF-8

## 接口总览

| 接口 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 定位计算 | POST | `/api/solver/solve` | 执行 SPP / PPK 定位计算 |
| 下载结果 | GET | `/api/solver/download/{sessionId}` | 下载计算结果 `.pos` |
| 清理会话 | DELETE | `/api/solver/cleanup/{sessionId}` | 删除会话临时文件 |
| 健康检查 | GET | `/api/solver/health` | 服务健康状态 |

---

## 1. 定位计算

`POST /api/solver/solve`，`Content-Type: multipart/form-data`

### 请求参数

| 参数名 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| `files` | File[] | 是 | 上传文件列表，顺序即解算程序的参数顺序 |
| `coordX` | Double | 否 | 基准站坐标第 1 位：**纬度**（ECEF 时为 X） |
| `coordY` | Double | 否 | 基准站坐标第 2 位：**经度**（ECEF 时为 Y） |
| `coordZ` | Double | 否 | 基准站坐标第 3 位：**高程**（ECEF 时为 Z） |
| `coordType` | String | 否 | `auto`（默认）/ `llh` / `ecef` |
| `threshold` | Double | 否 | 预留参数，当前未使用 |

> ⚠️ 三个坐标的顺序不能颠倒：解算程序按「纬度 经度 高程」解析，顺序不对时可能被静默忽略。

### 文件类型自动识别

| 类型 | 扩展名 |
| --- | --- |
| 观测文件 | `.obs`、`.o`、`.xxO`、`.xxo` |
| 星历文件 | `.nav`、`.n`、`.c`、`.rnx`、`.xxN`、`.xxn`、`.xxC`、`.xxc`、`brdc`/`igs` 等命名 |

模式判断规则：

- **SPP**：1 个观测文件 + 1 个星历文件
- **PPK**：2 个观测文件（**第一个为流动站，第二个为基准站**）+ 1 个星历文件
- **PPK + 手动坐标**：在上一种基础上再传 `coordX/Y/Z`

### 响应

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `success` | Boolean | 是否成功 |
| `message` | String | 结果消息（失败时含原因） |
| `sessionId` | String | 会话 ID，用于下载与清理 |
| `cmd` | String | 实际执行的命令（便于排查） |
| `mode` | String | `SPP` 或 `PPK` |
| `elapsedMs` | Long | 耗时（毫秒） |

```json
{
  "success": true,
  "message": "计算成功",
  "sessionId": "20261015233030_2fec3601",
  "cmd": "D:\\gnss-positioning-console\\backend\\position.exe base.o base.nav",
  "mode": "SPP",
  "elapsedMs": 3203
}
```

### 调用示例

```bash
# SPP
curl -X POST http://localhost:8080/api/solver/solve \
  -F "files=@rover.o" \
  -F "files=@base.nav"

# PPK
curl -X POST http://localhost:8080/api/solver/solve \
  -F "files=@rover.o" \
  -F "files=@base.o" \
  -F "files=@base.nav"

# PPK + 基准站坐标（纬度 经度 高程）
curl -X POST http://localhost:8080/api/solver/solve \
  -F "files=@rover.o" \
  -F "files=@base.o" \
  -F "files=@base.nav" \
  -F "coordX=22.591308375" \
  -F "coordY=113.966909956" \
  -F "coordZ=27.8681" \
  -F "coordType=auto"
```

```javascript
async function solve(files, coord = {}) {
  const form = new FormData()
  files.forEach((f) => form.append('files', f))
  if (coord.lat !== undefined) form.append('coordX', coord.lat)
  if (coord.lon !== undefined) form.append('coordY', coord.lon)
  if (coord.alt !== undefined) form.append('coordZ', coord.alt)
  if (coord.lat !== undefined) form.append('coordType', 'auto')

  const res = await fetch('/api/solver/solve', { method: 'POST', body: form })
  return res.json()
}
```

计算成功后，用返回的 `sessionId` 取结果：`GET /api/solver/download/{sessionId}`。

---

## 2. 下载结果

`GET /api/solver/download/{sessionId}`

- 成功：`200`，`Content-Type: text/plain`，附件名为 `{sessionId}.pos`
- 失败：`404`（会话不存在或未生成结果）

```bash
curl -o result.pos http://localhost:8080/api/solver/download/20261015233030_2fec3601
```

> 解算程序默认把结果写成「第一个输入文件主名 + `.pos`」（`base.o` → `base.pos`）。
> 后端会在计算成功后把它归一化为配置项 `solver.output-file`（默认 `rover.pos`），因此无论输入文件叫什么名字，该接口都能取到结果。

---

## 3. 清理会话

`DELETE /api/solver/cleanup/{sessionId}`

- 成功：`200`
- 失败：`404`

```bash
curl -X DELETE http://localhost:8080/api/solver/cleanup/20261015233030_2fec3601
```

---

## 4. 健康检查

`GET /api/solver/health` → `OK`

---

## 5. 错误处理

| HTTP | 场景 |
| --- | --- |
| 400 | 请求参数错误 |
| 404 | 会话不存在 / 结果文件不存在 |
| 500 | 服务内部错误 |

失败时 `success` 为 `false`，原因在 `message` 中：

```json
{
  "success": false,
  "message": "缺少必要文件：需要至少一个观测文件(.obs)和一个星历文件(.nav)",
  "sessionId": "20261015222248_8b2c54e6",
  "cmd": null,
  "mode": null,
  "elapsedMs": 32
}
```

| 错误信息 | 原因 | 处理 |
| --- | --- | --- |
| 缺少必要文件 | 文件数量不足或扩展名无法识别 | 至少上传 1 个观测文件和 1 个星历文件 |
| 找不到解算程序 position.exe | `solver.exe-path` 配置错误 | 检查配置；相对路径以 jar 所在目录为基准 |
| 计算超时（超过 N 秒） | 观测文件时段过长 | 调大 `solver.timeout` |
| 计算结束但未生成 .pos 结果文件 | 输入数据与星历不匹配、时段无重叠等 | 检查观测文件与星历文件是否为同一时段 |
| Maximum upload size exceeded | 超出上传限制 | 调整 `spring.servlet.multipart.*` |

---

## 6. 结果文件格式

结果为标准的 `.pos` 文本，头部为 `%` 开头的注释，随后每个历元一行：

```
% program   : position 1.0
% inp file  : rover.o
% inp file  : base.nav
% obs start : 2026/06/10 11:03:31.9 GPST
% pos mode  : Kinematic
2026/06/10 11:12:24.200   22.591305025  113.966916243    -3.3202   1   5 ...
```

| 列 | 字段 | 说明 |
| --- | --- | --- |
| 1 | 时间 | GPST |
| 2 | latitude | 纬度（度） |
| 3 | longitude | 经度（度） |
| 4 | height | 高程（米） |
| 5 | Q | 解状态：1 固定、2 浮点、3 SBAS、4 DGPS、5 单点、6 PPP |
| 6 | ns | 参与解算的卫星数 |
| 7-12 | sdn/sde/sdu… | 各方向中误差（米） |
| 13 | age | 差分龄期（秒） |
| 14 | ratio | 模糊度固定比率 |

前端据此绘制轨迹与参数曲线，Q 值可用于区分固定解与浮点解。
