import { describe, expect, it, vi } from "vitest";
import {
	EnterpriseExpertAuthError,
	EnterpriseExpertClient,
	parseEnterpriseExpertList,
} from "./enterprise-expert-client.js";

describe("EnterpriseExpertClient", () => {
	it("normalizes common enterprise expert list envelopes", () => {
		expect(
			parseEnterpriseExpertList({
				data: {
					records: [
						{
							agentId: "policy",
							agentName: "政策专家",
							description: "政策查询",
							avatarUrl: "https://img/expert.png",
						},
					],
				},
			}),
		).toEqual([{ id: "policy", name: "政策专家", description: "政策查询", avatarUrl: "https://img/expert.png" }]);
	});

	it("parses AG-UI SSE text deltas and sends both authorization headers", async () => {
		const fetchImpl = vi.fn(
			async (_url: string | URL | Request, _init?: RequestInit) =>
				new Response(
					[
						'data: {"type":"TEXT_MESSAGE_START"}',
						"",
						'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"山东"}',
						"",
						'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"政策"}',
						"",
						"data: [DONE]",
						"",
					].join("\n"),
					{ status: 200, headers: { "content-type": "text/event-stream" } },
				),
		);
		const chunks: Array<{ kind: "thinking" | "text"; delta: string }> = [];
		await new EnterpriseExpertClient(fetchImpl as typeof fetch).stream(
			"secret",
			{
				agentId: "policy",
				threadId: "thread",
				runId: "run",
				messages: [{ id: "message", role: "user", content: "查询政策" }],
			},
			(chunk) => chunks.push(chunk),
		);
		expect(chunks).toEqual([{ kind: "text", delta: "山东政策" }]);
		expect(fetchImpl.mock.calls[0]?.[1]?.headers).toMatchObject({
			authorization: "Bearer secret",
			"deframe-auth": "Bearer secret",
		});
	});

	it("keeps thinking deltas separate from final answer deltas", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					[
						'data: {"type":"THINKING_TEXT_MESSAGE_CONTENT","delta":"先检索"}',
						"",
						'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"最终答案"}',
						"",
					].join("\n"),
					{ status: 200 },
				),
		);
		const chunks: Array<{ kind: "thinking" | "text"; delta: string }> = [];
		await new EnterpriseExpertClient(fetchImpl as typeof fetch).stream(
			"secret",
			{
				agentId: "policy",
				threadId: "thread",
				runId: "run",
				messages: [],
			},
			(chunk) => chunks.push(chunk),
		);
		expect(chunks).toEqual([
			{ kind: "thinking", delta: "先检索" },
			{ kind: "text", delta: "最终答案" },
		]);
	});

	it("never renders tool arguments as answer text and prefers the final message snapshot", async () => {
		const fetchImpl = vi.fn(
			async () =>
				new Response(
					[
						'data: {"type":"TEXT_MESSAGE_CONTENT","delta":"让我先搜索。"}',
						"",
						'data: {"type":"TOOL_CALL_START","toolCallId":"call-1","toolCallName":"search_memories"}',
						"",
						'data: {"type":"TOOL_CALL_ARGS","toolCallId":"call-1","delta":"{\\"query\\":\\"虚拟电厂\\"}"}',
						"",
						'data: {"type":"MESSAGES_SNAPSHOT","messages":[{"role":"assistant","content":"让我先搜索。","toolCalls":[{"id":"call-1"}]},{"role":"assistant","content":"虚拟电厂可以参与需求响应。"}]}',
						"",
						'data: {"type":"RUN_FINISHED"}',
						"",
					].join("\n"),
					{ status: 200 },
				),
		);
		const chunks: Array<{ kind: "thinking" | "text"; delta: string }> = [];
		await new EnterpriseExpertClient(fetchImpl as typeof fetch).stream(
			"secret",
			{ agentId: "policy", threadId: "thread", runId: "run", messages: [] },
			(chunk) => chunks.push(chunk),
		);
		expect(chunks).toEqual([
			{ kind: "thinking", delta: "让我先搜索。" },
			{ kind: "text", delta: "虚拟电厂可以参与需求响应。" },
		]);
		expect(JSON.stringify(chunks)).not.toContain("query");
	});

	it("reports an expired token without consuming the response body", async () => {
		const client = new EnterpriseExpertClient(
			vi.fn(async () => new Response("expired", { status: 401 })) as typeof fetch,
		);
		await expect(client.list("expired")).rejects.toBeInstanceOf(EnterpriseExpertAuthError);
	});
});
