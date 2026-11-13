import { homedir } from "node:os";
import { join } from "node:path";
import type { ConfigRecord, VersionedConfigMigration } from "@astravia/toolkit/versioned-config";

const LEGACY_DEFAULT_WORKSPACE = "~/.officeBuddy/workspace";
const CURRENT_DEFAULT_WORKSPACE = "~/officeBuddy/workspace";

function migrateDefaultWorkspacePath(value: unknown): unknown {
	if (value === LEGACY_DEFAULT_WORKSPACE || value === join(homedir(), ".officeBuddy", "workspace")) {
		return CURRENT_DEFAULT_WORKSPACE;
	}
	return value;
}

export const migrateDesktopConfigV2ToV3: VersionedConfigMigration = {
	fromVersion: 2,
	toVersion: 3,
	migrate(config: ConfigRecord): ConfigRecord {
		return {
			...config,
			workspacePath: migrateDefaultWorkspacePath(config.workspacePath),
		};
	},
};
