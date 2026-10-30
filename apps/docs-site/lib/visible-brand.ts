export const VISIBLE_BRAND_NAME = "officebuddy";

export function applyVisibleBrandToText(value: string): string {
	return value.replace(/\bAstravia\b/g, VISIBLE_BRAND_NAME);
}

interface MdxAttribute {
	name?: string;
	value?: unknown;
}

interface MdxNode {
	type?: string;
	value?: unknown;
	children?: MdxNode[];
	attributes?: MdxAttribute[];
}

const TECHNICAL_ATTRIBUTE_NAMES = new Set(["href", "src", "url"]);

function brandNode(node: MdxNode): void {
	if (node.type === "text" && typeof node.value === "string") {
		node.value = applyVisibleBrandToText(node.value);
	}

	for (const attribute of node.attributes ?? []) {
		if (
			typeof attribute.value === "string" &&
			!TECHNICAL_ATTRIBUTE_NAMES.has(attribute.name ?? "")
		) {
			attribute.value = applyVisibleBrandToText(attribute.value);
		}
	}

	for (const child of node.children ?? []) brandNode(child);
}

/** 在文档编译期覆盖展示品牌，不改动源码中的命令、路径、包名与链接。 */
export function remarkVisibleBrand() {
	return (tree: MdxNode): void => brandNode(tree);
}
