import { appendFile, mkdir, readFile } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import type { TeamSessionDocument, TeamWorkItem } from "@astravia/agent-team";
import { getAppLogger } from "../logger.js";

const log = getAppLogger("agent-team-progress");

/** 成员进展条目的终态集合；waiting 表示本轮未产出最终结果。 */
export type TeamProgressEntryState = "started" | "completed" | "failed" | "cancelled" | "waiting";

export interface TeamProgressEntry {
	readonly memberId: string;
	readonly memberName: string;
	readonly memberRole?: string;
	readonly state: TeamProgressEntryState;
	/** 本轮目标（委派任务原文），started 时必带。 */
	readonly objective?: string;
	/** 结果正文或失败原因。 */
	readonly detail?: string;
	readonly mode?: string;
	readonly timestamp?: number;
}

const STATE_LABELS: Readonly<Record<TeamProgressEntryState, string>> = {
	started: "开始",
	completed: "完成",
	failed: "失败",
	cancelled: "已取消",
	waiting: "等待重试",
};

/** 进展文件根目录：<工作目录>/agent-team-progress/<会话 id>/。 */
export function teamProgressDir(session: Pick<TeamSessionDocument, "id" | "cwd">): string {
	return join(session.cwd, "agent-team-progress", session.id);
}

export function teamProgressSummaryPath(session: Pick<TeamSessionDocument, "id" | "cwd">): string {
	return join(teamProgressDir(session), "summary.md");
}

function memberProgressPath(session: Pick<TeamSessionDocument, "id" | "cwd">, memberId: string): string {
	// memberId 是团队内部标识（uuid/handle），字符集受限；防御性过滤一次，防止异常值写穿目录。
	const safe = memberId.replace(/[^a-zA-Z0-9_-]/g, "_");
	return join(teamProgressDir(session), `${safe}.md`);
}

/** 追加一条成员进展到按角色拆分的 md 文件。失败只记日志：进展文件是过程观测产物，
 * 绝不能反过来影响团队主流程；非绝对 cwd（测试桩、异常数据）直接跳过，避免把文件
 * 写进进程工作目录。 */
export async function appendTeamMemberProgress(
	session: Pick<TeamSessionDocument, "id" | "cwd">,
	entry: TeamProgressEntry,
): Promise<void> {
	if (!isAbsolute(session.cwd)) return;
	try {
		const path = memberProgressPath(session, entry.memberId);
		const timestamp = new Date(entry.timestamp ?? Date.now());
		const lines: string[] = [];
		try {
			await readFile(path, "utf8");
		} catch {
			// 首次写入：落成员档案头。
			lines.push(`# ${entry.memberName} 工作进展`, "");
			lines.push(`- 团队会话：\`${session.id}\``);
			if (entry.memberRole) lines.push(`- 角色：${entry.memberRole}`);
			lines.push("");
		}
		lines.push(`## ${formatTimestamp(timestamp)} · ${STATE_LABELS[entry.state]}`);
		if (entry.mode) lines.push(`- 模式：${entry.mode}`);
		if (entry.objective) lines.push(`- 目标：${compact(entry.objective, 400)}`);
		if (entry.detail) lines.push("", compact(entry.detail, 4_000));
		lines.push("");
		await mkdir(join(path, ".."), { recursive: true });
		await appendFile(path, `${lines.join("\n")}\n`, "utf8");
	} catch (error) {
		log.warn("team member progress append failed", {
			teamSessionId: session.id,
			memberId: entry.memberId,
			error: error instanceof Error ? error.message : String(error),
		});
	}
}

/**
 * 任务收尾时生成汇总：把每位成员的完整进展文件收进 summary.md，并附工作项清单。
 * 返回汇总文件路径；写失败时返回 undefined（同样不影响主流程）。
 */
export async function writeTeamProgressSummary(
	session: Pick<TeamSessionDocument, "id" | "cwd">,
	workItems: readonly TeamWorkItem[],
	memberNames: Readonly<Record<string, string>> = {},
): Promise<string | undefined> {
	if (!isAbsolute(session.cwd)) return undefined;
	try {
		const directory = teamProgressDir(session);
		const sections: string[] = [
			"# 团队任务进展汇总",
			"",
			`- 团队会话：\`${session.id}\``,
			`- 生成时间：${formatTimestamp(new Date())}`,
			"",
		];
		sections.push("## 工作项", "");
		if (workItems.length === 0) sections.push("（无工作项记录）", "");
		for (const item of workItems) {
			const owner = memberNames[item.assignedToParticipantId] ?? item.assignedToParticipantId;
			sections.push(
				`- [${item.state}] ${compact(item.objective, 200)}（执行：${owner}，更新于 ${formatTimestamp(new Date(item.updatedAt))}）`,
			);
		}
		sections.push("", "## 成员进展明细", "");
		const memberIds = [...new Set(workItems.map((item) => item.assignedToParticipantId))];
		if (memberIds.length === 0) sections.push("（无成员执行记录）", "");
		for (const memberId of memberIds) {
			const name = memberNames[memberId] ?? memberId;
			sections.push(`### ${name}`, "");
			try {
				const content = await readFile(memberProgressPath(session, memberId), "utf8");
				sections.push(content.trimEnd(), "");
			} catch {
				sections.push("（无进展记录）", "");
			}
		}
		const path = teamProgressSummaryPath(session);
		await mkdir(directory, { recursive: true });
		const { writeFile } = await import("node:fs/promises");
		await writeFile(path, `${sections.join("\n")}\n`, "utf8");
		return path;
	} catch (error) {
		log.warn("team progress summary write failed", {
			teamSessionId: session.id,
			error: error instanceof Error ? error.message : String(error),
		});
		return undefined;
	}
}

function compact(text: string, max: number): string {
	const normalized = text.replace(/\s+\n/g, "\n").trim();
	if (normalized.length <= max) return normalized;
	return `${normalized.slice(0, max)}…`;
}

function formatTimestamp(date: Date): string {
	const pad = (value: number): string => String(value).padStart(2, "0");
	return (
		`${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ` +
		`${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
	);
}
