import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// officeBuddy 官网：Vite + React + Tailwind v4 多路由静态站。
// 构建产物输出到 dist/，可直接部署到任意静态托管。

// 版本号与桌面端发布版本保持唯一事实源（apps/desktop/package.json），
// 官网下载链接会拼接到 https://dl.officebuddy.work/app/v<version>/。
const desktopPackageJson = JSON.parse(
	readFileSync(join(dirname(new URL(import.meta.url).pathname), "..", "apps", "desktop", "package.json"), "utf8"),
) as { version?: string };

const desktopVersion = desktopPackageJson.version?.trim() || "0.0.0";

export default defineConfig({
	base: "./",
	plugins: [react(), tailwindcss()],
	define: {
		"import.meta.env.VITE_DESKTOP_VERSION": JSON.stringify(desktopVersion),
	},
	build: {
		outDir: "dist",
		emptyOutDir: true,
	},
	preview: {
		port: 4173,
	},
});
