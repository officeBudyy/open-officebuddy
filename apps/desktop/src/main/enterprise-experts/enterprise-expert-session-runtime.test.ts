import type { Message } from "@astravia/ai";
import type { RuntimeHost, SessionEvent } from "@astravia/runtime-core";
import { describe, expect, it, vi } from "vitest";
import { EnterpriseExpertSessionRuntime } from "./enterprise-expert-session-runtime.js";

describe("EnterpriseExpertSessionRuntime", () => {
	it("executes remotely, streams standard events, and persists both messages locally", async () => {
		const messages: Message[] = [];
		const appendConversationMessage = vi.fn(async (_sessionId: string, record: { message: Message }) => {
			messages.push(record.message);
			return { entryId: `entry-${messages.length}` };
		});
		const runtime = {
			appendConversationMessage,
			getMessages: () => [...messages],
			renameSessionById: vi.fn(async () => undefined),
		} as unknown as RuntimeHost;
		const remoteStream = vi.fn(
			async (_request: unknown, onChunk: (chunk: { kind: "text"; delta: string }) => void) => {
				onChunk({ kind: "text", delta: "远程" });
				onChunk({ kind: "text", delta: "结果" });
			},
		);
		const bridge = new EnterpriseExpertSessionRuntime(runtime, { stream: remoteStream });
		bridge.register("session", { expert: { id: "policy", name: "政策专家" }, threadId: "thread" });
		const events: SessionEvent[] = [];
		bridge.subscribe("session", (event) => events.push(event));

		await expect(
			bridge.prompt("session", { text: "查询山东政策", messageId: "optimistic-user" }),
		).resolves.toMatchObject({ status: "completed" });
		expect(remoteStream).toHaveBeenCalledOnce();
		expect(appendConversationMessage.mock.calls[0]?.[1]).toMatchObject({ id: "optimistic-user" });
		expect(messages.map((message) => message.role)).toEqual(["user", "assistant"]);
		expect(messages[1]).toMatchObject({ content: [{ type: "text", text: "远程结果" }] });
		expect(messages[1]).toMatchObject({ provider: "", model: "" });
		expect(events.map((event) => event.type)).toEqual([
			"conversation.turn.started",
			"conversation.message.appended",
			"start",
			"text_start",
			"text_delta",
			"text_delta",
			"text_end",
			"done",
			"conversation.turn.completed",
		]);
		expect(events[1]).toMatchObject({
			type: "conversation.message.appended",
			messageId: "optimistic-user",
			message: { role: "user", content: "查询山东政策" },
		});
	});

	it("continues once when the first remote run only produces a server-side tool step", async () => {
		const messages: Message[] = [];
		const runtime = {
			appendConversationMessage: vi.fn(async (_sessionId: string, record: { message: Message }) => {
				messages.push(record.message);
				return { entryId: "entry" };
			}),
			getMessages: () => [...messages],
			renameSessionById: vi.fn(async () => undefined),
		} as unknown as RuntimeHost;
		let run = 0;
		const stream = vi.fn(
			async (_request: unknown, onChunk: (chunk: { kind: "thinking" | "text"; delta: string }) => void) => {
				run += 1;
				onChunk(run === 1 ? { kind: "thinking", delta: "正在查询" } : { kind: "text", delta: "最终答案" });
			},
		);
		const bridge = new EnterpriseExpertSessionRuntime(runtime, { stream });
		bridge.register("session", { expert: { id: "policy", name: "政策专家" }, threadId: "thread" });

		await bridge.prompt("session", { text: "查询" });
		expect(stream).toHaveBeenCalledTimes(2);
		expect(messages.at(-1)).toMatchObject({
			content: [
				{ type: "thinking", thinking: "正在查询" },
				{ type: "text", text: "最终答案" },
			],
		});
	});

	it("projects reasoning and final answer into separate assistant content blocks", async () => {
		const messages: Message[] = [];
		const runtime = {
			appendConversationMessage: vi.fn(async (_sessionId: string, record: { message: Message }) => {
				messages.push(record.message);
				return { entryId: "entry" };
			}),
			getMessages: () => [...messages],
			renameSessionById: vi.fn(async () => undefined),
		} as unknown as RuntimeHost;
		const bridge = new EnterpriseExpertSessionRuntime(runtime, {
			stream: async (_request, onChunk) => {
				onChunk({ kind: "thinking", delta: "先分析" });
				onChunk({ kind: "text", delta: "最终答案" });
			},
		});
		bridge.register("session", { expert: { id: "policy", name: "政策专家" }, threadId: "thread" });
		const events: SessionEvent[] = [];
		bridge.subscribe("session", (event) => events.push(event));

		await bridge.prompt("session", { text: "查询" });
		expect(messages.at(-1)).toMatchObject({
			content: [
				{ type: "thinking", thinking: "先分析" },
				{ type: "text", text: "最终答案" },
			],
		});
		expect(events.map((event) => event.type)).toContain("thinking_end");
	});

	it("cancels the remote request without falling back to a local prompt", async () => {
		const runtime = {
			appendConversationMessage: vi.fn(async () => ({ entryId: "entry" })),
			getMessages: () => [{ role: "user", content: "wait", timestamp: Date.now() }],
			renameSessionById: vi.fn(),
		} as unknown as RuntimeHost;
		const bridge = new EnterpriseExpertSessionRuntime(runtime, {
			stream: (_request, _onChunk, signal) =>
				new Promise((_resolve, reject) => {
					if (signal?.aborted) {
						reject(new DOMException("Aborted", "AbortError"));
						return;
					}
					signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
				}),
		});
		bridge.register("session", { expert: { id: "slow", name: "慢专家" }, threadId: "thread" });
		const running = bridge.prompt("session", { text: "wait" });
		expect(bridge.abort("session")).toBe(true);
		await expect(running).resolves.toMatchObject({ status: "cancelled" });
	});
});
