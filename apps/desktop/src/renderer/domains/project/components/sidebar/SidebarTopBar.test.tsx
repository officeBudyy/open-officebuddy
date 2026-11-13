// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { SidebarTopBar } from "./SidebarTopBar";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string) => (key === "common:appName" ? "officeBuddy" : "Hide"),
	}),
}));

vi.mock("./SidebarCommandMenuTrigger", () => ({
	SidebarCommandMenuTrigger: () => null,
}));

describe("SidebarTopBar", () => {
	it("renders the localized officeBuddy brand", () => {
		render(<SidebarTopBar floating />);

		expect(screen.getByText("officeBuddy")).toBeTruthy();
		expect(screen.queryByText("Astravia")).toBeNull();
	});
});
