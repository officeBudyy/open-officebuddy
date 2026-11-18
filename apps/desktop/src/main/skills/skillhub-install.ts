/**
 * 从 SkillHub 归档（zip）安装技能。
 *
 * 与官方市场归档（tar.gz）不同：SkillHub 下发的是 zip，且 zip 根目录直接是技能目录
 * （SKILL.md 位于根层或唯一一层子目录）。这里按 frontmatter 的 name 落盘到技能目录，
 * 清单记为 market 来源，并保留 SkillHub 的展示名与版本，供能力页展示。
 */
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { mkdir, rm } from "node:fs/promises";
import { dirname, join } from "node:path";
import { getAstraviaHomePath } from "@astravia/action-rpc";
import AdmZip from "adm-zip";
import { recordAbilityInstall } from "../abilities/ability-ledger.js";
import { parseFrontmatter, rewriteFrontmatterDescription } from "./skill-frontmatter.js";
import {
	ensureDirWritable,
	getSkillBaseDir,
	readSkillsManifest,
	recordSkillResourceEvent,
	writeSkillsManifest,
} from "./skill-service.js";

const tmpBaseDir = join(getAstraviaHomePath(), "tmp");
/** frontmatter.name 的落盘约束，与 import-custom 保持一致。 */
const SKILL_NAME_PATTERN = /^[a-z0-9-]{1,64}$/;

function findShallowestSkillMd(rootDir: string): string | null {
	const walk = (dir: string, depth: number): { path: string; depth: number } | null => {
		let entries: string[];
		try {
			entries = readdirSync(dir);
		} catch {
			return null;
		}
		const direct = entries.find((entry) => entry === "SKILL.md");
		if (direct) return { path: join(dir, direct), depth };
		let best: { path: string; depth: number } | null = null;
		for (const entry of entries) {
			const child = join(dir, entry);
			try {
				if (!statSync(child).isDirectory()) continue;
			} catch {
				continue;
			}
			const found = walk(child, depth + 1);
			if (found && (!best || found.depth < best.depth)) best = found;
		}
		return best;
	};
	return walk(rootDir, 0)?.path ?? null;
}

export interface SkillhubInstallResult {
	name: string;
	type: "skill" | "scene";
	version: string;
	updated: boolean;
}

export async function installSkillhubArchive(
	slug: string,
	buffer: Buffer,
	meta: { displayName?: string; description?: string; version?: string } = {},
): Promise<SkillhubInstallResult> {
	if (buffer.length < 2) throw new Error("压缩包内容为空或格式无效");
	if (!(buffer[0] === 0x50 && buffer[1] === 0x4b)) throw new Error("仅支持 zip 格式的技能归档");

	await mkdir(tmpBaseDir, { recursive: true });
	const stamp = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
	const extractDir = join(tmpBaseDir, `_skillhub_${stamp}`);
	await mkdir(extractDir, { recursive: true });

	try {
		new AdmZip(buffer).extractAllTo(extractDir, true);

		const skillMdPath = findShallowestSkillMd(extractDir);
		if (!skillMdPath) throw new Error("压缩包中未找到 SKILL.md");
		const frontmatter = parseFrontmatter(readFileSync(skillMdPath, "utf-8"));
		const name = frontmatter.name?.trim() || slug;
		if (!SKILL_NAME_PATTERN.test(name)) {
			throw new Error(`技能名不合法：${name}（仅允许小写字母、数字、连字符，1–64 字符）`);
		}

		const type: "skill" | "scene" = frontmatter.type === "scene" ? "scene" : "skill";
		const baseDir = getSkillBaseDir(type);
		mkdirSync(baseDir, { recursive: true });
		ensureDirWritable(baseDir);

		const targetDir = join(baseDir, name);
		const manifest = readSkillsManifest();
		const previous = manifest[name];
		if (existsSync(targetDir)) {
			ensureDirWritable(targetDir);
			await rm(targetDir, { recursive: true, force: true });
		}
		cpSync(dirname(skillMdPath), targetDir, { recursive: true });

		// 与 import-custom 同口径：把 description 规范化成 double-quoted，避免 `:` 打断 YAML。
		try {
			const targetSkillMd = join(targetDir, "SKILL.md");
			const original = readFileSync(targetSkillMd, "utf-8");
			const normalized = rewriteFrontmatterDescription(
				original,
				meta.description?.trim() || frontmatter.description || "",
			);
			if (normalized !== original) writeFileSync(targetSkillMd, normalized, "utf-8");
		} catch {
			// 规范化失败不阻塞安装
		}

		const version = meta.version?.trim() || frontmatter.version || "0.0.0";
		manifest[name] = {
			name,
			version,
			installedAt: new Date().toISOString(),
			source: "market",
			enabled: true,
			type,
			...(meta.displayName?.trim() ? { alias: meta.displayName.trim() } : {}),
			...(meta.description?.trim() ? { marketDescription: meta.description.trim() } : {}),
		};
		writeSkillsManifest(manifest);
		recordAbilityInstall(type, name, version);
		recordSkillResourceEvent({
			name,
			type,
			source: "market",
			operation: previous ? "updated" : "installed",
		});

		return { name, type, version, updated: Boolean(previous) };
	} finally {
		await rm(extractDir, { recursive: true, force: true }).catch(() => undefined);
	}
}
