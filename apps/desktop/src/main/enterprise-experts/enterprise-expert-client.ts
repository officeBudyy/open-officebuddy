import type { EnterpriseExpertSummary } from "../../shared/enterprise-experts.js";

const BASE_URL = "https://iep.kaiwulab.com/api/ai-assistant/external/private";

export class EnterpriseExpertAuthError extends Error {
	constructor(message = "Enterprise expert token is missing or expired") {
		super(message);
		this.name = "EnterpriseExpertAuthError";
	}
}

export interface EnterpriseExpertChatMessage {
	readonly id: string;
	readonly role: "user" | "assistant";
	readonly content: string;
}

export interface EnterpriseExpertStreamRequest {
	readonly agentId: string;
	readonly threadId: string;
	readonly runId: string;
	readonly messages: readonly EnterpriseExpertChatMessage[];
}

export interface EnterpriseExpertStreamChunk {
	readonly kind: "thinking" | "text";
	readonly delta: string;
}

export class EnterpriseExpertClient {
	constructor(private readonly fetchImpl: typeof fetch = fetch) {}

	async list(token: string, signal?: AbortSignal): Promise<readonly EnterpriseExpertSummary[]> {
		const response = await this.fetchImpl(`${BASE_URL}/agent-definitions?scope=GLOBAL`, {
			method: "GET",
			headers: {
				accept: "application/json, text/plain, */*",
				"deframe-auth": bearer(token),
				"deframe-language": "zh_CN",
			},
			signal,
		});
		await assertAuthorized(response);
		if (!response.ok) throw new Error(`Enterprise expert list request failed (${response.status})`);
		return parseEnterpriseExpertList(await response.json());
	}

	async stream(
		token: string,
		request: EnterpriseExpertStreamRequest,
		onChunk: (chunk: EnterpriseExpertStreamChunk) => void,
		signal?: AbortSignal,
	): Promise<void> {
		const response = await this.fetchImpl(
			`${BASE_URL}/agent-runtime/stream?agentId=${encodeURIComponent(request.agentId)}&scope=GLOBAL`,
			{
				method: "POST",
				headers: {
					accept: "text/event-stream",
					authorization: bearer(token),
					"content-type": "application/json",
					"deframe-auth": bearer(token),
				},
				body: JSON.stringify({
					threadId: request.threadId,
					runId: request.runId,
					tools: [],
					context: [],
					forwardedProps: {},
					state: {},
					messages: request.messages,
				}),
				signal,
			},
		);
		await assertAuthorized(response);
		if (!response.ok) throw new Error(`Enterprise expert request failed (${response.status})`);
		if (!response.body) throw new Error("Enterprise expert response has no stream body");

		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		const events = new EnterpriseExpertSseDecoder(onChunk);
		let buffer = "";
		while (true) {
			const { done, value } = await reader.read();
			buffer += decoder.decode(value, { stream: !done });
			const parsed = consumeSseBuffer(buffer, (frame) => events.consume(frame));
			buffer = parsed.rest;
			if (done) break;
		}
		if (buffer.trim()) events.consume(buffer);
		events.finish();
	}
}

function bearer(token: string): string {
	return `Bearer ${token.trim().replace(/^Bearer\s+/i, "")}`;
}

async function assertAuthorized(response: Response): Promise<void> {
	if (response.status === 401 || response.status === 403) throw new EnterpriseExpertAuthError();
}

export function parseEnterpriseExpertList(payload: unknown): readonly EnterpriseExpertSummary[] {
	const records = findRecordArray(payload);
	if (!records) return [];
	return records.map(parseExpert).filter((expert): expert is EnterpriseExpertSummary => expert !== undefined);
}

function findRecordArray(value: unknown, depth = 0): readonly unknown[] | undefined {
	if (Array.isArray(value)) return value;
	if (!isRecord(value) || depth > 4) return undefined;
	for (const key of ["data", "records", "items", "list", "rows", "result"]) {
		const found = findRecordArray(value[key], depth + 1);
		if (found) return found;
	}
	return undefined;
}

function parseExpert(value: unknown): EnterpriseExpertSummary | undefined {
	if (!isRecord(value)) return undefined;
	const id = firstString(value, ["agentId", "id", "code", "key"]);
	if (!id) return undefined;
	const name = firstString(value, ["agentName", "name", "displayName", "title"]) ?? id;
	const description = firstString(value, ["description", "desc", "remark"]);
	const avatarUrl = firstString(value, ["avatarUrl", "avatar", "icon"]);
	return { id, name, ...(description ? { description } : {}), ...(avatarUrl ? { avatarUrl } : {}) };
}

function firstString(record: Record<string, unknown>, keys: readonly string[]): string | undefined {
	for (const key of keys) {
		const value = record[key];
		if (typeof value === "string" && value.trim()) return value.trim();
	}
	return undefined;
}

function consumeSseBuffer(buffer: string, consume: (frame: string) => void): { rest: string } {
	const normalized = buffer.replace(/\r\n/g, "\n");
	const frames = normalized.split("\n\n");
	const rest = frames.pop() ?? "";
	for (const frame of frames) consume(frame);
	return { rest };
}

class EnterpriseExpertSseDecoder {
	private pendingText = "";
	private emittedText = "";
	private snapshotText: string | undefined;
	private toolSeen = false;

	constructor(private readonly onChunk: (chunk: EnterpriseExpertStreamChunk) => void) {}

	consume(frame: string): void {
		const data = frame
			.split(/\r?\n/)
			.filter((line) => line.startsWith("data:"))
			.map((line) => line.slice(5).trimStart())
			.join("\n")
			.trim();
		if (!data || data === "[DONE]") return;
		let payload: unknown;
		try {
			payload = JSON.parse(data);
		} catch {
			this.pendingText += data;
			return;
		}
		const error = extractStreamError(payload);
		if (error) throw new Error(error);
		const event = unwrapStreamEvent(payload);
		if (!event) return;
		const type = String(event.type).toUpperCase();
		if (type === "MESSAGES_SNAPSHOT") {
			this.snapshotText = extractLatestAssistantSnapshot(event.messages) ?? this.snapshotText;
			return;
		}
		if (isToolEvent(type)) {
			this.toolSeen = true;
			if (this.pendingText) {
				this.onChunk({ kind: "thinking", delta: this.pendingText });
				this.pendingText = "";
			}
			return;
		}
		const delta = firstString(event, ["delta", "content", "text"]);
		if (!delta) return;
		if (isThinkingPayload(event, type)) {
			this.onChunk({ kind: "thinking", delta });
			return;
		}
		if (!isTextContentEvent(type)) return;
		if (!this.toolSeen) {
			// 首段文本可能只是工具调用前的说明，等看到下一类事件后再决定归属。
			this.pendingText += delta;
			return;
		}
		this.emitText(delta);
	}

	finish(): void {
		if (this.snapshotText) {
			if (this.emittedText && this.snapshotText.startsWith(this.emittedText)) {
				this.emitText(this.snapshotText.slice(this.emittedText.length));
			} else if (!this.emittedText) {
				this.emitText(this.snapshotText);
			}
			return;
		}
		if (!this.toolSeen && this.pendingText) this.emitText(this.pendingText);
	}

	private emitText(delta: string): void {
		if (!delta) return;
		this.emittedText += delta;
		this.onChunk({ kind: "text", delta });
	}
}

function unwrapStreamEvent(value: unknown): Record<string, unknown> | undefined {
	if (!isRecord(value)) return undefined;
	if (typeof value.type === "string") return value;
	for (const key of ["data", "event", "chunk"]) {
		const nested = unwrapStreamEvent(value[key]);
		if (nested) return nested;
	}
	return undefined;
}

function isTextContentEvent(type: string): boolean {
	return type === "TEXT_MESSAGE_CONTENT" || type === "TEXT_MESSAGE_CHUNK" || type === "TEXT_DELTA";
}

function isToolEvent(type: string): boolean {
	return type.startsWith("TOOL_CALL_") || type === "TOOL_CALL_RESULT" || type.includes("FUNCTION_CALL");
}

function extractLatestAssistantSnapshot(value: unknown): string | undefined {
	if (!Array.isArray(value)) return undefined;
	for (let index = value.length - 1; index >= 0; index -= 1) {
		const message = value[index];
		if (!isRecord(message) || message.role !== "assistant" || hasToolCalls(message)) continue;
		const content = message.content;
		if (typeof content === "string" && content.trim()) return content;
		if (!Array.isArray(content)) continue;
		const text = content
			.flatMap((part) =>
				isRecord(part) && part.type === "text" && typeof part.text === "string" ? [part.text] : [],
			)
			.join("");
		if (text) return text;
	}
	return undefined;
}

function hasToolCalls(message: Record<string, unknown>): boolean {
	if ([message.toolCalls, message.tool_calls].some((value) => Array.isArray(value) && value.length > 0)) return true;
	return (
		Array.isArray(message.content) &&
		message.content.some(
			(part) =>
				isRecord(part) && (part.type === "toolCall" || part.type === "tool_call" || part.type === "tool_use"),
		)
	);
}

function isThinkingPayload(value: Record<string, unknown>, type: string): boolean {
	if (type.includes("THINK") || type.includes("REASON") || type.includes("ANALYSIS")) return true;
	for (const key of ["channel", "role", "contentType", "content_type", "messageType", "message_type"]) {
		const marker = value[key];
		if (typeof marker === "string" && /think|reason|analysis/i.test(marker)) return true;
	}
	return false;
}

function extractStreamError(value: unknown): string | undefined {
	if (!isRecord(value)) return undefined;
	const type = typeof value.type === "string" ? value.type.toUpperCase() : "";
	if (!type.includes("ERROR") && value.error === undefined) return undefined;
	if (typeof value.message === "string") return value.message;
	if (typeof value.error === "string") return value.error;
	if (isRecord(value.error) && typeof value.error.message === "string") return value.error.message;
	return "Enterprise expert stream failed";
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}
