import { lazy, Suspense } from "react";
import { ActionApprovalCenter } from "../shared/action-approval/ActionApprovalCenter";
import { EnterpriseExpertTokenDialog } from "../shared/components/EnterpriseExpertTokenDialog";
import { SshPromptDialog } from "../shared/components/SshPromptDialog";
import { useAtomValue } from "jotai";
import { initialRoutePaintedAtom } from "./initial-route-paint-state";

const RootOverlayViews = lazy(() =>
	import("./RootOverlayViews").then((module) => ({ default: module.RootOverlayViews })),
);

export function RootGlobalOverlays(): JSX.Element {
	const routePainted = useAtomValue(initialRoutePaintedAtom);
	return (
		<>
			{/* Keep receiving requests while the presenter chunk is loading. */}
			<ActionApprovalCenter />
			<SshPromptDialog />
			{/* Token requests can happen before the deferred overlay bundle mounts. */}
			<EnterpriseExpertTokenDialog />
			{routePainted && (
				<Suspense fallback={null}>
					<RootOverlayViews />
				</Suspense>
			)}
		</>
	);
}
