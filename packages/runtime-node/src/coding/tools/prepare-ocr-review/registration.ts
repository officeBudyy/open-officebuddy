import type { CodingToolRegistration } from "../../tool-registration.js";
import {
	createPrepareOcrReviewTool,
	type PrepareOcrReviewToolInput,
	type PrepareOcrReviewToolOptions,
} from "./prepare-ocr-review-tool.js";

export function createPrepareOcrReviewToolRegistration(
	cwd: string,
	options: PrepareOcrReviewToolOptions,
): CodingToolRegistration<PrepareOcrReviewToolInput> {
	return { tool: createPrepareOcrReviewTool(cwd, options), modelOrder: options.modelOrder };
}
