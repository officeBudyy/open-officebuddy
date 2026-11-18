import { Button, cn } from "@astravia-org/ui";
import { motion } from "motion/react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import type { SkillhubSkill } from "@preload/api";
import { SKILLHUB_PAGE_SIZE, useSkillHubModel, type SkillhubSortKey } from "../hooks/useSkillHubModel";

const easeOut = [0.22, 1, 0.36, 1] as const;

const SORT_OPTIONS = [
	{ key: "score", labelKey: "sort.score" },
	{ key: "downloads", labelKey: "sort.downloads" },
	{ key: "updated_at", labelKey: "sort.newest" },
	{ key: "stars", labelKey: "sort.stars" },
] as const;

function formatCount(value: number | undefined): string {
	if (value === undefined) return "0";
	if (value >= 10000) return `${(value / 10000).toFixed(1)}w`;
	return String(value);
}

function SkillIcon({ skill }: { skill: SkillhubSkill }): JSX.Element {
	if (skill.iconUrl) {
		return (
			<img
				src={skill.iconUrl}
				alt=""
				className="h-10 w-10 shrink-0 rounded-lg bg-muted object-cover"
				loading="lazy"
				onError={(event) => {
					event.currentTarget.style.display = "none";
				}}
			/>
		);
	}
	return (
		<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-[14px] font-semibold text-muted-foreground">
			{skill.name.slice(0, 1).toUpperCase()}
		</div>
	);
}

function SkillCard({
	skill,
	installed,
	installing,
	onInstall,
}: {
	skill: SkillhubSkill;
	installed: boolean;
	installing: boolean;
	onInstall: () => void;
}): JSX.Element {
	const { t } = useTranslation("abilities");
	return (
		<div className="group relative flex items-start gap-3 rounded-xl bg-card/60 px-3.5 py-3 transition-colors duration-200 hover:bg-accent/60">
			<SkillIcon skill={skill} />
			<div className="min-w-0 flex-1">
				<div className="flex min-w-0 items-center gap-1.5">
					<h3 className="truncate text-[13px] font-semibold text-foreground">{skill.name}</h3>
					{skill.verified && (
						<span
							className="icon-[solar--verified-check-bold] h-3.5 w-3.5 shrink-0 text-primary/70"
							title={t("skillhub.verified")}
						/>
					)}
				</div>
				<p className="mt-0.5 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground/70">
					{skill.description || t("card.noDescription")}
				</p>
				<div className="mt-1.5 flex items-center gap-3 text-[11px] tabular-nums text-muted-foreground/50">
					<span className="flex items-center gap-1">
						<span className="icon-[solar--download-minimalistic-linear] h-3 w-3" />
						{formatCount(skill.downloads)}
					</span>
					<span className="flex items-center gap-1">
						<span className="icon-[solar--star-linear] h-3 w-3" />
						{formatCount(skill.stars)}
					</span>
				</div>
			</div>
			<div className="shrink-0 pt-0.5">
				{installed ? (
					<span className="flex h-6 items-center gap-1 rounded-lg px-2 text-[11px] text-muted-foreground/60">
						<span className="icon-[solar--check-circle-linear] h-3.5 w-3.5" />
						{t("skillhub.installedBadge")}
					</span>
				) : (
					<Button
						variant="ghost"
						size="icon-sm"
						aria-label={t("skillhub.install")}
						title={t("skillhub.install")}
						disabled={installing}
						className="rounded-lg border border-transparent bg-transparent text-muted-foreground/60 transition-colors hover:border-border hover:bg-muted hover:text-foreground"
						onClick={onInstall}
					>
						<span
							className={cn(
								"icon-[solar--add-linear] h-4 w-4",
								installing && "animate-spin icon-[solar--refresh-linear]",
							)}
						/>
					</Button>
				)}
			</div>
		</div>
	);
}

export function SkillHubPage(): JSX.Element {
	const { t } = useTranslation("abilities");
	const navigate = useNavigate();
	const model = useSkillHubModel();
	return (
		<div className="relative flex h-full w-full flex-1 flex-col overflow-hidden">
			<div className="relative shrink-0 px-8 pb-4">
				<motion.div
					className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4"
					initial={{ opacity: 0, y: -8 }}
					animate={{ opacity: 1, y: 0 }}
					transition={{ duration: 0.5, ease: easeOut }}
				>
					<div className="min-w-0">
						<h1 className="bg-gradient-to-br from-foreground via-foreground to-foreground/70 bg-clip-text text-[26px] font-bold leading-tight tracking-tight text-transparent">
							{t("skillhub.title")}
						</h1>
						<p className="mt-1 text-[12px] text-muted-foreground/60">{t("skillhub.subtitle")}</p>
					</div>
					<Button variant="ghost" size="sm" onClick={() => void navigate({ to: "/abilities" })}>
						<span className="icon-[solar--alt-arrow-left-linear] h-3.5 w-3.5" />
						{t("skillhub.back")}
					</Button>
				</motion.div>
			</div>

			<div className="flex-1 overflow-y-auto px-8 pt-3 pb-8 [scrollbar-gutter:stable]">
				<div className="mx-auto flex w-full max-w-5xl flex-col gap-4">
					<div className="flex flex-wrap items-center justify-between gap-3">
						<div className="relative w-64 shrink-0">
							<span className="icon-[solar--magnifer-linear] absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/40" />
							<input
								type="text"
								placeholder={t("skillhub.searchPlaceholder")}
								value={model.keyword}
								onChange={(event) => model.setKeyword(event.target.value)}
								className="h-8 w-full rounded-lg bg-secondary pl-8 pr-3 text-[12px] text-foreground placeholder:text-muted-foreground/40 transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
							/>
						</div>
						<div className="flex items-center gap-0.5 rounded-lg bg-secondary/70 p-0.5">
							{SORT_OPTIONS.map((option) => (
								<button
									key={option.key}
									type="button"
									onClick={() => model.setSortBy(option.key)}
									className={cn(
										"rounded-md px-2.5 py-1 text-[12px] transition-colors",
										model.sortBy === option.key
											? "bg-background font-medium text-foreground shadow-sm"
											: "text-muted-foreground/60 hover:text-foreground",
									)}
								>
									{t(option.labelKey)}
								</button>
							))}
						</div>
					</div>

					{/* 场景分类导航：全部 + SkillHub 动态分类。 */}
					<div className="flex flex-wrap items-center gap-1.5">
						<button
							type="button"
							onClick={() => model.setCategory(null)}
							className={cn(
								"rounded-full px-3 py-1 text-[12px] transition-colors",
								model.category === null
									? "bg-primary/10 font-medium text-primary"
									: "text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground",
							)}
						>
							{t("skillhub.categoryAll")}
						</button>
						{model.categories.map((item) => (
							<button
								key={item.key}
								type="button"
								onClick={() => model.setCategory(item.key)}
								className={cn(
									"rounded-full px-3 py-1 text-[12px] transition-colors",
									model.category === item.key
										? "bg-primary/10 font-medium text-primary"
										: "text-muted-foreground/70 hover:bg-accent/60 hover:text-foreground",
								)}
							>
								{item.name}
							</button>
						))}
					</div>

					{model.error && (
						<div className="flex items-start gap-2 rounded-lg bg-muted/60 px-3 py-2 text-[12px] text-muted-foreground/70">
							<span className="icon-[solar--info-circle-linear] mt-0.5 h-3.5 w-3.5 shrink-0" />
							<span>{model.error}</span>
						</div>
					)}

					{model.loading ? (
						<div className="flex min-h-52 flex-col items-center justify-center gap-2 text-muted-foreground/60">
							<span className="icon-[solar--refresh-linear] h-8 w-8 animate-spin" />
							<span className="text-[12px]">{t("loading")}</span>
						</div>
					) : model.skills.length === 0 ? (
						<div className="flex min-h-52 flex-col items-center justify-center gap-3 rounded-xl border border-border/50 bg-card/30 text-center">
							<span className="icon-[solar--magic-stick-3-linear] h-10 w-10 text-muted-foreground/50" />
							<p className="text-[13px] font-semibold text-foreground">{t("skillhub.empty")}</p>
						</div>
					) : (
						<div className="flex flex-col gap-4">
							<div className="grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-2.5">
								{model.skills.map((skill) => (
									<SkillCard
										key={skill.slug}
										skill={skill}
										installed={model.installedSlugs.has(skill.slug)}
										installing={model.installingSlug === skill.slug}
										onInstall={() => model.install(skill)}
									/>
								))}
							</div>
							{model.skills.length < model.total && (
								<div className="flex justify-center pt-1">
									<Button variant="secondary" size="sm" disabled={model.loadingMore} onClick={model.loadMore}>
										{model.loadingMore
											? t("skillhub.loadingMore")
											: t("skillhub.loadMore", {
													remaining: Math.min(
														model.total - model.skills.length,
														SKILLHUB_PAGE_SIZE,
													),
												})}
									</Button>
								</div>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
