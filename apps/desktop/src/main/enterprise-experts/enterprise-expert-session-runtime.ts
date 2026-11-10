import { randomUUID } from "node:crypto";
import { type AssistantMessage, createAssistantMessage, type Message } from "@astravia/ai";
import {
	type PromptRequest,
	type RuntimeHost,
	type RuntimeTurnPromptOutcome,
	runtimeFailureFromError,
	type SessionEvent,
} from "@astravia/runtime-core";
import type { EnterpriseExpertSessionBinding } from "../../shared/enterprise-experts.js";
import type { EnterpriseExpertService } from "./enterprise-expert-service.js";

// provider/model 留空：企业专家不是本地模型选择，不能污染用户消息的模型切换边界。
const REMOTE_IDENTITY = { api: "enterprise-expert", provider: "", model: "" } as const;

export class EnterpriseExpertSessionRuntime {
	private readonly bindings = new Map<string, EnterpriseExpertSessionBinding>();
	private readonly listeners = new Map<string, Set<(event: SessionEvent) => void>>();
	private readonly controllers = new Map<string, AbortController>();

	constructor(
		private readonly runtime: RuntimeHost,
		private readonly service: Pick<EnterpriseExpertService, "stream">,
	) {}

	register(sessionId: string, binding: EnterpriseExpertSessionBinding): void {
		this.bindings.set(sessionId, binding);
	}

	isRemote(sessionId: string): boolean {
		return this.bindings.has(sessionId);
	}

	getBinding(sessionId: string): EnterpriseExpertSessionBinding | undefined {
		return this.bindings.get(sessionId);
	}

	subscribe(sessionId: string, listener: (event: SessionEvent) => void): () => void {
		const bucket = this.listeners.get(sessionId) ?? new Set();
		bucket.add(listener);
		this.listeners.set(sessionId, bucket);
		return () => {
			bucket.delete(listener);
			if (bucket.size === 0) this.listeners.delete(sessionId);
		};
	}

	async prompt(sessionId: string, request: PromptRequest): Promise<RuntimeTurnPromptOutcome> {
		const binding = this.bindings.get(sessionId);
		if (!binding) throw new Error("Enterprise expert session binding is missing");
		if (this.controllers.has(sessionId)) throw new Error("Enterprise expert is already processing a request");
		if (request.images?.length || request.attachments?.length) {
			throw new Error("Enterprise experts do not support attachments in this version");
		}

		const controller = new AbortController();
		this.controllers.set(sessionId, controller);
		const turnId = randomUUID();
		const userId = request.messageId ?? randomUUID();
		const assistantId = randomUUID();
		const startedAt = Date.now();
		const userMessage: Message = { role: "user", content: request.text, timestamp: startedAt };
		this.emit(sessionId, runtimeEvent(sessionId, "runtime-core", { type: "conversation.turn.started", turnId }));
		await this.runtime.appendConversationMessage(sessionId, {
			kind: "user",
			id: userId,
			turnId,
			timestamp: startedAt,
			author: { kind: "user", id: "local-user" },
			message: userMessage,
		});
		// appendConversationMessage only persists the record; unlike a normal Runtime Turn it
		// does not emit the live fact. Emit it before assistant output so live projection and
		// durable history choose the same assistant segment id.
		this.emit(
			sessionId,
			runtimeEvent(sessionId, "runtime-core", {
				type: "conversation.message.appended",
				turnId,
				messageId: userId,
				message: userMessage,
			}),
		);

		let assistant = createAssistantMessage(REMOTE_IDENTITY, { timestamp: Date.now() });
		this.emit(sessionId, assistantEvent(sessionId, turnId, { type: "start", partial: assistant }));
		let text = "";
		let thinking = "";
		let textStarted = false;
		let thinkingStarted = false;
		let thinkingEnded = false;
		try {
			// abort 可能发生在本地持久化等 await 期间；进入远端调用前先兑现取消
			controller.signal.throwIfAborted();
			const messages = this.runtime.getMessages(sessionId).flatMap(toRemoteMessage);
			const consumeChunk = (chunk: { readonly kind: "thinking" | "text"; readonly delta: string }): void => {
				if (chunk.kind === "thinking") {
					if (!thinkingStarted) {
						thinkingStarted = true;
						this.emit(
							sessionId,
							assistantEvent(sessionId, turnId, {
								type: "thinking_start",
								contentIndex: 0,
								partial: assistant,
							}),
						);
					}
					thinking += chunk.delta;
					assistant = { ...assistant, content: [{ type: "thinking", thinking }] };
					this.emit(
						sessionId,
						assistantEvent(sessionId, turnId, {
							type: "thinking_delta",
							contentIndex: 0,
							delta: chunk.delta,
							partial: assistant,
						}),
					);
					return;
				}
				if (thinkingStarted && !thinkingEnded) {
					thinkingEnded = true;
					this.emit(
						sessionId,
						assistantEvent(sessionId, turnId, {
							type: "thinking_end",
							contentIndex: 0,
							content: thinking,
							partial: assistant,
						}),
					);
				}
				const contentIndex = thinkingStarted ? 1 : 0;
				if (!textStarted) {
					textStarted = true;
					this.emit(
						sessionId,
						assistantEvent(sessionId, turnId, { type: "text_start", contentIndex, partial: assistant }),
					);
				}
				text += chunk.delta;
				assistant = {
					...assistant,
					content: [...(thinkingStarted ? [{ type: "thinking" as const, thinking }] : []), { type: "text", text }],
				};
				this.emit(
					sessionId,
					assistantEvent(sessionId, turnId, {
						type: "text_delta",
						contentIndex,
						delta: chunk.delta,
						partial: assistant,
					}),
				);
			};
			await this.service.stream(
				{ agentId: binding.expert.id, threadId: binding.threadId, runId: randomUUID(), messages },
				consumeChunk,
				controller.signal,
			);
			// 某些远程 Agent 的首次运行只产出服务端工具调用；同一 thread 再入一次才会
			// 返回工具执行后的最终文本。只自动续跑一次，避免用户手动重复提问。
			if (!textStarted && thinkingStarted) {
				const lastUser = findLastUserMessage(messages);
				await this.service.stream(
					{
						agentId: binding.expert.id,
						threadId: binding.threadId,
						runId: randomUUID(),
						messages: lastUser ? [...messages, { ...lastUser, id: randomUUID() }] : messages,
					},
					consumeChunk,
					controller.signal,
				);
			}
			if (!textStarted) throw new Error("Enterprise expert did not return a final answer");
			if (thinkingStarted && !thinkingEnded) {
				thinkingEnded = true;
				this.emit(
					sessionId,
					assistantEvent(sessionId, turnId, {
						type: "thinking_end",
						contentIndex: 0,
						content: thinking,
						partial: assistant,
					}),
				);
			}
			if (textStarted) {
				this.emit(
					sessionId,
					assistantEvent(sessionId, turnId, {
						type: "text_end",
						contentIndex: thinkingStarted ? 1 : 0,
						content: text,
						partial: assistant,
					}),
				);
			}
			this.emit(sessionId, assistantEvent(sessionId, turnId, { type: "done", reason: "stop", message: assistant }));
			await this.runtime.appendConversationMessage(sessionId, {
				kind: "agent",
				id: assistantId,
				turnId,
				timestamp: assistant.timestamp,
				author: { kind: "agent", id: "default-agent", agentId: binding.expert.id },
				message: assistant,
			});
			this.emit(
				sessionId,
				runtimeEvent(sessionId, "runtime-core", {
					type: "conversation.turn.completed",
					turnId,
					stopReason: "stop",
				}),
			);
			if (messages.length === 1) void this.runtime.renameSessionById(sessionId, fallbackTitle(request.text));
			return { status: "completed", turnId };
		} catch (error) {
			if (controller.signal.aborted) {
				this.emit(
					sessionId,
					runtimeEvent(sessionId, "runtime-core", {
						type: "conversation.turn.cancelled",
						turnId,
						reason: "aborted",
					}),
				);
				return { status: "cancelled", turnId };
			}
			const failure = runtimeFailureFromError(error, { origin: "provider", code: "ENTERPRISE_EXPERT_FAILED" });
			const failedAssistant: AssistantMessage = {
				...assistant,
				stopReason: "error",
				errorMessage: failure.message,
			};
			this.emit(
				sessionId,
				assistantEvent(sessionId, turnId, { type: "error", reason: "error", error: failedAssistant }),
			);
			this.emit(
				sessionId,
				runtimeEvent(sessionId, "runtime-core", { type: "conversation.turn.failed", turnId, error: failure }),
			);
			return { status: "failed", turnId, error: failure };
		} finally {
			this.controllers.delete(sessionId);
		}
	}

	abort(sessionId: string): boolean {
		const controller = this.controllers.get(sessionId);
		if (!controller) return false;
		controller.abort();
		return true;
	}

	private emit(sessionId: string, event: SessionEvent): void {
		for (const listener of this.listeners.get(sessionId) ?? []) listener(event);
	}
}

function toRemoteMessage(
	message: Message,
	index: number,
): { id: string; role: "user" | "assistant"; content: string }[] {
	if (message.role === "user") {
		const content =
			typeof message.content === "string"
				? message.content
				: message.content
						.filter((item) => item.type === "text")
						.map((item) => item.text)
						.join("\n");
		return [{ id: `history-${index}`, role: "user", content }];
	}
	if (message.role === "assistant") {
		return [
			{
				id: `history-${index}`,
				role: "assistant",
				content: message.content
					.filter((item) => item.type === "text")
					.map((item) => item.text)
					.join("\n"),
			},
		];
	}
	return [];
}

function findLastUserMessage(
	messages: readonly { readonly id: string; readonly role: "user" | "assistant"; readonly content: string }[],
): { readonly id: string; readonly role: "user"; readonly content: string } | undefined {
	for (let index = messages.length - 1; index >= 0; index -= 1) {
		const message = messages[index];
		if (message?.role === "user") return { ...message, role: "user" };
	}
	return undefined;
}

function base(sessionId: string, source: "runtime-core" | "agent") {
	return {
		schemaVersion: 1 as const,
		channel: "runtime" as const,
		sessionId,
		eventId: randomUUID(),
		timestamp: Date.now(),
		source,
	};
}

function runtimeEvent(sessionId: string, source: "runtime-core", event: object): SessionEvent {
	return { ...base(sessionId, source), ...event } as SessionEvent;
}

function assistantEvent(sessionId: string, turnId: string, event: object): SessionEvent {
	return { ...base(sessionId, "agent"), channel: "assistant", turnId, modelCallIndex: 0, ...event } as SessionEvent;
}

function fallbackTitle(text: string): string {
	return Array.from(text.trim().replace(/\s+/g, " ")).slice(0, 30).join("") || "Enterprise expert";
}
