import { migrateVersionedConfig, type VersionedConfigMigrationResult } from "@astravia/toolkit/versioned-config";
import { migrateDesktopConfigV1ToV2 } from "./migrations/001_to_2.js";
import { migrateDesktopConfigV2ToV3 } from "./migrations/002_to_3.js";

export const DESKTOP_CONFIG_SCHEMA_VERSION = 3;

export function migrateDesktopConfig(value: unknown): VersionedConfigMigrationResult {
	return migrateVersionedConfig(value, {
		currentVersion: DESKTOP_CONFIG_SCHEMA_VERSION,
		initialVersion: 1,
		migrations: [migrateDesktopConfigV1ToV2, migrateDesktopConfigV2ToV3],
		futureVersionPolicy: "preserve",
	});
}
