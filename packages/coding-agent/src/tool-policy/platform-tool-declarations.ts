import type { CodingToolRegistration } from "@astravia/runtime-tools";
import { readPdfOcrPageCount, resolvePdfTranscriptionModelCallBudget } from "../execution/turn/ocr-workflow-policy.js";
import { ALL_SCENARIOS, type ConversationScenario, type ToolCategory } from "../profiles/index.js";
import type { CodingAgentRuntimeToolRegistration } from "../runtime-contracts/index.js";
import {
	CODING_AGENT_READ_TOOL_DESCRIPTION,
	createCodingAgentCommandToolDescription,
} from "./platform-tool-descriptions.js";

interface PlatformToolDeclaration {
	readonly scopeUse: readonly ConversationScenario[];
	readonly category: ToolCategory;
	readonly description?: string;
}

const ALL_SCENARIO_CORE: PlatformToolDeclaration = Object.freeze({
	scopeUse: ALL_SCENARIOS,
	category: "core",
});
const ALL_SCENARIO_DOCUMENT: PlatformToolDeclaration = Object.freeze({
	scopeUse: ALL_SCENARIOS,
	category: "doc",
});
const EXPLICIT_ONLY_CORE: PlatformToolDeclaration = Object.freeze({
	scopeUse: Object.freeze([]),
	category: "core",
});
const BASH_CORE: PlatformToolDeclaration = Object.freeze({
	...ALL_SCENARIO_CORE,
	description: createCodingAgentCommandToolDescription("bash"),
});
const SHELL_CORE: PlatformToolDeclaration = Object.freeze({
	...ALL_SCENARIO_CORE,
	description: createCodingAgentCommandToolDescription("shell"),
});
const READ_CORE: PlatformToolDeclaration = Object.freeze({
	...ALL_SCENARIO_CORE,
	description: CODING_AGENT_READ_TOOL_DESCRIPTION,
});

/** Node 等宿主只提供实现；这里是 Coding Agent 对平台基础工具策略的唯一事实源。 */
const PLATFORM_TOOL_DECLARATIONS: Readonly<Record<string, PlatformToolDeclaration>> = Object.freeze({
	bash: BASH_CORE,
	shell: SHELL_CORE,
	read: READ_CORE,
	edit: ALL_SCENARIO_CORE,
	write: ALL_SCENARIO_CORE,
	glob: ALL_SCENARIO_CORE,
	grep: ALL_SCENARIO_CORE,
	dir_tree: ALL_SCENARIO_CORE,
	ls: EXPLICIT_ONLY_CORE,
	find: EXPLICIT_ONLY_CORE,
	doc_to_pdf: ALL_SCENARIO_DOCUMENT,
	html_to_pdf: ALL_SCENARIO_DOCUMENT,
	render_pdf_page: ALL_SCENARIO_DOCUMENT,
	extract_text_from_pdf: ALL_SCENARIO_DOCUMENT,
	extract_text_from_img: ALL_SCENARIO_DOCUMENT,
	prepare_ocr_review: ALL_SCENARIO_DOCUMENT,
});

export function declareCodingAgentPlatformTool(
	registration: CodingToolRegistration,
): CodingAgentRuntimeToolRegistration {
	const declaration = PLATFORM_TOOL_DECLARATIONS[registration.tool.name];
	if (!declaration) {
		throw new Error(
			`Coding Agent platform tool has no activation declaration: ${registration.tool.name}. ` +
				"Contribute Coding Agent tools through additionalRegistrations or add an explicit platform policy.",
		);
	}
	return {
		...registration,
		tool: withDeclaredPdfOcrRunPolicy(
			declaration.description
				? withDeclaredDescription(registration.tool, declaration.description)
				: registration.tool,
		),
		scopeUse: declaration.scopeUse,
		category: declaration.category,
	};
}

function withDeclaredPdfOcrRunPolicy(tool: CodingToolRegistration["tool"]): CodingToolRegistration["tool"] {
	if (tool.name !== "extract_text_from_pdf") return tool;
	const decorate = (candidate: CodingToolRegistration["tool"]): CodingToolRegistration["tool"] => {
		const runPolicy = candidate.runPolicy;
		return {
			...candidate,
			runPolicy: {
				...runPolicy,
				resolveStopOnError: (input) =>
					runPolicy?.resolveStopOnError?.(input) === true || input.mode === "transcription",
				resolveModelCallBudget: (input, result) => {
					const existing = runPolicy?.resolveModelCallBudget?.(input, result);
					if (input.mode !== "transcription") return existing;
					const pageCount = readPdfOcrPageCount(result.details);
					if (pageCount === undefined) return existing;
					const resolved = resolvePdfTranscriptionModelCallBudget(pageCount);
					return {
						maxModelCalls: Math.min(existing?.maxModelCalls ?? resolved.maxModelCalls, resolved.maxModelCalls),
						reviewAtModelCalls: Math.min(
							existing?.reviewAtModelCalls ?? resolved.reviewAtModelCalls,
							resolved.reviewAtModelCalls,
						),
					};
				},
			},
		};
	};
	const decorated = decorate(tool);
	const bindForTurn = tool.bindForTurn;
	return bindForTurn
		? {
				...decorated,
				bindForTurn: (context) => {
					const binding = bindForTurn(context);
					return { ...binding, tool: decorate(binding.tool) };
				},
			}
		: decorated;
}

function withDeclaredDescription(
	tool: CodingToolRegistration["tool"],
	description: string,
): CodingToolRegistration["tool"] {
	const bindForTurn = tool.bindForTurn;
	return {
		...tool,
		description,
		...(bindForTurn
			? {
					bindForTurn: (context) => {
						const binding = bindForTurn(context);
						return { ...binding, tool: { ...binding.tool, description } };
					},
				}
			: {}),
	};
}

export function declareCodingAgentPlatformTools(
	registrations: readonly CodingToolRegistration[],
): readonly CodingAgentRuntimeToolRegistration[] {
	return registrations.map(declareCodingAgentPlatformTool);
}
