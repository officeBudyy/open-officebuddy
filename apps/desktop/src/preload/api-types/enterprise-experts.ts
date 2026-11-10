import type { EnterpriseExpertSummary } from "../../shared/enterprise-experts.js";

export type { EnterpriseExpertSummary } from "../../shared/enterprise-experts.js";

export interface DesktopEnterpriseExpertsApi {
	list(): Promise<readonly EnterpriseExpertSummary[]>;
	hasToken(): Promise<boolean>;
	/** 校验成功后才写入安全凭据存储，并返回当前专家列表。 */
	setToken(token: string): Promise<readonly EnterpriseExpertSummary[]>;
	clearToken(): Promise<void>;
	onAuthRequired(listener: () => void): () => void;
	onChanged(listener: () => void): () => void;
}
