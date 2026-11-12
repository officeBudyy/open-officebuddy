// 下载分发配置。
// 链接结构：https://dl.officebuddy.work/app/v<version>/<artifact>，
// 与 upload-release-to-r2.yml 的 R2 prefix（app/v{version}）一致。
// VERSION 由 vite.config.ts 构建时从 apps/desktop/package.json 注入（VITE_DESKTOP_VERSION），
// 保证官网下载版本与桌面端发布版本同源。
export const VERSION = import.meta.env.VITE_DESKTOP_VERSION ?? "0.0.0";
const BASE = `https://dl.officebuddy.work/app/v${VERSION}`;

export interface DownloadItem {
	readonly id: string;
	readonly label: string;
	readonly note: string;
	readonly href: string;
}

export interface PlatformDownloads {
	readonly id: "mac" | "win" | "linux";
	readonly name: string;
	readonly icon: string;
	readonly note: string;
	readonly items: readonly DownloadItem[];
}

export const PLATFORMS: readonly PlatformDownloads[] = [
	{
		id: "mac",
		name: "macOS",
		icon: "icon-[simple-icons--apple]",
		note: "macOS 12 或更高",
		items: [
			// electron-builder macOS 默认命名：${productName}-${version}-${arch}.dmg
			// （productName = officeBuddy，见 desktop-packaging-layout.mjs 的 DESKTOP_PRODUCT_NAME）
			{ id: "mac-arm64", label: "Apple 芯片", note: "DMG · 推荐", href: `${BASE}/officeBuddy-${VERSION}-arm64.dmg` },
			{ id: "mac-intel", label: "Intel 芯片", note: "DMG", href: `${BASE}/officeBuddy-${VERSION}-x64.dmg` },
		],
	},
	{
		id: "win",
		name: "Windows",
		icon: "icon-[simple-icons--windows]",
		note: "Windows 10 或更高",
		items: [
			// Windows 显式 artifactName：${productName}-${version}-win-${arch}.${ext}
			{ id: "win-x64", label: "x64 安装程序", note: "EXE · 推荐", href: `${BASE}/officeBuddy-${VERSION}-win-x64.exe` },
		],
	},
	{
		id: "linux",
		name: "Linux",
		icon: "icon-[simple-icons--linux]",
		note: "glibc 2.31 或更高",
		items: [
			// electron-builder Linux 默认命名；发布前请核对 Release 实际附件名
			{ id: "linux-appimage", label: "x64 通用", note: "AppImage · 推荐", href: `${BASE}/officeBuddy-${VERSION}-x86_64.AppImage` },
			{ id: "linux-deb", label: "Debian / Ubuntu", note: "DEB", href: `${BASE}/officeBuddy-${VERSION}-amd64.deb` },
			{ id: "linux-rpm", label: "Fedora / RHEL", note: "RPM", href: `${BASE}/officeBuddy-${VERSION}-x86_64.rpm` },
		],
	},
];

/** 首选下载项：按 UA 匹配平台；Mac/Win 不细分架构（浏览器 UA 不可靠），统一推荐主流包。 */
export function primaryDownload(ua: string = navigator.userAgent): DownloadItem {
	if (/Windows/i.test(ua)) return PLATFORMS[1].items[0];
	if (/Linux/i.test(ua) && !/Android/i.test(ua)) return PLATFORMS[2].items[0];
	return PLATFORMS[0].items[0];
}

/** 主按钮文案按平台变化。 */
export function primaryLabel(ua: string = navigator.userAgent): string {
	if (/Windows/i.test(ua)) return "下载 Windows 版";
	if (/Macintosh|Mac OS X/i.test(ua)) return "下载 macOS 版";
	if (/Linux/i.test(ua)) return "下载 Linux 版";
	return "下载 macOS 版";
}
