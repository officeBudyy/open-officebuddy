import { Link } from "react-router";
import { Logo } from "./Logo";

const groups = [
	{
		title: "产品",
		items: [
			{ label: "能力", to: "/capabilities" },
			{ label: "模型", to: "/models" },
			{ label: "生态", to: "/ecosystem" },
			{ label: "定价", to: "/pricing" },
		],
	},
	{
		title: "资源",
		items: [
			{ label: "下载", to: "/download" },
			{ label: "使用文档", to: "/download" },
			{ label: "更新日志", to: "/download" },
		],
	},
	{
		title: "关于",
		items: [
			{ label: "隐私说明", to: "/pricing" },
			{ label: "常见问题", to: "/pricing" },
			{ label: "联系我们", to: "/pricing" },
		],
	},
];

export function Footer() {
	return (
		<footer className="shrink-0 border-t border-border/70 bg-surface px-8 py-10 text-[12px] text-muted">
			<div className="mx-auto max-w-[1040px]">
				<div className="grid grid-cols-[1.6fr_1fr_1fr_1fr] gap-10">
					<div>
						<Logo className="text-surface-foreground" size={24} fontSize={15} />
						<p className="mt-3 max-w-[300px] leading-relaxed">
							本地优先的 AI 办公助手。文档、数据、自动化在同一个桌面端里完成，文件与密钥不出你的电脑。
						</p>
					</div>
					{groups.map((group) => (
						<div key={group.title}>
							<div className="font-medium text-surface-foreground">{group.title}</div>
							<ul className="mt-3 space-y-2">
								{group.items.map((item) => (
									<li key={item.label}>
										<Link to={item.to} className="hover:text-surface-foreground">
											{item.label}
										</Link>
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div className="mt-9 flex items-center justify-between border-t border-border/60 pt-5 text-[11px]">
					<span>© 2026 officeBuddy</span>
					<span>本地优先 · 无需注册 · 无遥测</span>
				</div>
			</div>
		</footer>
	);
}
