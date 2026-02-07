# GTD Flow (Tauri) — Cross-Platform

GTD Flow 的 **Rust + Tauri 2** 版本，一套代码可构建为 **macOS / Windows / Linux** 桌面应用，以及 **iOS / Android** 移动应用（需按 Tauri 文档配置移动端构建环境）。

## 技术栈

- **前端**: 与 `gtd-react-app` 相同的 React + Vite + Tailwind（共享 UI 与交互）
- **后端**: Rust（Tauri 2）
  - 文件读写、默认存储路径、应用数据目录
  - 通过 Tauri Command 暴露给前端
- **跨平台**: Tauri 2 支持 Windows、macOS、Linux、iOS、Android

## 环境要求

1. **Node.js** 18+、npm
2. **Rust**: [https://rustup.rs](https://rustup.rs) — 安装后可用 `cargo`、`rustc`
3. **平台相关**（按需）:
   - **macOS**: Xcode Command Line Tools
   - **Windows**: Microsoft Visual C++ Build Tools、WebView2
   - **iOS**: Xcode、iOS SDK
   - **Android**: Android Studio、NDK、SDK

## 安装与运行

```bash
cd gtd-tauri
npm install
```

### 开发模式（桌面）

```bash
npm run tauri:dev
```

会启动 Vite 开发服务器并打开 Tauri 窗口，热更新生效。

### 构建（桌面）

```bash
npm run tauri:build
```

产物在 `src-tauri/target/release/`（或 `debug/`），以及各平台安装包（如 macOS `.app`、Windows `.msi` 等，取决于 `tauri.conf.json` 的 `bundle` 配置）。

### 图标

首次构建前建议生成应用图标：

```bash
npx tauri icon path/to/your-icon.png
```

会将图标生成到 `src-tauri/icons/`。若未生成，需在 `tauri.conf.json` 的 `bundle.icon` 中配置有效路径，否则构建可能报错。

## 移动端（iOS / Android）

Tauri 2 支持移动端，需额外环境与步骤，请以官方文档为准：

- [Tauri — Mobile](https://v2.tauri.app/develop/mobile/)
- 配置 `tauri.conf.json` 中 `bundle.android`、`bundle.ios`（若当前 schema 支持）
- iOS 需配置 development team、签名等
- Android 需配置 `minSdkVersion`、签名等

本仓库当前 `tauri.conf.json` 已保留 `bundle.android`，iOS 需按文档重新加入并配置。

## 与 Web 版的差异

- **存储**: 桌面/移动端使用 Rust 读写本地文件；默认存储路径为应用数据目录下的 `gtd-flow/store.md`，也可通过“打开 / 另存为”选择文件并设为默认。
- **浏览器 API**: 在 Tauri 中不使用 File System Access API 与 IndexedDB 存句柄；改用 Tauri Command：`read_markdown`、`write_markdown`、`read_file_at_path`、`write_file_at_path`、`get_default_store_path`、`set_default_store_path` 等。
- **同步**: 若需与 `gtd-react-app` 的同步服务（`/api/markdown`）一起用，在 Tauri 中仍可通过前端 `fetch` 访问同一后端（需网络与 CORS 配置允许）。

## 项目结构

```
gtd-tauri/
├── src/                 # React 前端（与 gtd-react-app 同源）
├── src-tauri/           # Rust 后端
│   ├── src/
│   │   ├── lib.rs       # Tauri 入口、插件与 Command 注册
│   │   ├── main.rs      # 桌面二进制入口
│   │   ├── commands.rs  # read_markdown、write_markdown、文件对话框等
│   │   └── store.rs     # 默认路径持久化（prefs.json）
│   ├── icons/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.js
└── README.md
```

## 许可证

与主项目一致。
