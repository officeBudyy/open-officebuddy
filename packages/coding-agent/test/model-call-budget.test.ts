import type { AssistantMessage, Message } from "@astravia/ai";
import type { SessionInput } from "@astravia/runtime-core/kernel";
import { describe, expect, it } from "vitest";
import { createCodingAgentModelCallBudget } from "../src/composition/turn/model-call-budget.js";

const signal = new AbortController().signal;

describe("Coding Agent model-call budget", () => {
	it("sets a temporary entry cap for faithful OCR tasks and leaves generic tasks uncapped", async () => {
		const budget = createCodingAgentModelCallBudget(undefined);
		await expect(
			budget.resolveMaxModelCalls({
				input: input("对 scanned-report.pdf 做离线 OCR，生成 result.docx，无法确认写 [待核对]。"),
			}),
		).resolves.toBe(48);
		await expect(budget.resolveMaxModelCalls({ input: input("解释 packages/runtime.ts") })).resolves.toBeUndefined();
	});

	it("keeps the page-aware OCR budget across a continue turn and subtracts prior model calls", async () => {
		const original = input("对 scanned-report.pdf 做离线 OCR，生成 result.docx，无法确认写 [待核对]。");
		const messages = [
			original.message,
			...Array.from({ length: 4 }, (_, index) => assistant(`step ${index + 1}`)),
			toolResult("extract_text_from_pdf", {
				workflow: { kind: "pdf_transcription", pageCount: 12 },
			}),
		];

		await expect(
			createCodingAgentModelCallBudget(undefined).resolveMaxModelCalls({ input: input("继续"), messages }),
		).resolves.toBe(12);
	});

	it("fails closed at a soft threshold when no interactive question channel exists", async () => {
		const result = await createCodingAgentModelCallBudget(undefined).review({
			sessionId: "session",
			turnId: "turn",
			threshold: 12,
			modelCalls: 12,
			toolCalls: 5,
			signal,
		});

		expect(result).toMatchObject({
			action: "stop_after_response",
			instruction: expect.stringContaining("no interactive"),
		});
	});

	it("rejects a premature OCR completion until extraction and review results exist", async () => {
		const budget = createCodingAgentModelCallBudget(undefined);
		const task = input("对 scanned-report.pdf 做 OCR 转写，生成 result.docx。");
		await expect(budget.reviewCompletion({ input: task, messages: [] })).resolves.toMatchObject({
			action: "retry",
			instruction: expect.stringContaining("extract_text_from_pdf"),
		});
		await expect(
			budget.reviewCompletion({
				input: task,
				messages: [toolResult("extract_text_from_pdf"), toolResult("prepare_ocr_review")],
			}),
		).resolves.toEqual({ action: "accept" });
	});
});

function input(text: string): SessionInput {
	return { message: { role: "user", content: text, timestamp: 1 } };
}

function toolResult(toolName: string, details: unknown = {}): Message {
	return {
		role: "toolResult" as const,
		toolCallId: `${toolName}-call`,
		toolName,
		content: [{ type: "text" as const, text: "ok" }],
		details,
		isError: false,
		timestamp: 1,
	};
}

function assistant(text: string): AssistantMessage {
	return {
		role: "assistant" as const,
		content: [{ type: "text" as const, text }],
		api: "openai-responses",
		provider: "test",
		model: "test",
		usage: {
			input: 1,
			output: 1,
			cacheRead: 0,
			cacheWrite: 0,
			totalTokens: 2,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 },
		},
		stopReason: "stop" as const,
		timestamp: 1,
	};
}
