import type {
	SkillhubInstallInput,
	SkillhubInstallResult,
	SkillhubListInput,
	SkillhubListResult,
} from "../../preload/api-types/skillhub.js";
import { installSkillhubArchive } from "./skillhub-install.js";

const SKILLHUB_API_BASE = "https://api.skillhub.cn";

function buildQuery(params: Record<string, string | number | undefined>): string {
	const search = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === "") continue;
		search.set(key, String(value));
	}
	return search.toString();
}

interface SkillhubCategoryRaw {
	key: string;
	name: string;
	nameEn?: string;
	sortOrder?: number;
	active?: boolean;
}

/** 服务端返回的技能行；只取 UI 需要的子集。 */
type SkillhubSkillRaw = Record<string, unknown>;

function normalizeSkill(item: SkillhubSkillRaw) {
	return {
		slug: String(item.slug ?? ""),
		name: String(item.name ?? item.slug ?? ""),
		description: String(item.descriptionZh ?? item.description ?? ""),
		iconUrl: item.iconUrl ? String(item.iconUrl) : undefined,
		downloads: typeof item.downloads === "number" ? item.downloads : undefined,
		stars: typeof item.stars === "number" ? item.stars : undefined,
		score: typeof item.score === "number" ? item.score : undefined,
		version: item.version ? String(item.version) : undefined,
		verified: typeof item.verified === "boolean" ? item.verified : undefined,
		category: item.category ? String(item.category) : undefined,
	};
}

/**
 * SkillHub 商店主进程代理。公开接口对任意 Origin 不回 CORS 头，
 * renderer 直连会被拦，故在主进程 fetch（不受 CORS 约束）。
 */
export const skillhubService = {
	async listCategories(): Promise<SkillhubCategoryRaw[]> {
		const res = await fetch(`${SKILLHUB_API_BASE}/api/v1/categories`);
		if (!res.ok) throw new Error(`SkillHub categories request failed: ${res.status}`);
		const body = (await res.json()) as { items?: SkillhubCategoryRaw[] };
		return body.items ?? [];
	},

	async listSkills(input: SkillhubListInput): Promise<SkillhubListResult> {
		const query = buildQuery({
			page: input.page,
			pageSize: input.pageSize,
			sortBy: input.sortBy,
			...(input.category ? { category: input.category } : {}),
			...(input.keyword?.trim() ? { keyword: input.keyword.trim() } : {}),
		});
		const res = await fetch(`${SKILLHUB_API_BASE}/api/skills?${query}`);
		if (!res.ok) throw new Error(`SkillHub skills request failed: ${res.status}`);
		const body = (await res.json()) as {
			code: number;
			message?: string;
			data?: { skills?: SkillhubSkillRaw[]; total?: number };
		};
		if (body.code !== 0) throw new Error(body.message || "SkillHub skills request failed");
		return { skills: (body.data?.skills ?? []).map(normalizeSkill), total: body.data?.total ?? 0 };
	},

	async install(input: SkillhubInstallInput): Promise<SkillhubInstallResult> {
		// /api/v1/download 返回 302 到 COS 归档；fetch 默认跟随重定向。
		const res = await fetch(`${SKILLHUB_API_BASE}/api/v1/download?${buildQuery({ slug: input.slug })}`);
		if (!res.ok) throw new Error(`SkillHub download failed: ${res.status}`);
		const buffer = Buffer.from(await res.arrayBuffer());
		return installSkillhubArchive(input.slug, buffer, {
			...(input.name ? { displayName: input.name } : {}),
			...(input.description ? { description: input.description } : {}),
			...(input.version ? { version: input.version } : {}),
		});
	},
};
