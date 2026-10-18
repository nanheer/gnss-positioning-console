# 贡献指南

感谢你关注本项目。下面是一些让协作更顺畅的约定。

## 提交问题

- 提交前先搜索已有 Issue，避免重复。
- 使用内置的 Issue 模板，尽量提供：复现步骤、期望结果、实际结果、运行环境（JDK / Node 版本、操作系统）。
- 涉及解算结果异常时，请说明使用的解算程序与命令行参数（可在后端日志里看到 `执行命令` 一行）。

## 提交代码

1. Fork 本仓库并从 `main` 拉出特性分支：

   ```bash
   git checkout -b feat/your-feature
   ```

2. 保持提交粒度清晰，提交信息推荐使用约定式格式：

   ```
   feat: 支持批量拖拽上传
   fix: 修正基准站坐标顺序
   docs: 补充接口说明
   ```

3. 提交前自查：

   ```bash
   cd backend && mvn -q test          # 后端
   cd frontend && npm run build       # 前端构建
   ```

4. 发起 Pull Request，说明改动动机与影响范围；界面类改动请附截图。

## 代码风格

- 前端：2 空格缩进，单引号，组件使用 `<script setup>`；样式统一走 `src/styles/global.scss` 中的变量。
- 后端：4 空格缩进，类名大驼峰，服务层不直接依赖 `MultipartFile` 之外的 Web 对象。
- 注释使用中文；公共函数、接口、配置项需写清楚用途与取值范围。

## 不要提交

- `node_modules/`、`target/`、`dist/` 等构建产物
- 真实的令牌、密钥、内网地址（一律通过环境变量注入）
- 体积过大的观测数据（>50 MB 建议用 Git LFS 或外链）

## 安全

发现安全问题请勿公开提交 Issue，按 [SECURITY.md](SECURITY.md) 的方式反馈。
