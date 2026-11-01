import type { AssistantMessage, Message } from "@astravia/ai";
import type { SessionInput } from "@astravia/runtime-core/kernel";
import { describe, expect, it } from "vitest";
import {
	assertPdfOcrWorkflowToolAllowed,
	classifyPdfTask,
	completionInstructionForPdfOcrWorkflow,
	readPdfOcrWorkflowStage,
	resolvePdfOcrWorkflowContext,
	resolvePdfTranscriptionModelCallBudget,
} from "../src/execution/turn/ocr-workflow-policy.js";

const task = input(
	"对 02-documents/scanned-report.pdf 做离线 OCR，生成 outputs/08-ocr-result.docx；保留标题、段落和表格，无法确认用 [待核对]，禁止猜测。",
);

describe("PDF OCR workflow policy", () => {
	it("classifies faithful PDF-to-DOCX work separately from generic PDF questions", () => {
		expect(classifyPdfTask(task)).toBe("pdf_transcription");
		expect(classifyPdfTask(input("请问 report.pdf 一共有多少页？"))).toBe("pdf_question_answering");
		expect(classifyPdfTask(input("修复软件里的 PDF OCR 调用逻辑"))).toBe("none");
	});

	it("requires source extraction and coverage review before unrestricted tools", () => {
		expect(() =>
			assertPdfOcrWorkflowToolAllowed({ turnInput: task, toolName: "bash", toolInput: {}, messages: [] }),
		).toThrow("must start with extract_text_from_pdf");
		expect(() =>
			assertPdfOcrWorkflowToolAllowed({
				turnInput: task,
				toolName: "extract_text_from_pdf",
				toolInput: { mode: "transcription" },
				messages: [],
			}),
		).not.toThrow();

		const afterExtract = [toolResult("extract_text_from_pdf")];
		expect(readPdfOcrWorkflowStage("pdf_transcription", afterExtract)).toBe("review");
		expect(() =>
			assertPdfOcrWorkflowToolAllowed({
				turnInput: task,
				toolName: "write",
				toolInput: {},
				messages: afterExtract,
			}),
		).toThrow("visual coverage review");
		expect(() =>
			assertPdfOcrWorkflowToolAllowed({
				turnInput: task,
				toolName: "prepare_ocr_review",
				toolInput: { reviewMode: "sampled" },
				messages: afterExtract,
			}),
		).toThrow('requires reviewMode="transcription"');
	});

	it("rejects premature completion with a concrete next workflow step", () => {
		expect(completionInstructionForPdfOcrWorkflow(task, [])).toContain("extract_text_from_pdf");
		expect(completionInstructionForPdfOcrWorkflow(task, [toolResult("extract_text_from_pdf")])).toContain(
			"prepare_ocr_review",
		);
		expect(
			completionInstructionForPdfOcrWorkflow(task, [
				toolResult("extract_text_from_pdf"),
				toolResult("prepare_ocr_review"),
			]),
		).toBeUndefined();
	});

	it("inherits an unfinished OCR workflow only for an explicit continuation", () => {
		const history = [task.message, assistant("starting"), toolResult("extract_text_from_pdf")];
		expect(resolvePdfOcrWorkflowContext(input("继续"), history)).toMatchObject({
			profile: "pdf_transcription",
			stage: "review",
			inherited: true,
		});
		expect(resolvePdfOcrWorkflowContext(input("解释另一个问题"), history).profile).toBe("none");
		expect(() =>
			assertPdfOcrWorkflowToolAllowed({
				turnInput: input("继续"),
				toolName: "bash",
				toolInput: {},
				messages: history,
			}),
		).toThrow("visual coverage review");
	});

	it("does not reuse completed OCR tool results for a new PDF task", () => {
		const history = [
			task.message,
			toolResult("extract_text_from_pdf"),
			toolResult("prepare_ocr_review"),
			input("对 another.pdf 做 OCR 转写，生成 another.docx。").message,
		];
		expect(
			resolvePdfOcrWorkflowContext(input("对 another.pdf 做 OCR 转写，生成 another.docx。"), history),
		).toMatchObject({ profile: "pdf_transcription", stage: "extract", inherited: false });
	});

	it.each([
		[12, { maxModelCalls: 16, reviewAtModelCalls: 12 }],
		[50, { maxModelCalls: 20, reviewAtModelCalls: 16 }],
		[100, { maxModelCalls: 28, reviewAtModelCalls: 24 }],
	])("scales the run budget for %i pages", (pages, expected) => {
		expect(resolvePdfTranscriptionModelCallBudget(pages)).toEqual(expected);
	});
});

function input(text: string): SessionInput {
	return { message: { role: "user", content: text, timestamp: 1 } };
}

function toolResult(toolName: string): Message {
	return {
		role: "toolResult",
		toolCallId: `${toolName}-call`,
		toolName,
		content: [{ type: "text", text: "ok" }],
		details: {},
		isError: false,
		timestamp: 1,
	};
}

function assistant(text: string): AssistantMessage {
	return {
		role: "assistant",
		content: [{ type: "text", text }],
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
		stopReason: "stop",
		timestamp: 1,
	};
}
