
import { Link } from "react-router";
import { AppWindow } from "../components/AppWindow";

const capabilities = [
	{
		title: "对话与工作区",
		tags: ["会话", "工具调用", "文件预览"],
		desc: "消息流、工具调用与结果同屏可见。你在哪一步、改了哪个文件，都留在同一份工作区记录里。",
	},
	{
		title: "文档与预览",
		tags: ["PDF", "Word", "PPT", "离线 OCR"],
		desc: "PDF、Word、PPT、表格、图片、音视频与 SVG 直接打开；扫描版 PDF 走本地识别，不需要上传。",
	},
	{
		title: "数据工作台",
		tags: ["SQL", "40+ 数据库", "中文问数"],
		desc: "连接管理、表浏览、多标签查询、历史记录与 CSV / JSON 导出。写操作分级授权，生产连接默认只读。",
	},
	{
		title: "批量任务",
		tags: ["多目录", "可重试", "进度可见"],
		desc: "一条指令处理多个目录；任务按「项目 + 任务」组织，可运行、可重试，进度随时能看。",
	},
	{
		title: "定时任务",
		tags: ["Cron", "托盘常驻", "执行历史"],
		desc: "内置 Cron 调度，应用退到托盘也照常运行；每次执行的时间、结果与异常都可以回看。",
	},
	{
		title: "通知与远程控制",
		tags: ["飞书", "钉钉", "手机遥控"],
		desc: "批量或定时任务完成、异常时推送到群机器人；手机扫码配对后，可以在手机上接着看会话、发指令。",
	},
	{
		title: "能力与知识库",
		tags: ["技能", "MCP", "插件", "索引"],
		desc: "能力市场里一键安装技能、MCP 与插件；本地文档加工成可检索的知识库，再由助手引用作答并标出来源。",
	},
	{
		title: "桌面集成",
		tags: ["全局快捷键", "Appshot", "自动更新"],
		desc: "快捷键唤起快捷面板，一键把前台窗口交给助手；托盘常驻、自动更新、中英双语界面。",
	},
];

export default function Capabilities() {
	return (
		<div className="flex min-h-full flex-col bg-surface">
			<section className="px-8 pb-14 pt-20">
				<div className="mx-auto max-w-[1040px]">
					<h1 className="max-w-[680px] text-[48px] font-semibold leading-[1.08] tracking-[-0.035em] text-surface-foreground">
						八件事，一个窗口。
					</h1>
					<p className="mt-6 max-w-[560px] text-[18px] leading-[1.62] text-muted">
						不用在聊天工具、表格软件和自动化平台之间来回切换。officeBuddy 把办公里真正耗时的部分放进同一份工作区。
					</p>
					<div className="mt-7 text-[12px] text-muted">全部功能本地运行 · 不依赖任何云服务</div>
				</div>
			</section>

			<section className="px-8">
				<div className="mx-auto max-w-[1040px]">
					<AppWindow />
					<div className="mt-4 flex items-center justify-between text-[12px] text-muted">
						<span>对话工作区 · 真实界面</span>
						<span>会话记录、工具调用与文件结果都在同一屏</span>
					</div>
				</div>
			</section>

			<section className="px-8 pb-8 pt-24">
				<div className="mx-auto max-w-[1040px]">
					<div className="grid grid-cols-[300px_1fr] gap-12 border-b border-border/80 pb-6">
						<div className="text-[12px] text-muted">能力</div>
						<div className="text-[12px] text-muted">说明</div>
					</div>
					{capabilities.map((item) => (
						<div
							key={item.title}
							className="grid grid-cols-[300px_1fr] gap-12 border-b border-border/60 py-7"
						>
							<div>
								<div className="text-[18px] font-medium text-surface-foreground">
									{item.title}
								</div>
								<div className="mt-2 flex flex-wrap gap-x-2 gap-y-1 text-[11px] text-muted">
									{item.tags.map((tag, index) => (
										<span key={tag}>
											{index > 0 ? "· " : ""}
											{tag}
										</span>
									))}
								</div>
							</div>
							<p className="max-w-[640px] text-[14.5px] leading-[1.75] text-muted">
								{item.desc}
							</p>
						</div>
					))}
				</div>
			</section>

			<section className="flex flex-1 flex-col items-center justify-center bg-dark px-8 py-20 text-center text-on-dark">
				<h2 className="text-[40px] font-semibold leading-[1.1] tracking-[-0.03em]">
					现在，把它们用起来。
				</h2>
				<p className="mt-5 max-w-[480px] text-[16px] leading-relaxed text-on-dark-muted">
					装好之后不用配置也能处理文件；需要模型时再填入自己的 Key。
				</p>
				<div className="mt-9 flex items-center gap-8">
					<Link
						to="/download"
						className="rounded-full bg-primary px-6 py-3 text-[15px] text-primary-foreground"
					>
						免费下载
					</Link>
					<Link to="/models" className="text-[15px] text-on-dark">
						模型与密钥
					</Link>
				</div>
			</section>
		</div>
	);
}
