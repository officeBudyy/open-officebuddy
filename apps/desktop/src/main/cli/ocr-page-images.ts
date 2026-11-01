import { mkdir, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

export interface CapturedOcrPage {
	readonly page: number;
	readonly renderedImageDataUrl?: string;
}

export async function persistCapturedPageImages<TPage extends CapturedOcrPage>(
	outputPath: string,
	pages: readonly TPage[],
): Promise<readonly (Omit<TPage, "renderedImageDataUrl"> & { readonly imagePath?: string })[]> {
	const pageDirectory = join(dirname(outputPath), `${basename(outputPath, extname(outputPath))}.pages`);
	let createdDirectory = false;
	const persisted: Array<Omit<TPage, "renderedImageDataUrl"> & { imagePath?: string }> = [];
	for (const page of pages) {
		const { renderedImageDataUrl, ...serializablePage } = page;
		if (!renderedImageDataUrl) {
			persisted.push(serializablePage);
			continue;
		}
		const match = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(renderedImageDataUrl);
		if (!match) throw new Error(`Invalid captured PNG for page ${page.page}`);
		if (!createdDirectory) {
			await mkdir(pageDirectory, { recursive: true });
			createdDirectory = true;
		}
		const imagePath = join(pageDirectory, `page-${String(page.page).padStart(4, "0")}.png`);
		await writeFile(imagePath, Buffer.from(match[1], "base64"));
		persisted.push({ ...serializablePage, imagePath });
	}
	return persisted;
}
