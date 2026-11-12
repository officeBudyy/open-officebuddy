import type { RouteObject } from "react-router";
import Home from "./pages/index";
import Capabilities from "./pages/capabilities";
import Models from "./pages/models";
import Ecosystem from "./pages/ecosystem";
import Pricing from "./pages/pricing";
import Download from "./pages/download";

// 页面路由与设计画布 frames/ 目录一一对应：文件名即路径。
export const routes: RouteObject[] = [
	{ path: "/", element: <Home /> },
	{ path: "/capabilities", element: <Capabilities /> },
	{ path: "/models", element: <Models /> },
	{ path: "/ecosystem", element: <Ecosystem /> },
	{ path: "/pricing", element: <Pricing /> },
	{ path: "/download", element: <Download /> },
];
