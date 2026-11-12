
import { Link } from "react-router";

const types = [
	{
		icon: "icon-[lucide--sparkles]",
		title: "技能",
		desc: "把一组操作打包成一个动作：读写文件、执行命令、查数据、调用内部接口。",
		sample: "示例 · 整理本周会议记录",
	},
	{
		icon: "icon-[lucide--plug]",
		title: "MCP 连接器",
		desc: "把外部服务接成助手能调用的工具，API、数据库、内部系统都算。",
		sample: "示例 · 查询 CRM 客户档案",
	},
	{
		icon: "icon-[lucide--puzzle]",
		title: "插件",
		desc: "新增侧栏面板、活动区标签与命令，把一整套工作流装进同一个应用。",
		sample: "示例 · 周报生成面板",
	},
	{
		icon: "icon-[lucide--palette]",
		title: "主题",
		desc: "外观、编辑器配色与图标随插件一起分发，也可以自己写一套。",
		sample: "示例 · 低对比夜间配色",
	},
];

const presets = [
	{ name: "设计画布", desc: "画框即真实 React 代码" },
	{ name: "内容创作", desc: "节点画布与素材编排" },
	{ name: "浏览器操作", desc: "驱动真实浏览器完成任务" },
	{ name: "图表渲染", desc: "对话下方的图表" },
	{ name: "图像生成", desc: "文生图与图像编辑" },
	{ name: "Office 预览", desc: "离线打开 PDF 与办公文档" },
	{ name: "媒体预览", desc: "图片、音频与视频" },
	{ name: "SVG 预览", desc: "渲染与源码可切换" },
	{ name: "Git 变更", desc: "活动面板里的变更树与 diff" },
	{ name: "插件制作", desc: "通过对话自举一个插件" },
	{ name: "系统动作", desc: "可独立演进的官方动作" },
];

export default function Ecosystem() {
	return (
		<div className="flex min-h-full flex-col bg-surface">
			<section className="px-8 pb-14 pt-20">
				<div className="mx-auto max-w-[1040px]">
					<h1 className="text-[48px] font-semibold leading-[1.08] tracking-[-0.035em] text-surface-foreground">
						一切皆插件。
					</h1>
					<p className="mt-6 max-w-[600px] text-[18px] leading-[1.62] text-muted">
						设计画布、内容创作、浏览器操作、Office 预览——这些工作区本身就是插件写出来的。同一套扩展点，也向第三方开放。
					</p>
				</div>
			</section>

			<section className="px-8 pb-20">
				<div className="mx-auto grid max-w-[1040px] grid-cols-2 gap-5">
					{types.map((type) => (
						<div key={type.title} className="rounded-2xl bg-surface-raised p-7">
							<span className={`${type.icon} size-5 text-muted`} />
							<div className="mt-5 text-[21px] font-semibold tracking-tight text-surface-foreground">
								{type.title}
							</div>
							<p className="mt-2 max-w-[400px] text-[14px] leading-relaxed text-muted">
								{type.desc}
							</p>
							<div className="mt-5 text-[11.5px] text-muted">{type.sample}</div>
						</div>
					))}
				</div>
			</section>

			<section className="bg-surface-raised px-8 py-20">
				<div className="mx-auto grid max-w-[1040px] grid-cols-[1fr_1.05fr] items-center gap-16">
					<div>
						<h2 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.03em] text-surface-foreground">
							权限写清楚，
							<br />
							装不装由你。
						</h2>
						<p className="mt-5 max-w-[400px] text-[15px] leading-[1.75] text-muted">
							每个插件在清单里显式声明需要的权限：读哪个目录、连哪个地址。宿主单独授权、运行时逐项校验，预装插件与第三方插件走同一套 API。
						</p>
						<div className="mt-7 flex items-center gap-2 text-[12px] text-muted">
							<span className="icon-[lucide--shield-check] size-3.5" />
							未授权的调用不会发出请求
						</div>
					</div>
					<div className="rounded-xl bg-dark p-7">
						<div className="flex items-center justify-between text-[11px] text-on-dark-muted">
							<span className="flex items-center gap-2">
								<span className="icon-[lucide--file-code-2] size-3.5" />
								plugin.json
							</span>
							<span>第三方插件</span>
						</div>
						<pre className="mt-4 font-mono text-[11.5px] leading-[1.85] text-on-dark">
							<code>{`{
  "id": "weekly-report",
  "permissions": [
    "fs:read:workspace",
    "net:crm.internal"
  ],
  "contributes": {
    "tab": "周报助手"
  }
}`}</code>
						</pre>
					</div>
				</div>
			</section>

			<section className="px-8 py-20">
				<div className="mx-auto max-w-[1040px]">
					<div className="flex items-end justify-between">
						<h2 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.03em] text-surface-foreground">
							预装插件
						</h2>
						<span className="pb-1 text-[12px] text-muted">11 个 · 与第三方插件同一套 API</span>
					</div>
					<div className="mt-8 grid grid-cols-3 gap-x-10 gap-y-0">
						{presets.map((preset) => (
							<div
								key={preset.name}
								className="flex items-baseline justify-between gap-4 border-t border-border/60 py-3.5"
							>
								<span className="text-[14px] text-surface-foreground">{preset.name}</span>
								<span className="text-right text-[11.5px] text-muted">{preset.desc}</span>
							</div>
						))}
					</div>
				</div>
			</section>

			<section className="flex flex-1 flex-col items-center justify-center bg-dark px-8 py-20 text-center text-on-dark">
				<h2 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">
					你也可以写一个。
				</h2>
				<p className="mt-5 max-w-[520px] text-[16px] leading-relaxed text-on-dark-muted">
					从脚手架到打包应用，都可以在对话里完成；写完立刻装进自己的应用。
				</p>
				<div className="mt-9 flex items-center gap-8">
					<Link
						to="/download"
						className="rounded-full bg-primary px-6 py-3 text-[15px] text-primary-foreground"
					>
						免费下载
					</Link>
					<Link to="/capabilities" className="text-[15px] text-on-dark">
						回到能力
					</Link>
				</div>
			</section>
		</div>
	);
}
