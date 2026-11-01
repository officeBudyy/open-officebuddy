import type { Message } from "@astravia/ai";
import type { SessionInput } from "@astravia/runtime-core/kernel";

export type PdfTaskProfile =
	| "none"
	| "pdf_text_extract"
	| "pdf_transcription"
	| "pdf_full_audit"
	| "pdf_question_answering";

export type PdfOcrWorkflowStage = "not_required" | "extract" | "review" | "complete";

export interface PdfOcrWorkflowContext {
	readonly profile: PdfTaskProfile;
	readonly stage: PdfOcrWorkflowStage;
	readonly workflowMessages: readonly Message[];
	readonly inherited: boolean;
}

const DISCOVERY_TOOLS = new Set(["find", "glob", "ls", "dir_tree", "tree", "progress", "ask_user_question"]);

export function classifyPdfTask(input: SessionInput | undefined): PdfTaskProfile {
	const text = readInputText(input);
	if (!/\.pdf\b/i.test(text)) return "none";
	const hasOcrIntent = /\bocr\b|文字识别|扫描件|扫描版|离线识别/i.test(text);
	if (!hasOcrIntent)
		return /[?？]|是否|什么|哪些|why|what|which|question/i.test(text) ? "pdf_question_answering" : "pdf_text_extract";
	if (/逐页(?:复核|审计|校对)|完整审计|全量(?:复核|校对)|full[ -]?audit|every page/i.test(text)) {
		return "pdf_full_audit";
	}
	if (/\.docx\b|转写|誊写|忠实|保留标题|保留.*(?:段落|表格)|待核对|不得?凭.*猜|reconstruct|transcri/i.test(text)) {
		return "pdf_transcription";
	}
	return /[?？]|是否|什么|哪些|why|what|which|question/i.test(text) ? "pdf_question_answering" : "pdf_text_extract";
}

export function requiresPdfOcrWorkflow(profile: PdfTaskProfile): boolean {
	return profile === "pdf_transcription" || profile === "pdf_full_audit";
}

export function readPdfOcrWorkflowStage(profile: PdfTaskProfile, messages: readonly Message[]): PdfOcrWorkflowStage {
	if (!requiresPdfOcrWorkflow(profile)) return "not_required";
	const extracted = hasSuccessfulWorkflowToolResult(messages, "extract_text_from_pdf");
	if (!extracted) return "extract";
	const reviewed = hasSuccessfulWorkflowToolResult(messages, "prepare_ocr_review");
	return reviewed ? "complete" : "review";
}

export function resolvePdfOcrWorkflowContext(
	input: SessionInput | undefined,
	messages: readonly Message[],
): PdfOcrWorkflowContext {
	const directProfile = classifyPdfTask(input);
	if (directProfile !== "none") {
		const workflowMessages = messagesAfterCurrentInput(input, messages);
		return {
			profile: directProfile,
			stage: readPdfOcrWorkflowStage(directProfile, workflowMessages),
			workflowMessages,
			inherited: false,
		};
	}
	if (!isContinuationInput(input)) return noWorkflowContext();

	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "user") continue;
		const text = readMessageText(message);
		if (isContinuationText(text)) continue;
		const profile = classifyPdfTask({ message });
		if (!requiresPdfOcrWorkflow(profile)) return noWorkflowContext();
		const workflowMessages = messages.slice(index + 1);
		const stage = readPdfOcrWorkflowStage(profile, workflowMessages);
		return stage === "complete" ? noWorkflowContext() : { profile, stage, workflowMessages, inherited: true };
	}
	return noWorkflowContext();
}

export function assertPdfOcrWorkflowToolAllowed(request: {
	readonly turnInput?: SessionInput;
	readonly messages?: readonly Message[];
	readonly toolName: string;
	readonly toolInput: unknown;
}): void {
	const { profile, stage } = resolvePdfOcrWorkflowContext(request.turnInput, request.messages ?? []);
	if (stage === "not_required" || stage === "complete") return;
	if (DISCOVERY_TOOLS.has(request.toolName)) return;

	if (stage === "extract") {
		if (
			request.toolName === "extract_text_from_pdf" &&
			readRecordString(request.toolInput, "mode") === "transcription"
		) {
			return;
		}
		throw new Error(
			'OCR transcription must start with extract_text_from_pdf(mode="transcription"). Existing OCR JSON, shell commands, page rendering, and manual reads cannot replace the source-validated extraction step.',
		);
	}

	if (request.toolName === "prepare_ocr_review") {
		const reviewMode = readRecordString(request.toolInput, "reviewMode") ?? "transcription";
		if (profile === "pdf_full_audit" ? reviewMode === "full_audit" : reviewMode === "transcription") return;
		throw new Error(
			`OCR ${profile === "pdf_full_audit" ? "full audit" : "transcription"} requires reviewMode="${
				profile === "pdf_full_audit" ? "full_audit" : "transcription"
			}"; reviewMode="${reviewMode}" is not valid for this task.`,
		);
	}
	throw new Error(
		"OCR extraction is complete, but visual coverage review is still required. Call prepare_ocr_review once before using shell/read/write or finishing the task.",
	);
}

export function completionInstructionForPdfOcrWorkflow(
	input: SessionInput | undefined,
	messages: readonly Message[],
): string | undefined {
	const { profile, stage } = resolvePdfOcrWorkflowContext(input, messages);
	if (stage === "extract") {
		return 'The requested PDF transcription workflow has not run. Call extract_text_from_pdf with mode="transcription" on the source PDF; do not reuse an unvalidated OCR JSON file.';
	}
	if (stage === "review") {
		return `The OCR baseline exists, but required visual coverage is incomplete. Call prepare_ocr_review with reviewMode="${
			profile === "pdf_full_audit" ? "full_audit" : "transcription"
		}" before producing the final answer.`;
	}
	return undefined;
}

function messagesAfterCurrentInput(input: SessionInput | undefined, messages: readonly Message[]): readonly Message[] {
	const inputText = readInputText(input).trim();
	let lastUserIndex = -1;
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		if (messages[index].role !== "user") continue;
		lastUserIndex = index;
		break;
	}
	if (lastUserIndex < 0) return messages;
	return readMessageText(messages[lastUserIndex]).trim() === inputText ? messages.slice(lastUserIndex + 1) : [];
}

function isContinuationInput(input: SessionInput | undefined): boolean {
	return isContinuationText(readInputText(input));
}

function isContinuationText(text: string): boolean {
	return /^(?:继续|继续执行|接着做|重试|再试一次|continue|resume|retry)[。.!！?？\s]*$/i.test(text.trim());
}

function noWorkflowContext(): PdfOcrWorkflowContext {
	return { profile: "none", stage: "not_required", workflowMessages: [], inherited: false };
}

function readMessageText(message: Message): string {
	if (typeof message.content === "string") return message.content;
	return message.content
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

export function resolvePdfTranscriptionModelCallBudget(pageCount: number): {
	readonly maxModelCalls: number;
	readonly reviewAtModelCalls: number;
} {
	const safePages = Math.max(1, Math.floor(pageCount));
	const pageBatches = Math.ceil(safePages / 25);
	const estimatedReviewSheets = Math.ceil((safePages * 2) / 16);
	const reviewBatches = Math.ceil(estimatedReviewSheets / 4);
	const maxModelCalls = Math.max(
		16,
		Math.min(48, 16 + 2 * Math.max(0, pageBatches - 1) + 2 * Math.max(0, reviewBatches - 1)),
	);
	return { maxModelCalls, reviewAtModelCalls: maxModelCalls - 4 };
}

export function readPdfOcrPageCount(details: unknown): number | undefined {
	if (!isRecord(details) || !isRecord(details.workflow)) return undefined;
	if (details.workflow.kind !== "pdf_transcription") return undefined;
	const pageCount = details.workflow.pageCount;
	return typeof pageCount === "number" && Number.isSafeInteger(pageCount) && pageCount > 0 ? pageCount : undefined;
}

function hasSuccessfulWorkflowToolResult(messages: readonly Message[], toolName: string): boolean {
	return messages.some(
		(message) => message.role === "toolResult" && message.toolName === toolName && message.isError !== true,
	);
}

function readInputText(input: SessionInput | undefined): string {
	const content = input?.message.content;
	if (typeof content === "string") return content;
	return (content ?? [])
		.filter((block) => block.type === "text")
		.map((block) => block.text)
		.join("\n");
}

function readRecordString(value: unknown, key: string): string | undefined {
	return isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
