import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DEFAULT_CONFIG_DIR_NAME } from "@astravia/action-rpc";
import { afterEach, describe, expect, it } from "vitest";
import { prepareOfficeBuddyHomeDirectory } from "./home-directory-migration.js";

const temporaryDirectories: string[] = [];

async function createHome(): Promise<string> {
	const path = await mkdtemp(join(tmpdir(), "officebuddy-home-migration-"));
	temporaryDirectories.push(path);
	return path;
}

afterEach(async () => {
	await Promise.all(temporaryDirectories.splice(0).map((path) => rm(path, { recursive: true, force: true })));
});

describe("officeBuddy user-data home migration", () => {
	it("uses the officeBuddy-branded directory by default", () => {
		expect(DEFAULT_CONFIG_DIR_NAME).toBe("officeBuddy");
	});

	it("atomically moves a dotted .officeBuddy home and leaves an alias", async () => {
		const homeDirectory = await createHome();
		const legacyPath = join(homeDirectory, ".officeBuddy");
		await mkdir(join(legacyPath, "agent"), { recursive: true });
		await writeFile(join(legacyPath, "agent", "models.json"), "user-models", "utf8");

		const result = prepareOfficeBuddyHomeDirectory({ env: {}, homeDirectory });

		expect(result).toMatchObject({
			homePath: join(homeDirectory, "officeBuddy"),
			legacyPath,
			status: "migrated",
		});
		// 旧根保留为别名，历史绝对路径仍然可用。
		expect(realpathSync(legacyPath)).toBe(realpathSync(result.homePath));
		expect(await readFile(join(result.homePath, "agent", "models.json"), "utf8")).toBe("user-models");
		expect(readFile(join(legacyPath, "agent", "models.json"), "utf8")).resolves.toBe("user-models");
		expect(prepareOfficeBuddyHomeDirectory({ env: {}, homeDirectory }).status).toBe("not-needed");
	});

	it("chains through a legacy .astravia alias when migrating from the first branded root", async () => {
		const homeDirectory = await createHome();
		// 旧版本迁移留下的形态：.astravia 是指向 .officeBuddy 的别名。
		const legacyPath = join(homeDirectory, ".officeBuddy");
		await mkdir(join(legacyPath, "agent"), { recursive: true });
		await writeFile(join(legacyPath, "agent", "models.json"), "user-models", "utf8");
		await symlink(legacyPath, join(homeDirectory, ".astravia"), "dir");

		const result = prepareOfficeBuddyHomeDirectory({ env: {}, homeDirectory });

		expect(result.status).toBe("migrated");
		expect(result.homePath).toBe(join(homeDirectory, "officeBuddy"));
		expect(await readFile(join(result.homePath, "agent", "models.json"), "utf8")).toBe("user-models");
		// 两个历史名字都应指到新根。
		expect(realpathSync(join(homeDirectory, ".officeBuddy"))).toBe(realpathSync(result.homePath));
		expect(realpathSync(join(homeDirectory, ".astravia"))).toBe(realpathSync(result.homePath));
		expect(prepareOfficeBuddyHomeDirectory({ env: {}, homeDirectory }).status).toBe("not-needed");
	});

	it("merges only missing data when both branded and legacy homes exist", async () => {
		const homeDirectory = await createHome();
		const legacyPath = join(homeDirectory, ".astravia");
		const homePath = join(homeDirectory, ".officeBuddy");
		await mkdir(join(legacyPath, "agent"), { recursive: true });
		await mkdir(join(homePath, "agent"), { recursive: true });
		await writeFile(join(legacyPath, "agent", "models.json"), "legacy", "utf8");
		await writeFile(join(homePath, "agent", "models.json"), "current", "utf8");
		await writeFile(join(legacyPath, "desktop-config.json"), "legacy-config", "utf8");

		const result = prepareOfficeBuddyHomeDirectory({ env: {}, homeDirectory });

		expect(result.status).toBe("merged");
		expect(result.homePath).toBe(join(homeDirectory, "officeBuddy"));
		expect(await readFile(join(result.homePath, "agent", "models.json"), "utf8")).toBe("current");
		expect(await readFile(join(result.homePath, "desktop-config.json"), "utf8")).toBe("legacy-config");
		expect(existsSync(legacyPath)).toBe(true);
	});

	it("does not migrate the default directories when ASTRAVIA_HOME is explicitly configured", async () => {
		const homeDirectory = await createHome();
		const legacyPath = join(homeDirectory, ".astravia");
		await mkdir(legacyPath, { recursive: true });

		const result = prepareOfficeBuddyHomeDirectory({
			env: { ASTRAVIA_HOME: "~/custom-officebuddy" },
			homeDirectory,
		});

		expect(result).toEqual({ homePath: join(homeDirectory, "custom-officebuddy"), status: "custom" });
		expect(existsSync(legacyPath)).toBe(true);
	});
});
