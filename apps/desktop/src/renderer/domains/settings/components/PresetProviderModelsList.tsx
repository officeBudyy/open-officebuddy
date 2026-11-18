import {
	PresetProviderModelsListView,
	type PresetProviderModelsListViewLabels,
} from "@astravia-org/theme-ui/settings";
import {
	Button,
	Input,
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
	cn,
} from "@astravia-org/ui";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import type {
	PresetProviderModelRow,
	PresetProviderRow,
	PresetProvidersSectionLabels,
} from "./usePresetProvidersSectionModel";

export function PresetProviderModelsList({
	row,
	labels,
	onSaveContextWindowOverride,
}: {
	row: PresetProviderRow;
	labels: PresetProvidersSectionLabels;
	onSaveContextWindowOverride: (modelId: string, value: number | null) => Promise<void>;
}): JSX.Element {
	const { t } = useTranslation("settings");
	const [searchQuery, setSearchQuery] = useState("");
	const normalizedQuery = searchQuery.trim().normalize("NFKC").toLocaleLowerCase();
	const modelRows = useMemo(() => {
		if (!normalizedQuery) return row.modelRows;
		return row.modelRows.filter((model) => {
			const searchable = `${model.name}\n${model.id}`.normalize("NFKC").toLocaleLowerCase();
			return searchable.includes(normalizedQuery);
		});
	}, [normalizedQuery, row.modelRows]);
	const viewLabels: PresetProviderModelsListViewLabels = {
		clearSearch: labels.clearModelSearch,
		listLabel: labels.modelListLabel(row.displayName),
		noMatchingModels: labels.noMatchingModels,
		noModels: labels.noModels,
		perMillionTokens: labels.perMillionTokens,
		searchPlaceholder: labels.searchModels(row.displayName),
		thinking: labels.thinking,
	};
	return (
		<div className="flex flex-col gap-2">
			<PresetProviderModelsListView
				labels={viewLabels}
				modelRows={modelRows}
				onSearchQueryChange={setSearchQuery}
				searchQuery={searchQuery}
				totalModelCount={row.modelRows.length}
			/>
			{row.adopted && row.modelRows.length > 0 && (
				<ContextWindowOverrideEditor modelRows={row.modelRows} onSave={onSaveContextWindowOverride} />
			)}
		</div>
	);
}

/**
 * 上下文窗口覆盖编辑器：预设服务商的模型列表会被定时同步整体覆写，手工修正的
 * 上下文窗口只能落在 provider.modelOverrides 里才不会被冲掉。运行时（含已开启的
 * 会话的下一轮请求）会即时套用，无需重启。
 */
function ContextWindowOverrideEditor({
	modelRows,
	onSave,
}: {
	modelRows: readonly PresetProviderModelRow[];
	onSave: (modelId: string, value: number | null) => Promise<void>;
}): JSX.Element {
	const { t } = useTranslation("settings");
	const overrides = useMemo(
		() => modelRows.filter((model) => model.contextWindowOverride !== undefined),
		[modelRows],
	);
	const [selectedId, setSelectedId] = useState<string>("");
	const [draft, setDraft] = useState("");
	const selected = modelRows.find((model) => model.id === selectedId);
	const parsed = Number(draft.trim());
	const draftValid = draft.trim().length > 0 && Number.isFinite(parsed) && parsed > 0;
	// 选中项变化时把该模型的上游声明或现值填进输入框，避免用户从 0 猜。
	const placeholder = selected
		? String(selected.contextWindowOverride ?? selected.contextWindow ?? "")
		: "";

	async function apply(value: number | null, modelId = selectedId): Promise<void> {
		await onSave(modelId, value);
		setDraft("");
	}

	return (
		<div
			data-testid="context-window-override-editor"
			className="rounded-xl border border-border/50 bg-background/40 px-3 py-2.5"
		>
			<p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
				{t("contextWindowOverride.title")}
			</p>
			<p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground/70">
				{t("contextWindowOverride.hint")}
			</p>
			<div className="mt-2 flex items-center gap-2">
				<Select
					value={selectedId}
					onValueChange={(value) => {
						setSelectedId(value);
						setDraft("");
					}}
				>
					<SelectTrigger aria-label={t("contextWindowOverride.model")} className="h-8 min-w-0 flex-1">
						<SelectValue placeholder={t("contextWindowOverride.pickModel")} />
					</SelectTrigger>
					<SelectContent className="max-h-64">
						{modelRows.map((model) => (
							<SelectItem key={model.id} value={model.id}>
								{model.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Input
					type="number"
					min={1}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					placeholder={placeholder}
					aria-label={t("contextWindowOverride.value")}
					className="h-8 w-36 shrink-0"
				/>
				<Button
					variant="outline"
					size="sm"
					className="h-8 shrink-0"
					disabled={!selected || !draftValid || parsed === selected.contextWindowOverride}
					onClick={() => void apply(parsed)}
				>
					{t("contextWindowOverride.apply")}
				</Button>
			</div>
			{overrides.length > 0 && (
				<ul className="mt-2 flex flex-wrap gap-1.5">
					{overrides.map((model) => (
						<li key={model.id}>
							<button
								type="button"
								title={t("contextWindowOverride.remove")}
								onClick={() => void apply(null, model.id)}
								className={cn(
									"inline-flex max-w-56 items-center gap-1.5 rounded-full border border-border/60 bg-muted/60 px-2.5 py-1 text-[11px] text-muted-foreground transition-colors hover:border-destructive/40 hover:text-destructive",
								)}
							>
								<span className="truncate">{model.name}</span>
								<span className="shrink-0 font-medium text-foreground">
									{model.contextWindowOverride!.toLocaleString()}
								</span>
								<span className="icon-[solar--close-circle-linear] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
							</button>
						</li>
					))}
				</ul>
			)}
		</div>
	);
}
