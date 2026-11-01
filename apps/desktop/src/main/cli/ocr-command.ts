import { createHash } from "node:crypto";
import { constants, writeSync } from "node:fs";
import { access, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runImageOcr, runPdfOcr } from "../ocr/pdf-ocr.js";
import { persistCapturedPageImages } from "./ocr-page-images.js";

// ---------------------------------------------------------------------------
// Headless OCR CLI (agent-friendly)
// ---------------------------------------------------------------------------
// Output protocol:
//   stdout — exactly ONE JSON object on success or failure (no progress noise),
//            terminated by a newline. Agents can `JSON.parse` the last
//            non-empty stdout line.
//   stderr — NDJSON: each line is a single JSON object describing a progress
//            event, a renderer log, or a structured error. Agents can stream
//            and parse line-by-line. Default verbosity emits only progress +
//            error events; --verbose adds renderer console mirroring.
// Output JSON document (written to <output>):
//   { "version": 2, "source": {...}, "request": {...}, "capabilities": {...}, "meta": {...}, "pages": [...] }

export type OcrCliCommand =
	| { type: "help" }
	| { type: "error"; code: string; exitCode: number; message: string }
	| {
			type: "ocr-pdf";
			input: string;
			output: string;
			pages: string;
			dpi: number;
			langs: string[];
			progress: boolean;
			verbose: boolean;
			quiet: boolean;
			preferTextLayer: boolean;
			textLayerMinChars: number;
			capturePages: boolean;
	  }
	| {
			type: "ocr-img";
			input: string;
			output: string;
			langs: string[];
			progress: boolean;
			verbose: boolean;
			quiet: boolean;
	  };

export interface OcrPageResult {
	page: number;
	text: string;
	width: number;
	height: number;
	source: "text-layer" | "ocr";
	renderedImageDataUrl?: string;
	imagePath?: string;
	ocrDurationMs?: number;
	confidence?: number;
	lines?: OcrLineResult[];
}

export interface OcrLineResult {
	text: string;
	box: [[number, number], [number, number], [number, number], [number, number]];
	confidence: number;
	confidenceScore: number;
}

export interface OcrCliResponse {
	ok: boolean;
	output?: string;
	totalPages?: number;
	processedPages?: number;
	textLayerPages?: number;
	ocrPages?: number;
	engine?: string;
	durationMs?: number;
	error?: {
		code: string;
		message: string;
	};
}

const HELP_TEXT = `officebuddy OCR command line interface

Usage:
  Astravia.exe --ocr-pdf <input.pdf>   --output <output.json> [pdf options]
  Astravia.exe --ocr-img <input.image> --output <output.json> [img options]
  Astravia.exe ocr pdf <input.pdf>     --output <output.json> [pdf options]
  Astravia.exe ocr img <input.image>   --output <output.json> [img options]

Description:
  Run local OCR on a multi-page PDF using officebuddy Desktop's bundled Electron
  renderer plus an in-process PP-OCRv5 pipeline. No network calls.

  By default, pages with an embedded text layer are extracted directly
  (effectively perfect accuracy + ~10x faster). Pages without a usable text
  layer fall through to PP-OCRv5 (Chinese + English).

Options:
  --output <path>             Required output JSON path.
  --pages <range>             "all" | "N" | "N-M" (default: all).
  --dpi <n>                   Render DPI for OCR fallback (default: 200).
  --langs <list>              Comma-separated Tesseract langs (default: chi_sim,eng).
  --no-text-layer             Skip text-layer probe; force full OCR.
  --text-layer-min-chars <n>  If a page's text layer has fewer chars than
                              this, fall back to OCR (default: 20).
  --capture-pages             Save each rendered PDF page as PNG beside the
                              output JSON and add imagePath to each page.
  --progress                  Emit NDJSON progress events on stderr.
  --verbose                     Mirror renderer console.log to stderr (verbose).
  --quiet                     Suppress all stderr except structured errors.
  -h, --help                  Show this help text.

Output protocol:
  stdout — exactly one JSON object on completion:
    {"ok":true,"output":"...","totalPages":N,"processedPages":N,
     "textLayerPages":N,"ocrPages":N,"engine":"...","durationMs":N}
    or
    {"ok":false,"error":{"code":"...","message":"..."}}
  stderr — NDJSON, one event per line. Event shapes:
    {"type":"progress","page":1,"total":42,"phase":"render"|"ocr"|"text-layer"|"done"}
    {"type":"log","level":"info"|"warn"|"error","message":"..."}    (only with --verbose)
    {"type":"error","code":"...","message":"..."}                    (terminal failure)

Output JSON file <output> structure:
  {
    "version": 2,
    "source": { "algorithm": "sha256", "sha256": "...", "size": 123, "mtimeMs": 0 },
    "request": { "pages": "all", "dpi": 200, "preferTextLayer": true,
      "textLayerMinChars": 20, "capturePages": true },
    "capabilities": { "pageCaptures": true, "lineBoxes": true },
    "meta": {
      "input": "/abs/path.pdf",
      "totalPages": 42,
      "processedPages": 42,
      "textLayerPages": 30,
      "ocrPages": 12,
      "engine": "ocr-web@0.2.1+ppocrv5",
      "durationMs": 142000,
      "renderDpi": 200,
      "startedAt": "2026-05-08T01:23:45.000Z"
    },
    "pages": [
      { "page": 1, "source": "text-layer", "text": "...", "width": 1240, "height": 1754 },
      { "page": 2, "source": "ocr", "text": "...", "width": 1240, "height": 1754,
        "ocrDurationMs": 1532, "confidence": 87.4,
        "lines": [{ "text": "...", "box": [[0,0],[10,0],[10,5],[0,5]],
          "confidence": 0.8, "confidenceScore": 70 }] }
    ]
  }

Exit codes:
  0  Success or help.
  2  Invalid command line arguments.
  3  Input or output path error.
  4  OCR pipeline error.
`;

class OcrCliError extends Error {
	constructor(
		readonly code: string,
		readonly exitCode: number,
		message: string,
	) {
		super(message);
		this.name = "OcrCliError";
	}
}

function findCommandStart(argv: string[]): number {
	return argv.findIndex((arg) => arg === "--ocr-pdf" || arg === "--ocr-img" || arg === "ocr");
}

function parseDpiOption(value: string | undefined): number {
	if (!value) throw new OcrCliError("ARGUMENT_ERROR", 2, "--dpi requires a number");
	const parsed = Number(value);
	if (!Number.isFinite(parsed) || parsed < 72 || parsed > 600) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, "--dpi must be between 72 and 600");
	}
	return parsed;
}

function parsePagesOption(value: string | undefined): string {
	if (!value) throw new OcrCliError("ARGUMENT_ERROR", 2, "--pages requires a value");
	if (value === "all") return "all";
	if (!/^\d+(-\d+)?$/.test(value)) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, `--pages must be "all", "N" or "N-M"; got: ${value}`);
	}
	return value;
}

function parseIntOption(name: string, value: string | undefined, min: number): number {
	if (!value) throw new OcrCliError("ARGUMENT_ERROR", 2, `${name} requires an integer`);
	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < min) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, `${name} must be an integer >= ${min}`);
	}
	return parsed;
}

function parseLangsOption(value: string | undefined): string[] {
	if (!value) throw new OcrCliError("ARGUMENT_ERROR", 2, "--langs requires a value");
	const langs = value
		.split(",")
		.map((s) => s.trim())
		.filter(Boolean);
	if (langs.length === 0) throw new OcrCliError("ARGUMENT_ERROR", 2, "--langs cannot be empty");
	return langs;
}

function parseOcrPdfOptions(args: string[]): Omit<Extract<OcrCliCommand, { type: "ocr-pdf" }>, "type"> {
	let input: string | undefined;
	let output: string | undefined;
	let pages = "all";
	let dpi = 200;
	let langs = ["chi_sim", "eng"];
	let progress = false;
	let verbose = false;
	let quiet = false;
	let preferTextLayer = true;
	let textLayerMinChars = 20;
	let capturePages = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") {
			throw new OcrCliError("HELP_REQUESTED", 0, HELP_TEXT);
		}
		if (arg === "--output") {
			const value = args[++i];
			if (!value) throw new OcrCliError("ARGUMENT_ERROR", 2, "--output requires a path");
			output = value;
			continue;
		}
		if (arg === "--pages") {
			pages = parsePagesOption(args[++i]);
			continue;
		}
		if (arg === "--dpi") {
			dpi = parseDpiOption(args[++i]);
			continue;
		}
		if (arg === "--langs") {
			langs = parseLangsOption(args[++i]);
			continue;
		}
		if (arg === "--no-text-layer") {
			preferTextLayer = false;
			continue;
		}
		if (arg === "--text-layer-min-chars") {
			textLayerMinChars = parseIntOption("--text-layer-min-chars", args[++i], 0);
			continue;
		}
		if (arg === "--capture-pages") {
			capturePages = true;
			continue;
		}
		if (arg === "--progress") {
			progress = true;
			continue;
		}
		if (arg === "--verbose" || arg === "-v") {
			verbose = true;
			continue;
		}
		if (arg === "--quiet") {
			quiet = true;
			continue;
		}
		if (arg.startsWith("-")) {
			throw new OcrCliError("ARGUMENT_ERROR", 2, `Unknown option: ${arg}`);
		}
		if (input) {
			throw new OcrCliError("ARGUMENT_ERROR", 2, `Unexpected argument: ${arg}`);
		}
		input = arg;
	}

	if (!input) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, "Missing <input.pdf> path");
	}
	if (!output) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, "Missing required --output <output.json>");
	}
	if (quiet && verbose) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, "--quiet and --verbose are mutually exclusive");
	}

	return {
		input,
		output,
		pages,
		dpi,
		langs,
		progress,
		verbose,
		quiet,
		preferTextLayer,
		textLayerMinChars,
		capturePages,
	};
}

function parseOcrImgOptions(args: string[]): Omit<Extract<OcrCliCommand, { type: "ocr-img" }>, "type"> {
	let input: string | undefined;
	let output: string | undefined;
	let langs = ["chi_sim", "eng"];
	let progress = false;
	let verbose = false;
	let quiet = false;

	for (let i = 0; i < args.length; i++) {
		const arg = args[i];
		if (arg === "-h" || arg === "--help") {
			throw new OcrCliError("HELP_REQUESTED", 0, HELP_TEXT);
		}
		if (arg === "--output") {
			const value = args[++i];
			if (!value) throw new OcrCliError("ARGUMENT_ERROR", 2, "--output requires a path");
			output = value;
			continue;
		}
		if (arg === "--langs") {
			langs = parseLangsOption(args[++i]);
			continue;
		}
		if (arg === "--progress") {
			progress = true;
			continue;
		}
		if (arg === "--verbose" || arg === "-v") {
			verbose = true;
			continue;
		}
		if (arg === "--quiet") {
			quiet = true;
			continue;
		}
		if (arg.startsWith("-")) {
			throw new OcrCliError("ARGUMENT_ERROR", 2, `Unknown option: ${arg}`);
		}
		if (input) {
			throw new OcrCliError("ARGUMENT_ERROR", 2, `Unexpected argument: ${arg}`);
		}
		input = arg;
	}

	if (!input) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, "Missing <input.image> path");
	}
	if (!output) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, "Missing required --output <output.json>");
	}
	if (quiet && verbose) {
		throw new OcrCliError("ARGUMENT_ERROR", 2, "--quiet and --verbose are mutually exclusive");
	}

	return { input, output, langs, progress, verbose, quiet };
}

export function parseOcrCliCommand(argv: string[]): OcrCliCommand | null {
	const start = findCommandStart(argv);
	if (start < 0) return null;
	const args = argv.slice(start);
	const command = args[0];

	try {
		if (command === "--ocr-pdf") {
			return { type: "ocr-pdf", ...parseOcrPdfOptions(args.slice(1)) };
		}
		if (command === "--ocr-img") {
			return { type: "ocr-img", ...parseOcrImgOptions(args.slice(1)) };
		}
		if (command === "ocr") {
			const subcommand = args[1];
			if (subcommand === "-h" || subcommand === "--help" || subcommand === undefined) {
				return { type: "help" };
			}
			if (subcommand === "pdf") {
				return { type: "ocr-pdf", ...parseOcrPdfOptions(args.slice(2)) };
			}
			if (subcommand === "img") {
				return { type: "ocr-img", ...parseOcrImgOptions(args.slice(2)) };
			}
			throw new OcrCliError("ARGUMENT_ERROR", 2, `Unknown ocr subcommand: ${subcommand}`);
		}
		return null;
	} catch (error) {
		if (error instanceof OcrCliError && error.code === "HELP_REQUESTED") {
			return { type: "help" };
		}
		if (error instanceof OcrCliError) {
			return { type: "error", code: error.code, exitCode: error.exitCode, message: error.message };
		}
		const message = error instanceof Error ? error.message : String(error);
		return { type: "error", code: "ARGUMENT_ERROR", exitCode: 2, message };
	}
}

function writeStdoutJson(response: OcrCliResponse): void {
	writeSync(1, `${JSON.stringify(response)}\n`);
}

function writeStderrEvent(quiet: boolean, payload: Record<string, unknown>): void {
	// Even in --quiet mode we still surface terminal errors so an agent can
	// distinguish silent success from silent failure.
	if (quiet && payload.type !== "error") return;
	writeSync(2, `${JSON.stringify(payload)}\n`);
}

async function ensureReadableFile(filePath: string): Promise<void> {
	try {
		await access(filePath, constants.R_OK);
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		throw new OcrCliError("INPUT_ERROR", 3, `Cannot read PDF input: ${message}`);
	}
}

export async function runOcrCliCommand(command: OcrCliCommand): Promise<number> {
	if (command.type === "help") {
		writeSync(1, HELP_TEXT);
		return 0;
	}
	if (command.type === "error") {
		writeStdoutJson({ ok: false, error: { code: command.code, message: command.message } });
		return command.exitCode;
	}

	const startedAt = Date.now();
	const startedAtIso = new Date(startedAt).toISOString();
	try {
		const input = resolve(command.input);
		const output = resolve(command.output);
		await ensureReadableFile(input);
		const source = await createSourceFingerprint(input);
		await mkdir(dirname(output), { recursive: true });

		const onProgress = command.progress
			? (event: Record<string, unknown>) => writeStderrEvent(command.quiet, { type: "progress", ...event })
			: undefined;
		const onLog = command.verbose
			? (level: "info" | "warn" | "error", message: string) =>
					writeStderrEvent(command.quiet, { type: "log", level, message })
			: undefined;

		const result =
			command.type === "ocr-img"
				? await runImageOcr({
						imagePath: input,
						langs: command.langs,
						debug: command.verbose,
						onProgress: onProgress as never,
						onLog,
					})
				: await runPdfOcr({
						pdfPath: input,
						pages: command.pages,
						dpi: command.dpi,
						langs: command.langs,
						preferTextLayer: command.preferTextLayer,
						textLayerMinChars: command.textLayerMinChars,
						capturePages: command.capturePages,
						debug: command.verbose,
						onProgress: onProgress as never,
						onLog,
					});

		const durationMs = Date.now() - startedAt;
		const textLayerPages = result.pages.filter((p) => p.source === "text-layer").length;
		const ocrPages = result.pages.length - textLayerPages;
		const pages =
			command.type === "ocr-pdf" && command.capturePages
				? await persistCapturedPageImages(output, result.pages)
				: result.pages;
		const sourceAfter = await stat(input);
		if (sourceAfter.size !== source.size || sourceAfter.mtimeMs !== source.mtimeMs) {
			throw new OcrCliError("SOURCE_CHANGED", 3, "OCR source changed while it was being processed; retry the task");
		}
		const document = {
			version: 2 as const,
			source,
			...(command.type === "ocr-pdf"
				? {
						request: {
							pages: command.pages,
							dpi: command.dpi,
							preferTextLayer: command.preferTextLayer,
							textLayerMinChars: command.textLayerMinChars,
							capturePages: command.capturePages,
						},
					}
				: {}),
			capabilities: {
				pageCaptures:
					command.type === "ocr-pdf" &&
					command.capturePages &&
					pages.every((page) => "imagePath" in page && Boolean(page.imagePath)),
				lineBoxes: pages.filter((page) => page.source === "ocr").every((page) => Array.isArray(page.lines)),
			},
			meta: {
				input,
				totalPages: result.totalPages,
				processedPages: result.pages.length,
				textLayerPages,
				ocrPages,
				engine: result.engine,
				durationMs,
				startedAt: startedAtIso,
				renderDpi: command.type === "ocr-pdf" ? command.dpi : undefined,
			},
			pages,
		};
		await writeFile(output, JSON.stringify(document, null, 2), "utf8");

		writeStdoutJson({
			ok: true,
			output,
			totalPages: result.totalPages,
			processedPages: result.pages.length,
			textLayerPages,
			ocrPages,
			engine: result.engine,
			durationMs,
		});
		return 0;
	} catch (error) {
		const code = error instanceof OcrCliError ? error.code : "OCR_ERROR";
		const exitCode = error instanceof OcrCliError ? error.exitCode : 4;
		const message = error instanceof Error ? error.message : String(error);
		writeStderrEvent(command.quiet, { type: "error", code, message });
		writeStdoutJson({ ok: false, error: { code, message } });
		return exitCode;
	}
}

async function createSourceFingerprint(filePath: string): Promise<{
	readonly algorithm: "sha256";
	readonly sha256: string;
	readonly size: number;
	readonly mtimeMs: number;
}> {
	const [bytes, metadata] = await Promise.all([readFile(filePath), stat(filePath)]);
	return {
		algorithm: "sha256",
		sha256: createHash("sha256").update(bytes).digest("hex"),
		size: metadata.size,
		mtimeMs: metadata.mtimeMs,
	};
}
