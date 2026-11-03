import { describe, expect, it } from "vitest";
import type { AbilityItem, McpAbility, PluginAbility, SkillAbility } from "../types";
import { groupAbilitiesByForm } from "./group-abilities-by-form";

function skill(id: string): SkillAbility {
	return {
		type: "skill",
		id,
		slug: id,
		catalogSource: { kind: "builtin", id: "builtin" },
		title: id,
		description: "",
		category: "",
		tags: [],
		author: "",
		license: "",
		version: "1.0.0",
		installed: false,
		enabled: true,
		readonly: false,
		needsUpdate: false,
		setupRequired: false,
		busy: false,
		downloadCount: 0,
		isCustom: false,
		isBuiltin: false,
		fromMarket: false,
		searchTerms: [],
	};
}

function mcp(id: string): McpAbility {
	return {
		...skill(id),
		type: "mcp",
		serverName: id,
		usesOAuth: false,
		authorized: false,
		canConfigure: true,
		canEdit: true,
	};
}

function plugin(id: string, form?: "connectors" | "apps"): PluginAbility {
	return {
		...skill(id),
		type: "plugin",
		plugin: null,
		permissions: [],
		grantedPermissions: [],
		commands: [],
		grantedCommands: [],
		...(form ? { market: { form } as PluginAbility["market"] } : {}),
	};
}

describe("groupAbilitiesByForm", () => {
	it("groups by product form and keeps connector plugins out of apps", () => {
		const sections = groupAbilitiesByForm([
			plugin("app"),
			mcp("mcp"),
			plugin("external-plugin", "connectors"),
			skill("skill"),
		]);
		expect(sections.map((section) => section.form)).toEqual(["skills", "connectors", "apps"]);
		expect(sections.find((section) => section.form === "connectors")?.items.map((item) => item.id)).toEqual([
			"mcp",
			"external-plugin",
		]);
	});

	it("places scenes with skills", () => {
		const scene = { ...skill("scene"), type: "scene" } as SkillAbility;
		expect(groupAbilitiesByForm([scene, skill("skill")])).toMatchObject([
			{ form: "skills", items: [{ id: "scene" }, { id: "skill" }] },
		]);
	});

	it("returns nothing for an empty list", () => {
		expect(groupAbilitiesByForm([] as AbilityItem[])).toEqual([]);
	});
});
