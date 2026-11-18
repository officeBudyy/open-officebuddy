import type { SkillhubCategory, SkillhubSkill } from "@preload/api";
import { i18n } from "@shared/i18n";
import { showToast } from "@shared/store/toast-atoms";
import { useCallback, useEffect, useRef, useState } from "react";

export const SKILLHUB_PAGE_SIZE = 24;

export type SkillhubSortKey = "score" | "downloads" | "updated_at" | "stars";

export interface SkillHubModel {
	categories: SkillhubCategory[];
	skills: SkillhubSkill[];
	total: number;
	loading: boolean;
	loadingMore: boolean;
	error: string | null;
	category: string | null;
	sortBy: SkillhubSortKey;
	keyword: string;
	installedSlugs: ReadonlySet<string>;
	installingSlug: string | null;
	setCategory: (category: string | null) => void;
	setSortBy: (sortBy: SkillhubSortKey) => void;
	setKeyword: (keyword: string) => void;
	loadMore: () => void;
	install: (skill: SkillhubSkill) => void;
}

/** SkillHub 商店列表页 model：分类/排序/搜索 + 分页拉取 + 一键安装。 */
export function useSkillHubModel(): SkillHubModel {
	const [categories, setCategories] = useState<SkillhubCategory[]>([]);
	const [skills, setSkills] = useState<SkillhubSkill[]>([]);
	const [total, setTotal] = useState(0);
	const [loading, setLoading] = useState(true);
	const [loadingMore, setLoadingMore] = useState(false);
	const [error, setError] = useState<string | null>(null);
	const [category, setCategory] = useState<string | null>(null);
	const [sortBy, setSortBy] = useState<SkillhubSortKey>("score");
	const [keyword, setKeyword] = useState("");
	const [installedSlugs, setInstalledSlugs] = useState<ReadonlySet<string>>(new Set());
	const [installingSlug, setInstallingSlug] = useState<string | null>(null);
	const requestSeq = useRef(0);
	const keywordRef = useRef("");
	keywordRef.current = keyword;

	const fetchPage = useCallback(
		async (
			page: number,
			append: boolean,
			input: { category: string | null; sortBy: SkillhubSortKey; keyword: string },
		) => {
			const seq = ++requestSeq.current;
			if (append) setLoadingMore(true);
			else setLoading(true);
			setError(null);
			try {
				const result = await window.astravia.skillhub.listSkills({
					page,
					pageSize: SKILLHUB_PAGE_SIZE,
					sortBy: input.sortBy,
					...(input.category ? { category: input.category } : {}),
					...(input.keyword.trim() ? { keyword: input.keyword.trim() } : {}),
				});
				if (seq !== requestSeq.current) return;
				setTotal(result.total);
				setSkills((prev) => (append ? [...prev, ...result.skills] : result.skills));
			} catch (err: unknown) {
				if (seq !== requestSeq.current) return;
				setError(err instanceof Error ? err.message : String(err));
				if (!append) setSkills([]);
			} finally {
				if (seq === requestSeq.current) {
					setLoading(false);
					setLoadingMore(false);
				}
			}
		},
		[],
	);

	const refreshInstalled = useCallback(() => {
		void window.astravia.skills
			.getMarketManifest()
			.then((manifest) => {
				setInstalledSlugs(new Set(Object.keys(manifest)));
			})
			.catch(() => undefined);
	}, []);

	useEffect(() => {
		refreshInstalled();
		void window.astravia.skillhub
			.listCategories()
			.then((items) => setCategories(items.filter((item) => item.active !== false)))
			.catch(() => undefined);
	}, [refreshInstalled]);

	// 筛选（分类 / 排序 / 关键词）变化时回到第一页；关键词输入带防抖。
	useEffect(() => {
		const timer = setTimeout(
			() => {
				void fetchPage(1, false, { category, sortBy, keyword });
			},
			keyword.trim() ? 300 : 0,
		);
		return () => clearTimeout(timer);
	}, [fetchPage, category, sortBy, keyword]);

	const loadMore = useCallback(() => {
		if (loading || loadingMore) return;
		if (skills.length >= total) return;
		void fetchPage(Math.ceil(skills.length / SKILLHUB_PAGE_SIZE) + 1, true, { category, sortBy, keyword });
	}, [loading, loadingMore, skills.length, total, fetchPage, category, sortBy, keyword]);

	const install = useCallback(
		(skill: SkillhubSkill) => {
			if (installingSlug) return;
			setInstallingSlug(skill.slug);
			void window.astravia.skillhub
				.install({
					slug: skill.slug,
					name: skill.name,
					...(skill.description ? { description: skill.description } : {}),
					...(skill.version ? { version: skill.version } : {}),
				})
				.then((result) => {
					setInstalledSlugs((prev) => new Set([...prev, skill.slug, result.name]));
					showToast({
						variant: "success",
						message: i18n.t("abilities:skillhub.installed", { name: skill.name }),
					});
				})
				.catch((err: unknown) => {
					showToast({
						variant: "error",
						message: i18n.t("abilities:skillhub.installFailed", {
							name: skill.name,
							error: err instanceof Error ? err.message : String(err),
						}),
					});
				})
				.finally(() => {
					setInstallingSlug(null);
				});
		},
		[installingSlug],
	);

	return {
		categories,
		skills,
		total,
		loading,
		loadingMore,
		error,
		category,
		sortBy,
		keyword,
		installedSlugs,
		installingSlug,
		setCategory: (next) => {
			setCategory(next);
		},
		setSortBy,
		setKeyword,
		loadMore,
		install,
	};
}
