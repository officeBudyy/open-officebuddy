import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	appendTeamMemberProgress,
	teamProgressDir,
	teamProgressSummaryPath,
	writeTeamProgressSummary,
} from "./team-progress-journal.js";

const cleanup: string[] = [];

afterEach(() => {
	// 记录目录交给系统临时目录回收；不主动 rm 避免触碰宿主的删除拦截。
	cleanup.length = 0;
});

function makeSession(): { id: string; cwd: string } {
	const cwd = join(tmpdir(), `team-progress-test-${Date.now()}-${Math.random().toString(36).slice(2)}`);
	cleanup.push(cwd);
	return { id: "session-1", cwd };
}

describe("team progress journal", () => {
	it("按成员写独立 md 文件并带档案头", async () => {
		const session = makeSession();
		await appendTeamMemberProgress(session, {
			memberId: "member-a",
			memberName: "架构师",
			memberRole: "负责整体设计",
			state: "started",
			objective: "设计模块 A",
			mode: "initial",
		});
		await appendTeamMemberProgress(session, {
			memberId: "member-a",
			memberName: "架构师",
			state: "completed",
			detail: "模块 A 已完成",
		});

		const content = await readFile(join(teamProgressDir(session), "member-a.md"), "utf8");
		expect(content).toContain("# 架构师 工作进展");
		expect(content).toContain("- 角色：负责整体设计");
		expect(content).toContain("· 开始");
		expect(content).toContain("- 目标：设计模块 A");
		expect(content).toContain("· 完成");
		expect(content).toContain("模块 A 已完成");
		// 第二条不应再重复档案头。
		expect(content.match(/# 架构师 工作进展/gu)).toHaveLength(1);
	});

	it("不安全字符的 memberId 会被过滤，文件名保持受限字符集", async () => {
		const session = makeSession();
		await appendTeamMemberProgress(session, {
			memberId: "../evil",
			memberName: "X",
			state: "started",
		});
		const content = await readFile(join(teamProgressDir(session), "___evil.md"), "utf8");
		expect(content).toContain("· 开始");
	});

	it("summary 汇总工作项与成员进展明细", async () => {
		const session = makeSession();
		await appendTeamMemberProgress(session, {
			memberId: "member-a",
			memberName: "架构师",
			state: "completed",
			detail: "A 完成",
		});
		const path = await writeTeamProgressSummary(
			session,
			[
				{
					id: "work-1",
					state: "completed",
					objective: "实现功能 A",
					assignedToParticipantId: "member-a",
					updatedAt: Date.now(),
				} as unknown as Parameters<typeof writeTeamProgressSummary>[1][number],
			],
			{ "member-a": "架构师" },
		);
		expect(path).toBe(teamProgressSummaryPath(session));
		const summary = await readFile(path!, "utf8");
		expect(summary).toContain("# 团队任务进展汇总");
		expect(summary).toContain("- [completed] 实现功能 A（执行：架构师");
		expect(summary).toContain("### 架构师");
		expect(summary).toContain("A 完成");
	});

	it("summary 在无进展记录时也不抛错", async () => {
		const session = makeSession();
		const path = await writeTeamProgressSummary(session, [], {});
		expect(path).toBe(teamProgressSummaryPath(session));
		const summary = await readFile(path!, "utf8");
		expect(summary).toContain("（无工作项记录）");
		expect(summary).toContain("（无成员执行记录）");
	});
});
