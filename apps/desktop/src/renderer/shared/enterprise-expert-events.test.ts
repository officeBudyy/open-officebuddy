// @vitest-environment jsdom

import { beforeEach, describe, expect, it } from "vitest";
import {
	consumeEnterpriseExpertTokenDialogOpenRequest,
	ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT,
	openEnterpriseExpertTokenDialog,
} from "./enterprise-expert-events";

describe("enterprise expert token dialog events", () => {
	beforeEach(() => {
		consumeEnterpriseExpertTokenDialogOpenRequest();
	});

	it("keeps an open request until the lazy dialog consumes it", () => {
		openEnterpriseExpertTokenDialog();

		expect(consumeEnterpriseExpertTokenDialogOpenRequest()).toBe(true);
		expect(consumeEnterpriseExpertTokenDialogOpenRequest()).toBe(false);
	});

	it("still dispatches the window event when the dialog is already mounted", () => {
		let received = 0;
		const listener = (): void => {
			received += 1;
		};
		window.addEventListener(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT, listener);

		openEnterpriseExpertTokenDialog();

		expect(received).toBe(1);
		window.removeEventListener(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT, listener);
	});
});
