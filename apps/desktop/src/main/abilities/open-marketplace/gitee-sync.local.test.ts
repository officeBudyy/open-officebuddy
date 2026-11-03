import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import { OpenMarketplaceService } from "./open-marketplace-service";

const { marketplaceLog } = vi.hoisted(() => ({
	marketplaceLog: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

vi.mock("../../logger", () => ({ getAppLogger: () => marketplaceLog }));

/**
 * 真实网络集成验证：从 gitee 官方分发分支（gh-pages）完整拉取一次市场快照。
 * 默认跳过；需要验证 gitee 链路时设置 `ASTRAVIA_GITEE_INTEGRATION=1` 手动运行。
 * 不进 CI：依赖外网与 gitee 风控策略，且耗时数十秒。
 */
describe.skipIf(!process.env.ASTRAVIA_GITEE_INTEGRATION)("OpenMarketplaceService gitee integration", () => {
	it("syncs the official gitee gh-pages distribution over the network", async () => {
		const rootDir = await mkdtemp(join(tmpdir(), "astravia-gitee-integration-"));
		try {
			const service = new OpenMarketplaceService({
				appVersion: "0.5.82",
				rootDir,
				repository: "https://gitee.com/energyPlatform/office-marketplace",
				sourceRef: "gh-pages",
			});
			const snapshot = await service.refresh();
			expect(snapshot.error).toBeUndefined();
			expect(snapshot.marketplaceVersion).toBeTruthy();
			expect(snapshot.abilities.length).toBeGreaterThan(0);
			expect(snapshot.repository).toBe("https://gitee.com/energyPlatform/office-marketplace");
		} finally {
			await rm(rootDir, { recursive: true, force: true });
		}
	}, 240_000);
});
