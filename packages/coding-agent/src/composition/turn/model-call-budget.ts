import type { Message } from "@astravia/ai";
import type { SessionInput } from "@astravia/runtime-core/kernel";
import {
	completionInstructionForPdfOcrWorkflow,
	readPdfOcrPageCount,
	requiresPdfOcrWorkflow,
	resolvePdfOcrWorkflowContext,
	resolvePdfTranscriptionModelCallBudget,
} from "../../execution/turn/ocr-workflow-policy.js";
import { CODING_AGENT_ASK_USER_QUESTION_FUNCTION } from "../../features/ask-user-question/contracts.js";
import type { CodingAgentRuntimeCompositionOptions } from "../contracts/index.js";

export function createCodingAgentModelCallBudget(
	functions: CodingAgentRuntimeCompositionOptions["sessionExtensionFunctions"],
) {
	return {
		thresholds: [20, 40],
		async resolveMaxModelCalls({
			input,
			messages = [],
		}: {
			readonly input?: SessionInput;
			readonly messages?: readonly Message[];
		}) {
			const context = resolvePdfOcrWorkflowContext(input, messages);
			if (!requiresPdfOcrWorkflow(context.profile)) return undefined;
			const pageCount = findLatestOcrPageCount(context.workflowMessages);
			const maxModelCalls = pageCount ? resolvePdfTranscriptionModelCallBudget(pageCount).maxModelCalls : 48;
			if (!context.inherited) return maxModelCalls;
			const priorModelCalls = context.workflowMessages.filter((message) => message.role === "assistant").length;
			return Math.max(1, maxModelCalls - priorModelCalls);
		},
		async review({
			sessionId,
			turnId,
			threshold,
			modelCalls,
			toolCalls,
			signal,
		}: {
			readonly sessionId: string;
			readonly turnId: string;
			readonly threshold: number;
			readonly modelCalls: number;
			readonly toolCalls: number;
			readonly signal: AbortSignal;
		}) {
			if (!functions?.has(CODING_AGENT_ASK_USER_QUESTION_FUNCTION)) {
				return {
					action: "stop_after_response" as const,
					instruction:
						"This run reached its model-call safety threshold, and no interactive approval channel is available. Do not call tools. Summarize completed work, remaining work, and output paths, then stop.",
				};
			}
			const continueLabel = "继续执行";
			const result = await functions.invoke(
				CODING_AGENT_ASK_USER_QUESTION_FUNCTION,
				{
					requestId: `model-budget-${turnId}-${threshold}-${Date.now()}`,
					sessionId,
					questions: [
						{
							header: "调用预警",
							question: `本轮任务已调用模型 ${modelCalls} 次、工具 ${toolCalls} 次。继续执行可能显著增加耗时和 Token，是否继续？`,
							options: [
								{ label: continueLabel, description: "保留当前上下文继续，但要求先收敛剩余步骤。" },
								{ label: "暂停并总结", description: "停止调用工具，输出当前进度和剩余事项。" },
							],
						},
					],
				},
				signal,
			);
			const shouldContinue =
				!result.cancelled && result.answers.some((answer) => answer.answers.includes(continueLabel));
			return { action: shouldContinue ? ("continue" as const) : ("stop_after_response" as const) };
		},
		async reviewCompletion({
			input,
			messages,
		}: {
			readonly input?: SessionInput;
			readonly messages: readonly Message[];
		}) {
			const instruction = completionInstructionForPdfOcrWorkflow(input, messages);
			return instruction ? { action: "retry" as const, instruction } : { action: "accept" as const };
		},
	};
}

function findLatestOcrPageCount(messages: readonly Message[]): number | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message.role !== "toolResult" || message.toolName !== "extract_text_from_pdf" || message.isError) continue;
		const pageCount = readPdfOcrPageCount(message.details);
		if (pageCount !== undefined) return pageCount;
	}
	return undefined;
}
