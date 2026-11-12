
import { Link } from "react-router";

const personal = [
	"全部内置能力：对话、文档、数据、批量与定时任务",
	"自备模型 Key，接自己的服务商或本地端点",
	"本地运行，不上传文件，无遥测",
	"免费更新，中英双语界面",
];

const team = [
	"部署在你的 VPC、机房或专属环境",
	"内部系统与数据源对接",
	"定制插件、技能与知识结构",
	"固定的落地与运维对接通道",
];

const faq = [
	{
		q: "免费版有额度限制吗？",
		a: "没有额度这回事。应用不代理推理，也不从中计费——你直接调用自己的模型服务商。",
	},
	{
		q: "需要注册账号吗？",
		a: "不需要。下载安装包，双击即用；没有登录墙，也没有激活码。",
	},
	{
		q: "数据会离开这台电脑吗？",
		a: "会话、工作区与索引默认留在本机，密钥存系统钥匙串。出站请求只发生在你配置的服务商与插件上。",
	},
	{
		q: "团队版按什么计费？",
		a: "按部署范围与对接工作量报价，包含部署、对接与一年的版本更新。具体规模在沟通后确定。",
	},
];

export default function Pricing() {
	return (
		<div className="flex min-h-full flex-col bg-surface">
			<section className="px-8 pb-12 pt-20">
				<div className="mx-auto max-w-[1040px]">
					<h1 className="text-[48px] font-semibold leading-[1.08] tracking-[-0.035em] text-surface-foreground">
						免费，然后按需。
					</h1>
					<p className="mt-6 max-w-[560px] text-[18px] leading-[1.62] text-muted">
						个人使用不收费，也不限额度。需要数据驻留与内部系统对接时，我们再谈部署范围。
					</p>
				</div>
			</section>

			<section className="px-8">
				<div className="mx-auto grid max-w-[1040px] grid-cols-2 gap-5">
					<div className="rounded-2xl bg-surface-raised p-9">
						<div className="text-[15px] font-medium text-surface-foreground">个人版</div>
						<div className="mt-4 flex items-baseline gap-2">
							<span className="text-[40px] font-semibold tracking-[-0.03em]">¥0</span>
							<span className="text-[13px] text-muted">永久免费</span>
						</div>
						<p className="mt-3 text-[13.5px] leading-relaxed text-muted">
							一个人用，全部功能都在里面。
						</p>
						<ul className="mt-7 space-y-3">
							{personal.map((item) => (
								<li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed">
									<span className="flex h-[22px] shrink-0 items-center">
										<span className="icon-[lucide--check] size-3.5 text-accent" />
									</span>
									<span className="text-surface-foreground">{item}</span>
								</li>
							))}
						</ul>
						<Link
							to="/download"
							className="mt-8 flex w-full items-center justify-center rounded-full bg-primary py-3 text-[14px] text-primary-foreground"
						>
							免费下载
						</Link>
					</div>
					<div className="rounded-2xl bg-surface-raised p-9">
						<div className="text-[15px] font-medium text-surface-foreground">团队版</div>
						<div className="mt-4 flex items-baseline gap-2">
							<span className="text-[40px] font-semibold tracking-[-0.03em]">按需</span>
							<span className="text-[13px] text-muted">按范围报价</span>
						</div>
						<p className="mt-3 text-[13.5px] leading-relaxed text-muted">
							给需要数据驻留与内部系统的团队。
						</p>
						<ul className="mt-7 space-y-3">
							{team.map((item) => (
								<li key={item} className="flex gap-2.5 text-[13.5px] leading-relaxed">
									<span className="flex h-[22px] shrink-0 items-center">
										<span className="icon-[lucide--check] size-3.5 text-accent" />
									</span>
									<span className="text-surface-foreground">{item}</span>
								</li>
							))}
						</ul>
						<Link
							to="/download"
							className="mt-8 flex w-full items-center justify-center rounded-full bg-surface py-3 text-[14px] text-surface-foreground"
						>
							说明你的场景
						</Link>
					</div>
				</div>
			</section>

			<section className="px-8 py-12">
				<div className="mx-auto grid max-w-[1040px] grid-cols-3 gap-10 text-[12.5px] leading-relaxed text-muted">
					<div>推理费用直接结算给你自己的模型服务商，应用不经手。</div>
					<div>没有席位费、没有隐藏收费，卸载即结束。</div>
					<div>版本更新免费，不区分免费版与付费版。</div>
				</div>
			</section>

			<section className="px-8 pb-20">
				<div className="mx-auto max-w-[1040px] rounded-2xl bg-surface-raised p-9">
					<div className="grid grid-cols-[240px_1fr] gap-12">
						<div>
							<h2 className="text-[28px] font-semibold leading-[1.2] tracking-[-0.02em] text-surface-foreground">
								常见问题
							</h2>
							<p className="mt-3 text-[12.5px] leading-relaxed text-muted">
								还有别的问题，可以直接在 Issues 里问。
							</p>
						</div>
						<div className="grid grid-cols-2 gap-x-10 gap-y-8">
							{faq.map((item) => (
								<div key={item.q}>
									<div className="text-[14px] font-medium text-surface-foreground">{item.q}</div>
									<p className="mt-2 text-[13px] leading-[1.7] text-muted">{item.a}</p>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			<section className="flex flex-1 flex-col items-center justify-center bg-dark px-8 py-16 text-center text-on-dark">
				<h2 className="text-[36px] font-semibold leading-[1.12] tracking-[-0.03em]">
					先下载，再决定。
				</h2>
				<p className="mt-4 max-w-[480px] text-[15px] leading-relaxed text-on-dark-muted">
					不需要信用卡，也不需要先选方案。
				</p>
				<Link
					to="/download"
					className="mt-8 rounded-full bg-primary px-6 py-3 text-[15px] text-primary-foreground"
				>
					免费下载
				</Link>
			</section>
		</div>
	);
}
