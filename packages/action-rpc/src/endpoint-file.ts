import { readFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import type { ActionRpcEndpoint } from "./types.js";

export const ACTION_RPC_ENDPOINT_FILE_ENV = "ASTRAVIA_ACTION_RPC_ENDPOINT_FILE";
export const ASTRAVIA_HOME_ENV = "ASTRAVIA_HOME";
export const ASTRAVIA_CONFIG_DIR_ENV = "ASTRAVIA_CONFIG_DIR";

/**
 * 默认用户数据目录名（即品牌名）。按环境隔离（如 dev）仍可用
 * ASTRAVIA_CONFIG_DIR 覆盖。项目内已有的 `.astravia/` 元数据目录属于兼容格式，
 * 不跟随用户数据根目录改名。
 */
export const DEFAULT_CONFIG_DIR_NAME = ".officeBuddy";

function expandTilde(p: string): string {
	if (p === "~") return homedir();
	if (p.startsWith("~/")) return join(homedir(), p.slice(2));
	return p;
}

/**
 * 用户数据目录名。ASTRAVIA_CONFIG_DIR 覆盖，否则用默认品牌名。
 */
export function getAstraviaConfigDirName(): string {
	return process.env[ASTRAVIA_CONFIG_DIR_ENV] || DEFAULT_CONFIG_DIR_NAME;
}

/**
 * 用户主目录下的数据根。ASTRAVIA_HOME（绝对路径，支持 ~ 展开）作为逃生口优先，
 * 否则为 ~/<configDirName>。
 */
export function getAstraviaHomePath(): string {
	const explicit = process.env[ASTRAVIA_HOME_ENV];
	if (explicit) return expandTilde(explicit);
	return join(homedir(), getAstraviaConfigDirName());
}

export function getActionRpcEndpointFilePath(): string {
	const envPath = process.env[ACTION_RPC_ENDPOINT_FILE_ENV];
	if (envPath) return envPath;
	return join(getAstraviaHomePath(), "action-server.json");
}

function parseActionRpcEndpoint(value: unknown, endpointFilePath: string): ActionRpcEndpoint {
	if (typeof value !== "object" || value === null || Array.isArray(value)) {
		throw new Error(`Invalid action server endpoint file: ${endpointFilePath}`);
	}
	const input = value as Record<string, unknown>;
	if (
		input.transport !== "http" ||
		typeof input.url !== "string" ||
		input.url.length === 0 ||
		typeof input.token !== "string" ||
		input.token.length === 0
	) {
		throw new Error(`Invalid action server endpoint file: ${endpointFilePath}`);
	}
	return { transport: "http", url: input.url, token: input.token };
}

/** Read and validate the endpoint advertised by the running Desktop host. */
export async function readActionRpcEndpoint(): Promise<ActionRpcEndpoint> {
	const endpointFilePath = getActionRpcEndpointFilePath();
	const raw = await readFile(endpointFilePath, "utf8");
	return parseActionRpcEndpoint(JSON.parse(raw) as unknown, endpointFilePath);
}
