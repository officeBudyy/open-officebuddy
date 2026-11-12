import { describe, expect, it } from "vitest";

import { planVersionPrefixPrune } from "./r2-version-retention.mjs";

describe("R2 desktop version retention", () => {
	it("keeps the current version and prunes only semver sibling directories", () => {
		expect(
			planVersionPrefixPrune({
				prefix: "app/v0.6.0",
				version: "0.6.0",
				entries: ["v0.5.93/", "v0.6.0/", "latest/", "client-mobile/", "v0.6.0-notes.txt"],
			}),
		).toEqual(["app/v0.5.93"]);
	});

	it("supports prerelease directories and produces a stable unique plan", () => {
		expect(
			planVersionPrefixPrune({
				prefix: "/app/v0.6.0-2/",
				version: "v0.6.0-2",
				entries: ["v0.6.0/", "v0.5.93/", "v0.6.0/", "v0.6.0-2/"],
			}),
		).toEqual(["app/v0.5.93", "app/v0.6.0"]);
	});

	it("refuses an unscoped or mismatched deletion target", () => {
		expect(() =>
			planVersionPrefixPrune({ prefix: "v0.6.0", version: "0.6.0", entries: ["v0.5.93/"] }),
		).toThrow("unscoped");
		expect(() =>
			planVersionPrefixPrune({ prefix: "app/v0.5.93", version: "0.6.0", entries: ["v0.5.92/"] }),
		).toThrow("does not end in v0.6.0");
	});
});
