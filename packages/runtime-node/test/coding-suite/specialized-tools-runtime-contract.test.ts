import { createHash } from "node:crypto";
import { access, mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import * as photon from "@silvia-odwyer/photon-node";
import { afterEach, describe, expect, it } from "vitest";
import {
	type AsyncExecutionGate,
	type CommandProcessPort,
	createDocToPdfToolRegistration,
	createExtractTextFromImageToolRegistration,
	createExtractTextFromPdfToolRegistration,
	createHtmlToPdfToolRegistration,
	createPrepareOcrReviewToolRegistration,
	createRenderPdfPageToolRegistration,
	type DesktopCommandPort,
	type DocToPdfOperations,
	type RenderPdfPageProcessPort,
} from "../../src/coding/index.js";

const temporaryDirectories: string[] = [];
const signal = new AbortController().signal;
const immediateGate: AsyncExecutionGate = { run: (operation) => operation() };

afterEach(async () => {
	for (const directory of temporaryDirectories.splice(0)) {
		await rm(directory, { recursive: true, force: true });
	}
});

describe("runtime specialized tool contracts", () => {
	it("keeps specialized runtime registrations independent of scenario policy", () => {
		const cwd = process.cwd();
		const desktop = successfulDesktop("C:output.json");
		const extractPdf = createExtractTextFromPdfToolRegistration(cwd, {
			desktop,
			process: desktop,
			executionGate: immediateGate,
		});
		const prepareReview = createPrepareOcrReviewToolRegistration(cwd, { process: desktop });
		const registrations = [
			createDocToPdfToolRegistration(cwd, { operations: successfulDocOperations() }),
			createHtmlToPdfToolRegistration(cwd, { desktop }),
			extractPdf,
			createExtractTextFromImageToolRegistration(cwd, { desktop, executionGate: immediateGate }),
			prepareReview,
			createRenderPdfPageToolRegistration(cwd, { process: successfulRenderProcess() }),
		];

		expect(registrations.map(({ tool }) => tool.name)).toEqual([
			"doc_to_pdf",
			"html_to_pdf",
			"extract_text_from_pdf",
			"extract_text_from_img",
			"prepare_ocr_review",
			"render_pdf_page",
		]);
		expect(extractPdf.tool.runPolicy).toBeUndefined();
		expect(prepareReview.tool.runPolicy?.stopOnError).toBe(true);
	});

	it("resolves document conversion paths from the session cwd and preserves phases and output", async () => {
		const cwd = await temporaryDirectory("doc");
		await writeFile(join(cwd, "source.docx"), "document", "utf8");
		const calls: string[][] = [];
		const operations: DocToPdfOperations = {
			detect: async () => ({ type: "msoffice", label: "Microsoft Office" }),
			convert: async (input, output) => {
				calls.push([input, output]);
				return output;
			},
		};
		const phases: string[] = [];
		const tool = createDocToPdfToolRegistration(cwd, { operations }).tool;
		const result = await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: { path: "source.docx", output: "result.pdf" },
			signal,
			reportPhase: (phase) => phases.push(phase),
		});

		expect(calls).toEqual([[join(cwd, "source.docx"), join(cwd, "result.pdf")]]);
		expect(phases).toEqual(["locate", "detect", "convert"]);
		expect(result).toEqual({
			content: [
				{
					type: "text",
					text: `Successfully converted to PDF using Microsoft Office.\nOutput: ${join(cwd, "result.pdf")}`,
				},
			],
			details: undefined,
		});
	});

	it("passes session-local HTML paths and renderer options through the desktop port", async () => {
		const cwd = await temporaryDirectory("html");
		await writeFile(join(cwd, "source.html"), "<p>test</p>", "utf8");
		const calls: Array<{ executable: string; args: readonly string[] }> = [];
		const desktop: DesktopCommandPort = {
			locate: async () => ({ path: "Astravia.exe" }),
			async run(executable, args) {
				calls.push({ executable, args });
				return {
					code: 0,
					stdout: JSON.stringify({ ok: true, output: join(cwd, "result.pdf"), renderer: "electron" }),
					stderr: "",
				};
			},
		};
		const tool = createHtmlToPdfToolRegistration(cwd, { desktop }).tool;
		const result = await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: { input: "source.html", output: "result.pdf", marginTop: 0.5 },
			signal,
		});

		expect(calls).toEqual([
			{
				executable: "Astravia.exe",
				args: [
					"--html-to-pdf",
					join(cwd, "source.html"),
					"--output",
					join(cwd, "result.pdf"),
					"--margin-top",
					"0.5",
				],
			},
		]);
		expect(result.content[0]).toMatchObject({ text: expect.stringContaining(`Output: ${join(cwd, "result.pdf")}`) });
	});

	it("runs image OCR through the shared gate and validates the structured document", async () => {
		const cwd = await temporaryDirectory("image-ocr");
		const imagePath = join(cwd, "scan.png");
		const outputPath = `${imagePath}.ocr.json`;
		await writeFile(imagePath, "image", "utf8");
		await writeFile(
			outputPath,
			JSON.stringify({
				version: 1,
				meta: { durationMs: 12, engine: "PP-OCRv5" },
				pages: [{ page: 1, text: "recognized text", source: "ocr", width: 10, height: 20, confidence: 98 }],
			}),
			"utf8",
		);
		let gateCalls = 0;
		const gate: AsyncExecutionGate = {
			async run(operation) {
				gateCalls += 1;
				return operation();
			},
		};
		const desktop = successfulDesktop(outputPath, "desktop warning\n");
		const tool = createExtractTextFromImageToolRegistration(cwd, { desktop, executionGate: gate }).tool;
		const result = await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: { input: "scan.png", maxChars: 10 },
			signal,
		});

		expect(gateCalls).toBe(1);
		expect(result.content[0]).toMatchObject({
			text: expect.stringContaining(
				"recognized\n…[truncated 5 chars]\n---\nconfidence=98 duration_ms=12 engine=PP-OCRv5",
			),
		});
	});

	it("auto-lowers PDF OCR dpi from pdfinfo and preserves page formatting", async () => {
		const cwd = await temporaryDirectory("pdf-ocr");
		const inputPath = join(cwd, "scan.pdf");
		const outputPath = `${inputPath}.ocr.json`;
		await writeFile(inputPath, "pdf", "utf8");
		const capturedPagePath = join(cwd, "page-0001.png");
		await writeFile(capturedPagePath, "png", "utf8");
		const source = await sourceFingerprint(inputPath);
		const desktopCalls: readonly string[][] = [];
		const mutableDesktopCalls = desktopCalls as string[][];
		const desktop: DesktopCommandPort = {
			locate: async () => ({ path: "Astravia.exe" }),
			async run(_executable, args) {
				mutableDesktopCalls.push([...args]);
				await writeFile(
					outputPath,
					JSON.stringify(
						ocrDocument(
							source,
							{
								pages: "1",
								dpi: 120,
								capturePages: true,
							},
							[
								{
									page: 1,
									imagePath: capturedPagePath,
									text: "page text",
									source: "ocr",
									width: 10,
									height: 20,
									lines: [
										{
											text: "page text",
											box: [
												[0, 0],
												[10, 0],
												[10, 5],
												[0, 5],
											],
											confidence: 0.5,
											confidenceScore: 63,
										},
									],
								},
							],
						),
					),
					"utf8",
				);
				return { code: 0, stdout: JSON.stringify({ ok: true, output: outputPath }), stderr: "" };
			},
		};
		const process: CommandProcessPort = {
			async run(executable, args) {
				expect(executable).toBe("pdfinfo");
				expect(args).toEqual(["-box", "-f", "1", "-l", "1", inputPath]);
				return { code: 0, stdout: "Page 1 size: 6000 x 4000 pts", stderr: "" };
			},
		};
		const tool = createExtractTextFromPdfToolRegistration(cwd, {
			desktop,
			process,
			executionGate: immediateGate,
		}).tool;
		const result = await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: { input: "scan.pdf", pages: "1", mode: "transcription" },
			signal,
		});

		expect(desktopCalls).toEqual([
			["--ocr-pdf", inputPath, "--output", outputPath, "--capture-pages", "--pages", "1", "--dpi", "120"],
		]);
		expect(result.content[0]).toMatchObject({
			text: expect.stringContaining("=== Page 1 (ocr) ===\npage text\n---\ntotal_pages=1 processed=1"),
		});
		expect(result.content[0]).toMatchObject({ text: expect.stringContaining("TRANSCRIPTION MODE\nline_boxes=1") });
		expect(result.details).toMatchObject({
			workflow: { kind: "pdf_transcription", pageCount: 1, cache: "miss", documentVersion: 2 },
		});

		await tool.execute({
			sessionId: "session",
			turnId: "turn-2",
			toolCallId: "call-2",
			input: { input: "scan.pdf", pages: "1", mode: "transcription" },
			signal,
		});
		expect(desktopCalls).toHaveLength(1);
	});

	it("returns OCR anomaly contact sheets in the same tool result", async () => {
		const cwd = await temporaryDirectory("ocr-review");
		const inputPath = join(cwd, "scan.pdf");
		const ocrPath = `${inputPath}.ocr.json`;
		const outputPrefix = join(cwd, "review");
		await writeFile(inputPath, "pdf", "utf8");
		const source = await sourceFingerprint(inputPath);
		const capturedPagePath = join(cwd, "page-0001.png");
		const capturedPage = new photon.PhotonImage(new Uint8Array(100 * 100 * 4).fill(255), 100, 100);
		try {
			await writeFile(capturedPagePath, capturedPage.get_bytes());
		} finally {
			capturedPage.free();
		}
		await writeFile(
			ocrPath,
			JSON.stringify({
				version: 2,
				source,
				request: {
					pages: "all",
					dpi: 150,
					preferTextLayer: true,
					textLayerMinChars: 20,
					capturePages: true,
				},
				capabilities: { pageCaptures: true, lineBoxes: true },
				meta: { renderDpi: 150 },
				pages: [
					{
						page: 1,
						imagePath: capturedPagePath,
						text: "uncertain",
						source: "ocr",
						width: 100,
						height: 100,
						lines: [
							{
								text: "uncertain",
								box: [
									[10, 10],
									[90, 10],
									[90, 40],
									[10, 40],
								],
								confidence: -0.5,
								confidenceScore: 38,
							},
						],
					},
				],
			}),
			"utf8",
		);
		const process: CommandProcessPort = {
			async run() {
				throw new Error("pdftoppm must not run when captured pages exist");
			},
		};
		const tool = createPrepareOcrReviewToolRegistration(cwd, { process }).tool;
		const result = await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: {
				input: "scan.pdf",
				output: "review",
				confidenceBelow: 75,
				samplePerPage: 0,
				maxTiles: 4,
			},
			signal,
		});

		expect(result.content.map(({ type }) => type)).toEqual(["text", "image"]);
		expect(result.content[0]).toMatchObject({
			text: expect.stringContaining("kind=line page=1 line=1 confidence=38"),
		});
		await access(`${outputPrefix}-01.png`);
		const manifest = JSON.parse(await readFile(`${outputPrefix}.json`, "utf8"));
		expect(manifest.sheets[0].tiles).toMatchObject([
			{ kind: "page", page: 1 },
			{ kind: "line", page: 1, line: 1, confidence: 38 },
		]);
		expect(manifest).toMatchObject({
			version: 2,
			reviewMode: "transcription",
			coverage: { pages: 1, totalPages: 1, tiles: 2 },
		});
	});

	it("uses the latest extraction output when review omits ocrJson", async () => {
		const cwd = await temporaryDirectory("ocr-review-output-contract");
		const inputPath = join(cwd, "scan.pdf");
		const ocrPath = join(cwd, "outputs", "custom.ocr.json");
		const capturedPagePath = join(cwd, "page-0001.png");
		await writeFile(inputPath, "pdf", "utf8");
		await mkdir(join(cwd, "outputs"), { recursive: true });
		const source = await sourceFingerprint(inputPath);
		const capturedPage = new photon.PhotonImage(new Uint8Array(32 * 32 * 4).fill(255), 32, 32);
		try {
			await writeFile(capturedPagePath, capturedPage.get_bytes());
		} finally {
			capturedPage.free();
		}
		await writeFile(
			ocrPath,
			JSON.stringify(
				ocrDocument(source, { pages: "all", dpi: 150, capturePages: true }, [
					{
						page: 1,
						imagePath: capturedPagePath,
						text: "page",
						source: "ocr",
						width: 32,
						height: 32,
						lines: [],
					},
				]),
			),
		);
		const tool = createPrepareOcrReviewToolRegistration(cwd, { process: successfulDesktop(ocrPath) }).tool;

		const result = await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "review-call",
			input: { input: "scan.pdf", output: "review" },
			messages: [
				{
					role: "toolResult",
					toolCallId: "extract-call",
					toolName: "extract_text_from_pdf",
					content: [{ type: "text", text: "ok" }],
					details: {
						workflow: { kind: "pdf_transcription", pageCount: 1, outputPath: ocrPath },
					},
					isError: false,
					timestamp: 1,
				},
			],
			signal,
		});

		expect(result.details).toMatchObject({ manifestPath: join(cwd, "review.json") });
	});

	it("covers every page overview in transcription review mode", async () => {
		const cwd = await temporaryDirectory("ocr-review-coverage");
		const inputPath = join(cwd, "scan.pdf");
		const ocrPath = `${inputPath}.ocr.json`;
		const capturedPagePath = join(cwd, "captured.png");
		await writeFile(inputPath, "pdf", "utf8");
		const capturedPage = new photon.PhotonImage(new Uint8Array(32 * 32 * 4).fill(255), 32, 32);
		try {
			await writeFile(capturedPagePath, capturedPage.get_bytes());
		} finally {
			capturedPage.free();
		}
		const source = await sourceFingerprint(inputPath);
		const pages = Array.from({ length: 12 }, (_, index) => ({
			page: index + 1,
			imagePath: capturedPagePath,
			text: `page ${index + 1}`,
			source: "ocr",
			width: 32,
			height: 32,
			lines: [],
		}));
		await writeFile(
			ocrPath,
			JSON.stringify(ocrDocument(source, { pages: "all", dpi: 150, capturePages: true }, pages)),
		);
		const tool = createPrepareOcrReviewToolRegistration(cwd, { process: successfulDesktop(ocrPath) }).tool;

		await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: { input: "scan.pdf", output: "coverage", samplePerPage: 0 },
			signal,
		});

		const manifest = JSON.parse(await readFile(join(cwd, "coverage.json"), "utf8"));
		expect(manifest.coverage).toEqual({ pages: 12, totalPages: 12, tiles: 12 });
		expect(
			manifest.sheets
				.flatMap((sheet: { tiles: Array<{ page: number }> }) => sheet.tiles)
				.map((tile: { page: number }) => tile.page),
		).toEqual(Array.from({ length: 12 }, (_, index) => index + 1));
	});

	it("caps transcription contact sheets even when the model requests 512 tiles", async () => {
		const cwd = await temporaryDirectory("ocr-review-bounded");
		const inputPath = join(cwd, "scan.pdf");
		const ocrPath = `${inputPath}.ocr.json`;
		const capturedPagePath = join(cwd, "captured.png");
		await writeFile(inputPath, "pdf", "utf8");
		const capturedPage = new photon.PhotonImage(new Uint8Array(32 * 32 * 4).fill(255), 32, 32);
		try {
			await writeFile(capturedPagePath, capturedPage.get_bytes());
		} finally {
			capturedPage.free();
		}
		const source = await sourceFingerprint(inputPath);
		const pages = Array.from({ length: 12 }, (_, pageIndex) => ({
			page: pageIndex + 1,
			imagePath: capturedPagePath,
			text: `page ${pageIndex + 1}`,
			source: "ocr",
			width: 32,
			height: 32,
			lines: Array.from({ length: 8 }, (_, lineIndex) => ({
				text: `PAY-${pageIndex + 1}-${lineIndex + 1}`,
				box: [
					[1, 1],
					[30, 1],
					[30, 10],
					[1, 10],
				],
				confidence: -0.5,
				confidenceScore: 30,
			})),
		}));
		await writeFile(
			ocrPath,
			JSON.stringify(ocrDocument(source, { pages: "all", dpi: 150, capturePages: true }, pages)),
		);
		const tool = createPrepareOcrReviewToolRegistration(cwd, { process: successfulDesktop(ocrPath) }).tool;

		await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: { input: "scan.pdf", output: "bounded", reviewMode: "transcription", maxTiles: 512 },
			signal,
		});

		const manifest = JSON.parse(await readFile(join(cwd, "bounded.json"), "utf8"));
		expect(manifest.coverage).toEqual({ pages: 12, totalPages: 12, tiles: 64 });
		expect(manifest.sheets).toHaveLength(4);
	});

	it("rejects legacy OCR JSON instead of reviewing a stale artifact", async () => {
		const cwd = await temporaryDirectory("ocr-review-stale");
		await writeFile(join(cwd, "scan.pdf"), "pdf", "utf8");
		await writeFile(
			join(cwd, "scan.pdf.ocr.json"),
			JSON.stringify({ version: 1, meta: { renderDpi: 150 }, pages: [] }),
			"utf8",
		);
		const tool = createPrepareOcrReviewToolRegistration(cwd, {
			process: successfulDesktop(join(cwd, "scan.pdf.ocr.json")),
		}).tool;

		await expect(
			tool.execute({
				sessionId: "session",
				turnId: "turn",
				toolCallId: "call",
				input: { input: "scan.pdf" },
				signal,
			}),
		).rejects.toMatchObject({ details: { code: "OCR_REVIEW_STALE_CACHE", retryable: false } });
	});

	it("renders a PDF page through the injected process and reports the generated PNG", async () => {
		const cwd = await temporaryDirectory("render");
		const inputPath = join(cwd, "source.pdf");
		const outputPath = join(cwd, "page.png");
		await writeFile(inputPath, "pdf", "utf8");
		const calls: readonly string[][] = [];
		const mutableCalls = calls as string[][];
		const process: RenderPdfPageProcessPort = {
			async run(args) {
				mutableCalls.push([...args]);
				await writeFile(outputPath, "png", "utf8");
				return { code: 0, stderr: "" };
			},
		};
		const tool = createRenderPdfPageToolRegistration(cwd, { process, now: () => 100 }).tool;
		const result = await tool.execute({
			sessionId: "session",
			turnId: "turn",
			toolCallId: "call",
			input: { input: "source.pdf", page: 2, output: "page.png", dpi: 144 },
			signal,
		});

		expect(calls).toEqual([
			["-png", "-r", "144", "-f", "2", "-l", "2", "-singlefile", inputPath, outputPath.slice(0, -4)],
		]);
		expect(result.content[0]).toMatchObject({ text: expect.stringContaining(`output: ${outputPath}`) });
	});
});

async function temporaryDirectory(label: string): Promise<string> {
	const directory = await mkdtemp(join(tmpdir(), `astravia-specialized-tools-${label}-`));
	temporaryDirectories.push(directory);
	return directory;
}

function successfulDesktop(outputPath: string, prefix = ""): DesktopCommandPort {
	return {
		locate: async () => ({ path: "Astravia.exe" }),
		run: async () => ({
			code: 0,
			stdout: `${prefix}${JSON.stringify({ ok: true, output: outputPath })}`,
			stderr: "",
		}),
	};
}

function successfulDocOperations(): DocToPdfOperations {
	return {
		detect: async () => ({ type: "msoffice", label: "Microsoft Office" }),
		convert: async (_input, output) => output,
	};
}

function successfulRenderProcess(): RenderPdfPageProcessPort {
	return { run: async () => ({ code: 0, stderr: "" }) };
}

async function sourceFingerprint(filePath: string): Promise<{
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

function ocrDocument(
	source: Awaited<ReturnType<typeof sourceFingerprint>>,
	request: { readonly pages: string; readonly dpi: number; readonly capturePages: boolean },
	pages: readonly Record<string, unknown>[],
): Record<string, unknown> {
	return {
		version: 2,
		source,
		request: {
			pages: request.pages,
			dpi: request.dpi,
			preferTextLayer: true,
			textLayerMinChars: 20,
			capturePages: request.capturePages,
		},
		capabilities: { pageCaptures: request.capturePages, lineBoxes: true },
		meta: {
			totalPages: pages.length,
			processedPages: pages.length,
			textLayerPages: 0,
			ocrPages: pages.length,
			durationMs: 20,
			engine: "PP-OCRv5",
			renderDpi: request.dpi,
		},
		pages,
	};
}
