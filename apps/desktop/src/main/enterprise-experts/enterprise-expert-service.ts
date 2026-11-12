import type { EnterpriseExpertSummary } from "../../shared/enterprise-experts.js";
import type { CredentialRef, CredentialVault } from "../credentials/credential-vault.js";
import { getDesktopCredentialVault } from "../credentials/desktop-credential-vault.js";
import {
	EnterpriseExpertAuthError,
	EnterpriseExpertClient,
	type EnterpriseExpertStreamChunk,
	type EnterpriseExpertStreamRequest,
} from "./enterprise-expert-client.js";

const TOKEN_REF: CredentialRef = {
	namespace: "enterprise-experts",
	ownerId: "iep.kaiwulab.com",
	name: "access-token",
};

type Listener = () => void;

export class EnterpriseExpertService {
	private readonly authListeners = new Set<Listener>();
	private readonly changedListeners = new Set<Listener>();

	constructor(
		private readonly client = new EnterpriseExpertClient(),
		private readonly vault: Pick<CredentialVault, "get" | "put" | "remove"> = getDesktopCredentialVault(),
	) {}

	hasToken(): boolean {
		return this.readToken() !== undefined;
	}

	async list(): Promise<readonly EnterpriseExpertSummary[]> {
		return this.withToken((token) => this.client.list(token));
	}

	async setToken(token: string): Promise<readonly EnterpriseExpertSummary[]> {
		const normalized = token.trim().replace(/^Bearer\s+/i, "");
		if (!normalized) throw new Error("Token cannot be empty");
		const experts = await this.client.list(normalized);
		this.vault.put(TOKEN_REF, normalized, { kind: "bearer", consumer: "enterprise-experts" });
		this.emit(this.changedListeners);
		return experts;
	}

	clearToken(): void {
		this.vault.remove(TOKEN_REF);
		this.emit(this.changedListeners);
	}

	async stream(
		request: EnterpriseExpertStreamRequest,
		onChunk: (chunk: EnterpriseExpertStreamChunk) => void,
		signal?: AbortSignal,
	): Promise<void> {
		await this.withToken((token) => this.client.stream(token, request, onChunk, signal));
	}

	onAuthRequired(listener: Listener): () => void {
		this.authListeners.add(listener);
		return () => this.authListeners.delete(listener);
	}

	onChanged(listener: Listener): () => void {
		this.changedListeners.add(listener);
		return () => this.changedListeners.delete(listener);
	}

	private async withToken<T>(run: (token: string) => Promise<T>): Promise<T> {
		const token = this.readToken();
		if (!token) {
			this.emit(this.authListeners);
			throw new EnterpriseExpertAuthError("Please configure the enterprise expert token");
		}
		try {
			return await run(token);
		} catch (error) {
			if (error instanceof EnterpriseExpertAuthError) this.emit(this.authListeners);
			throw error;
		}
	}

	/**
	 * safeStorage 的主密钥可能因应用名或系统凭据变化而失效。文件存在不代表凭据可用，
	 * 无法解密时按“未配置”处理，让用户能通过 Token 弹窗直接覆盖旧记录。
	 */
	private readToken(): string | undefined {
		try {
			return this.vault.get(TOKEN_REF);
		} catch {
			return undefined;
		}
	}

	private emit(listeners: ReadonlySet<Listener>): void {
		for (const listener of listeners) listener();
	}
}

export const enterpriseExpertService = new EnterpriseExpertService();
