import { Link, useLocation } from "react-router";
import { Logo } from "./Logo";

const links = [
	{ to: "/capabilities", label: "能力" },
	{ to: "/models", label: "模型" },
	{ to: "/ecosystem", label: "生态" },
	{ to: "/pricing", label: "定价" },
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
					{links.map((item) => (
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
					))}
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
