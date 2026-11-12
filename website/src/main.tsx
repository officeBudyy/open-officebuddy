import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router";
import { Layout } from "./layout";
import { routes } from "./routes";
import "./theme.css";

const router = createBrowserRouter([
	{
		element: <Layout />,
		children: routes,
	},
]);

createRoot(document.getElementById("root")!).render(
	<StrictMode>
		<RouterProvider router={router} />
	</StrictMode>,
);
