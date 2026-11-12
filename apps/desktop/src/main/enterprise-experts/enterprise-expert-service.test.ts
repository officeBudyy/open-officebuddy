import { describe, expect, it, vi } from "vitest";
import { EnterpriseExpertAuthError, type EnterpriseExpertClient } from "./enterprise-expert-client.js";
import { EnterpriseExpertService } from "./enterprise-expert-service.js";

function createVault(get: () => string | undefined) {
	return {
		get: vi.fn(get),
		put: vi.fn(),
		remove: vi.fn(),
	};
}

function createClient(): EnterpriseExpertClient {
	return {
		list: vi.fn(async () => []),
	} as unknown as EnterpriseExpertClient;
}

describe("EnterpriseExpertService credential recovery", () => {
	it("reports an undecryptable stored token as not configured", () => {
		const vault = createVault(() => {
			throw new Error("safeStorage decrypt failed");
		});
		const service = new EnterpriseExpertService(createClient(), vault);

		expect(service.hasToken()).toBe(false);
	});

	it("turns an undecryptable token into the normal auth-required flow", async () => {
		const vault = createVault(() => {
			throw new Error("safeStorage decrypt failed");
		});
		const client = createClient();
		const service = new EnterpriseExpertService(client, vault);
		const onAuthRequired = vi.fn();
		service.onAuthRequired(onAuthRequired);

		await expect(service.list()).rejects.toBeInstanceOf(EnterpriseExpertAuthError);
		expect(onAuthRequired).toHaveBeenCalledOnce();
		expect(client.list).not.toHaveBeenCalled();
	});
});
