#!/usr/bin/env node

import { pathToFileURL } from "node:url";

// 与仓库发布脚本接受的版本格式保持一致；宁可留下未知目录，也不扩大删除范围。
const VERSION_DIRECTORY = /^v\d+\.\d+\.\d+(?:-\d+)?$/;

function normalizePath(value) {
	return String(value ?? "")
		.trim()
		.replace(/^\/+|\/+$/g, "");
}

/**
 * Return the old version prefixes that may be removed after the current upload
 * has been verified. Only immediate `v<semver>` siblings are eligible.
 */
export function planVersionPrefixPrune({ prefix, version, entries }) {
	const normalizedPrefix = normalizePath(prefix);
	const normalizedVersion = String(version ?? "").trim().replace(/^v/, "");
	const parts = normalizedPrefix.split("/").filter(Boolean);
	const currentDirectory = parts.at(-1);
	const expectedDirectory = `v${normalizedVersion}`;
	const root = parts.slice(0, -1).join("/");

	if (!normalizedVersion || currentDirectory !== expectedDirectory || !VERSION_DIRECTORY.test(expectedDirectory)) {
		throw new Error(`Refusing to prune: prefix ${normalizedPrefix || "<empty>"} does not end in ${expectedDirectory}`);
	}
	if (!root) {
		throw new Error(`Refusing to prune an unscoped version root for ${normalizedPrefix}`);
	}

	return [...new Set(entries.map(normalizePath))]
		.filter((entry) => VERSION_DIRECTORY.test(entry) && entry !== currentDirectory)
		.sort()
		.map((entry) => `${root}/${entry}`);
}

function valueAfter(argv, flag) {
	const index = argv.indexOf(flag);
	return index === -1 ? "" : argv[index + 1] ?? "";
}

async function main(argv) {
	const input = await new Promise((resolve, reject) => {
		let contents = "";
		process.stdin.setEncoding("utf8");
		process.stdin.on("data", (chunk) => {
			contents += chunk;
		});
		process.stdin.on("end", () => resolve(contents));
		process.stdin.on("error", reject);
	});
	const prefixes = planVersionPrefixPrune({
		prefix: valueAfter(argv, "--prefix"),
		version: valueAfter(argv, "--version"),
		entries: input.split(/\r?\n/).filter(Boolean),
	});
	if (prefixes.length > 0) process.stdout.write(`${prefixes.join("\n")}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	main(process.argv.slice(2)).catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exitCode = 1;
	});
}
