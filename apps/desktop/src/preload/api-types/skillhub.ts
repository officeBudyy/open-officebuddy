/**
 * SkillHub 商店（skillhub.cn）公开 API 的 renderer 形状。
 * 字段仅保留 UI 需要的子集，服务端新增字段不会破坏本类型。
 */
export interface SkillhubCategory {
	key: string;
	name: string;
	nameEn?: string;
	sortOrder?: number;
	active?: boolean;
}

export interface SkillhubSkill {
	slug: string;
	name: string;
	description: string;
	iconUrl?: string;
	downloads?: number;
	stars?: number;
	score?: number;
	version?: string;
	verified?: boolean;
	category?: string;
}

export interface SkillhubListInput {
	page: number;
	pageSize: number;
	sortBy: "score" | "downloads" | "updated_at" | "stars";
	category?: string;
	keyword?: string;
}

export interface SkillhubListResult {
	skills: SkillhubSkill[];
	total: number;
}

export interface SkillhubInstallInput {
	slug: string;
	/** SkillHub 展示名，落库为能力别名。 */
	name?: string;
	description?: string;
	version?: string;
}

export interface SkillhubInstallResult {
	name: string;
	type: "skill" | "scene";
	version: string;
	updated: boolean;
}

export interface DesktopSkillhubApi {
	/** 场景分类列表（公开接口，动态拉取）。 */
	listCategories(): Promise<SkillhubCategory[]>;
	/** 技能分页列表。 */
	listSkills(input: SkillhubListInput): Promise<SkillhubListResult>;
	/** 下载技能归档并装到本地技能目录，返回落盘后的技能名。 */
	install(input: SkillhubInstallInput): Promise<SkillhubInstallResult>;
}
