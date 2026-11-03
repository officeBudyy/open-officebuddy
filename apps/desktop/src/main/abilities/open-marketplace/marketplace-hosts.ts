/**
 * 市场托管站点的 URL 差异集中在这里：仓库校验、raw 清单地址、归档下载地址。
 *
 * GitHub 与 Gitee 的路径规则不同：
 * - raw：GitHub 是 `/raw/refs/heads/{ref}/{path}`，Gitee 只认 `/raw/{ref}/{path}`；
 * - 归档：GitHub 是 `/archive/refs/heads/{ref}.zip`，Gitee 是 `/repository/archive/{ref}.zip`。
 */

export type MarketplaceHost = "github" | "gitee";

/** 允许作为市场来源的托管站点（小写 hostname）。 */
export const SUPPORTED_MARKETPLACE_HOSTS: ReadonlySet<string> = new Set(["github.com", "gitee.com"]);

export function marketplaceHost(repository: string): MarketplaceHost {
	return new URL(repository).hostname.toLowerCase() === "gitee.com" ? "gitee" : "github";
}

function encodeRef(ref: string): string {
	return ref.split("/").map(encodeURIComponent).join("/");
}

/** 无凭证时的清单直连地址；Gitee 会 302 到带签名的 raw 域，调用方需 follow redirect。 */
export function marketplaceManifestUrl(repository: string, ref: string): string {
	const parsed = new URL(repository);
	const rawPath = marketplaceHost(repository) === "gitee" ? "raw" : "raw/refs/heads";
	return `${parsed.origin}${parsed.pathname}/${rawPath}/${encodeRef(ref)}/.astravia/marketplace.json`;
}

/** 无凭证时的整库归档地址。 */
export function marketplaceArchiveUrl(repository: string, ref: string): string {
	const parsed = new URL(repository);
	const archivePath =
		marketplaceHost(repository) === "gitee"
			? `repository/archive/${encodeRef(ref)}.zip`
			: `archive/refs/heads/${encodeRef(ref)}.zip`;
	return `${parsed.origin}${parsed.pathname}/${archivePath}`;
}
