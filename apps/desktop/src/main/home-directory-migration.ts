import {
	cpSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	realpathSync,
	renameSync,
	symlinkSync,
} from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
	ASTRAVIA_CONFIG_DIR_ENV,
	ASTRAVIA_HOME_ENV,
	DEFAULT_CONFIG_DIR_NAME,
} from "@astravia/action-rpc";

export const LEGACY_HOME_DIRECTORY_NAME = ".astravia";

export type OfficeBuddyHomeMigrationStatus =
	| "custom"
	| "not-needed"
	| "migrated"
	| "merged"
	| "legacy-fallback";

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

/**
 * Prepare the branded user-data root before any Desktop service is imported.
 * A simple first upgrade uses an atomic rename. If both roots already exist,
 * only missing entries are copied and the legacy tree is retained as a backup.
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

	const legacyPath = join(homeDirectory, LEGACY_HOME_DIRECTORY_NAME);
	const homePath = join(homeDirectory, DEFAULT_CONFIG_DIR_NAME);
	if (!existsSync(legacyPath)) return { homePath, status: "not-needed" };
	if (existsSync(homePath) && realpathSync(legacyPath) === realpathSync(homePath)) {
		return { homePath, legacyPath, status: "not-needed" };
	}

	try {
		if (!existsSync(homePath)) {
			renameSync(legacyPath, homePath);
			try {
				// Stored project/session paths may still contain ~/.astravia. Keep a
				// compatibility alias while all new writes use ~/.officeBuddy.
				symlinkSync(homePath, legacyPath, process.platform === "win32" ? "junction" : "dir");
			} catch (error) {
				renameSync(homePath, legacyPath);
				throw error;
			}
			return { homePath, legacyPath, status: "migrated" };
		}
		const copiedEntries = copyMissingEntries(legacyPath, homePath);
		return { homePath, legacyPath, copiedEntries, status: "merged" };
	} catch (error) {
		return {
			homePath: legacyPath,
			legacyPath,
			status: "legacy-fallback",
			error: error instanceof Error ? error.message : String(error),
		};
	}
}
