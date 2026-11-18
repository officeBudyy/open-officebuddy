import type { SessionContextRecord } from "@astravia/runtime-core/kernel";

export const TEAM_TASK_COMPLETED_CONTEXT_TYPE = "agent-team.task-completed.v1";

export interface TeamTaskCompletionNotificationInput {
	readonly teamTaskId: string;
	readonly assignedToParticipantId: string;
	readonly requestTurnId: string;
	readonly resultMessageId: string;
	readonly resultText: string;
	/** 成员进展汇总 md 的路径；存在时告知模型，便于在回复里向用户指出复盘文件。 */
	readonly progressSummaryPath?: string;
	readonly timestamp?: number;
}

export interface TeamTaskCompletionNotificationPort {
	deliverSessionContext(
		sessionId: string,
		records: readonly SessionContextRecord[],
		mode: "triggerTurn",
	): Promise<void>;
}

/** Creates the model-visible completion signal delivered to the task initiator. */
export function createTeamTaskCompletionNotification(input: TeamTaskCompletionNotificationInput): SessionContextRecord {
	const timestamp = input.timestamp ?? Date.now();
	const payload = {
		event: "team-task-completed",
		teamTaskId: input.teamTaskId,
		assignedToParticipantId: input.assignedToParticipantId,
		requestTurnId: input.requestTurnId,
		resultMessageId: input.resultMessageId,
		resultText: input.resultText,
		...(input.progressSummaryPath ? { progressSummaryPath: input.progressSummaryPath } : {}),
	};
	return {
		type: TEAM_TASK_COMPLETED_CONTEXT_TYPE,
		content: [
			{
				type: "text",
				text: `Agent Team task completed. Treat the following as a status notification and integrate the published result:${
					input.progressSummaryPath
						? `\nPer-member progress journals and the closing summary were written under: ${input.progressSummaryPath}. When useful for the user, mention this review file in your reply.`
						: ""
				}\n${JSON.stringify(payload)}`,
			},
		],
		modelVisible: true,
		display: false,
		timestamp,
		metadata: payload,
	};
}

export function deliverTeamTaskCompletionNotification(
	port: TeamTaskCompletionNotificationPort,
	initiatorSessionId: string,
	input: TeamTaskCompletionNotificationInput,
): Promise<void> {
	return port.deliverSessionContext(initiatorSessionId, [createTeamTaskCompletionNotification(input)], "triggerTurn");
}
