// @vitest-environment jsdom

import { act, cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT } from "../../../shared/enterprise-expert-events";
import { EnterpriseExpertsSection } from "./EnterpriseExpertsSection";

vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		i18n: { language: "zh" },
		t: (key: string) => key,
	}),
}));

// Switch 桩：role="switch"，点击触发 onCheckedChange(checked 取反)
vi.mock("@astravia-org/ui", () => ({
	Button: ({ children, onClick }: { children: ReactNode; onClick?: () => void }) => (
		<button type="button" onClick={onClick}>
			{children}
		</button>
	),
	Switch: ({
		checked,
		onCheckedChange,
	}: {
		checked: boolean;
		onCheckedChange?: (checked: boolean) => void;
	}) => (
		<button
			type="button"
			role="switch"
			aria-checked={checked}
			onClick={() => onCheckedChange?.(!checked)}
		/>
	),
}));

type Listener = () => void;

function createApi({ hasToken }: { hasToken: boolean }) {
	const changedListeners = new Set<Listener>();
	return {
		list: vi.fn(async () => [{ id: "e1", name: "Expert", description: "d" }]),
		hasToken: vi.fn(async () => hasToken),
		setToken: vi.fn(async () => undefined),
		clearToken: vi.fn(async () => undefined),
		onChanged: vi.fn((listener: Listener) => {
			changedListeners.add(listener);
			return () => changedListeners.delete(listener);
		}),
		onAuthRequired: vi.fn(() => () => undefined),
		emitChanged(): void {
			for (const listener of [...changedListeners]) listener();
		},
	};
}

type ApiMock = ReturnType<typeof createApi>;

function stubAstravia(api: ApiMock | undefined): void {
	(window as unknown as { astravia?: unknown }).astravia = api
		? { enterpriseExperts: api }
		: undefined;
}

const STORAGE_KEY = "astravia.enterprise-experts.enabled";

async function clickSwitch(user: ReturnType<typeof userEvent.setup>): Promise<void> {
	await act(async () => {
		await user.click(screen.getByRole("switch"));
	});
}

describe("EnterpriseExpertsSection toggle", () => {
	beforeEach(() => {
		const values = new Map<string, string>();
		vi.stubGlobal("localStorage", {
			clear: () => values.clear(),
			getItem: (key: string) => values.get(key) ?? null,
			setItem: (key: string, value: string) => values.set(key, value),
			removeItem: (key: string) => values.delete(key),
		});
	});

	afterEach(() => {
		cleanup();
		stubAstravia(undefined);
		vi.unstubAllGlobals();
		vi.restoreAllMocks();
	});

	it("is off by default: no list fetch, shows disabled body", () => {
		const api = createApi({ hasToken: false });
		stubAstravia(api);
		render(<EnterpriseExpertsSection onStart={vi.fn()} />);
		expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
		expect(api.list).not.toHaveBeenCalled();
		expect(screen.getByText("enterprise.disabledBody")).toBeTruthy();
		expect(screen.queryByText("enterprise.refresh")).toBeNull();
	});

	it("turns on immediately when a token is already configured", async () => {
		const api = createApi({ hasToken: true });
		stubAstravia(api);
		const user = userEvent.setup();
		render(<EnterpriseExpertsSection onStart={vi.fn()} />);
		await clickSwitch(user);
		expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
		expect(api.hasToken).toHaveBeenCalled();
		expect(api.list).toHaveBeenCalled();
		expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
	});

	it("bounces back and opens the token dialog when no token, then auto-enables after save", async () => {
		const api = createApi({ hasToken: false });
		stubAstravia(api);
		const user = userEvent.setup();
		const dialogEvents: string[] = [];
		const onDialogOpen = (): void => {
			dialogEvents.push(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT);
		};
		window.addEventListener(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT, onDialogOpen);

		render(<EnterpriseExpertsSection onStart={vi.fn()} />);
		await clickSwitch(user);

		// 开关回弹为关，弹窗被请求打开，列表不拉取
		expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
		expect(dialogEvents).toHaveLength(1);
		expect(api.list).not.toHaveBeenCalled();

		// Token 保存成功 → main 广播 changed → 自动启用
		(api.hasToken as ReturnType<typeof vi.fn>).mockResolvedValue(true);
		await act(async () => {
			api.emitChanged();
		});
		expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
		expect(api.list).toHaveBeenCalled();
		expect(localStorage.getItem(STORAGE_KEY)).toBe("1");
		window.removeEventListener(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT, onDialogOpen);
	});

	it("turns off again and clears storage", async () => {
		localStorage.setItem(STORAGE_KEY, "1");
		const api = createApi({ hasToken: true });
		stubAstravia(api);
		const user = userEvent.setup();
		render(<EnterpriseExpertsSection onStart={vi.fn()} />);

		await clickSwitch(user);
		expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("false");
		expect(localStorage.getItem(STORAGE_KEY)).toBe("0");
	});

	it("opens the token dialog automatically when list fails with an auth error", async () => {
		const api = createApi({ hasToken: true });
		// 模拟本机存过失效 Token：开关直接打开，但列表请求鉴权失败
		(api.list as ReturnType<typeof vi.fn>).mockRejectedValue(
			new Error("Error invoking remote method 'astravia:enterprise-experts:list': astravia:enterprise-experts:auth-required"),
		);
		stubAstravia(api);
		const user = userEvent.setup();
		const dialogEvents: string[] = [];
		const onDialogOpen = (): void => {
			dialogEvents.push(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT);
		};
		window.addEventListener(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT, onDialogOpen);

		render(<EnterpriseExpertsSection onStart={vi.fn()} />);
		await clickSwitch(user);

		// 开关保持打开，显示鉴权提示，且自动唤起 Token 配置弹窗
		expect(screen.getByRole("switch").getAttribute("aria-checked")).toBe("true");
		expect(screen.getByText("enterprise.authHint")).toBeTruthy();
		expect(dialogEvents).toHaveLength(1);
		window.removeEventListener(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT, onDialogOpen);
	});
});
