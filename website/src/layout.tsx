import { Outlet } from "react-router";
import { Nav } from "./components/Nav";
import { Footer } from "./components/Footer";

// 全站共享外壳：导航 + 页脚。与设计画布 _layout.tsx 一致。
export function Layout() {
	return (
		<div className="flex min-h-screen flex-col bg-surface font-sans text-surface-foreground antialiased">
			<Nav />
			<div className="min-h-0 flex-1">
				<Outlet />
			</div>
			<Footer />
		</div>
	);
}
