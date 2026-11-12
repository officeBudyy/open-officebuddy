/** 企业专家是可选能力；所有 Renderer 入口共用同一开关事实源。 */
export const ENTERPRISE_EXPERTS_ENABLED_STORAGE_KEY = "astravia.enterprise-experts.enabled";

export function readEnterpriseExpertsEnabled(): boolean {
	try {
		return localStorage.getItem(ENTERPRISE_EXPERTS_ENABLED_STORAGE_KEY) === "1";
	} catch {
		return false;
	}
}

export function writeEnterpriseExpertsEnabled(enabled: boolean): void {
	try {
		localStorage.setItem(ENTERPRISE_EXPERTS_ENABLED_STORAGE_KEY, enabled ? "1" : "0");
	} catch {
		// ignore quota / private mode
	}
}
