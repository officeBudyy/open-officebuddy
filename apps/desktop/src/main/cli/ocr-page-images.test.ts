import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { persistCapturedPageImages } from "./ocr-page-images.js";

const temporaryDirectories: string[] = [];

afterEach(async () => {
	await Promise.all(
		temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
	);
});

describe("persistCapturedPageImages", () => {
	it("writes captured PNG bytes and keeps only imagePath in OCR JSON pages", async () => {
		const directory = await mkdtemp(join(tmpdir(), "officebuddy-ocr-pages-"));
		temporaryDirectories.push(directory);
		const png = Buffer.from([0x89, 0x50, 0x4e, 0x47]);
		const pages = await persistCapturedPageImages(join(directory, "report.ocr.json"), [
			{ page: 3, text: "sample", renderedImageDataUrl: `data:image/png;base64,${png.toString("base64")}` },
		]);

		expect(pages).toEqual([
			{
				page: 3,
				text: "sample",
				imagePath: join(directory, "report.ocr.pages", "page-0003.png"),
			},
		]);
		await expect(readFile(pages[0].imagePath!)).resolves.toEqual(png);
	});
});
