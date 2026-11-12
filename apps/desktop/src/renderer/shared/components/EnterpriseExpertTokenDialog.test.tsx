// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
	consumeEnterpriseExpertTokenDialogOpenRequest,
	openEnterpriseExpertTokenDialog,
} from "../enterprise-expert-events";
import { ENTERPRISE_EXPERTS_ENABLED_STORAGE_KEY } from "../enterprise-expert-preferences";
import { EnterpriseExpertTokenDialog } from "./EnterpriseExpertTokenDialog";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({ t: (key: string) => key }),
}));

vi.mock("@astravia-org/ui", () => ({
	Button: ({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) => <button {...props}>{children}</button>,
	Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock("@astravia-org/ui/dialog", () => ({
	Dialog: ({ open, children }: { open: boolean; children: ReactNode }) =>
		open ? <div role="dialog">{children}</div> : null,
	DialogContent: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogDescription: ({ children }: { children: ReactNode }) => <p>{children}</p>,
	DialogFooter: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogHeader: ({ children }: { children: ReactNode }) => <div>{children}</div>,
	DialogTitle: ({ children }: { children: ReactNode }) => <h2>{children}</h2>,
}));

let authRequiredListener: (() => void) | undefined;

function stubAstravia(): void {
	(window as unknown as { astravia: unknown }).astravia = {
		enterpriseExperts: {
			list: vi.fn(async () => []),
			hasToken: vi.fn(async () => false),
			setToken: vi.fn(async () => []),
			clearToken: vi.fn(async () => undefined),
			onAuthRequired: vi.fn((listener: () => void) => {
				authRequiredListener = listener;
				return () => undefined;
			}),
			onChanged: vi.fn(() => () => undefined),
		},
	};
}

describe("EnterpriseExpertTokenDialog", () => {
	beforeEach(() => {
		const values = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			clear: () => values.clear(),
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		});
		consumeEnterpriseExpertTokenDialogOpenRequest();
		localStorage.clear();
		authRequiredListener = undefined;
		stubAstravia();
	});

	afterEach(() => {
		cleanup();
		Reflect.deleteProperty(window, "astravia");
		vi.unstubAllGlobals();
	});

	it("opens when a request arrives after the dialog mounts", () => {
		render(<EnterpriseExpertTokenDialog />);

		act(() => openEnterpriseExpertTokenDialog());

		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("opens when a request arrived before the dialog mounted", () => {
		openEnterpriseExpertTokenDialog();

		render(<EnterpriseExpertTokenDialog />);

		expect(screen.getByRole("dialog")).toBeTruthy();
	});

	it("ignores background auth requests while enterprise experts are disabled", () => {
		render(<EnterpriseExpertTokenDialog />);

		act(() => authRequiredListener?.());

		expect(screen.queryByRole("dialog")).toBeNull();
	});

	it("opens for a background auth request when enterprise experts are enabled", () => {
		localStorage.setItem(ENTERPRISE_EXPERTS_ENABLED_STORAGE_KEY, "1");
		render(<EnterpriseExpertTokenDialog />);

		act(() => authRequiredListener?.());

		expect(screen.getByRole("dialog")).toBeTruthy();
	});
});
