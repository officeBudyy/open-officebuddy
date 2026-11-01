import type { Message, ToolCall, ToolResultMessage } from "@astravia/ai";
import { Value } from "@sinclair/typebox/value";
import { AgentToolExecutionError } from "../tool-execution-error.js";
import type {
	AgentExecutionEvent,
	AgentInputCollector,
	AgentResolvedModelCallBudget,
	AgentToolPhase,
	AgentToolPolicy,
	RuntimeToolDefinition,
	RuntimeToolResult,
} from "./types.js";

interface ExecuteToolCallsRequest {
	readonly calls: readonly ToolCall[];
	readonly tools: readonly RuntimeToolDefinition[];
	readonly messages: readonly Message[];
	readonly modelCallIndex: number;
	readonly signal: AbortSignal;
	readonly policy: AgentToolPolicy;
	readonly emit: (event: AgentExecutionEvent) => void;
	readonly takeSteeringMessages?: AgentInputCollector;
}

const MAX_PARALLEL_TOOL_CALLS = 4;

export interface ToolExecutionBatchResult {
	readonly results: readonly ToolResultMessage[];
	readonly steeringMessages?: readonly Message[];
	readonly terminalFailure?: ToolResultMessage;
	readonly maxModelCalls?: number;
	readonly reviewAtModelCalls?: number;
}

interface ToolExecutionOutcome {
	readonly result: ToolResultMessage;
	readonly terminalFailure?: ToolResultMessage;
	readonly maxModelCalls?: number;
	readonly reviewAtModelCalls?: number;
}

export async function executeRuntimeToolCalls(request: ExecuteToolCallsRequest): Promise<ToolExecutionBatchResult> {
	const results: ToolResultMessage[] = [];
	let maxModelCalls: number | undefined;
	let reviewAtModelCalls: number | undefined;
	for (let index = 0; index < request.calls.length; ) {
		request.signal.throwIfAborted();
		const batch = collectExecutionBatch(request.calls, request.tools, index);
		const batchOutcomes =
			batch.length === 1
				? [await executeOne(batch[0], request)]
				: await Promise.all(batch.map((call) => executeOne(call, request)));
		results.push(...batchOutcomes.map(({ result }) => result));
		for (const outcome of batchOutcomes) {
			if (outcome.maxModelCalls !== undefined) {
				maxModelCalls = Math.min(maxModelCalls ?? outcome.maxModelCalls, outcome.maxModelCalls);
			}
			if (outcome.reviewAtModelCalls !== undefined) {
				reviewAtModelCalls = Math.min(reviewAtModelCalls ?? outcome.reviewAtModelCalls, outcome.reviewAtModelCalls);
			}
		}
		index += batch.length;
		const terminalFailure = batchOutcomes.find((outcome) => outcome.terminalFailure)?.terminalFailure;
		if (terminalFailure) {
			for (const skippedCall of request.calls.slice(index)) {
				results.push(skipToolCall(skippedCall, request.emit, "Skipped after a terminal tool failure."));
			}
			return {
				results,
				terminalFailure,
				...(maxModelCalls === undefined ? {} : { maxModelCalls }),
				...(reviewAtModelCalls === undefined ? {} : { reviewAtModelCalls }),
			};
		}

		const steeringMessages = await request.takeSteeringMessages?.({
			modelCallIndex: request.modelCallIndex + 1,
			messages: [...request.messages, ...results],
			signal: request.signal,
		});
		if (steeringMessages && steeringMessages.length > 0) {
			for (const skippedCall of request.calls.slice(index)) {
				results.push(skipToolCall(skippedCall, request.emit));
			}
			return {
				results,
				steeringMessages,
				...(maxModelCalls === undefined ? {} : { maxModelCalls }),
				...(reviewAtModelCalls === undefined ? {} : { reviewAtModelCalls }),
			};
		}
	}
	return {
		results,
		...(maxModelCalls === undefined ? {} : { maxModelCalls }),
		...(reviewAtModelCalls === undefined ? {} : { reviewAtModelCalls }),
	};
}

function collectExecutionBatch(
	calls: readonly ToolCall[],
	tools: readonly RuntimeToolDefinition[],
	start: number,
): readonly ToolCall[] {
	const first = calls[start];
	const firstTool = tools.find((candidate) => candidate.name === first.name);
	if (firstTool?.executionMode !== "parallel") return [first];
	let end = start + 1;
	while (end < calls.length && end - start < MAX_PARALLEL_TOOL_CALLS) {
		const tool = tools.find((candidate) => candidate.name === calls[end].name);
		if (tool?.executionMode !== "parallel") break;
		end += 1;
	}
	return calls.slice(start, end);
}

async function executeOne(call: ToolCall, request: ExecuteToolCallsRequest): Promise<ToolExecutionOutcome> {
	const startedAt = Date.now();
	const phases: AgentToolPhase[] = [];
	const tool = request.tools.find((candidate) => candidate.name === call.name);
	let result: ToolResultMessage;
	let maxModelCalls: number | undefined;
	let reviewAtModelCalls: number | undefined;
	let stopOnError = false;

	if (!tool) {
		const message = `Tool ${call.name} not found`;
		request.emit({ type: "tool_validation", call, valid: false, error: message });
		request.emit({ type: "tool_execution_start", call, startedAt });
		result = toolError(call, message, "AGENT_TOOL_NOT_FOUND");
	} else {
		const validation = validateToolInput(tool, call);
		if (!validation.valid) {
			request.emit({ type: "tool_validation", call, valid: false, error: validation.error });
			request.emit({ type: "tool_execution_start", call, startedAt });
			result = toolError(call, validation.error, "AGENT_TOOL_INPUT_INVALID");
		} else {
			stopOnError =
				tool.runPolicy?.stopOnError === true || tool.runPolicy?.resolveStopOnError?.(validation.input) === true;
			const resolvedLimit = tool.runPolicy?.resolveMaxModelCalls?.(validation.input);
			if (resolvedLimit !== undefined) {
				if (!Number.isInteger(resolvedLimit) || resolvedLimit <= 0) {
					throw new Error(`Tool ${tool.name} resolved an invalid maxModelCalls value: ${resolvedLimit}`);
				}
				maxModelCalls = resolvedLimit;
			}
			request.emit({ type: "tool_validation", call, valid: true });
			request.emit({ type: "tool_execution_start", call, startedAt });
			result = await executeValidatedTool(call, tool, validation.input, request, startedAt, phases);
			const resolvedBudget = tool.runPolicy?.resolveModelCallBudget?.(validation.input, {
				content: result.content,
				details: result.details,
				isError: result.isError,
			});
			validateResolvedBudget(tool.name, resolvedBudget);
			maxModelCalls = Math.min(
				maxModelCalls ?? resolvedBudget?.maxModelCalls ?? Number.POSITIVE_INFINITY,
				resolvedBudget?.maxModelCalls ?? Number.POSITIVE_INFINITY,
			);
			if (!Number.isFinite(maxModelCalls)) maxModelCalls = undefined;
			reviewAtModelCalls = resolvedBudget?.reviewAtModelCalls;
		}
	}

	request.emit({
		type: "tool_execution_finish",
		call,
		result,
		startedAt,
		durationMs: Date.now() - startedAt,
		phases: [...phases],
	});
	return {
		result,
		...(stopOnError && result.isError ? { terminalFailure: result } : {}),
		...(maxModelCalls === undefined ? {} : { maxModelCalls }),
		...(reviewAtModelCalls === undefined ? {} : { reviewAtModelCalls }),
	};
}

function validateResolvedBudget(toolName: string, budget: AgentResolvedModelCallBudget | undefined): void {
	if (!budget) return;
	for (const [name, value] of [
		["maxModelCalls", budget.maxModelCalls],
		["reviewAtModelCalls", budget.reviewAtModelCalls],
	] as const) {
		if (value !== undefined && (!Number.isInteger(value) || value <= 0)) {
			throw new Error(`Tool ${toolName} resolved an invalid ${name} value: ${value}`);
		}
	}
	if (
		budget.maxModelCalls !== undefined &&
		budget.reviewAtModelCalls !== undefined &&
		budget.reviewAtModelCalls >= budget.maxModelCalls
	) {
		throw new Error(
			`Tool ${toolName} resolved reviewAtModelCalls=${budget.reviewAtModelCalls} at or above maxModelCalls=${budget.maxModelCalls}`,
		);
	}
}

async function executeValidatedTool(
	call: ToolCall,
	tool: RuntimeToolDefinition,
	input: unknown,
	request: ExecuteToolCallsRequest,
	startedAt: number,
	phases: AgentToolPhase[],
): Promise<ToolResultMessage> {
	try {
		await request.policy.authorize({
			call,
			tool,
			modelCallIndex: request.modelCallIndex,
			messages: request.messages,
			signal: request.signal,
		});
		const executed = await tool.execute(input, {
			toolCallId: call.id,
			messages: request.messages,
			signal: request.signal,
			onUpdate: (update: RuntimeToolResult) => request.emit({ type: "tool_execution_update", call, update }),
			reportPhase: (label) => {
				const phase = { label, atMs: Date.now() - startedAt };
				phases.push(phase);
				request.emit({ type: "tool_execution_phase", call, phase });
			},
		});
		return {
			role: "toolResult",
			toolCallId: call.id,
			toolName: call.name,
			content: [...executed.content],
			details: executed.details,
			isError: executed.isError === true,
			timestamp: Date.now(),
		};
	} catch (error) {
		request.signal.throwIfAborted();
		return toolError(
			call,
			error instanceof Error ? error.message : "Tool execution failed",
			"AGENT_TOOL_EXECUTION_FAILED",
			error instanceof AgentToolExecutionError ? error.details : undefined,
		);
	}
}

function validateToolInput(
	tool: RuntimeToolDefinition,
	call: ToolCall,
): { readonly valid: true; readonly input: unknown } | { readonly valid: false; readonly error: string } {
	try {
		if (tool.validateInput) return { valid: true, input: tool.validateInput(call.arguments) };
		const errors = [...Value.Errors(tool.inputSchema, call.arguments)];
		if (errors.length > 0) {
			return {
				valid: false,
				error: errors.map((error) => `${error.path || "/"}: ${error.message}`).join("; "),
			};
		}
		return { valid: true, input: Value.Decode(tool.inputSchema, call.arguments) };
	} catch (error) {
		return { valid: false, error: error instanceof Error ? error.message : "Tool input validation failed" };
	}
}

function skipToolCall(
	call: ToolCall,
	emit: (event: AgentExecutionEvent) => void,
	message = "Skipped due to queued user message.",
): ToolResultMessage {
	const startedAt = Date.now();
	const result = toolError(call, message, "AGENT_TOOL_SKIPPED", {});
	emit({ type: "tool_execution_start", call, startedAt });
	emit({ type: "tool_execution_finish", call, result, startedAt, durationMs: 0, phases: [] });
	return result;
}

function toolError(call: ToolCall, message: string, code: string, details?: unknown): ToolResultMessage {
	return {
		role: "toolResult",
		toolCallId: call.id,
		toolName: call.name,
		content: [{ type: "text", text: message }],
		details: details ?? { code },
		isError: true,
		timestamp: Date.now(),
	};
}
