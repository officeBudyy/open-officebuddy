import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import {
	DESKTOP_BUILD_OUTPUTS,
	DESKTOP_EXECUTABLE_NAME,
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

test("packaged desktop uses officeBuddy consistently on macOS while preserving other platform compatibility", () => {
	assert.equal(DESKTOP_PRODUCT_NAME, "officeBuddy");
	assert.equal(DESKTOP_EXECUTABLE_NAME, "Astravia");
	assert.equal(DESKTOP_MAC_EXECUTABLE_NAME, "officeBuddy");
	const preparePack = readFileSync(join(desktopRoot, "scripts", "prepare-pack.js"), "utf8");
	assert.match(preparePack, /productName:\s*DESKTOP_PRODUCT_NAME/);
	assert.match(preparePack, /mac:\s*{\s*executableName:\s*DESKTOP_MAC_EXECUTABLE_NAME/);
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
