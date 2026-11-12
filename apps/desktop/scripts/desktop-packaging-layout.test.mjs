import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
	DESKTOP_BUILD_OUTPUTS,
	DESKTOP_EXECUTABLE_NAME,
	DESKTOP_LINUX_EXECUTABLE_NAME,
	DESKTOP_LINUX_PACKAGE_NAME,
	DESKTOP_MAC_EXECUTABLE_NAME,
	DESKTOP_PRODUCT_NAME,
	DESKTOP_REQUIRED_SOURCE_FILES,
	ASTRAVIA_PLUGIN_FILE_ASSOCIATION,
} from "./desktop-packaging-layout.mjs";

const desktopRoot = join(import.meta.dirname, "..");

test("production build outputs have stable staging destinations", () => {
	assert.deepEqual(
		DESKTOP_BUILD_OUTPUTS,
		[
			{ source: "dist/main", target: "main" },
			{ source: "dist/preload", target: "preload" },
			{ source: "dist/renderer", target: "renderer" },
			{ source: "dist/ocr-preload", target: "ocr-preload" },
			{ source: "dist/ocr-runner", target: "ocr-runner" },
		],
	);
});

test("required source entry points exist", () => {
	for (const relativePath of DESKTOP_REQUIRED_SOURCE_FILES) {
		assert.ok(existsSync(join(desktopRoot, relativePath)), `missing Desktop source entry: ${relativePath}`);
	}
});

test("packaged desktop uses officeBuddy consistently on macOS and Linux while preserving Windows compatibility", () => {
	assert.equal(DESKTOP_PRODUCT_NAME, "officeBuddy");
	assert.equal(DESKTOP_EXECUTABLE_NAME, "Astravia");
	assert.equal(DESKTOP_MAC_EXECUTABLE_NAME, "officeBuddy");
	assert.equal(DESKTOP_LINUX_EXECUTABLE_NAME, "officeBuddy");
	assert.equal(DESKTOP_LINUX_PACKAGE_NAME, "officebuddy");
	const preparePack = readFileSync(join(desktopRoot, "scripts", "prepare-pack.js"), "utf8");
	assert.match(preparePack, /productName:\s*DESKTOP_PRODUCT_NAME/);
	assert.match(preparePack, /mac:\s*{\s*executableName:\s*DESKTOP_MAC_EXECUTABLE_NAME/);
	assert.match(preparePack, /linux:\s*{[\s\S]*?executableName:\s*DESKTOP_LINUX_EXECUTABLE_NAME/);
	// deb/rpm 文件名与包内元数据都来自 staged package.json 的 name
	// （electron-builder 的 ${name} 宏只认 appInfo.name），必须引用常量。
	assert.match(preparePack, /name:\s*DESKTOP_LINUX_PACKAGE_NAME/);
	assert.doesNotMatch(preparePack, /name:\s*["']astravia["']/);
	// electron-builder 26 的 linux 段不接受 packageName（schema 已删除），
	// 顶层 deb/rpm per-target 段也已移除，统一走 staged name 回退。
	assert.doesNotMatch(preparePack, /^\tdeb:\s*{/m);
	assert.doesNotMatch(preparePack, /^\trpm:\s*{/m);
	assert.match(preparePack, /appId:\s*["']com\.officebuddy\.desktop["']/);
	assert.doesNotMatch(preparePack, /com\.astravia\.desktop/);
	assert.match(preparePack, /CFBundleDisplayName:\s*DESKTOP_PRODUCT_NAME/);
	assert.match(preparePack, /CFBundleName:\s*DESKTOP_PRODUCT_NAME/);
	assert.match(preparePack, /title:\s*["']\$\{productName\} \$\{version\}["']/);
	assert.doesNotMatch(preparePack, /CFBundleName:\s*["']officebuddy["']/i);
	const repairScript = readFileSync(join(desktopRoot, "build", "repair.applescript"), "utf8");
	assert.match(repairScript, /Applications\/officeBuddy\.app/);
	assert.match(repairScript, /Applications\/Astravia\.app/);
});

test("packaged Desktop registers the dedicated Astravia plugin package type", () => {
	assert.deepEqual(ASTRAVIA_PLUGIN_FILE_ASSOCIATION, {
		ext: "astraviapkg",
		name: "Astravia Plugin Package",
		description: "Installable Astravia plugin package",
		mimeType: "application/vnd.astravia.plugin+zip",
		role: "Editor",
	});
});
