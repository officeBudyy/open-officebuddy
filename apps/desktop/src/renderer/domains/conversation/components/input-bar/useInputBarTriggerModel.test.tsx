// @vitest-environment jsdom

import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useInputBarTriggerModel } from "./useInputBarTriggerModel";

const focusInputEditor = vi.hoisted(() => vi.fn());
const insertConnectorToken = vi.hoisted(() => vi.fn());

vi.mock("./editor/inputEditorHandle", async () => ({
	...(await vi.importActual<typeof import("./editor/inputEditorHandle")>("./editor/inputEditorHandle")),
	focusInputEditor,
	insertConnectorToken,
}));

Object.defineProperty(window, "astravia", {
	configurable: true,
	value: {
		config: {
			get: vi.fn(async () => ({})),
			onShortcutsChanged: vi.fn(() => () => undefined),
		},
	},
});

function renderTriggerModel() {
	return renderHook(() =>
		useInputBarTriggerModel({
			hasSession: true,
			isStreaming: false,
			isEmpty: true,
			canSend: false,
			firstSuggestion: undefined,
			activeSession: { cwd: "C:/workspace", runtimeId: "runtime-1" },
			focusInputRequest: 0,
			onSend: vi.fn(async () => undefined),
			onAbort: vi.fn(async () => undefined),
		}),
	);
}

describe("useInputBarTriggerModel", () => {
	beforeEach(() => {
		focusInputEditor.mockClear();
		insertConnectorToken.mockClear();
	});

	it("focuses the editor when the command button opens the slash panel", () => {
		const { result } = renderTriggerModel();

		// Mounting a ready session also requests focus; isolate the button interaction itself.
		focusInputEditor.mockClear();
		act(() => result.current.handlePlusClick());

		expect(result.current.slashOpen).toBe(true);
		expect(focusInputEditor).toHaveBeenCalledOnce();
	});

	it("reopens a dismissed @ panel after the trigger is deleted and pasted again", () => {
		const { result } = renderTriggerModel();
		const mention = { kind: "at", query: "research", length: 9 } as const;

		act(() => result.current.handleTriggerChange(mention));
		expect(result.current.atOpen).toBe(true);

		act(() => result.current.handleAtClose());
		expect(result.current.atOpen).toBe(false);

		act(() => result.current.handleTriggerChange(mention));
		expect(result.current.atOpen).toBe(false);

		act(() => result.current.handleTriggerChange(null));
		act(() => result.current.handleTriggerChange(mention));
		expect(result.current.atOpen).toBe(true);
	});

	it("将显式选择的连接器插入为结构化引用并关闭命令面板", () => {
		const { result } = renderTriggerModel();
		act(() => result.current.handlePlusClick());

		act(() =>
			result.current.handleConnectorSelect({
				name: "documents",
				label: "Documents",
				description: "Create and edit documents",
				iconUrl: "https://example.com/documents.svg",
			}),
		);

		expect(insertConnectorToken).toHaveBeenCalledWith(
			"documents",
			"Documents",
			"https://example.com/documents.svg",
			{ replaceTrigger: true },
		);
		expect(result.current.slashOpen).toBe(false);
	});
});
