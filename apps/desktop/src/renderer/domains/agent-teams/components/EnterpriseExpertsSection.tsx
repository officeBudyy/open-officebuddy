import type { EnterpriseExpertSummary } from "@preload/api";
import { Button } from "@astravia-org/ui";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export interface EnterpriseExpertsSectionProps {
	readonly onStart: (expertId: string) => void;
}

export function EnterpriseExpertsSection({ onStart }: EnterpriseExpertsSectionProps): JSX.Element {
	const { t } = useTranslation("agent-teams");
	const [experts, setExperts] = useState<readonly EnterpriseExpertSummary[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string>();
	const load = useCallback(async () => {
		setLoading(true);
		setError(undefined);
		try {
			const api = window.astravia?.enterpriseExperts;
			if (!api) {
				setExperts([]);
				return;
			}
			setExperts(await api.list());
		} catch (cause) {
			setError(cause instanceof Error ? cause.message : String(cause));
		} finally {
			setLoading(false);
		}
	}, []);
	useEffect(() => {
		void load();
		return window.astravia?.enterpriseExperts?.onChanged(() => void load());
	}, [load]);

	return (
		<section className="mb-9 flex flex-col gap-3.5">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-baseline gap-3">
					<h2 className="text-[15px] font-semibold tracking-tight text-foreground">{t("enterprise.section")}</h2>
					<span className="truncate text-[12px] text-muted-foreground">{t("enterprise.hint", { count: experts.length })}</span>
				</div>
				<Button variant="ghost" size="sm" className="h-7 text-[12px]" onClick={() => void load()}>
					<span className="icon-[solar--refresh-linear] h-3.5 w-3.5" />{t("enterprise.refresh")}
				</Button>
			</div>
			{loading ? (
				<p className="px-1 text-[12px] text-muted-foreground">{t("loading")}</p>
			) : error ? (
				<p className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center text-[12px] text-muted-foreground">{t("enterprise.authHint")}</p>
			) : experts.length === 0 ? (
				<p className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center text-[12px] text-muted-foreground">{t("enterprise.empty")}</p>
			) : (
				<div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3">
					{experts.map((expert) => (
						<button key={expert.id} type="button" onClick={() => onStart(expert.id)} className="group flex min-h-28 items-center gap-3 rounded-xl border border-border/60 bg-card p-4 text-left transition hover:border-primary/40 hover:bg-accent/40">
							{expert.avatarUrl ? <img src={expert.avatarUrl} alt="" className="h-11 w-11 rounded-xl object-cover" /> : <span className="icon-[solar--global-outline] h-11 w-11 rounded-xl bg-primary/10 p-2.5 text-primary" />}
							<span className="min-w-0 flex-1">
								<span className="block truncate text-[14px] font-medium text-foreground">{expert.name}</span>
								<span className="mt-1 line-clamp-2 text-[12px] text-muted-foreground">{expert.description || t("enterprise.remoteExecution")}</span>
							</span>
							<span className="icon-[solar--arrow-right-linear] h-4 w-4 text-muted-foreground transition group-hover:translate-x-0.5" />
						</button>
					))}
				</div>
			)}
		</section>
	);
}
