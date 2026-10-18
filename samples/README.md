# 示例数据

本目录下的观测数据仅用于演示与自测，来自单次实测采集，**不含任何个人或单位信息**。

| 文件 | 大小 | 类型 | 说明 |
| --- | --- | --- | --- |
| `base.nav` | 33 KB | 广播星历 | SPP / PPK 都需要 |
| `base.o` | 2.1 MB | 观测文件 | 约 4 分钟、1 Hz 采样 |
| `rover.o` | 45 MB | 观测文件 | 长时段数据，解算耗时较长 |

## 推荐用法

**快速验证链路（数秒出结果）**

- 模式：SPP
- 文件：`base.o` + `base.nav`

**验证 PPK 链路（约 30~60 秒）**

- 模式：PPK
- 文件：`rover.o`（流动站）+ `base.o`（基准站）+ `base.nav`

```bash
# 命令行直接验证后端
curl -X POST http://localhost:8080/api/solver/solve \
  -F "files=@samples/base.o" \
  -F "files=@samples/base.nav"
```

## 说明

- 采样率、时段长度会直接影响结果点数与固定解比例，属于数据本身的特性。
- `rover.o` 体积较大，若克隆缓慢，可在自己的 fork 中删除（SPP 演示不受影响）。
- 请勿将本目录数据用于生产或对外发布。
