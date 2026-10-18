# 解算程序

控制台把定位解算交给独立的命令行程序完成，自身只负责参数拼装、进程调度与结果回收。

## 接口约定

```
position.exe [file1] [file2] ... [coord1 coord2 coord3]

  SPP        position.exe rover.o base.nav
  PPK        position.exe rover.o base.o base.nav
  PPK + 坐标  position.exe rover.o base.o base.nav -c 22.5913 113.9669 27.8681
```

行为约定：

- 按扩展名自动识别输入文件（观测文件 `.o/.obs/.xxO`，星历文件 `.nav/.n/.rnx/.xxN`）
- 第一个观测文件视为**流动站**，第二个视为**基准站**
- 输出文件名 = **第一个输入文件主名 + `.pos`**（`base.o` → `base.pos`）
- `-c` 后的三个值依次为 **纬度 经度 高程**
- 运行结束会等待回车退出（后端已做兼容处理）

## 替换为自己的解算核心

只要满足上述命令行约定，把 `solver.exe-path` 指向你的程序即可，后端代码无需改动：

```yaml
solver:
  exe-path: D:/tools/my-solver.exe
```

若新程序的参数形式不同，有两种接入方式：

1. **包装一层**：写一个脚本（bat/sh）把本项目的参数形式转换成目标程序的参数形式，把 `solver.exe-path` 指向该脚本；
2. **改后端**：调整 `PpkService#buildCommand` 中的参数拼装逻辑。

## 部署位置

`position.exe` 需要与后端 jar 位于同一目录，或通过配置指定绝对路径：

```yaml
solver:
  exe-path: ./position.exe          # 相对路径以 jar 所在目录为基准
  # exe-path: D:/tools/position.exe # 也可以写绝对路径
```

也可以在启动时覆盖：

```bash
java -jar gnss-solver-1.0.0.jar --solver.exe-path=D:/tools/position.exe
```
