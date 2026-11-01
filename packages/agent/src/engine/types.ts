import type {
	AIErrorDetails,
	AssistantMessage,
	ImageContent,
	LanguageModelStreamEvent,
	Message,
	ModelStreamResponse,
	TextContent,
	ToolCall,
	ToolResultMessage,
} from "@astravia/ai";
import type { Static, TSchema } from "@sinclair/typebox";

export interface AgentRunLimits {
	/** Optional model-call cap. Omit it to let the run continue until another terminal condition. */
	readonly maxModelCalls?: number;
	/** Optional tool-call cap. Omit it to let the run continue until another terminal condition. */
	readonly maxToolCalls?: number;
	readonly maxRecoveryAttempts: number;
	readonly checkpointTimeoutMs: number;
	readonly deadlineMs?: number;
}

export type AgentRunStatus =
	| "completed"
	| "max_model_calls"
	| "max_tool_calls"
	| "recovery_exhausted"
	| "aborted"
	| "failed";

export interface AgentRunFailure {
	readonly code: string;
	readonly message: string;
	readonly retryable?: boolean;
	readonly origin?: "provider";
	readonly details?: {
		readonly statusCode?: number;
		readonly provider?: string;
		readonly modelId?: string;
		readonly requestId?: string;
		readonly providerCode?: string;
		readonly phase?: "resolve" | "request" | "response" | "stream" | "decode";
		readonly url?: string;
		readonly responseHeaders?: Readonly<Record<string, string>>;
		readonly responseBodyPreview?: string;
		readonly retryAfterMs?: number;
	};
}

export interface AgentRunResult {
	readonly status: AgentRunStatus;
	readonly messages: readonly Message[];
	readonly modelCalls: number;
	readonly toolCalls: number;
	readonly recoveryAttempts: number;
	readonly lastAssistantMessage?: AssistantMessage;
	readonly failure?: AgentRunFailure;
}

export interface AgentRun {
	readonly events: AsyncIterable<AgentExecutionEvent>;
	readonly result: Promise<AgentRunResult>;
}

export interface AgentModelCallContext {
	readonly modelCallIndex: number;
	readonly messages: readonly Message[];
	readonly tools: readonly RuntimeToolDefinition[];
	readonly signal: AbortSignal;
}

export interface ResolvedModelCall {
	readonly callId: string;
	readonly snapshotId: string;
	readonly response: ModelStreamResponse;
}

export interface ToolResolutionContext {
	readonly modelCallIndex: number;
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
}

export interface RuntimeToolExecutionContext<TDetails = unknown> {
	readonly toolCallId: string;
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
	readonly onUpdate: (update: RuntimeToolResult<TDetails>) => void;
	readonly reportPhase: (label: string) => void;
}

export interface RuntimeToolResult<TDetails = unknown> {
	readonly content: readonly (TextContent | ImageContent)[];
	readonly details: TDetails;
	/** Protocol-level error result returned without throwing. */
	readonly isError?: boolean;
}

export interface RuntimeToolDefinition<TSchemaDef extends TSchema = TSchema, TDetails = unknown> {
	readonly name: string;
	readonly description: string;
	readonly inputSchema: TSchemaDef;
	/**
	 * Parallel tools may run beside adjacent parallel calls from the same model
	 * response. The default is exclusive so existing and mutating tools retain
	 * their ordering guarantees.
	 */
	readonly executionMode?: "parallel" | "exclusive";
	/** Optional run-level controls activated after this tool's input is validated. */
	readonly runPolicy?: {
		/** End the run as failed when this tool returns an error result. */
		readonly stopOnError?: boolean;
		/** Resolve input-specific terminal-error behavior after validation. */
		resolveStopOnError?(input: Static<TSchemaDef>): boolean;
		/** Lower the total model-call ceiling for runs using this input. */
		resolveMaxModelCalls?(input: Static<TSchemaDef>): number | undefined;
		/** Resolve result-aware soft and hard model-call limits. */
		resolveModelCallBudget?(
			input: Static<TSchemaDef>,
			result: RuntimeToolResult<TDetails>,
		): AgentResolvedModelCallBudget | undefined;
	};
	/** Optional host validator for standard JSON Schema or other schema dialects. */
	readonly validateInput?: (input: ToolCall["arguments"]) => Static<TSchemaDef>;
	execute(
		input: Static<TSchemaDef>,
		context: RuntimeToolExecutionContext<TDetails>,
	): Promise<RuntimeToolResult<TDetails>>;
}

export interface AgentToolPhase {
	readonly label: string;
	readonly atMs: number;
}

export type AgentPendingInputKind = "steering" | "continuation";

export interface AgentInputCollectionContext {
	readonly modelCallIndex: number;
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
}

export type AgentInputCollector = (context: AgentInputCollectionContext) => Promise<readonly Message[]>;

export interface ToolAuthorizationRequest {
	readonly call: ToolCall;
	readonly tool: RuntimeToolDefinition;
	readonly modelCallIndex: number;
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
}

export interface AgentToolPolicy {
	authorize(request: ToolAuthorizationRequest): Promise<void>;
}

export type AgentCheckpointReason = "model_call" | "assistant_result" | "assistant_error";

export interface AgentCheckpointRequest {
	readonly reason: AgentCheckpointReason;
	readonly messages: readonly Message[];
	readonly modelCallIndex: number;
	/** 自最近一次模型调用产出可用结果以来的连续恢复次数，不是整轮累计。 */
	readonly recoveryAttempt: number;
	readonly assistantMessage?: AssistantMessage;
}

export interface AgentCheckpointResult {
	/** Message view used for the current model call or retry decision. */
	readonly messages?: readonly Message[];
	/** Durable in-run context used by subsequent model calls. */
	readonly contextMessages?: readonly Message[];
	readonly retry?: boolean;
}

export type AgentCheckpointHandler = (
	request: AgentCheckpointRequest,
	signal: AbortSignal,
) => Promise<AgentCheckpointResult | undefined>;

export interface AgentModelCallBudgetReviewRequest {
	readonly threshold: number;
	readonly modelCalls: number;
	readonly toolCalls: number;
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
}

export interface AgentModelCallBudgetReviewResult {
	readonly action: "continue" | "stop_after_response";
	/** Internal instruction appended to the remaining in-run model context. */
	readonly instruction: string;
}

export interface AgentResolvedModelCallBudget {
	readonly maxModelCalls?: number;
	readonly reviewAtModelCalls?: number;
}

export interface AgentModelCallBudgetResolutionRequest {
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
}

export interface AgentModelCallBudgetCompletionReviewRequest {
	readonly modelCalls: number;
	readonly toolCalls: number;
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
}

export interface AgentModelCallBudgetCompletionReviewResult {
	readonly action: "accept" | "retry";
	readonly instruction?: string;
}

export interface AgentModelCallBudget {
	readonly thresholds: readonly number[];
	resolveMaxModelCalls?(request: AgentModelCallBudgetResolutionRequest): Promise<number | undefined>;
	review(request: AgentModelCallBudgetReviewRequest): Promise<AgentModelCallBudgetReviewResult>;
	reviewCompletion?(
		request: AgentModelCallBudgetCompletionReviewRequest,
	): Promise<AgentModelCallBudgetCompletionReviewResult>;
}

export interface AgentTurnRequest {
	readonly messages: readonly Message[];
	readonly resolveModelCall: (context: AgentModelCallContext) => Promise<ResolvedModelCall>;
	readonly resolveTools: (context: ToolResolutionContext) => Promise<readonly RuntimeToolDefinition[]>;
	readonly toolPolicy: AgentToolPolicy;
	readonly checkpoint?: AgentCheckpointHandler;
	readonly modelCallBudget?: AgentModelCallBudget;
	readonly takeSteeringMessages?: AgentInputCollector;
	readonly takeContinuationMessages?: AgentInputCollector;
	readonly limits: AgentRunLimits;
	readonly signal: AbortSignal;
	readonly observer?: (event: AgentExecutionEvent) => void;
}

export type AgentExecutionEvent =
	| { readonly type: "run_start" }
	| {
			readonly type: "model_call_start";
			readonly modelCallIndex: number;
			readonly callId: string;
			readonly snapshotId: string;
	  }
	| {
			readonly type: "model_event";
			readonly modelCallIndex: number;
			readonly event: LanguageModelStreamEvent;
	  }
	| {
			readonly type: "model_call_finish";
			readonly modelCallIndex: number;
			readonly callId?: string;
			readonly status: "completed" | "failed";
	  }
	| {
			readonly type: "assistant_message";
			readonly message: AssistantMessage;
			/** Structured provider failure from the terminal model event, if available. */
			readonly failure?: AIErrorDetails;
	  }
	| { readonly type: "input_message"; readonly kind: AgentPendingInputKind; readonly message: Message }
	| { readonly type: "tool_validation"; readonly call: ToolCall; readonly valid: boolean; readonly error?: string }
	| { readonly type: "tool_execution_start"; readonly call: ToolCall; readonly startedAt: number }
	| {
			readonly type: "tool_execution_update";
			readonly call: ToolCall;
			readonly update: RuntimeToolResult;
	  }
	| { readonly type: "tool_execution_phase"; readonly call: ToolCall; readonly phase: AgentToolPhase }
	| {
			readonly type: "tool_execution_finish";
			readonly call: ToolCall;
			readonly result: ToolResultMessage;
			readonly startedAt: number;
			readonly durationMs: number;
			readonly phases: readonly AgentToolPhase[];
	  }
	| { readonly type: "diagnostic"; readonly source: "observer"; readonly message: string }
	| { readonly type: "run_finish"; readonly result: AgentRunResult };
