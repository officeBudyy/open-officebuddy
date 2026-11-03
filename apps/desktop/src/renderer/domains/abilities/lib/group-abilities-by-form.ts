import type { AbilityItem } from "../types";

export const ABILITY_FORM_SECTION_ORDER = ["skills", "connectors", "apps", "bundles"] as const;

export type AbilityFormSectionKey = (typeof ABILITY_FORM_SECTION_ORDER)[number];

export interface AbilityFormSection {
	form: AbilityFormSectionKey;
	items: AbilityItem[];
}

export function abilityForm(item: AbilityItem): AbilityFormSectionKey {
	const marketForm = item.market?.form;
	if (marketForm) return marketForm;
	if (item.type === "skill" || item.type === "scene") return "skills";
	if (item.type === "mcp") return "connectors";
	if (item.type === "bundle") return "bundles";
	return "apps";
}

export function groupAbilitiesByForm(items: AbilityItem[]): AbilityFormSection[] {
	const buckets = new Map<AbilityFormSectionKey, AbilityItem[]>();
	for (const item of items) {
		const form = abilityForm(item);
		const bucket = buckets.get(form);
		if (bucket) bucket.push(item);
		else buckets.set(form, [item]);
	}
	return ABILITY_FORM_SECTION_ORDER.flatMap((form) => {
		const sectionItems = buckets.get(form);
		return sectionItems ? [{ form, items: sectionItems }] : [];
	});
}
