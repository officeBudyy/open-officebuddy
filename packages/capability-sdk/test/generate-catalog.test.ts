import { existsSync } from "node:fs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { generateCapabilityCatalog } from "../scripts/generate-catalog.js";

describe("capability catalog generator", () => {
	let temporaryDirectory: string | undefined;

	afterEach(async () => {
		vi.restoreAllMocks();
		if (temporaryDirectory) await rm(temporaryDirectory, { force: true, recursive: true });
	});

	it("skips the documentation check when this branch does not contain docs/capabilities", async () => {
		temporaryDirectory = await mkdtemp(join(tmpdir(), "capability-catalog-"));
		const docsDirectory = join(temporaryDirectory, "missing", "docs", "capabilities");
		const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

		await expect(generateCapabilityCatalog({ check: true, docsDirectory })).resolves.toBe(true);

		expect(existsSync(docsDirectory)).toBe(false);
		expect(log).toHaveBeenCalledWith(
			"Capability Catalog documentation check skipped: docs/capabilities is not part of this branch.",
		);
	});
});
