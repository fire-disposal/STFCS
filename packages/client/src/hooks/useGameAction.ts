/**
 * useGameAction - 统一的游戏操作发送 hook
 *
 * 所有 Panel 组件使用此 hook 发送 game:action/edit:token 等请求
 * 无需 props drilling，直接从 gameStateRef 获取 actionSender
 */

import { useCallback } from "react";
import { getGameActionSender } from "@/state/stores/uiStore";
import type { WsEventName, WsPayload, WsResponseData } from "@vt/data";
import { notify } from "@/ui/shared/Notification";

export function useGameAction() {
	const sender = getGameActionSender();

	const send = useCallback(async <E extends WsEventName>(
		event: E,
		payload: WsPayload<E>,
		successMsg?: string,
		errorMsg?: string
	): Promise<WsResponseData<E> | null> => {
		if (!sender.isAvailable()) {
			notify.error("网络未连接");
			return null;
		}

		try {
			const result = await sender.send(event, payload);
			if (successMsg) notify.success(successMsg);
			return result;
		} catch (error) {
			const msg = error instanceof Error ? error.message : (errorMsg || "操作失败");
			notify.error(msg);
			return null;
		}
	}, [sender]);

	const sendMove = useCallback(async (
		tokenId: string,
		forward: number,
		strafe: number
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "move",
			tokenId,
			forward,
			strafe,
		}, `移动 ${forward > 0 ? "前进" : forward < 0 ? "后退" : ""} ${Math.abs(forward)}`);
		return result !== null;
	}, [send]);

	const sendRotate = useCallback(async (
		tokenId: string,
		angle: number
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "rotate",
			tokenId,
			angle,
		}, `旋转 ${angle}°`);
		return result !== null;
	}, [send]);

	const sendAdvancePhase = useCallback(async (
		tokenId: string
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "advance_phase",
			tokenId,
		}, "阶段推进");
		return result !== null;
	}, [send]);

	const sendAttack = useCallback(async (
		tokenId: string,
		allocations: Array<{ mountId: string; targets: Array<{ targetId: string; shots: number }> }>
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "attack",
			tokenId,
			allocations,
		}, "攻击已执行");
		return result !== null;
	}, [send]);

	const sendShieldToggle = useCallback(async (
		tokenId: string,
		active: boolean
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "shield",
			tokenId,
			active,
		}, active ? "护盾开启" : "护盾关闭");
		return result !== null;
	}, [send]);

	const sendShieldRotate = useCallback(async (
		tokenId: string,
		direction: number
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "shield",
			tokenId,
			active: true,
			direction,
		}, `护盾朝向 ${direction}°`);
		return result !== null;
	}, [send]);

	const sendVent = useCallback(async (
		tokenId: string
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "vent",
			tokenId,
		}, "开始散辐");
		return result !== null;
	}, [send]);

	const sendEndTurn = useCallback(async (
		tokenId: string
	): Promise<boolean> => {
		const result = await send("game:action", {
			action: "end_turn",
			tokenId,
		}, "结束回合");
		return result !== null;
	}, [send]);

	const sendEditToken = useCallback(async (
		action: "create" | "modify" | "remove" | "heal" | "damage" | "restore" | "reset",
		tokenId?: string,
		token?: any,
		position?: { x: number; y: number },
		faction?: string,
		amount?: number,
		path?: string,
		value?: any
	): Promise<boolean> => {
		const result = await send("edit:token", {
			action,
			tokenId,
			token,
			position,
			faction,
			amount,
			path,
			value,
		} as any, action === "create" ? "舰船已部署" : action === "heal" ? "已修复" : action === "damage" ? "已损伤" : "操作完成");
		return result !== null;
	}, [send]);

	const sendQuery = useCallback(async (
		type: "targets" | "movement" | "ownership" | "combat_state" | "weapon_state",
		tokenId: string,
		mountId?: string
	): Promise<any | null> => {
		const result = await send("game:query", {
			type,
			tokenId,
			mountId,
		});
		return result?.result ?? null;
	}, [send]);

	return {
		isAvailable: sender.isAvailable(),
		send,
		sendMove,
		sendRotate,
		sendAdvancePhase,
		sendEndTurn,
		sendAttack,
		sendShieldToggle,
		sendShieldRotate,
		sendVent,
		sendEditToken,
		sendQuery,
	};
}

export default useGameAction;