/**
 * 跨组件唤起企业专家 Token 配置弹窗。
 *
 * 弹窗本体挂在 RootGlobalOverlays（全局 overlay），而触发方可能在任意深度
 * 的视图里（如智能体中心的企业专家开关）。照 setup-wizard / team-session-events
 * 的既有模式走 window CustomEvent，不引入额外状态依赖。
 */
export const ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT = "astravia:enterprise-experts:open-token-dialog";

// 保留一次待处理请求，覆盖根布局初始挂载期间监听器尚未注册的极短窗口。
let tokenDialogOpenPending = false;

/** 请求打开企业专家 Token 配置弹窗（任意视图可调用）。 */
export function openEnterpriseExpertTokenDialog(): void {
	tokenDialogOpenPending = true;
	window.dispatchEvent(new Event(ENTERPRISE_EXPERT_TOKEN_DIALOG_OPEN_EVENT));
}

/** 弹窗挂载或收到事件时消费尚未处理的打开请求。 */
export function consumeEnterpriseExpertTokenDialogOpenRequest(): boolean {
	const pending = tokenDialogOpenPending;
	tokenDialogOpenPending = false;
	return pending;
}
