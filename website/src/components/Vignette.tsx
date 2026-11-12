const card =
	"h-[176px] overflow-hidden rounded-xl bg-surface-raised p-4 ring-1 ring-border/60";

export function DocsVignette() {
	return (
		<div className={card}>
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-2 text-[11.5px] font-medium text-surface-foreground">
					<span className="icon-[lucide--file-text] size-3.5 text-muted" />
					采购框架协议_2026.pdf
				</div>
				<span className="text-[10.5px] text-muted">24 页</span>
			</div>
			<div className="mt-3 space-y-1.5">
				<div className="h-1.5 w-[92%] rounded-full bg-border/70" />
				<div className="h-1.5 w-[78%] rounded-full bg-border/70" />
				<div className="h-1.5 w-[85%] rounded-full bg-border/50" />
			</div>
			<div className="mt-3 rounded-lg bg-tint-blue px-2.5 py-2 text-[10.5px] leading-relaxed text-primary">
				第 8.2 条 · 付款账期自验收日起 45 日内结清，逾期按日万分之三计息。
			</div>
		</div>
	);
}

const tableRows = [
	{ dept: "市场部", count: "1,284,600" },
	{ dept: "研发部", count: "3,905,200" },
	{ dept: "运营部", count: "962,400" },
];

export function SqlVignette() {
	return (
		<div className={card}>
			<div className="rounded-md bg-surface px-2.5 py-2 font-mono text-[10px] leading-relaxed text-muted">
				<span className="text-primary">select</span> dept, sum(amount)…
				<br />
				<span className="text-primary">from</span> budget_q3{" "}
				<span className="text-primary">group by</span> dept;
			</div>
			<div className="mt-2.5">
				<div className="grid grid-cols-[1.2fr_1fr] gap-2 px-1 text-[10px] text-muted">
					<span>部门</span>
					<span className="text-right">合计</span>
				</div>
				{tableRows.map((row) => (
					<div
						key={row.dept}
						className="grid grid-cols-[1.2fr_1fr] gap-2 border-t border-border/50 px-1 py-[6px] text-[11px]"
					>
						<span className="text-surface-foreground">{row.dept}</span>
						<span className="text-right text-surface-foreground">{row.count}</span>
					</div>
				))}
			</div>
		</div>
	);
}

const tasks = [
	{ name: "每日邮件摘要", cron: "0 9 * * *", on: true },
	{ name: "周报自动整理", cron: "0 10 * * 1", on: true },
	{ name: "报销单归档", cron: "0 2 * * *", on: false },
];

export function TaskVignette() {
	return (
		<div className={`${card} space-y-1.5`}>
			<div className="flex items-center justify-between pb-1 text-[10.5px] text-muted">
				<span>计划任务</span>
				<span>每天运行</span>
			</div>
			{tasks.map((task) => (
				<div
					key={task.name}
					className="flex items-center justify-between rounded-lg bg-surface px-2.5 py-2"
				>
					<div className="flex items-center gap-2">
						<span
							className={`size-1.5 rounded-full ${task.on ? "bg-accent" : "bg-border"}`}
						/>
						<span className="text-[11.5px] text-surface-foreground">{task.name}</span>
					</div>
					<span className="font-mono text-[10px] text-muted">{task.cron}</span>
				</div>
			))}
		</div>
	);
}

const capabilities = [
	{ icon: "icon-[lucide--sparkles]", label: "技能", meta: "已启用" },
	{ icon: "icon-[lucide--plug]", label: "MCP", meta: "3 个连接" },
	{ icon: "icon-[lucide--puzzle]", label: "插件", meta: "11 个" },
	{ icon: "icon-[lucide--library]", label: "知识库", meta: "2 个索引" },
];

export function SkillVignette() {
	return (
		<div className={`${card} grid grid-cols-2 gap-2`}>
			{capabilities.map((item) => (
				<div key={item.label} className="rounded-lg bg-surface px-2.5 py-2.5">
					<span className={`${item.icon} size-3.5 text-muted`} />
					<div className="mt-2 text-[11.5px] font-medium text-surface-foreground">
						{item.label}
					</div>
					<div className="text-[10px] text-muted">{item.meta}</div>
				</div>
			))}
		</div>
	);
}
