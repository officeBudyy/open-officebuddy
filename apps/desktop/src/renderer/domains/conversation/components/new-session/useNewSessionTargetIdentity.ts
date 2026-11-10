import type { NewSessionHeroIdentity } from "@astravia-org/theme-ui";
import type { EnterpriseExpertSummary } from "@preload/api";
import { useAgentAvatarResolver } from "@shared/agent-teams/agent-avatar";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAgentTeamDirectoryDocument } from "./agent-team-directory";
import { resolveNewSessionTargetIdentity } from "./new-session-target-identity";
import { type NewSessionTargetKey, parseEnterpriseExpertTargetKey } from "./target";

/**
 * 选中的会话对象在 hero 上的身份（名称、描述、头像组）。
 *
 * 名录加载失败这里不报错：同屏的选择器已经有重试入口，hero 静默留在问候语，
 * 不要为同一次失败弹两处提示。
 */
export function useNewSessionTargetIdentity(targetKey: NewSessionTargetKey | null): NewSessionHeroIdentity | null {
	const { t } = useTranslation("chat");
	const document = useAgentTeamDirectoryDocument();
	const resolveAvatar = useAgentAvatarResolver();
	const enterpriseExpertId = parseEnterpriseExpertTargetKey(targetKey);
	const [enterpriseExpert, setEnterpriseExpert] = useState<EnterpriseExpertSummary>();
	useEffect(() => {
		if (!enterpriseExpertId) {
			setEnterpriseExpert(undefined);
			return;
		}
		let cancelled = false;
		void window.astravia.enterpriseExperts
			.list()
			.then((experts) => {
				if (!cancelled) setEnterpriseExpert(experts.find((expert) => expert.id === enterpriseExpertId));
			})
			.catch(() => undefined);
		return () => {
			cancelled = true;
		};
	}, [enterpriseExpertId]);

	return useMemo(
		() =>
			enterpriseExpert
				? {
						avatars: [{ avatar: enterpriseExpert.avatarUrl ?? "", name: enterpriseExpert.name }],
						key: targetKey ?? enterpriseExpert.id,
						subtitle: enterpriseExpert.description ?? t("newSession.agentSelector.enterpriseRemote"),
						title: enterpriseExpert.name,
					}
				: resolveNewSessionTargetIdentity(
						document,
						targetKey,
						{ memberCount: (count) => t("newSession.agentSelector.memberCount", { count }) },
						resolveAvatar,
					),
		[document, enterpriseExpert, resolveAvatar, t, targetKey],
	);
}
