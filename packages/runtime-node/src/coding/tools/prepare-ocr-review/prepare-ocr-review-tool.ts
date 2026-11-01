import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, isAbsolute, resolve } from "node:path";
import type { Message } from "@astravia/ai";
import { type RuntimeToolDefinition, RuntimeToolExecutionError } from "@astravia/runtime-core/kernel";
import * as photon from "@silvia-odwyer/photon-node";
import { type Static, Type } from "@sinclair/typebox";
import type { CommandProcessPort } from "../../shared/desktop-command.js";
import {
	createOcrSourceFingerprint,
	matchesOcrSourceFingerprint,
	type OcrJsonDocument,
	type OcrLineResult,
	parseOcrJsonDocument,
} from "../../shared/ocr-document.js";
import { resolveExistingPath, resolveToCwd } from "../../shared/path-resolution.js";
import { PREPARE_OCR_REVIEW_TOOL_DESCRIPTION } from "./description.js";

export const PrepareOcrReviewToolInputSchema = Type.Object({
	description: Type.Optional(
		Type.String({ description: "Brief user-facing reason for this tool call (max 100 chars).", maxLength: 100 }),
	),
	input: Type.String({ description: "Path to the source PDF file." }),
	ocrJson: Type.Optional(
		Type.String({
			description:
				"Path to extract_text_from_pdf JSON. Default: latest successful transcription extraction output, then <input>.ocr.json.",
		}),
	),
	output: Type.Optional(
		Type.String({ description: "Output prefix for PNG sheets and JSON manifest. Default: <input>.ocr-review." }),
	),
	confidenceBelow: Type.Optional(
		Type.Number({ description: "Include OCR lines below this 0..100 score. Default 75.", minimum: 0, maximum: 100 }),
	),
	samplePerPage: Type.Optional(
		Type.Integer({
			description: "Deterministic non-anomaly line samples per page. Default 1.",
			minimum: 0,
			maximum: 5,
		}),
	),
	includePageOverview: Type.Optional(
		Type.Boolean({ description: "Include deterministic full-page overview tiles. Default true." }),
	),
	reviewMode: Type.Optional(
		Type.Union([Type.Literal("sampled"), Type.Literal("transcription"), Type.Literal("full_audit")], {
			description:
				'"sampled" checks anomalies plus samples; "transcription" covers every page plus risky lines; "full_audit" includes every OCR line up to maxTiles. Default "transcription".',
		}),
	),
	maxTiles: Type.Optional(
		Type.Integer({
			description:
				"Requested maximum tiles. Transcription mode also enforces an adaptive page-based cap; full-audit supports up to 512.",
			minimum: 1,
			maximum: 512,
		}),
	),
	dpi: Type.Optional(
		Type.Integer({ description: "Render DPI. Defaults to OCR renderDpi, otherwise 150.", minimum: 72, maximum: 600 }),
	),
});

export type PrepareOcrReviewToolInput = Static<typeof PrepareOcrReviewToolInputSchema>;

export interface PrepareOcrReviewToolOptions {
	readonly process: CommandProcessPort;
	readonly modelOrder?: number;
}

type ReviewTile =
	| { readonly kind: "page"; readonly page: number }
	| {
			readonly kind: "line";
			readonly page: number;
			readonly line: number;
			readonly text: string;
			readonly confidence: number;
			readonly box: OcrLineResult["box"];
	  };

type ReviewLineTile = Extract<ReviewTile, { readonly kind: "line" }>;

interface ManifestTile {
	readonly row: number;
	readonly column: number;
	readonly kind: ReviewTile["kind"];
	readonly page: number;
	readonly line?: number;
	readonly text?: string;
	readonly confidence?: number;
}

const DEFAULT_DPI = 150;
const DEFAULT_CONFIDENCE = 75;
const DEFAULT_SAMPLE_PER_PAGE = 1;
const COLUMNS = 4;
const ROWS = 4;
const TILE_WIDTH = 320;
const TILE_HEIGHT = 220;
const TILE_GAP = 8;

export function createPrepareOcrReviewTool(
	cwd: string,
	options: PrepareOcrReviewToolOptions,
): RuntimeToolDefinition<PrepareOcrReviewToolInput> {
	return {
		name: "prepare_ocr_review",
		label: "prepare_ocr_review",
		description: PREPARE_OCR_REVIEW_TOOL_DESCRIPTION,
		inputSchema: PrepareOcrReviewToolInputSchema,
		modelOrder: options.modelOrder,
		runPolicy: { stopOnError: true },
		async execute({ input, messages, signal, reportPhase }) {
			signal.throwIfAborted();
			reportPhase?.("locate");
			const inputPath = resolveExistingPath(input.input, cwd);
			const ocrJsonPath = resolveExistingPath(
				input.ocrJson ?? readLatestTranscriptionOutputPath(messages) ?? `${inputPath}.ocr.json`,
				cwd,
			);
			const outputPrefix = resolveToCwd(input.output ?? `${inputPath}.ocr-review`, cwd);
			const document = parseOcrJsonDocument(await readFile(ocrJsonPath, "utf8"));
			const source = await createOcrSourceFingerprint(inputPath);
			if (!matchesOcrSourceFingerprint(document, source)) {
				throw new RuntimeToolExecutionError(
					'OCR review requires a version-2 OCR JSON whose source fingerprint matches the current PDF. Re-run extract_text_from_pdf(mode="transcription"); do not reuse or manually repair a stale JSON file.',
					{ code: "OCR_REVIEW_STALE_CACHE", retryable: false },
				);
			}
			if (document.capabilities?.pageCaptures !== true) {
				throw new RuntimeToolExecutionError(
					'OCR JSON does not contain complete page captures. Re-run extract_text_from_pdf(mode="transcription").',
					{ code: "OCR_REVIEW_CAPTURES_REQUIRED", retryable: false },
				);
			}
			const reviewMode = input.reviewMode ?? "transcription";
			const adaptiveTileLimit = adaptiveMaxTiles(document, reviewMode);
			const maxTiles =
				reviewMode === "transcription"
					? Math.min(input.maxTiles ?? adaptiveTileLimit, adaptiveTileLimit)
					: (input.maxTiles ?? adaptiveTileLimit);
			const tiles = selectReviewTiles(
				document,
				reviewMode,
				input.confidenceBelow ?? DEFAULT_CONFIDENCE,
				input.samplePerPage ?? DEFAULT_SAMPLE_PER_PAGE,
				input.includePageOverview !== false,
				maxTiles,
			);
			if (tiles.length === 0) throw new Error("OCR JSON contains no pages or reviewable lines");

			const sourceDpi = readRenderDpi(document) ?? DEFAULT_DPI;
			const renderDpi = input.dpi ?? sourceDpi;
			if (renderDpi !== sourceDpi) {
				throw new RuntimeToolExecutionError(
					`OCR review dpi ${renderDpi} does not match captured page dpi ${sourceDpi}. Re-run extraction at the desired dpi.`,
					{ code: "OCR_REVIEW_DPI_MISMATCH", retryable: false },
				);
			}
			const scale = renderDpi / sourceDpi;
			reportPhase?.("validate-captures");
			const selectedPages = [...new Set(tiles.map((tile) => tile.page))];
			const pageImages = await resolvePageImages(document, selectedPages, ocrJsonPath);
			reportPhase?.("compose");
			await mkdir(dirname(outputPrefix), { recursive: true });
			const sheets = await composeSheets(tiles, pageImages, outputPrefix, scale, signal);
			const manifestPath = `${outputPrefix}.json`;
			await writeFile(
				manifestPath,
				JSON.stringify(
					{
						version: 2,
						sourcePdf: inputPath,
						ocrJson: ocrJsonPath,
						reviewMode,
						dpi: renderDpi,
						confidenceBelow: input.confidenceBelow ?? DEFAULT_CONFIDENCE,
						coverage: { pages: selectedPages.length, totalPages: document.pages.length, tiles: tiles.length },
						sheets: sheets.map(({ path, tiles: sheetTiles }) => ({ path, tiles: sheetTiles })),
					},
					null,
					2,
				),
				"utf8",
			);
			const summary = buildManifestText(sheets, manifestPath, renderDpi, tiles.length);
			return {
				content: [
					{ type: "text", text: summary },
					...sheets.map(({ bytes }) => ({
						type: "image" as const,
						data: bytes.toString("base64"),
						mimeType: "image/png",
					})),
				],
				details: {
					manifestPath,
					sheetPaths: sheets.map(({ path }) => path),
					tileCount: tiles.length,
					workflow: { kind: "pdf_ocr_review", reviewMode, coveredPages: selectedPages.length },
				},
			};
		},
	};
}

function readLatestTranscriptionOutputPath(messages: readonly Message[] | undefined): string | undefined {
	const history = messages ?? [];
	for (let index = history.length - 1; index >= 0; index -= 1) {
		const message = history[index];
		if (
			message.role !== "toolResult" ||
			message.toolName !== "extract_text_from_pdf" ||
			message.isError === true ||
			!isRecord(message.details) ||
			!isRecord(message.details.workflow) ||
			message.details.workflow.kind !== "pdf_transcription"
		) {
			continue;
		}
		const outputPath = message.details.workflow.outputPath;
		if (typeof outputPath === "string" && outputPath.length > 0) return outputPath;
	}
	return undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null;
}

async function resolvePageImages(
	document: OcrJsonDocument,
	pages: readonly number[],
	ocrJsonPath: string,
): Promise<ReadonlyMap<number, string>> {
	const resolved = new Map<number, string>();
	for (const page of document.pages) {
		if (!pages.includes(page.page) || !page.imagePath) continue;
		const imagePath = isAbsolute(page.imagePath) ? page.imagePath : resolve(dirname(ocrJsonPath), page.imagePath);
		try {
			await stat(imagePath);
			resolved.set(page.page, imagePath);
		} catch {
			// Missing or unreadable captures are reported together below.
		}
	}
	const missingPages = pages.filter((page) => !resolved.has(page));
	if (missingPages.length > 0) {
		throw new RuntimeToolExecutionError(
			`Captured OCR page images are missing for page(s): ${missingPages.join(", ")}. Re-run extract_text_from_pdf(mode="transcription"); do not render/read pages individually.`,
			{ code: "OCR_REVIEW_CAPTURES_MISSING", retryable: false, metadata: { pages: missingPages } },
		);
	}
	return resolved;
}

function readRenderDpi(document: OcrJsonDocument): number | undefined {
	const value = document.meta.renderDpi;
	return typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined;
}

function selectReviewTiles(
	document: OcrJsonDocument,
	reviewMode: "sampled" | "transcription" | "full_audit",
	confidenceBelow: number,
	samplePerPage: number,
	includePageOverview: boolean,
	maxTiles: number,
): readonly ReviewTile[] {
	const lowConfidence: ReviewLineTile[] = [];
	const samples: ReviewLineTile[] = [];
	for (const page of document.pages) {
		const lines = page.lines ?? [];
		const selected = new Set<number>();
		for (let index = 0; index < lines.length; index += 1) {
			const line = lines[index];
			if (reviewMode === "full_audit" || line.confidenceScore < confidenceBelow || isHighRiskLine(line.text)) {
				selected.add(index);
				lowConfidence.push(lineTile(page.page, index, line));
			}
		}
		for (const index of evenlySpacedIndexes(lines.length, samplePerPage)) {
			if (!selected.has(index)) samples.push(lineTile(page.page, index, lines[index]));
		}
	}
	lowConfidence.sort((left, right) => left.confidence - right.confidence || left.page - right.page);

	const overviewBudget = includePageOverview
		? reviewMode === "sampled"
			? Math.min(document.pages.length, Math.max(1, Math.floor(maxTiles / 3)))
			: document.pages.length
		: 0;
	const overviewIndexes = evenlySpacedIndexes(document.pages.length, overviewBudget);
	const overviews = overviewIndexes.map((index) => ({ kind: "page" as const, page: document.pages[index].page }));
	return (
		reviewMode === "sampled"
			? [...lowConfidence, ...overviews, ...samples]
			: [...overviews, ...lowConfidence, ...samples]
	).slice(0, maxTiles);
}

function adaptiveMaxTiles(document: OcrJsonDocument, reviewMode: "sampled" | "transcription" | "full_audit"): number {
	if (reviewMode === "sampled") return 64;
	if (reviewMode === "full_audit") {
		return Math.min(
			512,
			document.pages.length + document.pages.reduce((sum, page) => sum + (page.lines?.length ?? 0), 0),
		);
	}
	return Math.min(512, Math.max(64, document.pages.length * 2));
}

function isHighRiskLine(text: string): boolean {
	const digits = text.match(/\d/g)?.length ?? 0;
	return digits >= 3 || /[|+*=/%#]|\b[A-Z]{2,}\d+\b/.test(text);
}

function lineTile(page: number, index: number, line: OcrLineResult): ReviewLineTile {
	return {
		kind: "line",
		page,
		line: index + 1,
		text: line.text,
		confidence: line.confidenceScore,
		box: line.box,
	};
}

function evenlySpacedIndexes(length: number, count: number): number[] {
	if (length <= 0 || count <= 0) return [];
	if (count >= length) return Array.from({ length }, (_, index) => index);
	const indexes = new Set<number>();
	for (let position = 0; position < count; position += 1) {
		indexes.add(Math.min(length - 1, Math.floor(((position + 0.5) * length) / count)));
	}
	return [...indexes];
}

async function composeSheets(
	tiles: readonly ReviewTile[],
	pageImages: ReadonlyMap<number, string>,
	outputPrefix: string,
	scale: number,
	signal: AbortSignal,
): Promise<readonly { readonly path: string; readonly bytes: Buffer; readonly tiles: readonly ManifestTile[] }[]> {
	const perSheet = COLUMNS * ROWS;
	const output: Array<{ path: string; bytes: Buffer; tiles: ManifestTile[] }> = [];
	for (let offset = 0; offset < tiles.length; offset += perSheet) {
		signal.throwIfAborted();
		const chunk = tiles.slice(offset, offset + perSheet);
		const sheetPixels = new Uint8Array(COLUMNS * TILE_WIDTH * ROWS * TILE_HEIGHT * 4).fill(255);
		const sheet = new photon.PhotonImage(sheetPixels, COLUMNS * TILE_WIDTH, ROWS * TILE_HEIGHT);
		const manifestTiles: ManifestTile[] = [];
		try {
			for (let index = 0; index < chunk.length; index += 1) {
				const tile = chunk[index];
				const row = Math.floor(index / COLUMNS);
				const column = index % COLUMNS;
				const imagePath = pageImages.get(tile.page);
				if (!imagePath) throw new Error(`Missing rendered page ${tile.page}`);
				const pageImage = photon.PhotonImage.new_from_byteslice(new Uint8Array(await readFile(imagePath)));
				try {
					const source = tile.kind === "line" ? cropLine(pageImage, tile.box, scale) : pageImage;
					try {
						placeImage(sheet, source, column * TILE_WIDTH, row * TILE_HEIGHT);
					} finally {
						if (source !== pageImage) source.free();
					}
				} finally {
					pageImage.free();
				}
				manifestTiles.push({
					row: row + 1,
					column: column + 1,
					kind: tile.kind,
					page: tile.page,
					...(tile.kind === "line" ? { line: tile.line, text: tile.text, confidence: tile.confidence } : {}),
				});
			}
			const bytes = Buffer.from(sheet.get_bytes());
			const path = `${outputPrefix}-${String(output.length + 1).padStart(2, "0")}.png`;
			await writeFile(path, bytes);
			output.push({ path, bytes, tiles: manifestTiles });
		} finally {
			sheet.free();
		}
	}
	return output;
}

function cropLine(image: photon.PhotonImage, box: OcrLineResult["box"], scale: number): photon.PhotonImage {
	const xs = box.map(([x]) => x * scale);
	const ys = box.map(([, y]) => y * scale);
	const padding = 12;
	const x1 = Math.max(0, Math.floor(Math.min(...xs) - padding));
	const y1 = Math.max(0, Math.floor(Math.min(...ys) - padding));
	const x2 = Math.min(image.get_width(), Math.ceil(Math.max(...xs) + padding));
	const y2 = Math.min(image.get_height(), Math.ceil(Math.max(...ys) + padding));
	if (x2 <= x1 || y2 <= y1) throw new Error("OCR line box is outside the rendered page");
	return photon.crop(image, x1, y1, x2, y2);
}

function placeImage(sheet: photon.PhotonImage, source: photon.PhotonImage, tileX: number, tileY: number): void {
	const maxWidth = TILE_WIDTH - TILE_GAP * 2;
	const maxHeight = TILE_HEIGHT - TILE_GAP * 2;
	const ratio = Math.min(maxWidth / source.get_width(), maxHeight / source.get_height());
	const width = Math.max(1, Math.round(source.get_width() * ratio));
	const height = Math.max(1, Math.round(source.get_height() * ratio));
	const resized = photon.resize(source, width, height, photon.SamplingFilter.Lanczos3);
	try {
		const x = tileX + Math.floor((TILE_WIDTH - width) / 2);
		const y = tileY + Math.floor((TILE_HEIGHT - height) / 2);
		photon.watermark(sheet, resized, BigInt(x), BigInt(y));
	} finally {
		resized.free();
	}
}

function buildManifestText(
	sheets: readonly { readonly path: string; readonly tiles: readonly ManifestTile[] }[],
	manifestPath: string,
	dpi: number,
	tileCount: number,
): string {
	const rows = sheets.flatMap((sheet, sheetIndex) =>
		sheet.tiles.map(
			(tile) =>
				`sheet=${sheetIndex + 1} row=${tile.row} col=${tile.column} kind=${tile.kind} page=${tile.page}${
					tile.line === undefined
						? ""
						: ` line=${tile.line} confidence=${tile.confidence} text=${JSON.stringify(tile.text)}`
				}`,
		),
	);
	return [
		`Prepared ${sheets.length} OCR review sheet(s), ${tileCount} tile(s), ${dpi} dpi.`,
		"Inspect the attached images. Use [待核对] for anything not visually confirmable; do not infer from context.",
		...rows,
		"---",
		`manifest: ${manifestPath}`,
		...sheets.map((sheet) => `sheet: ${sheet.path}`),
	].join("\n");
}
