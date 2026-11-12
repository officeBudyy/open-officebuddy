# officeBuddy 官网

本地优先的 AI 办公助手官网。由设计画布原型（officebuddy-site.astravia-design）转换而来，视觉与原型 1:1 对应。

## 技术栈

- Vite 7 + React 19 + react-router 7
- Tailwind CSS v4（`@theme` 设计令牌来自原型 `theme.css`）
- 图标：`@iconify/tailwind4`（lucide + simple-icons，`icon-[lucide--x]` 语法与设计画布一致）

## 页面 ↔ 原型映射

| 路由 | 来源 |
|---|---|
| `/` | `frames/index.tsx` |
| `/capabilities` | `frames/capabilities.tsx` |
| `/models` | `frames/models.tsx` |
| `/ecosystem` | `frames/ecosystem.tsx` |
| `/pricing` | `frames/pricing.tsx` |
| `/download` | `frames/download.tsx`（已接入 UA 检测与占位下载链接） |

## 常用命令

```bash
bun install        # 安装依赖
bun run dev        # 开发预览 http://localhost:5173
bun run build      # 类型检查 + 构建到 dist/
bun run preview    # 预览构建产物 http://localhost:4173
```

## 待办（上线前）

1. **下载链接**：`src/lib/download.ts` 里的 `BASE` 目前是
   `https://dl.example.com/officebuddy/` 占位，替换为真实分发地址
   （GitHub Releases 或 dl 子域 + CDN），并同步 `VERSION`。
2. **SPA 深链回退**：部署到静态托管时配置所有路径回退到 `index.html`
   （Cloudflare Pages 默认支持；Nginx 需加 `try_files`）。
3. **SEO**：如需预渲染成静态 HTML，可加 `vite-plugin-prerender` 或迁移 Astro。
