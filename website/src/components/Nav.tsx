import { Link, useLocation } from "react-router";
import { Logo } from "./Logo";

// to 为站内路由；href 为外部链接（新标签页打开）。
type NavItem = { to: string; label: string } | { href: string; label: string };

const links: NavItem[] = [
	{ to: "/capabilities", label: "能力" },
	{ to: "/models", label: "模型" },
	{ to: "/ecosystem", label: "生态" },
	{ to: "/pricing", label: "定价" },
	{ href: "https://doc.officebuddy.work/", label: "文档" },
	{ to: "/download", label: "下载" },
];

export function Nav() {
	const { pathname } = useLocation();
	return (
		<header className="relative z-30 shrink-0 bg-surface/85 backdrop-blur-xl">
			<div className="mx-auto flex h-12 max-w-[1040px] items-center px-8">
				<Link to="/" className="pr-10 text-surface-foreground">
					<Logo size={22} />
				</Link>
				<nav className="flex flex-1 items-center gap-7">
					{links.map((item) =>
						"href" in item ? (
							<a
								key={item.href}
								href={item.href}
								target="_blank"
								rel="noopener noreferrer"
								className="text-[12px] text-muted transition-colors hover:text-surface-foreground"
							>
								{item.label}
							</a>
						) : (
							<Link
								key={item.to}
								to={item.to}
								className={`text-[12px] transition-colors ${
									pathname === item.to
										? "text-surface-foreground"
										: "text-muted hover:text-surface-foreground"
								}`}
							>
								{item.label}
							</Link>
						),
					)}
				</nav>
				<Link
					to="/download"
					className="rounded-full bg-primary px-3.5 py-1.5 text-[12px] text-primary-foreground"
				>
					免费下载
				</Link>
			</div>
		</header>
	);
}
