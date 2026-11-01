import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { Type } from "@sinclair/typebox";
import { Value } from "@sinclair/typebox/value";

const OcrCliResponseSchema = Type.Object(
	{
		ok: Type.Boolean(),
		output: Type.Optional(Type.String()),
		error: Type.Optional(
			Type.Object(
				{
					message: Type.String(),
				},
				{ additionalProperties: true },
			),
		),
	},
	{ additionalProperties: true },
);

const OcrPageResultSchema = Type.Object(
	{
		page: Type.Number(),
		text: Type.String(),
		source: Type.Union([Type.Literal("text-layer"), Type.Literal("ocr")]),
		width: Type.Number(),
		height: Type.Number(),
		imagePath: Type.Optional(Type.String()),
		ocrDurationMs: Type.Optional(Type.Number()),
		confidence: Type.Optional(Type.Number()),
		lines: Type.Optional(
			Type.Array(
				Type.Object(
					{
						text: Type.String(),
						box: Type.Tuple([
							Type.Tuple([Type.Number(), Type.Number()]),
							Type.Tuple([Type.Number(), Type.Number()]),
							Type.Tuple([Type.Number(), Type.Number()]),
							Type.Tuple([Type.Number(), Type.Number()]),
						]),
						confidence: Type.Number(),
						confidenceScore: Type.Number(),
					},
					{ additionalProperties: true },
				),
			),
		),
	},
	{ additionalProperties: true },
);

const OcrJsonDocumentSchema = Type.Object(
	{
		version: Type.Number(),
		source: Type.Optional(
			Type.Object({
				algorithm: Type.Literal("sha256"),
				sha256: Type.String(),
				size: Type.Number(),
				mtimeMs: Type.Number(),
			}),
		),
		request: Type.Optional(
			Type.Object({
				pages: Type.String(),
				dpi: Type.Number(),
				preferTextLayer: Type.Boolean(),
				textLayerMinChars: Type.Number(),
				capturePages: Type.Boolean(),
			}),
		),
		capabilities: Type.Optional(
			Type.Object({
				pageCaptures: Type.Boolean(),
				lineBoxes: Type.Boolean(),
			}),
		),
		meta: Type.Record(Type.String(), Type.Unknown()),
		pages: Type.Array(OcrPageResultSchema),
	},
	{ additionalProperties: true },
);

export interface OcrCliResponse {
	readonly ok: boolean;
	readonly output?: string;
	readonly error?: { readonly message: string };
}

export interface OcrPageResult {
	readonly page: number;
	readonly text: string;
	readonly source: "text-layer" | "ocr";
	readonly width: number;
	readonly height: number;
	readonly imagePath?: string;
	readonly ocrDurationMs?: number;
	readonly confidence?: number;
	readonly lines?: readonly OcrLineResult[];
}

export interface OcrLineResult {
	readonly text: string;
	readonly box: readonly [
		readonly [number, number],
		readonly [number, number],
		readonly [number, number],
		readonly [number, number],
	];
	readonly confidence: number;
	readonly confidenceScore: number;
}

export interface OcrJsonDocument {
	readonly version: number;
	readonly source?: OcrSourceFingerprint;
	readonly request?: OcrRequestSignature;
	readonly capabilities?: OcrDocumentCapabilities;
	readonly meta: Readonly<Record<string, unknown>>;
	readonly pages: readonly OcrPageResult[];
}

export interface OcrSourceFingerprint {
	readonly algorithm: "sha256";
	readonly sha256: string;
	readonly size: number;
	readonly mtimeMs: number;
}

export interface OcrRequestSignature {
	readonly pages: string;
	readonly dpi: number;
	readonly preferTextLayer: boolean;
	readonly textLayerMinChars: number;
	readonly capturePages: boolean;
}

export interface OcrDocumentCapabilities {
	readonly pageCaptures: boolean;
	readonly lineBoxes: boolean;
}

export function parseOcrDesktopResponse(stdout: string): OcrCliResponse {
	const lines = stdout.split(/\r?\n/).filter((line) => line.trim().length > 0);
	for (let index = lines.length - 1; index >= 0; index--) {
		try {
			const parsed: unknown = JSON.parse(lines[index]);
			if (Value.Check(OcrCliResponseSchema, parsed)) return parsed;
		} catch {
			// Electron helpers may write non-JSON lines before the response.
		}
	}
	throw new Error("Astravia Desktop returned no parseable JSON on stdout");
}

export function parseOcrJsonDocument(raw: string): OcrJsonDocument {
	const parsed: unknown = JSON.parse(raw);
	if (!Value.Check(OcrJsonDocumentSchema, parsed)) {
		throw new Error("Astravia Desktop returned an invalid OCR document");
	}
	return parsed;
}

export async function createOcrSourceFingerprint(filePath: string): Promise<OcrSourceFingerprint> {
	const [bytes, metadata] = await Promise.all([readFile(filePath), stat(filePath)]);
	return {
		algorithm: "sha256",
		sha256: createHash("sha256").update(bytes).digest("hex"),
		size: metadata.size,
		mtimeMs: metadata.mtimeMs,
	};
}

export function matchesOcrSourceFingerprint(document: OcrJsonDocument, expected: OcrSourceFingerprint): boolean {
	return (
		document.version >= 2 &&
		document.source?.algorithm === "sha256" &&
		document.source.sha256 === expected.sha256 &&
		document.source.size === expected.size
	);
}

export function matchesOcrRequest(document: OcrJsonDocument, expected: OcrRequestSignature): boolean {
	const request = document.request;
	return (
		request?.pages === expected.pages &&
		request.dpi === expected.dpi &&
		request.preferTextLayer === expected.preferTextLayer &&
		request.textLayerMinChars === expected.textLayerMinChars &&
		request.capturePages === expected.capturePages
	);
}
