import { ipcMain, webContents } from "electron";
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
	ipcMain.handle(CHANNELS.LIST, () => service.list());
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
