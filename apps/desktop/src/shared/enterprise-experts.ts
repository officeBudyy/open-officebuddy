export interface EnterpriseExpertSummary {
	readonly id: string;
	readonly name: string;
	readonly description?: string;
	readonly avatarUrl?: string;
}

export interface EnterpriseExpertSessionBinding {
	readonly expert: EnterpriseExpertSummary;
	readonly threadId: string;
}
