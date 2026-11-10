import { ASTRAVIA_HOME_ENV } from "@astravia/action-rpc";
import { prepareOfficeBuddyHomeDirectory } from "./home-directory-migration.js";

const homeMigration = prepareOfficeBuddyHomeDirectory();
process.env[ASTRAVIA_HOME_ENV] = homeMigration.homePath;

if (homeMigration.status === "migrated") {
	console.info(`[home-migration] moved ${homeMigration.legacyPath} to ${homeMigration.homePath}`);
} else if (homeMigration.status === "merged") {
	console.info(
		`[home-migration] copied ${homeMigration.copiedEntries ?? 0} missing entries into ${homeMigration.homePath}; ` +
			`legacy backup retained at ${homeMigration.legacyPath}`,
	);
} else if (homeMigration.status === "legacy-fallback") {
	console.error(
		`[home-migration] could not prepare ${homeMigration.homePath}; continuing with ${homeMigration.legacyPath}: ${homeMigration.error}`,
	);
}

await import("./main.js");
