import type { EnterpriseExpertSummary } from "@preload/api";
import { Button, Switch } from "@astravia-org/ui";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { openEnterpriseExpertTokenDialog } from "../../../shared/enterprise-expert-events";
import {
	readEnterpriseExpertsEnabled,
	writeEnterpriseExpertsEnabled,
} from "../../../shared/enterprise-expert-preferences";
import { isEnterpriseExpertAuthErrorMessage } from "../../../../shared/enterprise-experts";

export interface EnterpriseExpertsSectionProps {
	readonly onStart: (expertId: string) => void;
}

export function EnterpriseExpertsSection({ onStart }: EnterpriseExpertsSectionProps): JSX.Element {
	const { t } = useTranslation("agent-teams");
	const [enabled, setEnabled] = useState(readEnterpriseExpertsEnabled);
	const [experts, setExperts] = useState<readonly EnterpriseExpertSummary[]>([]);
	const [loading, setLoading] = useState(enabled);
	const [error, setError] = useState<string>();
	/** 打开弹窗时置位：Token 配置成功（changed 广播）后自动把开关切到开。 */
	const pendingEnable = useRef(false);

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
			const message = cause instanceof Error ? cause.message : String(cause);
			setError(message);
			// 本机存过 Token 但已失效时开关会直接打开、列表请求鉴权失败；
			// 此时自动唤起配置弹窗，避免只提示「请完成配置」却无弹窗可操作
			if (isEnterpriseExpertAuthErrorMessage(message)) openEnterpriseExpertTokenDialog();
		} finally {
			setLoading(false);
		}
	}, []);

	// 仅在开关打开时拉取/刷新列表
	useEffect(() => {
		if (!enabled) return;
		void load();
		return window.astravia?.enterpriseExperts?.onChanged(() => void load());
	}, [load, enabled]);

	// Token 保存成功会触发 changed 广播（见 enterprise-expert-service.setToken），
	// 此时若在「等待启用」状态则自动打开开关
	const tryAutoEnable = useCallback(async () => {
		if (!pendingEnable.current) return;
		const has = await window.astravia?.enterpriseExperts?.hasToken();
		if (!has) return;
		pendingEnable.current = false;
		writeEnterpriseExpertsEnabled(true);
		setEnabled(true);
	}, []);
	useEffect(() => {
		const api = window.astravia?.enterpriseExperts;
		if (!api) return;
		return api.onChanged(() => void tryAutoEnable());
	}, [tryAutoEnable]);

	const handleToggle = useCallback(async (checked: boolean) => {
		const api = window.astravia?.enterpriseExperts;
		if (!api) return;
		if (!checked) {
			pendingEnable.current = false;
			writeEnterpriseExpertsEnabled(false);
			setEnabled(false);
			return;
		}
		try {
			if (await api.hasToken()) {
				pendingEnable.current = false;
				writeEnterpriseExpertsEnabled(true);
				setEnabled(true);
				return;
			}
		} catch {
			// Token 查询失败：保守起见不开启
			return;
		}
		// 未配置 Token：开关回弹为关，弹出配置窗；保存成功后自动启用
		pendingEnable.current = true;
		openEnterpriseExpertTokenDialog();
	}, []);

	return (
		<section className="mb-9 flex flex-col gap-3.5">
			<div className="flex items-center justify-between gap-3">
				<div className="flex min-w-0 items-baseline gap-3">
					<h2 className="text-[15px] font-semibold tracking-tight text-foreground">{t("enterprise.section")}</h2>
					<span className="truncate text-[12px] text-muted-foreground">
						{enabled ? t("enterprise.hint", { count: experts.length }) : t("enterprise.disabledHint")}
					</span>
				</div>
				<div className="flex shrink-0 items-center gap-2.5">
					<Switch
						size="sm"
						checked={enabled}
						aria-label={t("enterprise.enableLabel")}
						onCheckedChange={(checked) => void handleToggle(checked)}
					/>
					{enabled && (
						<Button variant="ghost" size="sm" className="h-7 text-[12px]" onClick={() => void load()}>
							<span className="icon-[solar--refresh-linear] h-3.5 w-3.5" />{t("enterprise.refresh")}
						</Button>
					)}
				</div>
			</div>
			{!enabled ? (
				<p className="rounded-xl border border-dashed border-border/50 px-4 py-6 text-center text-[12px] text-muted-foreground">
					{t("enterprise.disabledBody")}
				</p>
			) : loading ? (
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
