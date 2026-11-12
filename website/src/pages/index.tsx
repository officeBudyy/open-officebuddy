
import type { ReactNode } from "react";
import { Link } from "react-router";
import { AppWindow } from "../components/AppWindow";
import {
	DocsVignette,
	SkillVignette,
	SqlVignette,
	TaskVignette,
} from "../components/Vignette";

const facts = [
	{
		title: "文件不出本机",
		desc: "解析、索引与缓存都在本地完成",
		icon: "icon-[lucide--hard-drive]",
	},
	{
		title: "密钥在你手里",
		desc: "模型 Key 只写入系统钥匙串",
		icon: "icon-[lucide--key-round]",
	},
	{
		title: "断网也能干活",
		desc: "整理已有文件时不产生任何请求",
		icon: "icon-[lucide--wifi-off]",
	},
];

const tiles = [
	{
		title: "对话与文档",
		desc: "把文件拖进来就能问。PDF、Word、PPT、表格原地预览，扫描件离线识别。",
		art: <DocsVignette />,
	},
	{
		title: "数据工作台",
		desc: "连上数据库，用中文问数；写操作分级授权，生产连接默认只读。",
		art: <SqlVignette />,
	},
	{
		title: "自动化",
		desc: "内置 Cron 调度，任务在托盘后台常驻，完成后推送到飞书或钉钉。",
		art: <TaskVignette />,
	},
	{
		title: "能力扩展",
		desc: "技能、MCP、插件与知识库，需要的时候再装，不装就不占位置。",
		art: <SkillVignette />,
	},
];

const providers = [
	"Claude",
	"OpenAI",
	"DeepSeek",
	"Kimi",
	"Gemini",
	"Grok",
	"Qwen",
	"Z.ai",
	"Ollama",
	"vLLM",
	"LM Studio",
	"自定义端点",
];

const steps = [
	{
		no: "01",
		title: "下载安装",
		desc: "双击安装包，不需要账号，也没有引导注册。",
	},
	{
		no: "02",
		title: "填入 Key",
		desc: "选择服务商，粘贴自己的 Key，立即拉取可用模型。",
	},
	{
		no: "03",
		title: "开始干活",
		desc: "新建工作区，把要处理的文件拖进对话。",
	},
	{
		no: "04",
		title: "交给自动",
		desc: "重复的事排成计划任务，完成后收到通知。",
	},
];

const network = [
	"模型推理 · 你配置的服务商",
	"模型目录 · models.dev 公共快照",
	"插件来源 · 你添加的仓库",
	"自动更新 · 你指定的更新源",
];

function Tile({
	title,
	desc,
	art,
}: {
	title: string;
	desc: string;
	art: ReactNode;
}) {
	return (
		<div className="flex flex-col rounded-2xl bg-surface p-8">
			<h3 className="text-[21px] font-semibold tracking-tight text-surface-foreground">
				{title}
			</h3>
			<p className="mt-2 max-w-[420px] text-[14px] leading-relaxed text-muted">{desc}</p>
			<div className="mt-auto pt-7">{art}</div>
		</div>
	);
}

export default function Home() {
	return (
		<div className="flex min-h-full flex-col bg-surface">
			<section className="px-8 pb-[76px] pt-[92px]">
				<div className="mx-auto max-w-[1040px]">
					<div className="grid grid-cols-[1.55fr_0.85fr] items-end gap-14">
						<div>
							<h1 className="text-[58px] font-semibold leading-[1.06] tracking-[-0.035em] text-surface-foreground">
								办公桌上的琐事，
								<br />
								交给它就好。
							</h1>
							<p className="mt-7 max-w-[540px] text-[19px] leading-[1.62] text-muted">
								officeBuddy 是本地优先的 AI 办公助手：整理文档、合并表格、翻数据库、按时跑任务——全程在这台电脑里完成，不注册账号，也不上传文件。
							</p>
							<div className="mt-9 flex items-center gap-8">
								<Link
									to="/download"
									className="rounded-full bg-primary px-6 py-3 text-[15px] text-primary-foreground transition-opacity hover:opacity-90"
								>
									免费下载
								</Link>
								<Link
									to="/capabilities"
									className="flex items-center gap-1 text-[15px] text-primary"
								>
									看看它能做什么
									<span className="icon-[lucide--chevron-right] size-4" />
								</Link>
							</div>
							<div className="mt-8 text-[12px] text-muted">
								macOS 12+ · Windows 10+ · Linux　·　免费使用，无需注册
							</div>
						</div>
						<div className="divide-y divide-border/70 border-t border-border/70">
							{facts.map((fact) => (
								<div key={fact.title} className="flex gap-3 py-3.5">
									<span className="flex h-5 shrink-0 items-center">
										<span className={`${fact.icon} size-4 text-muted`} />
									</span>
									<div>
										<div className="text-[13px] font-medium text-surface-foreground">
											{fact.title}
										</div>
										<div className="mt-0.5 text-[12px] text-muted">{fact.desc}</div>
									</div>
								</div>
							))}
						</div>
					</div>
					<div className="mt-[68px]">
						<AppWindow />
						<div className="mt-4 flex items-center justify-between text-[12px] text-muted">
							<span>对话工作区 · 真实界面</span>
							<span>文件在本机解析，不上传</span>
						</div>
					</div>
				</div>
			</section>

			<section className="bg-surface-raised px-8 pb-24 pt-24">
				<div className="mx-auto max-w-[1040px]">
					<div className="flex items-end justify-between">
						<h2 className="text-[40px] font-semibold leading-[1.12] tracking-[-0.03em] text-surface-foreground">
							一个应用，八件事。
						</h2>
						<Link
							to="/capabilities"
							className="flex items-center gap-1 pb-2 text-[15px] text-primary"
						>
							全部能力
							<span className="icon-[lucide--chevron-right] size-4" />
						</Link>
					</div>
					<p className="mt-3 max-w-[520px] text-[17px] leading-relaxed text-muted">
						对话、文档、数据、自动化都在同一个窗口里，不用在几个客户端之间来回切。
					</p>
					<div className="mt-14 grid grid-cols-2 gap-5">
						{tiles.map((tile) => (
							<Tile key={tile.title} title={tile.title} desc={tile.desc} art={tile.art} />
						))}
					</div>
				</div>
			</section>

			<section className="bg-surface px-8 py-24">
				<div className="mx-auto grid max-w-[1040px] grid-cols-[1fr_1.05fr] gap-16">
					<div>
						<h2 className="text-[40px] font-semibold leading-[1.12] tracking-[-0.03em] text-surface-foreground">
							用你自己的模型，
							<br />
							用你自己的 Key。
						</h2>
						<p className="mt-6 max-w-[380px] text-[17px] leading-relaxed text-muted">
							内置的服务商预设只含接口地址与 API 类型，不含任何 Key。填入即用，请求直发服务商——应用不代理、不转发、不计费。
						</p>
						<Link to="/models" className="mt-6 flex items-center gap-1 text-[15px] text-primary">
							查看支持的服务商
							<span className="icon-[lucide--chevron-right] size-4" />
						</Link>
					</div>
					<div>
						<div className="grid grid-cols-3 gap-2.5">
							{providers.map((name) => (
								<div
									key={name}
									className="rounded-lg bg-surface-raised px-3.5 py-3 text-[13px] text-surface-foreground shadow-sm"
								>
									{name}
								</div>
							))}
						</div>
						<p className="mt-5 text-[12px] leading-relaxed text-muted">
							支持 OpenAI 兼容端点，可接本地推理（Ollama / vLLM / LM Studio），完全离线运行。
						</p>
					</div>
				</div>
			</section>

			<section className="bg-surface-raised px-8 py-24">
				<div className="mx-auto grid max-w-[1040px] grid-cols-[1fr_1.1fr] items-center gap-16">
					<div>
						<h2 className="text-[40px] font-semibold leading-[1.12] tracking-[-0.03em] text-surface-foreground">
							一切皆插件。
						</h2>
						<p className="mt-6 max-w-[400px] text-[17px] leading-relaxed text-muted">
							设计画布、内容创作、浏览器操作、Office 预览——这些工作区本身就是插件写出来的。同一套扩展点向第三方开放，权限在 plugin.json 里声明，运行时逐项校验。
						</p>
						<Link to="/ecosystem" className="mt-6 flex items-center gap-1 text-[15px] text-primary">
							了解生态
							<span className="icon-[lucide--chevron-right] size-4" />
						</Link>
					</div>
					<div className="rounded-xl bg-dark p-7">
						<div className="flex items-center gap-2 text-[11px] text-on-dark-muted">
							<span className="icon-[lucide--code-2] size-3.5" />
							plugin.ts
						</div>
						<pre className="mt-4 overflow-hidden font-mono text-[12px] leading-[1.9] text-on-dark">
							<code>{`import { definePlugin } from "@officebuddy/sdk";

export default definePlugin({
  activate(ctx) {
    ctx.ui.registerTab({
      id: "weekly",
      label: "周报助手",
      component: WeeklyPanel,
    });
  },
});`}</code>
						</pre>
						<div className="mt-5 border-t border-white/10 pt-4 text-[11.5px] text-on-dark-muted">
							预装插件 11 个，与第三方插件走同一套 API。
						</div>
					</div>
				</div>
			</section>

			<section className="bg-dark px-8 py-24 text-on-dark">
				<div className="mx-auto max-w-[1040px]">
					<div className="grid grid-cols-[1.2fr_1fr] items-end gap-16">
						<h2 className="text-[40px] font-semibold leading-[1.12] tracking-[-0.03em]">
							你的数据，
							<br />
							留在你的电脑里。
						</h2>
						<p className="pb-1 text-[17px] leading-relaxed text-on-dark-muted">
							连接自己的模型、工具与数据——环境由你决定，应用不替你决定。
						</p>
					</div>
					<div className="mt-14 grid grid-cols-3 gap-10">
						<div>
							<div className="flex items-center gap-2 text-[15px] font-medium">
								<span className="icon-[lucide--shield-check] size-4 text-on-dark-muted" />
								数据安全
							</div>
							<p className="mt-2.5 text-[13.5px] leading-relaxed text-on-dark-muted">
								会话、工作区与密钥都留在本机；没有遥测，没有崩溃上报，没有使用统计。
							</p>
						</div>
						<div>
							<div className="flex items-center gap-2 text-[15px] font-medium">
								<span className="icon-[lucide--cpu] size-4 text-on-dark-muted" />
								模型自由
							</div>
							<p className="mt-2.5 text-[13.5px] leading-relaxed text-on-dark-muted">
								自己的密钥、模型与端点，OpenAI 兼容即接入，本地推理可完全离线。
							</p>
						</div>
						<div>
							<div className="flex items-center gap-2 text-[15px] font-medium">
								<span className="icon-[lucide--layers] size-4 text-on-dark-muted" />
								可扩展
							</div>
							<p className="mt-2.5 text-[13.5px] leading-relaxed text-on-dark-muted">
								插件、技能与 MCP 面向规模扩展；能力按需装，不用的不占位置。
							</p>
						</div>
					</div>
					<div className="mt-12 border-t border-white/10 pt-7">
						<div className="text-[12px] text-on-dark-muted">只在以下情况联网，全部由你的配置决定：</div>
						<div className="mt-3 grid grid-cols-2 gap-x-10 gap-y-2">
							{network.map((item) => (
								<div key={item} className="flex items-center gap-2 text-[12.5px] text-on-dark">
									<span className="size-1 rounded-full bg-on-dark-muted" />
									{item}
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			<section className="bg-surface-raised px-8 py-24">
				<div className="mx-auto max-w-[1040px]">
					<div className="flex items-end justify-between">
						<h2 className="text-[40px] font-semibold leading-[1.12] tracking-[-0.03em] text-surface-foreground">
							四步上手。
						</h2>
						<span className="pb-2 text-[12px] text-muted">从下载到自动化，大约 10 分钟</span>
					</div>
					<div className="mt-14 grid grid-cols-4 gap-8">
						{steps.map((step) => (
							<div key={step.no} className="border-t border-border/80 pt-5">
								<div className="font-mono text-[11px] text-muted">{step.no}</div>
								<div className="mt-3 text-[17px] font-medium text-surface-foreground">
									{step.title}
								</div>
								<p className="mt-2 text-[13.5px] leading-relaxed text-muted">{step.desc}</p>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="flex flex-1 flex-col items-center justify-center bg-dark px-8 py-20 text-center text-on-dark">
				<h2 className="text-[44px] font-semibold leading-[1.1] tracking-[-0.03em]">
					今天就把它放到桌面上。
				</h2>
				<p className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-on-dark-muted">
					免费使用，无需注册，也不需要一张信用卡。装好之后，先把手边那份表格丢进去。
				</p>
				<div className="mt-9 flex items-center gap-8">
					<Link
						to="/download"
						className="rounded-full bg-primary px-6 py-3 text-[15px] text-primary-foreground"
					>
						免费下载
					</Link>
					<Link to="/pricing" className="text-[15px] text-on-dark">
						看看方案
					</Link>
				</div>
			</section>
		</div>
	);
}
