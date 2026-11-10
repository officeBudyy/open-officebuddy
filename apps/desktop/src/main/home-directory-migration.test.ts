import { existsSync, realpathSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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
		expect(DEFAULT_CONFIG_DIR_NAME).toBe(".officeBuddy");
	});

	it("atomically moves an existing Astravia home and preserves user data", async () => {
		const homeDirectory = await createHome();
		const legacyPath = join(homeDirectory, ".astravia");
		await mkdir(join(legacyPath, "agent"), { recursive: true });
		await writeFile(join(legacyPath, "agent", "models.json"), "user-models", "utf8");

		const result = prepareOfficeBuddyHomeDirectory({ env: {}, homeDirectory });

		expect(result).toMatchObject({
			homePath: join(homeDirectory, ".officeBuddy"),
			legacyPath,
			status: "migrated",
		});
		expect(realpathSync(legacyPath)).toBe(realpathSync(result.homePath));
		expect(await readFile(join(result.homePath, "agent", "models.json"), "utf8")).toBe("user-models");
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
		expect(await readFile(join(homePath, "agent", "models.json"), "utf8")).toBe("current");
		expect(await readFile(join(homePath, "desktop-config.json"), "utf8")).toBe("legacy-config");
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
