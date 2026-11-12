import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const workflow = readFileSync(join(import.meta.dirname, "../../.github/workflows/desktop-release.yml"), "utf8");
const packagedWorkflow = readFileSync(
	join(import.meta.dirname, "../../.github/workflows/desktop-packaged.yml"),
	"utf8",
);
const upgradeWorkflow = readFileSync(
	join(import.meta.dirname, "../../.github/workflows/desktop-upgrade-e2e.yml"),
	"utf8",
);

const require = createRequire(join(import.meta.dirname, "../../apps/desktop/package.json"));
const { parse } = require("yaml");
const jobs = parse(workflow).jobs;
const packagedJobs = parse(packagedWorkflow).jobs;
function actionSteps(name) {
	return parse(readFileSync(join(import.meta.dirname, `../../.github/actions/${name}/action.yml`), "utf8")).runs.steps;
}

describe("Desktop release workflow contracts", () => {
	it("downloads packaging inputs directly instead of restoring Actions caches", () => {
		expect(actionSteps("install-bun-dependencies").some((step) => step.uses?.startsWith("actions/cache"))).toBe(
			false,
		);
		expect(workflow).not.toContain("actions/cache");
		expect(workflow).not.toContain("desktop-download-cache");
		expect(workflow).not.toContain("prepare-desktop-resources");
		for (const job of [jobs.quality, jobs.build]) {
			const setupGo = job.steps.find((step) => step.uses === "actions/setup-go@v5");
			expect(setupGo.with.cache).toBe(false);
		}
	});

	it("publishes each platform's installers as soon as it is built", () => {
		expect(jobs.build.strategy["fail-fast"]).toBe(false);
		expect(Object.keys(jobs)).toEqual([
			"prepare",
			"quality",
			"build",
			"publish-update-metadata",
			"publish-r2",
			"publish-website",
			"deploy-website",
			"prune-r2",
		]);
		expect(workflow).not.toContain("release-build-");
		expect(workflow).not.toContain("test:e2e:packaged");
		// 单个平台构建不许等别的平台的产物；清单汇总在 publish-update-metadata 里做。
		expect(JSON.stringify(jobs.build)).not.toContain("download-artifact");
		expect(workflow).not.toContain("merge:updates:mac");
		const buildSteps = jobs.build.steps;
		const index = (name) => buildSteps.findIndex((step) => step.name === name);
		const build = index("Build updater artifacts");
		const verify = index("Verify updater artifacts");
		const rename = index("Name macOS update metadata per architecture");
		const upload = index("Upload updater artifacts");
		const github = index("Add installers to GitHub Release");
		expect(build).toBeLessThan(verify);
		expect(verify).toBeLessThan(rename);
		expect(rename).toBeLessThan(upload);
		expect(upload).toBeLessThan(github);
		expect(buildSteps[upload].with.name).toBe("desktop-$" + "{{ matrix.platform }}");
		expect(buildSteps[verify].if).toContain("runner.os != 'Windows'");
		expect(jobs.build.permissions).toEqual({ contents: "write" });
	});

	// 构建任务只上传安装包；清单上线集中在 desktop-publish-update-metadata。
	it("never publishes update metadata from a platform build", () => {
		const buildSteps = jobs.build.steps;
		expect(buildSteps.find((step) => step.name?.includes("R2"))).toBeUndefined();
		expect(JSON.stringify(jobs.build)).not.toContain("publish-update-artifacts-r2");
		expect(workflow).not.toContain("publish:updates:r2");
		const github = buildSteps.find((step) => step.name === "Add installers to GitHub Release");
		expect(github.run).toContain("publish-github-installers.mjs --platform desktop");
		expect(github.run).not.toContain(".yml");
		expect(github.run).not.toContain("--draft");
		expect(JSON.stringify(jobs.build)).not.toContain("verify-update-feed");
	});

	// 开源版客户端的更新源就是 GitHub Release 资产：客户端直接请求 v<版本> 下的
	// latest*.yml，缺清单时 electron-updater 报 ERR_UPDATER_CHANNEL_FILE_NOT_FOUND，
	// 用户点「检查更新」只会看到失败（0.5.78 的 Release 里只有安装包，就是这个现象）。
	it("attaches merged update metadata to the GitHub Release for the github target", () => {
		const publish = jobs["publish-update-metadata"];
		expect(publish.needs).toEqual(["prepare", "build"]);
		expect(publish.uses).toBe("./.github/workflows/desktop-publish-update-metadata.yml");
		expect(publish.if).toContain("needs.prepare.outputs.should-publish == 'true'");
		expect(publish.if).toContain("needs.prepare.outputs.release_target == 'github'");
		expect(publish.if).toContain("needs.prepare.outputs.channel != 'test'");
		expect(publish.if).not.toContain("always()");
		expect(publish.with.version).toBe("$" + "{{ needs.prepare.outputs.release-version }}");
		// 自动发布直接取当前 run 的产物；run_id 只留给补发历史版本。
		expect(publish.with.run_id).toBeUndefined();
		// workflow_call 只能降不能升：被调 workflow 声明的 scope 必须在这里先授出来。
		expect(publish.permissions).toEqual({ contents: "write", actions: "read" });

		const metadata = parse(
			readFileSync(join(import.meta.dirname, "../../.github/workflows/desktop-publish-update-metadata.yml"), "utf8"),
		);
		expect(Object.keys(metadata.on).sort()).toEqual(["workflow_call", "workflow_dispatch"]);
		for (const trigger of ["workflow_call", "workflow_dispatch"]) {
			expect(metadata.on[trigger].inputs.version.required).toBe(true);
			// run_id 默认空 → 从当前 run 取产物，不走跨 run 的 API 路径。
			expect(metadata.on[trigger].inputs.run_id.default).toBe("");
		}

		const steps = metadata.jobs.publish.steps;
		const position = (name) => steps.findIndex((step) => step.name === name);
		// 下载拆成「当前 run」与「别的 run」两步：只要传了 github-token，download-artifact 就
		// 走跨 run 的 API 路径并把空的 run-id 拼成 NaN（v0.5.79 首发真实踩到：清单没上 Release，
		// 旧版客户端「检查更新」一无所获），所以两条分支必须泾渭分明。
		const download = position("Download updater artifacts (this run)");
		const downloadOtherRun = position("Download updater artifacts (another run)");
		const merge = position("Merge macOS per-architecture metadata");
		const attach = position("Attach update metadata to GitHub Release");
		const verify = position("Verify update feed");
		for (const index of [download, downloadOtherRun, merge, attach, verify]) {
			expect(index).toBeGreaterThanOrEqual(0);
		}
		expect(steps[download].with.pattern).toBe("desktop-*");
		expect(steps[download].with["merge-multiple"]).toBe(true);
		// 自动发布走这条：不传 run-id，也不传 github-token（后者一传就换路径）。
		expect(steps[download].if).toBe("inputs.run_id == ''");
		expect(steps[download].with["run-id"]).toBeUndefined();
		expect(steps[download].with["github-token"]).toBeUndefined();
		// 补发历史版本走另一条：必须显式给 run-id 和 token。
		expect(steps[downloadOtherRun].if).toBe("inputs.run_id != ''");
		expect(steps[downloadOtherRun].with["run-id"]).toBe("$" + "{{ inputs.run_id }}");
		expect(download).toBeLessThan(downloadOtherRun);
		// 只许这两步。留下第三步无 if 的旧写法，自动发布时它会带着 token 和空 run-id 再跑
		// 一遍，把已经在前面成功下载好的产物换成 `Fetching artifact list for workflow run
		// NaN`（v0.5.80 首发就是这样：前一步拿到 4 个产物，后一步让整个 job 失败）。
		const downloadSteps = steps.filter((step) => String(step.uses ?? "").includes("actions/download-artifact"));
		expect(downloadSteps).toHaveLength(2);
		for (const step of downloadSteps) {
			expect(step.if).toBeTruthy();
		}
		expect(steps[downloadOtherRun].if).toBe("inputs.run_id != ''");
		expect(steps[downloadOtherRun].with["run-id"]).toBe("$" + "{{ inputs.run_id }}");
		expect(download).toBeLessThan(downloadOtherRun);
		expect(steps[download].with.pattern).toBe("desktop-*");
		expect(steps[download].with["merge-multiple"]).toBe(true);
		// arm64 与 x64 两份按架构命名的清单不合并，MacUpdater 会在其中一种架构上找不到 ZIP。
		expect(steps[merge].run).toContain("node scripts/merge-mac-update-metadata.mjs");
		expect(downloadOtherRun).toBeLessThan(merge);
		expect(merge).toBeLessThan(attach);
		expect(steps[attach].run).toContain("gh release upload");
		expect(steps[attach].run).toContain("latest*.yml");
		// 写进 Release 不等于用户拿得到：公网复核必须排在最后。
		expect(attach).toBeLessThan(verify);
		expect(steps[verify].run).toBe("node scripts/verify-update-feed.mjs");
		expect(steps[verify].env.ASTRAVIA_UPDATE_PROVIDER).toBe("github");
	});

	// GitHub Release 是历史归档；R2 只做当前桌面版本的下载镜像。官网等新镜像校验后
	// 切换版本，再清理旧目录，避免任何一段时间把用户导向 404。
	it("mirrors stable installers to R2, deploys the website, then prunes old versions", () => {
		const parsedWorkflow = parse(workflow);
		expect(parsedWorkflow.concurrency.group).toBe("desktop-release");
		expect(parsedWorkflow.concurrency["cancel-in-progress"]).toBe(false);
		const r2 = jobs["publish-r2"];
		expect(r2.needs).toEqual(["prepare", "build", "publish-update-metadata"]);
		expect(r2.uses).toBe("./.github/workflows/upload-release-to-r2.yml");
		expect(r2.with.version).toBe("$" + "{{ needs.prepare.outputs.release-version }}");
		expect(r2.with.patterns).toBe("*.AppImage,*.blockmap,*.deb,*.dmg,*.exe,*.msi,*.rpm,*.zip");
		expect(r2.with.prune_previous_versions).toBeUndefined();
		expect(r2.with.retention_group).toBe("desktop-app");
		expect(r2.secrets).toBe("inherit");

		const website = jobs["publish-website"];
		expect(website.needs).toEqual(["prepare", "publish-r2"]);
		expect(JSON.stringify(website)).toContain("bump-website-version.mjs");
		const websiteCheckout = website.steps.find((step) => step.uses === "actions/checkout@v4");
		expect(websiteCheckout.with.ref).toBe("$" + "{{ github.event.repository.default_branch }}");
		const websitePublish = website.steps.find((step) => step.id === "publish");
		expect(websitePublish.env.BASE_BRANCH).toBe("$" + "{{ github.event.repository.default_branch }}");
		expect(websitePublish.run).toContain('"origin/${BASE_BRANCH}"');
		expect(websitePublish.run).toContain('gh pr create --base "${BASE_BRANCH}"');
		expect(websitePublish.run).not.toContain("--base dev");
		expect(websitePublish.run).not.toContain("origin/main");
		const deploy = jobs["deploy-website"];
		expect(deploy.needs).toEqual(["prepare", "publish-website"]);
		expect(deploy.uses).toBe("./.github/workflows/deploy-website.yml");
		expect(deploy.with.ref).toBe("$" + "{{ needs.publish-website.outputs.ref }}");
		expect(deploy.permissions).toEqual({ contents: "read" });

		const pruneR2 = jobs["prune-r2"];
		expect(pruneR2.needs).toEqual(["prepare", "deploy-website"]);
		expect(pruneR2.uses).toBe("./.github/workflows/upload-release-to-r2.yml");
		expect(pruneR2.with.version).toBe("$" + "{{ needs.prepare.outputs.release-version }}");
		expect(pruneR2.with.upload_assets).toBe(false);
		expect(pruneR2.with.prune_previous_versions).toBe(true);
		expect(pruneR2.with.retention_group).toBe("desktop-app");
		expect(pruneR2.secrets).toBe("inherit");

		expect(jobs.promote).toBeUndefined();
		expect(workflow).not.toContain("./.github/workflows/desktop-promote.yml");
		const inputs = parse(workflow).on.workflow_dispatch.inputs;
		expect(inputs.release_target).toBeUndefined();
		expect(inputs.r2_prefix).toBeUndefined();
		expect(inputs.auto_promote).toBeUndefined();
		expect(inputs.cloud_enabled).toBeUndefined();
		expect(inputs.server_url).toBeUndefined();
		expect(inputs.site_url).toBeUndefined();
		expect(inputs.update_url).toBeUndefined();
		expect(jobs["publish-update-metadata"].uses).toBe("./.github/workflows/desktop-publish-update-metadata.yml");
		const r2Workflow = parse(
			readFileSync(join(import.meta.dirname, "../../.github/workflows/upload-release-to-r2.yml"), "utf8"),
		);
		const websiteWorkflow = parse(
			readFileSync(join(import.meta.dirname, "../../.github/workflows/deploy-website.yml"), "utf8"),
		);
		expect(r2Workflow.on.release).toBeUndefined();
		expect(websiteWorkflow.on.release).toBeUndefined();
		const websiteSteps = websiteWorkflow.jobs.deploy.steps;
		const domainCheck = websiteSteps.findIndex((step) => step.name === "Verify download domain resolves");
		const websiteDeploy = websiteSteps.findIndex((step) => step.name === "Deploy to Aliyun server");
		expect(domainCheck).toBeGreaterThanOrEqual(0);
		expect(domainCheck).toBeLessThan(websiteDeploy);
		expect(websiteSteps[domainCheck].run).toContain("getent ahosts dl.officebuddy.work");
		expect(websiteWorkflow.on.push.branches).toEqual(["wayne"]);
		expect(r2Workflow.on.workflow_call.inputs.prune_previous_versions.default).toBe(false);
		expect(r2Workflow.on.workflow_call.inputs.upload_assets.default).toBe(true);
		expect(r2Workflow.on.workflow_call.inputs.retention_group.default).toBe("");
		expect(r2Workflow.on.workflow_call.inputs.public_base_url.default).toBe("https://dl.officebuddy.work");
		expect(r2Workflow.concurrency.group).toContain("inputs.retention_group");
		expect(r2Workflow.concurrency["cancel-in-progress"]).toBe(false);

		const r2Steps = r2Workflow.jobs.upload.steps;
		const position = (name) => r2Steps.findIndex((step) => step.name === name);
		const upload = position("Upload assets to R2");
		const verify = position("Verify uploaded assets");
		const verifyPublic = position("Verify public download URLs");
		const prune = position("Prune previous version directories");
		expect(upload).toBeGreaterThanOrEqual(0);
		expect(upload).toBeLessThan(verify);
		expect(verify).toBeLessThan(verifyPublic);
		expect(verifyPublic).toBeLessThan(prune);
		expect(r2Steps[upload].run).toContain("rclone copy");
		expect(r2Steps[upload].run).not.toContain("rclone copyto");
		expect(r2Steps[upload].if).toBe("inputs.upload_assets != false");
		expect(r2Steps[verify].run).toContain("rclone check");
		expect(r2Steps[verify].if).toBe("inputs.upload_assets != false");
		expect(r2Steps[verifyPublic].run).toContain("curl --fail");
		expect(r2Steps[verifyPublic].env.PUBLIC_BASE_URL).toBe("$" + "{{ inputs.public_base_url }}");
		expect(r2Steps[prune].if).toBe("inputs.prune_previous_versions == true");
		expect(r2Steps[prune].run).toContain("r2-version-retention.mjs");
		expect(r2Steps[prune].run).toContain("rclone purge");
	});

	it("runs quality and packaging tests before the platform matrix", () => {
		expect(workflow).toContain("  quality:");
		expect(workflow).toMatch(/run: bun run check:full\r?\n/);
		expect(workflow).toContain("run: bun run test:quality");
		expect(workflow).toContain("run: bun run verify:desktop:contracts");
		expect(workflow).toContain("run: bun run test:desktop:packaging");
		expect(workflow).toContain("needs: [prepare, quality]");
	});

	it("downloads and verifies the pinned Windows sandbox release before packaging", () => {
		const sandboxSteps = actionSteps("prepare-windows-sandbox");
		expect(sandboxSteps).toHaveLength(1);
		const [download] = sandboxSteps;
		expect(download.env.SANDBOX_REPOSITORY).toBe("maomaochong-ai/codex");
		expect(download.env.SANDBOX_TAG).toMatch(/^astravia-sandbox-v\d+\.\d+\.\d+$/);
		expect(download.env.SANDBOX_COMMIT).toMatch(/^[0-9a-f]{40}$/);
		expect(download.env.SANDBOX_ARCHIVE_SHA256).toMatch(/^[0-9a-f]{64}$/);
		expect(download.run).toContain("SHA-256 mismatch");
		expect(download.run).toContain("$manifest.commit -ne $env:SANDBOX_COMMIT");
		expect(download.run).toContain("--capabilities --json");
		expect(JSON.stringify(sandboxSteps)).not.toMatch(/cargo|rust-toolchain|actions\/checkout/);

		for (const buildSteps of [jobs.build.steps, packagedJobs.smoke.steps]) {
			const sandbox = buildSteps.findIndex((step) => step.uses === "./.github/actions/prepare-windows-sandbox");
			expect(sandbox).toBeGreaterThanOrEqual(0);
			expect(buildSteps[sandbox].if).toBe("runner.os == 'Windows'");
			expect(sandbox).toBeLessThan(buildSteps.findIndex((step) => step.name === "Set up Bun"));
		}
	});

	it("keeps the pull-request packaged E2E matrix cross-platform", () => {
		expect(packagedWorkflow).toContain("runner: windows-latest");
		expect(packagedWorkflow).toContain("runner: macos-latest");
		expect(packagedWorkflow).toContain("runner: ubuntu-latest");
		expect(packagedWorkflow).toContain("bun run test:e2e:packaged");
		expect(packagedWorkflow).toContain("xvfb-run --auto-servernum");
	});

	it("installs Linux bubblewrap build dependencies in packaged and release builds", () => {
		for (const workflowSource of [packagedWorkflow, workflow]) {
			expect(workflowSource).toContain("Install Linux packaging dependencies");
			expect(workflowSource).toContain("if: runner.os == 'Linux'");
			expect(workflowSource).toContain("build-essential libcap-dev meson ninja-build pkg-config xz-utils");
		}
	});

	it("builds and uploads all Linux release formats", () => {
		expect(workflow).toContain("command: dist:linux");
		expect(workflow).toContain("pkg-config xz-utils rpm");
		expect(workflow).toContain("apps/desktop/release/*.AppImage");
		expect(workflow).toContain("apps/desktop/release/*.deb");
		expect(workflow).toContain("apps/desktop/release/*.rpm");
	});

	it("keeps pull-request Linux packaging on the AppImage smoke target", () => {
		expect(packagedWorkflow).toContain("command: dist:linux:test");
		const desktopPackage = JSON.parse(
			readFileSync(join(import.meta.dirname, "../../apps/desktop/package.json"), "utf8"),
		);
		expect(desktopPackage.scripts["dist:linux:test"]).toContain("dist:linux:appimage");
	});

	it("builds and uploads all Windows release formats", () => {
		expect(workflow).toContain("command: dist:win");
		expect(workflow).toContain("apps/desktop/release/*.exe");
		expect(workflow).toContain("apps/desktop/release/*.msi");
		expect(workflow).toContain("apps/desktop/release/*.zip");

		const desktopPackage = JSON.parse(
			readFileSync(join(import.meta.dirname, "../../apps/desktop/package.json"), "utf8"),
		);
		expect(desktopPackage.scripts["dist:win"]).toBe("bun run package:win");
		expect(desktopPackage.scripts["package:win"]).toMatch(/--platform win$/);
	});

	it("keeps pull-request Windows packaging on the unpacked smoke target", () => {
		expect(packagedWorkflow).toContain("build-command: pack:win:test");
		const desktopPackage = JSON.parse(
			readFileSync(join(import.meta.dirname, "../../apps/desktop/package.json"), "utf8"),
		);
		expect(desktopPackage.scripts["pack:win:test"]).toContain("pack:win");
	});

	it("installs the Electron audio runtime required by Ubuntu 24.04", () => {
		const packagedSmokeJob = packagedWorkflow.split("\n  smoke:\n")[1];
		expect(packagedSmokeJob).toBeDefined();
		expect(packagedSmokeJob).toContain("Install Linux Electron runtime dependencies");
		expect(packagedSmokeJob).toContain("libasound2t64");
	});

	it("installs the IM gateway Go toolchain from its module declaration", () => {
		const packagedSmokeJob = packagedWorkflow.split("\n  smoke:\n")[1];
		const releaseBuildJob = workflow.split("\n  build:\n")[1];
		for (const jobSource of [packagedSmokeJob, releaseBuildJob]) {
			expect(jobSource).toBeDefined();
			expect(jobSource).toContain("Set up Go for IM gateway");
			expect(jobSource).toContain("uses: actions/setup-go@v5");
			expect(jobSource).toContain("go-version-file: apps/im-gateway/go.mod");
		}
		expect(packagedSmokeJob).toContain("cache-dependency-path: apps/im-gateway/go.sum");
	});

	it("uses the same GitHub publish jobs for tagged and manually dispatched stable releases", () => {
		const inputs = parse(workflow).on.workflow_dispatch.inputs;
		expect(inputs.channel.options).toEqual(["default", "stable"]);
		expect(inputs.build_version).toBeUndefined();
		expect(workflow).toContain("should-publish: $" + "{{ steps.config.outputs.should_publish }}");
		expect(workflow).toContain("needs.prepare.outputs.should-publish == 'true'");
		expect(workflow).toContain("environment: desktop-production");
		expect(workflow).toContain("OUTPUT_BUILD_VERSION");
		expect(workflow).toContain("REQUIRE_RELEASE_SIGNATURE");
		expect(workflow).toContain("needs.prepare.outputs.should-publish == 'true'");
		const github = jobs.build.steps.find((step) => step.name === "Add installers to GitHub Release");
		expect(github.env.RELEASE_VERSION).toBe("$" + "{{ needs.prepare.outputs.release-version }}");
	});

	// im-gateway 的 sidecar 由 prepare-pack.js 交叉编译进发布包，但它的 Go 测试
	// 既不在 `bun run check` 里，im-gateway.yml 也不 gate 本流水线。少了这道门禁，
	// 测试失败的 sidecar 会被静默打包发布。
	it("gates the release on the IM gateway Go tests", () => {
		const qualityJob = workflow.slice(workflow.indexOf("\n  quality:"), workflow.indexOf("\n  build:"));
		expect(qualityJob).toContain("go test ./...");
		expect(qualityJob).toContain("working-directory: apps/im-gateway");
		expect(qualityJob).toContain("go-version-file: apps/im-gateway/go.mod");
	});

	it("builds each macOS architecture on a matching hosted runner", () => {
		expect(workflow).toContain("runs-on: $" + "{{ matrix.runner }}");
		expect(workflow).toContain("runner: macos-15\n");
		expect(workflow).toContain("runner: macos-15-intel\n");
		expect(workflow).not.toContain("astravia-mac");
	});

	it("allows enough wall clock for signing and notarizing both macOS architectures", () => {
		const buildJob = workflow.slice(workflow.indexOf("\n  build:"));
		const timeout = Number(buildJob.match(/timeout-minutes: (\d+)/)?.[1]);
		expect(timeout).toBeGreaterThanOrEqual(120);
	});

	it("publishes stable desktop artifacts to GitHub Release before mirroring them to R2", () => {
		expect(workflow).toContain("- name: Add installers to GitHub Release");
		expect(workflow).toContain("needs.prepare.outputs.channel != 'test'");
		expect(jobs["publish-r2"].needs).toContain("publish-update-metadata");
		expect(jobs["prune-r2"].needs).toContain("deploy-website");
		expect(jobs["prune-r2"].with.prune_previous_versions).toBe(true);
	});

	it("uses the versioned release note as the GitHub Release body", () => {
		expect(workflow).toContain("node scripts/release/release-notes.mjs --check");
		expect(workflow).toContain("node scripts/release/publish-github-installers.mjs");
		expect(workflow).not.toContain("--generate-notes");
		// 正文缺失要在质量阶段就失败，而不是等平台矩阵签名公证跑完。
		const qualityJob = workflow.slice(workflow.indexOf("\n  quality:"), workflow.indexOf("\n  build:"));
		expect(qualityJob).toContain("node scripts/release/release-notes.mjs --check");
	});

	it("provides an isolated test-channel workflow for real install and restart upgrades", () => {
		expect(upgradeWorkflow).toContain("baseline_version:");
		expect(upgradeWorkflow).toContain("candidate_version:");
		expect(upgradeWorkflow).toContain("environment: desktop-test");
		expect(upgradeWorkflow).toContain("bun run test:e2e:upgrade");
		expect(upgradeWorkflow).toContain("xvfb-run --auto-servernum");
		expect(upgradeWorkflow).toContain("upgrade-e2e-diagnostics");
	});
});
