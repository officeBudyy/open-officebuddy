import { defaultConversationCwdAtom, projectsAtom } from "@shared/store/atoms";
import { pathBasename } from "@shared/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@shared/components/ui/popover";
import { useAtomValue } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	filterProjects,
	selectableProjects,
	shouldShowSearch,
	type ProjectOption,
} from "../../components/new-session/project-selector/project-selection";

export interface TeamWorkspaceChipProps {
	/** 当前会话的工作目录；团队私有目录为 null。 */
	readonly workspacePath: string | null;
	/** 选择项目空间（新建会话绑定）；null 表示回到团队私有目录。 */
	readonly onSelectWorkspace: (cwd: string | null) => void;
	readonly disabled?: boolean;
}

/**
 * 团队会话的工作目录胶囊：展示当前 cwd，点击弹出项目空间选择。
 * 团队工作目录随会话创建固化，因此选择新项目会创建一个绑定了该项目的新会话。
 */
export function TeamWorkspaceChip({ workspacePath, onSelectWorkspace, disabled = false }: TeamWorkspaceChipProps): JSX.Element {
	const { t } = useTranslation("agent-teams");
	const projects = useAtomValue(projectsAtom);
	const defaultConversationCwd = useAtomValue(defaultConversationCwdAtom);
	const [open, setOpen] = useState(false);
	const [query, setQuery] = useState("");

	const options = useMemo(
		() => selectableProjects(projects, defaultConversationCwd),
		[projects, defaultConversationCwd],
	);
	const filtered = useMemo(() => filterProjects(options, query), [options, query]);

	const label = workspacePath
		? pathBasename(workspacePath)
		: t("chat.workspace.unbound");
	const boundToProject = workspacePath !== null;

	function pick(option: ProjectOption | null): void {
		setOpen(false);
		setQuery("");
		onSelectWorkspace(option ? option.cwd : null);
	}

	return (
		<Popover
			open={open}
			onOpenChange={(next) => {
				setOpen(next);
				if (!next) setQuery("");
			}}
		>
			<PopoverTrigger asChild>
				<button
					type="button"
					data-team-workspace="true"
					disabled={disabled}
					title={workspacePath ?? t("chat.workspace.unboundTitle")}
					aria-label={t("chat.workspace.label")}
					className="flex h-7 max-w-52 shrink-0 items-center gap-1.5 rounded-full border border-border/60 bg-background/60 px-2.5 text-[12px] font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-45"
				>
					<span
						className={boundToProject ? "icon-[solar--folder-bold] h-3.5 w-3.5 shrink-0 text-primary/80" : "icon-[solar--folder-minimalistic-linear] h-3.5 w-3.5 shrink-0"}
						aria-hidden="true"
					/>
					<span className="truncate">{label}</span>
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-72 p-1.5">
				<div className="flex flex-col gap-1">
					<p className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground/60">
						{t("chat.workspace.title")}
					</p>
					{shouldShowSearch(options.length) && (
						<input
							value={query}
							onChange={(event) => setQuery(event.target.value)}
							placeholder={t("chat.workspace.search")}
							aria-label={t("chat.workspace.search")}
							className="mx-1 mb-1 h-8 rounded-lg border border-border/60 bg-background/50 px-2.5 text-[12px] text-foreground outline-none placeholder:text-muted-foreground/50 focus:border-primary/50"
						/>
					)}
					<button
						type="button"
						data-team-workspace-option="session"
						className={cnChip(!boundToProject)}
						onClick={() => pick(null)}
					>
						<span className="icon-[solar--box-minimalistic-linear] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
						<span className="min-w-0 flex-1 truncate text-left">{t("chat.workspace.sessionOption")}</span>
						{!boundToProject && <CheckIcon />}
					</button>
					{filtered.map((option) => (
						<button
							key={option.cwd}
							type="button"
							data-team-workspace-option="project"
							className={cnChip(option.cwd === workspacePath)}
							title={option.cwd}
							onClick={() => pick(option)}
						>
							<span className="icon-[solar--folder-bold] h-3.5 w-3.5 shrink-0 text-primary/70" aria-hidden="true" />
							<span className="min-w-0 flex-1 truncate text-left">{option.name}</span>
							{option.cwd === workspacePath && <CheckIcon />}
						</button>
					))}
					{filtered.length === 0 && (
						<p className="px-2 py-3 text-center text-[11.5px] text-muted-foreground">{t("chat.workspace.empty")}</p>
					)}
					<p className="px-2 pb-1 pt-1.5 text-[11px] leading-relaxed text-muted-foreground/70">
						{t("chat.workspace.immutableHint")}
					</p>
				</div>
			</PopoverContent>
		</Popover>
	);
}

function cnChip(active: boolean): string {
	return [
		"flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-[12px] transition-colors",
		active
			? "bg-primary/10 text-primary"
			: "text-foreground hover:bg-accent",
	].join(" ");
}

function CheckIcon(): JSX.Element {
	return <span className="icon-[solar--check-circle-bold] h-3.5 w-3.5 shrink-0" aria-hidden="true" />;
}
