import type { IpcRenderer } from "electron";
import type { DesktopApi } from "../api.js";

export function createSkillhubApi(ipc: IpcRenderer): Pick<DesktopApi, "skillhub"> {
	return {
		skillhub: {
			listCategories: () => ipc.invoke("astravia:skillhub:list-categories"),
			listSkills: (input) => ipc.invoke("astravia:skillhub:list-skills", input),
			install: (input) => ipc.invoke("astravia:skillhub:install", input),
		},
	};
}
