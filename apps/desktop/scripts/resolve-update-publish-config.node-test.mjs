import assert from "node:assert/strict";
import test from "node:test";
import { resolveUpdatePublishConfig } from "./resolve-update-publish-config.mjs";

test("disables updates when a packaged build has no explicit provider", () => {
	assert.equal(resolveUpdatePublishConfig({}), null);
});

test("allows an explicit update URL to override the stable default", () => {
	assert.deepEqual(
		resolveUpdatePublishConfig({
			ASTRAVIA_UPDATE_PROVIDER: "generic",
			ASTRAVIA_UPDATE_URL: "https://releases.example.com/desktop/test/",
		}),
		{
			provider: "generic",
			url: "https://releases.example.com/desktop/test",
			useMultipleRangeRequest: true,
		},
	);
});

test("allows a package to explicitly disable updates", () => {
	assert.equal(resolveUpdatePublishConfig({ ASTRAVIA_UPDATE_PROVIDER: "none" }), null);
});

test("requires a URL when the generic provider is enabled", () => {
	assert.throws(
		() => resolveUpdatePublishConfig({ ASTRAVIA_UPDATE_PROVIDER: "generic" }),
		/ASTRAVIA_UPDATE_URL is required/,
	);
});

test("still requires GitHub coordinates for the GitHub provider", () => {
	assert.throws(
		() => resolveUpdatePublishConfig({ ASTRAVIA_UPDATE_PROVIDER: "github" }),
		/ASTRAVIA_UPDATE_GITHUB_OWNER is required/,
	);
});
