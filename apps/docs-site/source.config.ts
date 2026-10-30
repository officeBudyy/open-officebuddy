import { defineConfig } from "fumadocs-mdx/config";
import { remarkVisibleBrand } from "./lib/visible-brand";

export default defineConfig({
	mdxOptions: {
		remarkPlugins: [remarkVisibleBrand],
	},
});
