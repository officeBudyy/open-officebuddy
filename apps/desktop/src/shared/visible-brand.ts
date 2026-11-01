/** 用户可见品牌名。内部兼容标识仍使用 Astravia/astravia。 */
export const VISIBLE_BRAND_NAME = "officebuddy";

/**
 * 将上游文案中的旧展示品牌替换成当前品牌。
 *
 * 只匹配独立单词，避免改动 AstraviaKit 等代码名；小写的包名、协议和路径
 * 也不会受影响。
 */
export function applyVisibleBrand<T>(value: T): T {
	if (typeof value === "string") {
		return value.replace(/\bAstravia\b/g, VISIBLE_BRAND_NAME) as T;
	}
	if (Array.isArray(value)) {
		return value.map((entry) => applyVisibleBrand(entry)) as T;
	}
	if (value !== null && typeof value === "object") {
		return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, applyVisibleBrand(entry)])) as T;
	}
	return value;
}
