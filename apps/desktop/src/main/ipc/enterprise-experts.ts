import { ipcMain, webContents } from "electron";
import { ENTERPRISE_EXPERT_AUTH_ERROR_MARKER } from "../../shared/enterprise-experts.js";
import { EnterpriseExpertAuthError } from "../enterprise-experts/enterprise-expert-client.js";
import {
	type EnterpriseExpertService,
	enterpriseExpertService,
} from "../enterprise-experts/enterprise-expert-service.js";

const CHANNELS = {
	LIST: "astravia:enterprise-experts:list",
	HAS_TOKEN: "astravia:enterprise-experts:has-token",
	SET_TOKEN: "astravia:enterprise-experts:set-token",
	CLEAR_TOKEN: "astravia:enterprise-experts:clear-token",
	AUTH_REQUIRED: "astravia:enterprise-experts:auth-required",
	CHANGED: "astravia:enterprise-experts:changed",
} as const;

export function registerEnterpriseExpertsIpc(service: EnterpriseExpertService = enterpriseExpertService): () => void {
	const broadcast = (channel: string): void => {
		for (const contents of webContents.getAllWebContents()) {
			if (!contents.isDestroyed()) contents.send(channel);
		}
	};
	const unsubscribeAuth = service.onAuthRequired(() => broadcast(CHANNELS.AUTH_REQUIRED));
	const unsubscribeChanged = service.onChanged(() => broadcast(CHANNELS.CHANGED));
	// 鉴权错误跨 IPC 后只剩纯文本，改写成带稳定标记的消息，渲染层据此唤起 Token 弹窗
	ipcMain.handle(CHANNELS.LIST, async () => {
		try {
			return await service.list();
		} catch (error) {
			if (error instanceof EnterpriseExpertAuthError) throw new Error(ENTERPRISE_EXPERT_AUTH_ERROR_MARKER);
			throw error;
		}
	});
	ipcMain.handle(CHANNELS.HAS_TOKEN, () => service.hasToken());
	ipcMain.handle(CHANNELS.SET_TOKEN, (_event, token: unknown) => {
		if (typeof token !== "string") throw new Error("Token must be a string");
		return service.setToken(token);
	});
	ipcMain.handle(CHANNELS.CLEAR_TOKEN, () => service.clearToken());
	return () => {
		unsubscribeAuth();
		unsubscribeChanged();
		for (const channel of [CHANNELS.LIST, CHANNELS.HAS_TOKEN, CHANNELS.SET_TOKEN, CHANNELS.CLEAR_TOKEN]) {
			ipcMain.removeHandler(channel);
		}
	};
}
