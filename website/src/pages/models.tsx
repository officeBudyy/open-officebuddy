
import { Link } from "react-router";

const providers = [
	{ mark: "Cl", name: "Claude", note: "Anthropic · 官方端点" },
	{ mark: "AI", name: "OpenAI", note: "官方 · 兼容端点" },
	{ mark: "DS", name: "DeepSeek", note: "官方 · OpenAI 兼容" },
	{ mark: "KM", name: "Kimi", note: "Moonshot · 兼容" },
	{ mark: "Gm", name: "Gemini", note: "Google · 官方" },
	{ mark: "X", name: "Grok", note: "xAI · 官方" },
	{ mark: "Qw", name: "Qwen", note: "阿里云 · 兼容" },
	{ mark: "Z", name: "Z.ai", note: "官方 · 兼容" },
	{ mark: "Ol", name: "Ollama", note: "本地推理", local: true },
	{ mark: "vL", name: "vLLM", note: "本地推理", local: true },
	{ mark: "LM", name: "LM Studio", note: "本地推理", local: true },
	{ mark: "＋", name: "自定义端点", note: "任何 OpenAI 兼容地址" },
];

const points = [
	{
		title: "请求直发服务商",
		desc: "应用不代理、不转发、不计费。你能在服务商后台看到每一次调用。",
		icon: "icon-[lucide--arrow-up-right]",
	},
	{
		title: "密钥只存钥匙串",
		desc: "写入系统钥匙串，不落配置文件、不进日志，也不随备份同步到别处。",
		icon: "icon-[lucide--key-round]",
	},
	{
		title: "模型目录随包兜底",
		desc: "能力与价格由 models.dev 补齐，每 12 小时后台同步；断网时使用随包快照。",
		icon: "icon-[lucide--refresh-cw]",
	},
];

export default function Models() {
	return (
		<div className="flex min-h-full flex-col bg-surface">
			<section className="px-8 pb-14 pt-20">
				<div className="mx-auto grid max-w-[1040px] grid-cols-[1.4fr_0.9fr] items-end gap-16">
					<div>
						<h1 className="text-[48px] font-semibold leading-[1.08] tracking-[-0.035em] text-surface-foreground">
							模型是你的，
							<br />
							账单也是。
						</h1>
						<p className="mt-6 max-w-[540px] text-[18px] leading-[1.62] text-muted">
							内置多家服务商预设，只含接口地址与 API 类型。填入自己的 Key 立即拉取可用模型，要换随时换。
						</p>
					</div>
					<div className="pb-2 text-[13px] leading-relaxed text-muted">
						预设里没有任何 Key。
						<br />
						应用也不提供任何共享额度。
					</div>
				</div>
			</section>

			<section className="bg-surface-raised px-8 py-16">
				<div className="mx-auto max-w-[1040px]">
					<div className="grid grid-cols-4 gap-3">
						{providers.map((provider) => (
							<div
								key={provider.name}
								className="rounded-xl bg-surface px-4 py-4"
							>
								<div className="flex items-center justify-between">
									<span className="grid size-8 place-items-center rounded-lg bg-surface-raised text-[11px] font-medium text-muted">
										{provider.mark}
									</span>
									{provider.local ? (
										<span className="text-[10px] text-accent">本地</span>
									) : null}
								</div>
								<div className="mt-3 text-[14px] font-medium text-surface-foreground">
									{provider.name}
								</div>
								<div className="mt-0.5 text-[11.5px] text-muted">{provider.note}</div>
							</div>
						))}
					</div>
					<p className="mt-6 text-[12px] text-muted">
						支持任何 OpenAI 兼容端点；本地推理（Ollama / vLLM / LM Studio）完全离线运行。
					</p>
				</div>
			</section>

			<section className="px-8 py-20">
				<div className="mx-auto grid max-w-[1040px] grid-cols-3 gap-12">
					{points.map((point) => (
						<div key={point.title} className="border-t border-border/80 pt-5">
							<span className={`${point.icon} size-4 text-muted`} />
							<div className="mt-4 text-[16px] font-medium text-surface-foreground">
								{point.title}
							</div>
							<p className="mt-2 text-[13.5px] leading-relaxed text-muted">{point.desc}</p>
						</div>
					))}
				</div>
			</section>

			<section className="px-8">
				<div className="mx-auto max-w-[1040px] rounded-2xl bg-surface-raised p-8">
					<div className="grid grid-cols-[220px_1fr] gap-10">
						<div className="text-[17px] font-medium text-surface-foreground">关于费用</div>
						<div className="max-w-[620px] space-y-3 text-[14px] leading-[1.75] text-muted">
							<p>
								应用不代收任何费用，也不从中分成：推理成本直接结算给你自己配置的服务商。
							</p>
							<p>
								没有额度、没有隐藏收费，用多少、花多少由服务商账户决定；到额时限制来自服务商，而不是这个应用。
							</p>
						</div>
					</div>
				</div>
			</section>

			<section className="flex flex-1 flex-col items-center justify-center bg-dark px-8 py-20 text-center text-on-dark">
				<h2 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">
					接上你正在用的那家。
				</h2>
				<p className="mt-5 max-w-[480px] text-[16px] leading-relaxed text-on-dark-muted">
					填入 Key 就开始对话；换服务商只需要改一行设置。
				</p>
				<div className="mt-9 flex items-center gap-8">
					<Link
						to="/download"
						className="rounded-full bg-primary px-6 py-3 text-[15px] text-primary-foreground"
					>
						免费下载
					</Link>
					<Link to="/ecosystem" className="text-[15px] text-on-dark">
						生态与插件
					</Link>
				</div>
			</section>
		</div>
	);
}
