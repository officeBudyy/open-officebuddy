#!/usr/bin/env node
// 发版准备侦察脚本：输出升版本号所需事实，只读，不修改任何文件。
// 用法：node .agents/skills/officebuddy-release/scripts/prepare-release.mjs [--version X.Y.Z]

import { execFileSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// 本脚本位于 <repo>/.agents/skills/officebuddy-release/scripts/，不依赖调用方 cwd。
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../../../");
const args = process.argv.slice(2);
const versionFlagIdx = args.indexOf("--version");
if (versionFlagIdx >= 0 && (!args[versionFlagIdx + 1] || args[versionFlagIdx + 1].startsWith("--"))) {
  console.error("ERROR: --version 后必须提供版本号");
  process.exit(1);
}
const explicitVersion = versionFlagIdx >= 0 ? args[versionFlagIdx + 1] : undefined;

function git(gitArgs, { quiet = false } = {}) {
  try {
    return execFileSync("git", gitArgs, {
      cwd: root,
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024,
      stdio: quiet ? ["ignore", "pipe", "ignore"] : "pipe",
    }).trim();
  } catch (err) {
    if (quiet) return "";
    throw err;
  }
}

function die(msg) {
  console.error(`ERROR: ${msg}`);
  process.exit(1);
}

const pkgPath = join(root, "apps/desktop/package.json");
if (!existsSync(pkgPath)) die(`未找到项目文件: ${pkgPath}`);
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const current = pkg.version;
if (!/^\d+\.\d+\.\d+(-\d+)?$/.test(current ?? "")) die(`apps/desktop/package.json version 格式异常: ${current}`);
let target = explicitVersion;
if (!target) {
  const [maj, min, patch] = current.replace(/-\d+$/, "").split(".").map(Number);
  target = `${maj}.${min}.${patch + 1}`;
}
if (!/^\d+\.\d+\.\d+(-\d+)?$/.test(target)) die(`目标版本号格式必须为 X.Y.Z 或 X.Y.Z-N: ${target}`);

const lastTag = git(["describe", "--tags", "--abbrev=0", "--match", "v*"], { quiet: true });
const tagged = lastTag !== "";
const status = git(["status", "--short"]);
const dirty = status.split("\n").filter(Boolean);
const logRange = tagged ? `${lastTag}..HEAD` : "HEAD";
const commits = git(["log", "--oneline", "--no-decorate", "-30", logRange]).split("\n").filter(Boolean);

const i18nGlob = "apps/desktop/src/shared/i18n/locales/*/*.json";
let i18nSummary = "";
if (tagged) {
  i18nSummary = git(["diff", "--stat", `${lastTag}..HEAD`, "--", i18nGlob]);
} else {
  i18nSummary = git(["diff", "--stat", "HEAD~10..HEAD", "--", i18nGlob], { quiet: true });
}

const notesPath = join(root, `.github/release-notes/v${target}.md`);
const notesExists = existsSync(notesPath);
let notesTampered = "";
if (tagged) {
  notesTampered = git(["log", "--oneline", `${lastTag}..HEAD`, "--", `.github/release-notes/v${lastTag.slice(1)}.md`], { quiet: true });
}

let websiteSync = "unknown";
try {
  const websitePkgPath = join(root, "website/package.json");
  if (existsSync(websitePkgPath)) {
    const websitePkg = JSON.parse(readFileSync(websitePkgPath, "utf8"));
    websiteSync = Object.hasOwn(websitePkg?.scripts ?? {}, "bump-website-version")
      ? "auto (bump-website-version 脚本存在；仍需确认其已挂入发布流程)"
      : "manual check required";
  }
} catch {
  websiteSync = "manual check required";
}

console.log("=== 发版准备报告（只读） ===\n");
console.log(`仓库:          ${root}`);
console.log(`当前版本:      ${current}`);
console.log(`目标版本:      ${target}${explicitVersion ? "（用户指定）" : "（建议 patch +1，需确认）"}`);
console.log(`上个版本 tag:  ${tagged ? lastTag : "未找到（提交范围仅显示最近 30 条）"}（仅检查本地 tag；如远端可能有新 tag，fetch 后重跑）`);
console.log(`官网版本同步:  ${websiteSync}\n`);
console.log(`未提交改动: ${dirty.length === 0 ? "无" : ""}`);
for (const line of dirty.slice(0, 20)) console.log(`  ${line}`);
if (dirty.length > 20) console.log(`  ... 还有 ${dirty.length - 20} 条`);
console.log(`\n自上个版本的提交（最多 30 条，范围 ${logRange}）:`);
for (const line of commits) console.log(`  ${line}`);
if (commits.length === 0) console.log("  （无）");
console.log("\ni18n locale diff（用户可见改动线索，非功能证明）:");
console.log(i18nSummary ? i18nSummary.split("\n").map((line) => `  ${line}`).join("\n") : "  （无）");
console.log(`\n发布说明 v${target}.md: ${notesExists ? "已存在（勿覆盖，确认后补充）" : "不存在（确认后新建）"}`);
if (notesTampered) {
  console.log(`\n⚠️ 上个版本发布说明在 tag 后被修改: ${lastTag.slice(1)}.md`);
  console.log(notesTampered.split("\n").map((line) => `  ${line}`).join("\n"));
  console.log("  → 需人工确认是否处理。\n");
}
console.log("后续建议: 确认变更归属与目标版本 → 按授权修改版本和发布说明 → 运行仓库发布说明检查与 resolve-desktop-release-config 验证。");
