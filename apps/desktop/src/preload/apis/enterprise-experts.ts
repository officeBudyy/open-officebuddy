import type { IpcRenderer } from "electron";
import type { DesktopApi } from "../api.js";

const AUTH_REQUIRED = "astravia:enterprise-experts:auth-required";
const CHANGED = "astravia:enterprise-experts:changed";

export function createEnterpriseExpertsApi(ipc: IpcRenderer): Pick<DesktopApi, "enterpriseExperts"> {
	const subscribe = (channel: string, listener: () => void): (() => void) => {
		const handler = (): void => listener();
		ipc.on(channel, handler);
		return () => ipc.removeListener(channel, handler);
	};
	return {
		enterpriseExperts: {
			list: () => ipc.invoke("astravia:enterprise-experts:list"),
			hasToken: () => ipc.invoke("astravia:enterprise-experts:has-token"),
			setToken: (token) => ipc.invoke("astravia:enterprise-experts:set-token", token),
			clearToken: () => ipc.invoke("astravia:enterprise-experts:clear-token"),
			onAuthRequired: (listener) => subscribe(AUTH_REQUIRED, listener),
			onChanged: (listener) => subscribe(CHANGED, listener),
		},
	};
}
