import { describe, expect, it } from "vitest";
import { remarkVisibleBrand } from "../lib/visible-brand";

describe("remarkVisibleBrand", () => {
	it("brands visible MDX text and labels while preserving technical targets", () => {
		const textNode = { type: "text", value: "Use Astravia for this task" };
		const codeNode = { type: "inlineCode", value: "Astravia.exe" };
		const componentNode = {
			type: "mdxJsxFlowElement",
			attributes: [
				{ name: "title", value: "Astravia workspace" },
				{ name: "href", value: "/downloads/Astravia-latest.dmg" },
			],
		};
		const tree = {
			type: "root",
			children: [textNode, codeNode, componentNode],
		};

		remarkVisibleBrand()(tree);

		expect(textNode.value).toBe("Use officebuddy for this task");
		expect(codeNode.value).toBe("Astravia.exe");
		expect(componentNode.attributes).toEqual([
			{ name: "title", value: "officebuddy workspace" },
			{ name: "href", value: "/downloads/Astravia-latest.dmg" },
		]);
	});
});
