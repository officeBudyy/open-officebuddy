import { LogoMark } from "./Logo";

const sidebar = [
	{ icon: "icon-[lucide--message-circle]", label: "对话", active: true },
	{ icon: "icon-[lucide--file-text]", label: "文档" },
	{ icon: "icon-[lucide--table-2]", label: "数据" },
	{ icon: "icon-[lucide--timer]", label: "自动化" },
	{ icon: "icon-[lucide--blocks]", label: "能力" },
	{ icon: "icon-[lucide--library]", label: "知识库" },
];

const recent = ["三份合同要点对比", "8 月报销汇总", "供应商名单清洗"];

const chips = ["读取 预算_Q3.xlsx", "合并 3 份表格", "生成汇总表"];

const rows = [
	{ dept: "市场部", amount: "1,284,600", delta: "+12.4%", flag: true },
	{ dept: "研发部", amount: "3,905,200", delta: "+6.1%", flag: false },
	{ dept: "运营部", amount: "962,400", delta: "+2.8%", flag: false },
];

export function AppWindow() {
	return (
		<div className="overflow-hidden rounded-2xl bg-surface-raised shadow-lg ring-1 ring-black/[0.06]">
			<div className="flex h-11 items-center justify-between border-b border-border/60 px-5">
				<div className="flex items-center gap-3">
					<LogoMark size={18} />
					<span className="text-[12px] font-semibold text-surface-foreground">officeBuddy</span>
					<span className="text-[12px] text-muted">/ 季度预算复核</span>
				</div>
				<div className="flex items-center gap-3 text-[11px] text-muted">
					<span className="flex items-center gap-1.5">
						<span className="size-1.5 rounded-full bg-accent" />
						本地索引完成
					</span>
					<span className="icon-[lucide--search] size-3.5" />
					<span className="icon-[lucide--settings-2] size-3.5" />
				</div>
			</div>
			<div className="flex h-[476px]">
				<aside className="w-[204px] shrink-0 border-r border-border/60 bg-surface/70 px-3 py-4">
					<div className="flex items-center justify-between rounded-lg bg-surface-raised px-2.5 py-2 text-[12px] font-medium text-surface-foreground shadow-sm">
						新对话
						<span className="icon-[lucide--plus] size-3.5 text-muted" />
					</div>
					<div className="mt-4 space-y-0.5">
						{sidebar.map((item) => (
							<div
								key={item.label}
								className={`flex items-center gap-2 rounded-md px-2.5 py-[7px] text-[12.5px] ${
									item.active ? "bg-surface-raised text-surface-foreground shadow-sm" : "text-muted"
								}`}
							>
								<span className={`${item.icon} size-3.5`} />
								{item.label}
							</div>
						))}
					</div>
					<div className="mt-6 px-2.5 text-[10.5px] font-medium tracking-wide text-muted/80">
						最近
					</div>
					<div className="mt-2 space-y-1.5">
						{recent.map((item) => (
							<div key={item} className="truncate px-2.5 text-[12px] text-muted">
								{item}
							</div>
						))}
					</div>
				</aside>
				<main className="flex min-w-0 flex-1 flex-col px-7 pb-5 pt-5">
					<div className="flex items-center justify-between">
						<div>
							<div className="text-[14px] font-semibold text-surface-foreground">季度预算复核</div>
							<div className="mt-0.5 text-[11px] text-muted">4 个文件 · 186 行数据 · 全部在本机解析</div>
						</div>
						<div className="rounded-full bg-surface px-3 py-1 text-[11px] text-muted">共享</div>
					</div>
					<div className="mt-5 flex flex-1 flex-col gap-3.5">
						<div className="flex justify-end">
							<div className="max-w-[430px] rounded-[14px] bg-primary px-3.5 py-2.5 text-[12.5px] leading-relaxed text-primary-foreground">
								把这三份预算表合成一张，标出同比超过 10% 的科目，按部门分组。
							</div>
						</div>
						<div className="flex gap-2.5">
							<LogoMark size={19} />
							<div className="min-w-0">
								<div className="text-[12.5px] leading-relaxed text-surface-foreground">
									已合并 3 份表格，共 186 行。下面 4 个科目同比超过 10%，市场部的「代理商费用」超出最多。
								</div>
								<div className="mt-2 flex flex-wrap gap-1.5">
									{chips.map((chip) => (
										<span
											key={chip}
											className="flex items-center gap-1 rounded-md bg-surface px-2 py-1 text-[11px] text-muted"
										>
											<span className="icon-[lucide--check] size-3 text-accent" />
											{chip}
										</span>
									))}
								</div>
							</div>
						</div>
						<div className="overflow-hidden rounded-xl ring-1 ring-border/70">
							<div className="flex items-center justify-between bg-surface/60 px-3.5 py-2.5">
								<div className="flex items-center gap-2 text-[11.5px] font-medium text-surface-foreground">
									<span className="icon-[lucide--sheet] size-3.5 text-accent" />
									预算汇总_Q3.xlsx
								</div>
								<span className="text-[10.5px] text-muted">4 张表 · 186 行</span>
							</div>
							<div className="grid grid-cols-[1.4fr_1fr_0.9fr] gap-2 border-t border-border/50 px-3.5 py-1.5 text-[10.5px] text-muted">
								<span>部门</span>
								<span className="text-right">金额（元）</span>
								<span className="text-right">同比</span>
							</div>
							{rows.map((row) => (
								<div
									key={row.dept}
									className="grid grid-cols-[1.4fr_1fr_0.9fr] gap-2 border-t border-border/40 px-3.5 py-[7px] text-[11.5px]"
								>
									<span className="text-surface-foreground">{row.dept}</span>
									<span className="text-right text-surface-foreground">{row.amount}</span>
									<span
										className={`text-right ${
											row.flag ? "font-medium text-danger" : "text-muted"
										}`}
									>
										{row.delta}
									</span>
								</div>
							))}
						</div>
					</div>
					<div className="mt-4 flex items-center gap-3 rounded-full bg-surface px-4 py-2.5">
						<span className="text-[12px] text-muted">继续问，或把文件拖进来</span>
						<div className="ml-auto flex items-center gap-2.5 text-muted">
							<span className="icon-[lucide--paperclip] size-3.5" />
							<span className="grid size-5 place-items-center rounded-full bg-primary">
								<span className="icon-[lucide--arrow-up] size-3 text-primary-foreground" />
							</span>
						</div>
					</div>
				</main>
			</div>
		</div>
	);
}
