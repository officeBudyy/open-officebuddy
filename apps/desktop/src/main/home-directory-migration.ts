import { cpSync, existsSync, lstatSync, mkdirSync, readdirSync, realpathSync, renameSync, symlinkSync } from "node:fs";
import type { Stats } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { ASTRAVIA_CONFIG_DIR_ENV, ASTRAVIA_HOME_ENV, DEFAULT_CONFIG_DIR_NAME } from "@astravia/action-rpc";

/**
 * 历史用户数据根目录名，按新旧排序。启动迁移时取第一个真实持有数据的目录
 * 作为迁移源；其余目录只做缺项合并，并全部保留为指向新根的别名，
 * 使旧版本写入配置里的绝对路径继续可用。
 */
export const LEGACY_HOME_DIRECTORY_NAMES = [".officeBuddy", ".astravia"] as const;

export type OfficeBuddyHomeMigrationStatus = "custom" | "not-needed" | "migrated" | "merged" | "legacy-fallback";

export interface OfficeBuddyHomeMigrationResult {
	homePath: string;
	status: OfficeBuddyHomeMigrationStatus;
	legacyPath?: string;
	copiedEntries?: number;
	error?: string;
}

interface OfficeBuddyHomeMigrationOptions {
	env?: NodeJS.ProcessEnv;
	homeDirectory?: string;
}

function expandHomePath(path: string, homeDirectory: string): string {
	if (path === "~") return homeDirectory;
	if (path.startsWith("~/")) return join(homeDirectory, path.slice(2));
	return path;
}

function copyMissingEntries(sourceDirectory: string, targetDirectory: string): number {
	mkdirSync(targetDirectory, { recursive: true });
	let copiedEntries = 0;
	for (const entry of readdirSync(sourceDirectory, { withFileTypes: true })) {
		const sourcePath = join(sourceDirectory, entry.name);
		const targetPath = join(targetDirectory, entry.name);
		if (!existsSync(targetPath)) {
			cpSync(sourcePath, targetPath, {
				recursive: entry.isDirectory(),
				force: false,
				errorOnExist: true,
				preserveTimestamps: true,
			});
			copiedEntries += 1;
			continue;
		}
		if (entry.isDirectory() && lstatSync(targetPath).isDirectory()) {
			copiedEntries += copyMissingEntries(sourcePath, targetPath);
		}
	}
	return copiedEntries;
}

/** 让 `legacyPath` 成为指向 `targetPath` 的别名；已是别名或真实目录时不动。 */
function ensureHomeAlias(legacyPath: string, targetPath: string): void {
	let stat: Stats | null = null;
	try {
		stat = lstatSync(legacyPath);
	} catch {
		// 不存在 → 直接创建别名。
	}
	try {
		if (!stat) {
			symlinkSync(targetPath, legacyPath, process.platform === "win32" ? "junction" : "dir");
			return;
		}
		if (stat.isSymbolicLink()) {
			// 悬空的旧别名（迁移把目标挪走后断链）→ 重建指向新根。
			try {
				realpathSync(legacyPath);
			} catch {
				symlinkSync(targetPath, legacyPath, process.platform === "win32" ? "junction" : "dir");
			}
		}
	} catch {
		// 别名创建失败不阻断迁移（新根已可用，旧绝对路径只是失去别名）。
	}
}

/**
 * Prepare the branded user-data root before any Desktop service is imported.
 * A simple first upgrade uses an atomic rename. If both roots already exist,
 * only missing entries are copied and the legacy tree is retained as a backup.
 * All historical roots (`.officeBuddy`, `.astravia`) are kept as alias symlinks
 * pointing at the new root so absolute paths stored by older versions survive.
 */
export function prepareOfficeBuddyHomeDirectory(
	options: OfficeBuddyHomeMigrationOptions = {},
): OfficeBuddyHomeMigrationResult {
	const env = options.env ?? process.env;
	const homeDirectory = options.homeDirectory ?? homedir();
	const explicitHome = env[ASTRAVIA_HOME_ENV]?.trim();
	if (explicitHome) {
		return { homePath: expandHomePath(explicitHome, homeDirectory), status: "custom" };
	}
	const explicitConfigDirectory = env[ASTRAVIA_CONFIG_DIR_ENV]?.trim();
	if (explicitConfigDirectory) {
		return { homePath: join(homeDirectory, explicitConfigDirectory), status: "custom" };
	}

	const homePath = join(homeDirectory, DEFAULT_CONFIG_DIR_NAME);
	const legacyPaths = LEGACY_HOME_DIRECTORY_NAMES.map((name) => join(homeDirectory, name));
	const presentLegacyPaths = legacyPaths.filter((path) => existsSync(path));
	// 新根尚不存在时无需去重；存在时剔除与新根同 realpath 的旧别名。
	const homePathExists = existsSync(homePath);
	const activeSources = presentLegacyPaths.filter((path) => {
		if (!homePathExists) return true;
		try {
			return realpathSync(path) !== realpathSync(homePath);
		} catch {
			return false;
		}
	});
	if (activeSources.length === 0) {
		return { homePath, status: "not-needed" };
	}

	const primaryPath = activeSources[0];
	try {
		if (!existsSync(homePath)) {
			renameSync(primaryPath, homePath);
			for (const legacyPath of legacyPaths) ensureHomeAlias(legacyPath, homePath);
			// 其余历史根（如并存的真实 .astravia）只补缺项，保留为备份。
			const copiedEntries = activeSources
				.slice(1)
				.reduce((sum, source) => sum + copyMissingEntries(source, homePath), 0);
			return {
				homePath,
				legacyPath: primaryPath,
				...(copiedEntries > 0 ? { copiedEntries } : {}),
				status: copiedEntries > 0 ? "merged" : "migrated",
			};
		}
		const copiedEntries = activeSources.reduce((sum, source) => sum + copyMissingEntries(source, homePath), 0);
		for (const legacyPath of legacyPaths) ensureHomeAlias(legacyPath, homePath);
		return { homePath, legacyPath: primaryPath, copiedEntries, status: "merged" };
	} catch (error) {
		return {
			homePath: primaryPath,
			legacyPath: primaryPath,
			status: "legacy-fallback",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
