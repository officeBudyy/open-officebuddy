import { describe, expect, it } from "vitest";
import { marketplaceArchiveUrl, marketplaceHost, marketplaceManifestUrl } from "./marketplace-hosts";

describe("marketplace hosts", () => {
	it("detects the hosting site from the repository URL", () => {
		expect(marketplaceHost("https://github.com/maomaochong-ai/astravia-official-marketplace")).toBe("github");
		expect(marketplaceHost("https://gitee.com/energyPlatform/office-marketplace")).toBe("gitee");
	});

	it("builds GitHub raw and archive URLs with the refs/heads convention", () => {
		expect(marketplaceManifestUrl("https://github.com/example/market", "main")).toBe(
			"https://github.com/example/market/raw/refs/heads/main/.astravia/marketplace.json",
		);
		expect(marketplaceArchiveUrl("https://github.com/example/market", "release/v2")).toBe(
			"https://github.com/example/market/archive/refs/heads/release/v2.zip",
		);
	});

	it("builds Gitee raw and archive URLs with the plain ref convention", () => {
		expect(marketplaceManifestUrl("https://gitee.com/energyPlatform/office-marketplace", "gh-pages")).toBe(
			"https://gitee.com/energyPlatform/office-marketplace/raw/gh-pages/.astravia/marketplace.json",
		);
		expect(marketplaceArchiveUrl("https://gitee.com/energyPlatform/office-marketplace", "gh-pages")).toBe(
			"https://gitee.com/energyPlatform/office-marketplace/repository/archive/gh-pages.zip",
		);
	});
});
