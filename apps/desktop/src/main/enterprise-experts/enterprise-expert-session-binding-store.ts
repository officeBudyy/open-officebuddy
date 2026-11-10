import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { atomicWriteJSONAsync } from "@astravia/toolkit/atomic-write";
import type { EnterpriseExpertSessionBinding } from "../../shared/enterprise-experts.js";

const STORE_FILE_NAME = "enterprise-expert-bindings.json";
const writeTails = new Map<string, Promise<unknown>>();

function storePath(sessionPath: string): string {
	return join(dirname(sessionPath), STORE_FILE_NAME);
}

function sessionKey(sessionPath: string): string {
	return basename(sessionPath).replace(/\.jsonl$/i, "");
}

async function readStore(path: string): Promise<Record<string, EnterpriseExpertSessionBinding>> {
	try {
		const value: unknown = JSON.parse(await readFile(path, "utf8"));
		if (!value || typeof value !== "object" || Array.isArray(value)) return {};
		const result: Record<string, EnterpriseExpertSessionBinding> = {};
		for (const [key, candidate] of Object.entries(value)) {
			if (!candidate || typeof candidate !== "object") continue;
			const binding = candidate as Partial<EnterpriseExpertSessionBinding>;
			if (
				typeof binding.threadId !== "string" ||
				!binding.expert ||
				typeof binding.expert.id !== "string" ||
				typeof binding.expert.name !== "string"
			)
				continue;
			result[key] = binding as EnterpriseExpertSessionBinding;
		}
		return result;
	} catch {
		return {};
	}
}

export async function readEnterpriseExpertSessionBinding(
	sessionPath: string,
): Promise<EnterpriseExpertSessionBinding | undefined> {
	return (await readStore(storePath(sessionPath)))[sessionKey(sessionPath)];
}

export async function recordEnterpriseExpertSessionBinding(
	sessionPath: string,
	binding: EnterpriseExpertSessionBinding,
): Promise<void> {
	const path = storePath(sessionPath);
	const key = sessionKey(sessionPath);
	const previous = writeTails.get(path) ?? Promise.resolve();
	const result = previous.then(async () => {
		const store = await readStore(path);
		if (store[key]) return;
		await atomicWriteJSONAsync(path, { ...store, [key]: binding });
	});
	const tail = result.then(
		() => undefined,
		() => undefined,
	);
	writeTails.set(path, tail);
	void tail.then(() => {
		if (writeTails.get(path) === tail) writeTails.delete(path);
	});
	await result;
}
