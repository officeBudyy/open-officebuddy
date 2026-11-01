import type { AgentLoopConfig, StreamFn } from "@astravia/agent-core";
import type { Api, Message, Model, SimpleStreamOptions } from "@astravia/ai";
import type { SessionInput } from "./contracts.js";

export interface AgentCoreModelCallBudgetContext {
	readonly sessionId: string;
	readonly turnId: string;
	readonly input?: SessionInput;
	readonly messages: readonly Message[];
	readonly signal: AbortSignal;
}

export interface AgentCoreModelCallBudgetReviewRequest {
	readonly sessionId: string;
	readonly turnId: string;
	readonly threshold: number;
	readonly modelCalls: number;
	readonly toolCalls: number;
	readonly signal: AbortSignal;
	readonly input?: SessionInput;
	readonly messages: readonly Message[];
}

export interface AgentCoreModelCallBudgetCompletionReviewRequest extends AgentCoreModelCallBudgetContext {
	readonly modelCalls: number;
	readonly toolCalls: number;
}

export interface AgentCoreModelCallBudget {
	readonly thresholds: readonly number[];
	resolveMaxModelCalls?(request: AgentCoreModelCallBudgetContext): Promise<number | undefined>;
	review(
		request: AgentCoreModelCallBudgetReviewRequest,
	): Promise<{ readonly action: "continue" | "stop_after_response"; readonly instruction?: string }>;
	reviewCompletion?(
		request: AgentCoreModelCallBudgetCompletionReviewRequest,
	): Promise<{ readonly action: "accept" | "retry"; readonly instruction?: string }>;
}

export interface AgentCoreTurnEngineOptions {
	/** Compatibility fallback; production Runtime should bind the model per turn. */
	readonly model?: Model<Api>;
	readonly streamOptions?: Omit<SimpleStreamOptions, "sessionId" | "signal">;
	readonly streamFn?: StreamFn;
	readonly getApiKey?: AgentLoopConfig["getApiKey"];
	/** Platform-neutral observation port owned and disposed by the host. */
	readonly tracer?: AgentLoopConfig["tracer"];
	/** Shared tracing policy; execute supplies the concrete session identity. */
	readonly tracing?: AgentLoopConfig["tracing"];
	/** Optional model/tool-call caps and the checkpoint budget applied to every turn. */
	readonly limits?: AgentLoopConfig["limits"];
	/** Optional interactive soft checkpoints before unusually long runs continue. */
	readonly modelCallBudget?: AgentCoreModelCallBudget;
	/** Resolves credentials for the exact model bound to the current turn. */
	readonly resolveApiKey?: (model: Model<Api>) => Promise<string | undefined> | string | undefined;
}
