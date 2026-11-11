// source.config.ts
import { defineConfig } from "fumadocs-mdx/config";

// lib/visible-brand.ts
var VISIBLE_BRAND_NAME = "officebuddy";
function applyVisibleBrandToText(value) {
  return value.replace(/\bAstravia\b/g, VISIBLE_BRAND_NAME);
}
var TECHNICAL_ATTRIBUTE_NAMES = /* @__PURE__ */ new Set(["href", "src", "url"]);
function brandNode(node) {
  if (node.type === "text" && typeof node.value === "string") {
    node.value = applyVisibleBrandToText(node.value);
  }
  for (const attribute of node.attributes ?? []) {
    if (typeof attribute.value === "string" && !TECHNICAL_ATTRIBUTE_NAMES.has(attribute.name ?? "")) {
      attribute.value = applyVisibleBrandToText(attribute.value);
    }
  }
  for (const child of node.children ?? []) brandNode(child);
}
function remarkVisibleBrand() {
  return (tree) => brandNode(tree);
}

// source.config.ts
var source_config_default = defineConfig({
  mdxOptions: {
    remarkPlugins: [remarkVisibleBrand]
  }
});
export {
  source_config_default as default
};
