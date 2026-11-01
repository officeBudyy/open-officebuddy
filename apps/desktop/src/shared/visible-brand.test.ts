import { describe, expect, it } from "vitest";
import { applyVisibleBrand, VISIBLE_BRAND_NAME } from "./visible-brand";

describe("visible brand", () => {
	it("brands nested user-visible copy without mutating upstream resources", () => {
		const upstream = {
			title: "Astravia",
			nested: ["Ask Astravia for help", { hint: "打开 Astravia" }],
		};

		expect(applyVisibleBrand(upstream)).toEqual({
			title: "officebuddy",
			nested: ["Ask officebuddy for help", { hint: "打开 officebuddy" }],
		});
		expect(upstream.title).toBe("Astravia");
		expect(VISIBLE_BRAND_NAME).toBe("officebuddy");
	});

	it("preserves compatibility identifiers and compound code names", () => {
		const identifiers = ["@astravia/ai", ".astravia", "astravia://settings", "ASTRAVIA_API_KEY", "AstraviaKit"];

		expect(applyVisibleBrand(identifiers)).toEqual(identifiers);
	});
});
