import { describe, expect, it, vi } from "vitest";
import { agentTargetKey, enterpriseExpertTargetKey, teamTargetKey } from "./target";
import { createNewSessionTargetStrategyRegistry } from "./target-strategy";

describe("new-session target strategy registry", () => {
	it("resolves ordinary by default and team only when selected", async () => {
		const conversation = vi.fn(async () => undefined);
		const team = vi.fn(async () => undefined);
		const registry = createNewSessionTargetStrategyRegistry({
			conversationDispatch: conversation,
			teamDispatch: team,
			teamKey: teamTargetKey("team-1"),
			agentDispatch: vi.fn(async () => undefined),
			agentKey: null,
			enterpriseDispatch: vi.fn(async () => undefined),
			enterpriseKey: null,
		});
		await registry.resolve(null).dispatch();
		await registry.resolve(teamTargetKey("team-1")).dispatch();
		await expect(registry.resolve(teamTargetKey("missing")).dispatch()).rejects.toThrow("Unknown new-session target");
		expect(conversation).toHaveBeenCalledOnce();
		expect(team).toHaveBeenCalledOnce();
	});

	it("routes a selected agent to its own dispatch and never to the Team one", async () => {
		const team = vi.fn(async () => undefined);
		const agent = vi.fn(async () => undefined);
		const registry = createNewSessionTargetStrategyRegistry({
			conversationDispatch: vi.fn(async () => undefined),
			teamDispatch: team,
			teamKey: null,
			agentDispatch: agent,
			agentKey: agentTargetKey("agent-1"),
			enterpriseDispatch: vi.fn(async () => undefined),
			enterpriseKey: null,
		});
		await registry.resolve(agentTargetKey("agent-1")).dispatch();
		await expect(registry.resolve(teamTargetKey("team-1")).dispatch()).rejects.toThrow("Unknown new-session target");
		expect(agent).toHaveBeenCalledOnce();
		expect(team).not.toHaveBeenCalled();
	});

	it("routes a selected enterprise expert through the remote session dispatch", async () => {
		const enterprise = vi.fn(async () => undefined);
		const key = enterpriseExpertTargetKey("policy");
		const registry = createNewSessionTargetStrategyRegistry({
			conversationDispatch: vi.fn(async () => undefined),
			teamDispatch: vi.fn(async () => undefined),
			teamKey: null,
			agentDispatch: vi.fn(async () => undefined),
			agentKey: null,
			enterpriseDispatch: enterprise,
			enterpriseKey: key,
		});
		await registry.resolve(key).dispatch();
		expect(enterprise).toHaveBeenCalledOnce();
	});
});
