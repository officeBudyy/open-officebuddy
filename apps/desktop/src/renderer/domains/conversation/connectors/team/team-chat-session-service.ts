import type {
	AgentTeamDocument,
	TeamSessionListItem,
	TeamSessionReference,
	TeamSessionWorkspaceSelection,
} from "@astravia/agent-team";
import type { SessionExecutionMode } from "@astravia/runtime-core";
import type { DesktopTeamSessionSnapshot } from "@preload/api-types/team-conversation-display";

const SESSION_STORAGE_PREFIX = "astravia.agent-team.session.";
const WORKSPACE_STORAGE_PREFIX = "astravia.agent-team.workspace.";
const pendingSessionCreations = new Map<string, Promise<LoadedTeamChatSession>>();

/**
 * 团队会话的工作目录在创建后不可变；这里按团队记住用户最近一次选择的
 * 项目空间，让「从团队列表直接打开」这类不经过新会话页的入口也能落到
 * 用户期望的项目目录，而不是每次都新建团队私有目录。
 */
export function readLastTeamWorkspace(teamId: string): TeamSessionWorkspaceSelection | undefined {
	try {
		const stored = window.localStorage.getItem(`${WORKSPACE_STORAGE_PREFIX}${teamId}`);
		if (!stored) return undefined;
		const parsed: unknown = JSON.parse(stored);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"path" in parsed &&
			typeof parsed.path === "string" &&
			parsed.path.length > 0
		) {
			return { kind: "project", path: parsed.path };
		}
	} catch {
		// 损坏的记录按「没有记忆」处理。
	}
	return undefined;
}

export function writeLastTeamWorkspace(teamId: string, selection: TeamSessionWorkspaceSelection | undefined): void {
	const storageKey = `${WORKSPACE_STORAGE_PREFIX}${teamId}`;
	if (!selection || selection.kind !== "project") {
		window.localStorage.removeItem(storageKey);
		return;
	}
	window.localStorage.setItem(storageKey, JSON.stringify(selection));
}

export interface LoadedTeamChatSession {
	readonly document?: AgentTeamDocument;
	readonly snapshot: DesktopTeamSessionSnapshot;
	readonly sessions: readonly TeamSessionListItem[];
}

export interface TeamChatBootstrap {
	readonly document: AgentTeamDocument;
	readonly sessions: readonly TeamSessionListItem[];
}

export interface CreateReservedTeamChatSessionOptions {
	readonly teamId: string;
	readonly sessionId: string;
	readonly executionMode: SessionExecutionMode;
	readonly document?: AgentTeamDocument;
	readonly workspace?: TeamSessionWorkspaceSelection;
}

export async function loadTeamChatBootstrap(teamId: string): Promise<TeamChatBootstrap> {
	const [document, sessions] = await Promise.all([
		window.astravia.agentTeams.list(),
		window.astravia.agentTeams.listSessions(teamId),
	]);
	if (!document.teams.some((team) => team.id === teamId)) {
		throw new Error(`Agent team not found: ${teamId}`);
	}
	return { document, sessions };
}

export async function loadTeamChatSession(teamId: string, preferredSessionId?: string): Promise<LoadedTeamChatSession> {
	const { document, sessions } = await loadTeamChatBootstrap(teamId);
	const storageKey = `${SESSION_STORAGE_PREFIX}${teamId}`;
	const preferred = preferredSessionId ? sessions.find((session) => session.id === preferredSessionId) : undefined;
	if (preferredSessionId && !preferred) throw new Error(`Agent Team session not found: ${preferredSessionId}`);
	const stored = window.localStorage.getItem(storageKey);
	if (preferred) return openTeamChatSession(document, sessions, storageKey, preferred);
	if (stored) {
		try {
			return await openTeamChatSession(document, sessions, storageKey, parseStoredReference(stored));
		} catch {
			window.localStorage.removeItem(storageKey);
		}
	}
	if (sessions[0]) return openTeamChatSession(document, sessions, storageKey, sessions[0]);

	return createTeamChatSession(teamId, document, sessions);
}

export async function createTeamChatSession(
	teamId: string,
	document?: AgentTeamDocument,
	knownSessions: readonly TeamSessionListItem[] = [],
	/** 传 undefined 沿用该团队最近一次选择；传 null 显式回到团队私有目录。 */
	workspace?: TeamSessionWorkspaceSelection | null,
): Promise<LoadedTeamChatSession> {
	const pending = pendingSessionCreations.get(teamId);
	if (pending) return pending;
	const effectiveWorkspace = workspace === undefined ? readLastTeamWorkspace(teamId) : workspace;
	writeLastTeamWorkspace(teamId, effectiveWorkspace ?? undefined);
	const creation = createTeamChatSessionInternal(teamId, document, knownSessions, effectiveWorkspace ?? undefined);
	pendingSessionCreations.set(teamId, creation);
	void creation.then(
		() => {
			if (pendingSessionCreations.get(teamId) === creation) pendingSessionCreations.delete(teamId);
		},
		() => {
			if (pendingSessionCreations.get(teamId) === creation) pendingSessionCreations.delete(teamId);
		},
	);
	return creation;
}

export async function createReservedTeamChatSession({
	teamId,
	sessionId,
	executionMode,
	document,
	workspace,
}: CreateReservedTeamChatSessionOptions): Promise<LoadedTeamChatSession> {
	const snapshot = await window.astravia.agentTeams.createSessionRecord(teamId, {
		sessionId,
		executionMode,
		...(workspace ? { workspace } : {}),
	});
	if (snapshot.session.id !== sessionId) throw new Error("Reserved Team session identity changed");
	if (workspace) writeLastTeamWorkspace(teamId, workspace);
	const storageKey = `${SESSION_STORAGE_PREFIX}${teamId}`;
	window.localStorage.setItem(storageKey, JSON.stringify(toReference(snapshot)));
	return {
		...(document ? { document } : {}),
		snapshot,
		sessions: withTeamChatSnapshot([], snapshot),
	};
}

async function createTeamChatSessionInternal(
	teamId: string,
	document?: AgentTeamDocument,
	knownSessions: readonly TeamSessionListItem[] = [],
	workspace?: TeamSessionWorkspaceSelection,
): Promise<LoadedTeamChatSession> {
	if (document && !document.teams.some((team) => team.id === teamId)) {
		throw new Error(`Agent team not found: ${teamId}`);
	}
	const createSessionRecord =
		window.astravia.agentTeams.createSessionRecord ?? window.astravia.agentTeams.createSession;
	const snapshot = workspace ? await createSessionRecord(teamId, { workspace }) : await createSessionRecord(teamId);
	const storageKey = `${SESSION_STORAGE_PREFIX}${teamId}`;
	window.localStorage.setItem(storageKey, JSON.stringify(toReference(snapshot)));
	return { ...(document ? { document } : {}), snapshot, sessions: withTeamChatSnapshot(knownSessions, snapshot) };
}

function toReference(snapshot: DesktopTeamSessionSnapshot): TeamSessionReference {
	const coordinationSessionPath = snapshot.session.coordinationRuntime?.sessionPath;
	if (!coordinationSessionPath) throw new Error("Team coordination Conversation is unavailable");
	return { id: snapshot.session.id, coordinationSessionPath };
}

async function openTeamChatSession(
	document: AgentTeamDocument,
	sessions: readonly TeamSessionListItem[],
	storageKey: string,
	reference: TeamSessionReference | TeamSessionListItem | string,
): Promise<LoadedTeamChatSession> {
	const ipcReference =
		typeof reference === "string"
			? reference
			: { id: reference.id, coordinationSessionPath: reference.coordinationSessionPath };
	const snapshot = await window.astravia.agentTeams.getSession(ipcReference);
	window.localStorage.setItem(storageKey, JSON.stringify(toReference(snapshot)));
	return { document, snapshot, sessions: withTeamChatSnapshot(sessions, snapshot) };
}

function parseStoredReference(value: string): TeamSessionReference | string {
	try {
		const parsed: unknown = JSON.parse(value);
		if (
			typeof parsed === "object" &&
			parsed !== null &&
			"id" in parsed &&
			typeof parsed.id === "string" &&
			"coordinationSessionPath" in parsed &&
			typeof parsed.coordinationSessionPath === "string"
		) {
			return { id: parsed.id, coordinationSessionPath: parsed.coordinationSessionPath };
		}
	} catch {
		// Previous releases stored only the legacy Team sidecar id.
	}
	return value;
}

export function withTeamChatSnapshot(
	sessions: readonly TeamSessionListItem[],
	snapshot: DesktopTeamSessionSnapshot,
): readonly TeamSessionListItem[] {
	const existing = sessions.find((session) => session.id === snapshot.session.id);
	const coordinationSessionPath =
		snapshot.session.coordinationRuntime?.sessionPath ?? existing?.coordinationSessionPath;
	if (!coordinationSessionPath) return sessions;
	const snapshotItem: TeamSessionListItem = {
		id: snapshot.session.id,
		coordinationSessionPath,
		title: snapshot.session.title ?? "",
		createdAt: snapshot.session.createdAt,
		updatedAt: snapshot.session.updatedAt,
	};
	const item =
		existing &&
		(existing.updatedAt > snapshotItem.updatedAt ||
			(existing.updatedAt === snapshotItem.updatedAt && existing.title && !snapshotItem.title))
			? existing
			: snapshotItem;
	return [item, ...sessions.filter((session) => session.id !== item.id)].sort(
		(left, right) => right.updatedAt - left.updatedAt,
	);
}

export function mergeTeamChatBootstrapSessions(
	bootstrap: readonly TeamSessionListItem[],
	current: readonly TeamSessionListItem[],
	activeSessionId: string | undefined,
): readonly TeamSessionListItem[] {
	if (!activeSessionId) return bootstrap;
	const currentActive = current.find((session) => session.id === activeSessionId);
	if (!currentActive) return bootstrap;
	const bootstrapActive = bootstrap.find((session) => session.id === activeSessionId);
	if (
		bootstrapActive &&
		(bootstrapActive.updatedAt > currentActive.updatedAt ||
			(bootstrapActive.updatedAt === currentActive.updatedAt && (bootstrapActive.title || !currentActive.title)))
	) {
		return bootstrap;
	}
	return [currentActive, ...bootstrap.filter((session) => session.id !== activeSessionId)].sort(
		(left, right) => right.updatedAt - left.updatedAt,
	);
}
