import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { APP_USER_MODEL_ID } from "./app-identity.js";

const packageRoot = join(import.meta.dirname, "..", "..");

function readPackageSource(relativePath: string): string {
	return readFileSync(join(packageRoot, relativePath), "utf8");
}

describe("app runtime name", () => {
	it("is applied to app.name unconditionally in the main process", () => {
		const mainSource = readPackageSource("src/main/main.ts");
		expect(mainSource).toContain("app.name = APP_RUNTIME_NAME;");
		// 早期实现只在开发态覆盖名字，正是环境间密钥分叉的成因。
		expect(mainSource).not.toMatch(/app\.name\s*=\s*"/);
	});
});

describe("Windows app identity", () => {
	it("keeps the packaged app, main process, and installer shortcuts on one AppUserModelID", () => {
		const preparePack = readPackageSource("scripts/prepare-pack.js");
		const appId = /\bappId:\s*"([^"]+)"/.exec(preparePack)?.[1];
		expect(appId).toBe(APP_USER_MODEL_ID);

		const mainSource = readPackageSource("src/main/main.ts");
		expect(mainSource).toContain("app.setAppUserModelId(APP_USER_MODEL_ID);");

		const installer = readPackageSource("build/installer.iss");
		expect(installer.match(new RegExp(`AppUserModelID: "${APP_USER_MODEL_ID}"`, "g"))).toHaveLength(2);
	});
});
