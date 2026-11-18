import { ipcMain } from "electron";
import type { SkillhubInstallInput, SkillhubListInput } from "../../preload/api-types/skillhub.js";
import { skillhubService } from "../skills/skillhub-service.js";

function parseListInput(value: unknown): SkillhubListInput {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("SkillHub listSkills requires an input object");
	}
	const input = value as Record<string, unknown>;
	const sortBy = input.sortBy;
	if (sortBy !== "score" && sortBy !== "downloads" && sortBy !== "updated_at" && sortBy !== "stars") {
		throw new Error("SkillHub listSkills sortBy is invalid");
	}
	return {
		page: typeof input.page === "number" && input.page >= 1 ? Math.floor(input.page) : 1,
		pageSize:
			typeof input.pageSize === "number" && input.pageSize >= 1 && input.pageSize <= 100
				? Math.floor(input.pageSize)
				: 24,
		sortBy,
		...(typeof input.category === "string" && input.category ? { category: input.category } : {}),
		...(typeof input.keyword === "string" ? { keyword: input.keyword } : {}),
	};
}

function parseInstallInput(value: unknown): SkillhubInstallInput {
	if (value == null || typeof value !== "object" || Array.isArray(value)) {
		throw new Error("SkillHub install requires an input object");
	}
	const input = value as Record<string, unknown>;
	if (typeof input.slug !== "string" || !input.slug.trim()) throw new Error("SkillHub install requires slug");
	return {
		slug: input.slug.trim(),
		...(typeof input.name === "string" && input.name.trim() ? { name: input.name.trim() } : {}),
		...(typeof input.description === "string" && input.description.trim()
			? { description: input.description.trim() }
			: {}),
		...(typeof input.version === "string" && input.version.trim() ? { version: input.version.trim() } : {}),
	};
}

export function registerSkillhubIpc(): () => void {
	ipcMain.handle("astravia:skillhub:list-categories", () => skillhubService.listCategories());
	ipcMain.handle("astravia:skillhub:list-skills", (_event, input: unknown) =>
		skillhubService.listSkills(parseListInput(input)),
	);
	ipcMain.handle("astravia:skillhub:install", (_event, input: unknown) =>
		skillhubService.install(parseInstallInput(input)),
	);
	return () => {
		ipcMain.removeHandler("astravia:skillhub:list-categories");
		ipcMain.removeHandler("astravia:skillhub:list-skills");
		ipcMain.removeHandler("astravia:skillhub:install");
	};
}
