import { getSharedRuntime } from "../runtime.js";
import { enterpriseExpertService } from "./enterprise-expert-service.js";
import { EnterpriseExpertSessionRuntime } from "./enterprise-expert-session-runtime.js";

export const enterpriseExpertSessionRuntime = new EnterpriseExpertSessionRuntime(
	getSharedRuntime(),
	enterpriseExpertService,
);
