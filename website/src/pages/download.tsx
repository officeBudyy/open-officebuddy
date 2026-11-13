import { Link } from "react-router";
import { MOBILE_DOWNLOADS, PLATFORMS, primaryDownload, primaryLabel, VERSION } from "../lib/download";

const requirements = [
	{ label: "系统", value: "macOS 12+ · Windows 10+ · Linux glibc 2.31+" },
	{ label: "磁盘", value: "约 400 MB，插件与知识库另计" },
	{ label: "内存", value: "4 GB 起，处理大表格建议 8 GB" },
];

export default function Download() {
	const primary = primaryDownload();
	return (
		<div className="flex min-h-full flex-col bg-surface">
			<section className="px-8 pb-14 pt-20">
				<div className="mx-auto grid max-w-[1040px] grid-cols-[1.3fr_0.8fr] items-end gap-16">
					<div>
						<h1 className="text-[48px] font-semibold leading-[1.08] tracking-[-0.035em] text-surface-foreground">
							获取 officeBuddy。
						</h1>
						<p className="mt-6 max-w-[520px] text-[18px] leading-[1.62] text-muted">
							免费使用，无需注册。双击安装包，十秒后就能把第一份文件拖进对话。
						</p>
					</div>
					<div className="pb-2">
						<div className="text-[12px] text-muted">当前版本 v{VERSION} · 最新</div>
						<a
							href={primary.href}
							className="mt-3 flex items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-[15px] text-primary-foreground"
						>
							<span className="icon-[lucide--download] size-4" />
							{primaryLabel()}
						</a>
						<div className="mt-2.5 text-center text-[11px] text-muted">其他平台见下方</div>
					</div>
				</div>
			</section>

			<section className="px-8 pb-16">
				<div className="mx-auto grid max-w-[1040px] grid-cols-3 gap-5">
					{PLATFORMS.map((platform) => (
						<div key={platform.name} className="rounded-2xl bg-surface-raised p-7">
							<div className="flex items-center justify-between">
								<div className="flex items-center gap-2.5">
									<span className={`${platform.icon} size-5 text-surface-foreground`} />
									<span className="text-[17px] font-medium text-surface-foreground">
										{platform.name}
									</span>
								</div>
								<span className="text-[11px] text-muted">{platform.note}</span>
							</div>
							<div className="mt-6 space-y-1">
								{platform.items.map((item) => (
									<a
										key={item.id}
										href={item.href}
										className="flex items-center justify-between rounded-lg px-2 py-2.5 hover:bg-surface"
									>
										<div>
											<div className="text-[13px] text-surface-foreground">{item.label}</div>
											<div className="mt-0.5 text-[10.5px] text-muted">{item.note}</div>
										</div>
										<span className="icon-[lucide--download] size-3.5 text-muted" />
									</a>
								))}
							</div>
						</div>
					))}
				</div>
			</section>

			<section className="bg-surface-raised px-8 py-16">
				<div className="mx-auto grid max-w-[1040px] grid-cols-[1fr_1.1fr] gap-16">
					<div>
						<h2 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.03em] text-surface-foreground">
							手机端：接着看，
							<br />
							接着问。
						</h2>
						<p className="mt-5 max-w-[380px] text-[14.5px] leading-[1.75] text-muted">
							桌面端点「手机扫码连接」，扫码后可以在手机上继续同一份会话、发指令、看任务进度。两端都不收费。
						</p>
					</div>
					<div className="space-y-2.5">
						{MOBILE_DOWNLOADS.map((item) => (
							<a
								key={item.id}
								href={item.href}
								className="flex items-center justify-between rounded-xl bg-surface px-5 py-4 transition-colors hover:bg-border/30"
							>
								<div className="flex items-center gap-3">
									<span
										className={`size-4 text-surface-foreground ${
											item.id === "ios" ? "icon-[simple-icons--apple]" : "icon-[simple-icons--android]"
										}`}
									/>
									<div>
										<div className="text-[13.5px] text-surface-foreground">{item.label}</div>
										<div className="mt-0.5 text-[11px] text-muted">{item.note}</div>
									</div>
								</div>
								<span className="flex items-center gap-1.5 rounded-full bg-surface-raised px-3 py-1 text-[11px] text-muted">
									<span className="icon-[lucide--download] size-3" />
									下载
								</span>
							</a>
						))}
						<p className="pt-2 text-[11px] leading-relaxed text-muted">
							内测版本与桌面版走同一套配对协议，会话在局域网内直连，不经过中转服务器。iOS 未签名 IPA 需自行用 Apple ID 签名安装。
						</p>
					</div>
				</div>
			</section>

			<section className="px-8 py-14">
				<div className="mx-auto max-w-[1040px]">
					<div className="grid grid-cols-[220px_1fr] gap-10 border-t border-border/70 pt-6">
						<div className="text-[12px] text-muted">系统要求</div>
						<div className="space-y-3">
							{requirements.map((row) => (
								<div key={row.label} className="grid grid-cols-[80px_1fr] gap-6 text-[13px]">
									<span className="text-muted">{row.label}</span>
									<span className="text-surface-foreground">{row.value}</span>
								</div>
							))}
						</div>
					</div>
				</div>
			</section>

			<section className="flex flex-1 flex-col items-center justify-center bg-dark px-8 py-16 text-center text-on-dark">
				<h2 className="text-[36px] font-semibold leading-[1.12] tracking-[-0.03em]">
					装好了，先试一件小事。
				</h2>
				<p className="mt-4 max-w-[520px] text-[15px] leading-relaxed text-on-dark-muted">
					把手边那份还没整理的表格拖进对话，让它先把格式统一了。
				</p>
				<div className="mt-8 flex items-center gap-8 text-[15px]">
					<span className="text-on-dark-muted">桌面版 · 免费 · 无需注册</span>
					<Link to="/capabilities" className="text-on-dark">
						能力一览
					</Link>
				</div>
			</section>
		</div>
	);
}
