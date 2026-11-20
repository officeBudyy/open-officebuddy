import {
	type BuiltinMcpLabelKey,
	matchBuiltinMcpPreset,
	missingRequiredSecrets,
	resolveMcpIcon,
	resolveMcpPresetDescription,
	resolveMcpPresetDisplayName,
} from "@domains/settings/mcp/builtin-mcp-presets";
import type { McpServerConfigData } from "@preload/api";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";

export interface ConnectorListItem {
	/** mcp.json 里的真实 key，写进 `@mcp:` 标记的就是它。 */
	name: string;
	label: string;
	description: string;
	iconUrl: string;
}

export interface ConnectorListModel {
	items: ConnectorListItem[];
}

/**
 * 已启用的自定义/市场连接器可以直接展示；内置预设还需要满足其必填密钥约束。
 * OAuth 状态不参与过滤，避免面板打开后因额外 IPC 异步重排。
 */
export function buildConnectorListItems(
	servers: Readonly<Record<string, McpServerConfigData>>,
	translate: (key: BuiltinMcpLabelKey) => string,
): ConnectorListItem[] {
	const items: ConnectorListItem[] = [];
	for (const [name, config] of Object.entries(servers)) {
		if (config.disabled === true) continue;
		const preset = matchBuiltinMcpPreset(name, config);
		if (preset && missingRequiredSecrets(preset, config).length > 0) continue;
		const label = preset ? resolveMcpPresetDisplayName(preset, translate) : config.displayName?.trim() || name;
		items.push({
			name,
			label,
			description: preset
				? resolveMcpPresetDescription(preset, translate)
				: config.description?.trim() || (label === name ? "" : name),
			iconUrl: resolveMcpIcon(name, config) ?? "",
		});
	}
	return items.sort((left, right) => left.label.localeCompare(right.label));
}

/**
 * 输入框命令区的已安装连接器列表。
 * `prefetch` 让它在展开前读好 mcp.json，避免第一次展开与高度动画争用主线程。
 */
export function useConnectorList(open: boolean, prefetch = false): ConnectorListModel {
	const { t } = useTranslation("settings");
	const [servers, setServers] = useState<Record<string, McpServerConfigData>>({});

	useEffect(() => {
		if (!open && !prefetch) return;
		let cancelled = false;
		void window.astravia.mcp
			.get()
			.then((config) => {
				if (!cancelled) setServers(config.mcpServers ?? {});
			})
			.catch((error) => {
				console.error("[useConnectorList] read mcp config failed:", error);
			});
		return () => {
			cancelled = true;
		};
	}, [open, prefetch]);

	return useMemo(() => ({ items: buildConnectorListItems(servers, (key) => t(key)) }), [servers, t]);
}
