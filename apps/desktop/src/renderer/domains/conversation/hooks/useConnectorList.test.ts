import type { McpServerConfigData } from "@preload/api";
import { describe, expect, it } from "vitest";
import { buildConnectorListItems } from "./useConnectorList";

describe("buildConnectorListItems", () => {
	it("展示市场与自定义连接器，并保留显示名和图标", () => {
		const servers: Record<string, McpServerConfigData> = {
			documents: {
				type: "http",
				url: "https://example.com/mcp",
				displayName: "Documents",
				description: "Create and edit documents",
				icon: "https://example.com/documents.svg",
			},
			local_search: { command: "local-search" },
		};

		expect(buildConnectorListItems(servers, (key) => key)).toEqual([
			{
				name: "documents",
				label: "Documents",
				description: "Create and edit documents",
				iconUrl: "https://example.com/documents.svg",
			},
			{ name: "local_search", label: "local_search", description: "", iconUrl: "" },
		]);
	});

	it("隐藏已禁用或缺少内置必填配置的连接器", () => {
		const servers: Record<string, McpServerConfigData> = {
			disabled: { command: "disabled", disabled: true },
			slack: {
				command: "npx",
				args: ["-y", "@modelcontextprotocol/server-slack"],
			},
			gmail: {
				command: "npx",
				args: ["-y", "@gongrzhe/server-gmail-autoauth-mcp"],
			},
		};

		expect(buildConnectorListItems(servers, (key) => key)).toEqual([
			{
				name: "gmail",
				label: "mcpPresets.gmail.displayName",
				description: "mcpPresets.gmail.description",
				iconUrl: "./mcp/gmail.webp",
			},
		]);
	});
});
