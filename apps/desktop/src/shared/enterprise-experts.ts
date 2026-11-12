export interface EnterpriseExpertSummary {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly avatarUrl?: string;
}

/**
 * 鉴权失败的稳定标记。EnterpriseExpertAuthError 跨 IPC 序列化后只剩纯文本，
 * 渲染进程无法按类型识别；main 侧统一把鉴权错误改写成带此标记的消息。
 */
export const ENTERPRISE_EXPERT_AUTH_ERROR_MARKER = "astravia:enterprise-experts:auth-required";

/** 判断一段错误消息是否为企业专家鉴权失败（含 IPC 序列化前后的兜底关键词）。 */
export function isEnterpriseExpertAuthErrorMessage(message: string): boolean {
	return (
		message.includes(ENTERPRISE_EXPERT_AUTH_ERROR_MARKER) ||
		message.includes("EnterpriseExpertAuthError") ||
		/token is missing or expired|please configure the enterprise expert token/i.test(message)
	);
}

export interface EnterpriseExpertSessionBinding {
	readonly expert: EnterpriseExpertSummary;
	readonly threadId: string;
}
