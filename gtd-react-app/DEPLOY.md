# GTD Flow React — 本地部署说明 (macOS)

适用于在 MacBook Pro（含 Apple Silicon M4）上本地运行本应用。

## 环境要求

- **Node.js**：18+（推荐 20 LTS）
- **npm**：9+

检查版本：
```bash
node -v   # 建议 v18+
npm -v
```

未安装时可从 [nodejs.org](https://nodejs.org/) 安装，或使用 `nvm` / `fnm`。

## 方式一：开发模式（推荐日常开发）

```bash
cd gtd-react-app
npm install
npm run dev
```

- 默认地址：**http://localhost:5173**
- 支持热更新，改代码即刷新。

## 方式二：生产构建 + 本地预览

```bash
cd gtd-react-app
npm install
npm run build
npm run preview
```

- 构建产物在 `dist/`。
- 预览地址：**http://localhost:4173**（端口占用时会自动用下一端口）。

一键构建并预览：
```bash
npm run deploy:local
```

## 方式三：仅构建静态文件

```bash
cd gtd-react-app
npm install
npm run build
```

之后可用任意静态服务器托管 `dist/`，例如：

```bash
npx serve dist -p 3000
# 或
python3 -m http.server 8080 --directory dist
```

访问 **http://localhost:3000** 或 **http://localhost:8080**。

## 本机其他设备访问

若已配置 `host: true`（当前已启用），同一局域网内可用本机 IP 访问：

- 开发：`http://<本机IP>:5173`
- 预览：`http://<本机IP>:4173`

查看本机 IP：`ifconfig | grep "inet "` 或 系统设置 → 网络。

## 数据与存储

- 应用为纯前端，数据通过 **File System Access API** 读写本地 Markdown 文件。
- 文件句柄会缓存在浏览器 **IndexedDB**，无需额外后端或数据库。
- 建议使用 Chrome / Edge 以获得完整文件访问能力。

## Sync server (LAN + mobile)

To use the app from your phone on the same Wi‑Fi and keep tasks in sync with the MacBook:

1. On the MacBook: `npm run build && npm run serve:sync` (or `npm run build:sync`).
2. Open `http://<MacBook-IP>:3000` on both the MacBook and the phone.
3. Data is stored on the server; changes on one device appear on the other (phone polls every 30s).

The sync server serves the built app and a GET/POST API for the markdown store (saved under `data/store.json`). For best LAN performance, use this production build instead of `npm run dev`.

---

部署完成后，在浏览器打开上述地址即可使用 GTD Flow。
