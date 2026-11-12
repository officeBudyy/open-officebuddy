// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { createStore, Provider } from "jotai";
import { afterEach, describe, expect, it, vi } from "vitest";
import { initialRoutePaintedAtom } from "./initial-route-paint-state";
import { RootGlobalOverlays } from "./RootGlobalOverlays";

vi.mock("../shared/action-approval/ActionApprovalCenter", () => ({
	ActionApprovalCenter: () => <div>action-approval-center</div>,
}));
vi.mock("../shared/components/SshPromptDialog", () => ({
	SshPromptDialog: () => <div>ssh-prompt-dialog</div>,
}));
vi.mock("../shared/components/EnterpriseExpertTokenDialog", () => ({
	EnterpriseExpertTokenDialog: () => <div>enterprise-expert-token-dialog</div>,
}));

afterEach(() => {
	document.body.replaceChildren();
});

describe("RootGlobalOverlays", () => {
	it("mounts the enterprise expert token dialog before deferred overlays are enabled", () => {
		const store = createStore();
		store.set(initialRoutePaintedAtom, false);

		render(
			<Provider store={store}>
				<RootGlobalOverlays />
			</Provider>,
		);

		expect(screen.getByText("enterprise-expert-token-dialog")).toBeTruthy();
	});
});
