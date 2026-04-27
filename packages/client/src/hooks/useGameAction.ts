import { useCallback } from "react";
import { useGameActionSender } from "@/state/stores/gameStore";
import type { WsEventName, WsPayload, WsResponseData } from "@vt/data";
import { notify } from "@/ui/shared/Notification";

type GameActionName = "move" | "rotate" | "attack" | "deviation" | "shield_toggle" | "shield_rotate" | "vent" | "advance_phase" | "end_turn";

interface Allocation {
	mountId: string;
	targets: Array<{ targetId: string; shots: number }>;
}

export function useGameAction() {
	const sender = useGameActionSender();

	const send = useCallback(async <E extends WsEventName>(
		event: E,
		payload: WsPayload<E>,
	): Promise<WsResponseData<E> | null> => {
		if (!sender.isAvailable()) {
			return null;
		}
		try {
			return await sender.send(event, payload);
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "操作失败");
			return null;
		}
	}, [sender]);

	const sendGameAction = useCallback(async (
		action: GameActionName,
		tokenId: string,
		extra: Record<string, unknown> = {},
	): Promise<boolean> => {
		const result = await send("game:action", { action, tokenId, ...extra } as any);
		return result !== null;
	}, [send]);

	const sendMove = useCallback((tokenId: string, forward: number, strafe: number) =>
		sendGameAction("move", tokenId, { forward, strafe }), [sendGameAction]);

	const sendRotate = useCallback((tokenId: string, angle: number) =>
		sendGameAction("rotate", tokenId, { angle }), [sendGameAction]);

	const sendAdvancePhase = useCallback((tokenId: string) =>
		sendGameAction("advance_phase", tokenId), [sendGameAction]);

	const sendEndTurn = useCallback((tokenId: string) =>
		sendGameAction("end_turn", tokenId), [sendGameAction]);

	const sendAttack = useCallback((tokenId: string, allocations: Allocation[]) =>
		sendGameAction("attack", tokenId, { allocations }), [sendGameAction]);

	const sendDeviation = useCallback((tokenId: string, allocations: Allocation[]) =>
		sendGameAction("deviation", tokenId, { allocations }), [sendGameAction]);

	const sendShieldToggle = useCallback((tokenId: string, active: boolean) =>
		sendGameAction("shield_toggle", tokenId, { active }), [sendGameAction]);

	const sendShieldRotate = useCallback((tokenId: string, direction: number) =>
		sendGameAction("shield_rotate", tokenId, { direction }), [sendGameAction]);

	const sendVent = useCallback((tokenId: string) =>
		sendGameAction("vent", tokenId), [sendGameAction]);

	const sendEditToken = useCallback(async (
		action: "create" | "modify" | "remove" | "heal" | "damage" | "restore" | "reset" | "rename",
		tokenId?: string,
		extra: Record<string, unknown> = {},
	): Promise<boolean> => {
		const result = await send("edit:token", { action, tokenId, ...extra } as any);
		return result !== null;
	}, [send]);

	const sendQuery = useCallback(async (
		type: "targets" | "movement" | "ownership" | "combat_state" | "weapon_state",
		tokenId: string,
		mountId?: string
	): Promise<any | null> => {
		const result = await send("game:query", { type, tokenId, mountId });
		return result?.result ?? null;
	}, [send]);

	return {
		isAvailable: sender.isAvailable,
		send,
		sendMove,
		sendRotate,
		sendAdvancePhase,
		sendEndTurn,
		sendAttack,
		sendDeviation,
		sendShieldToggle,
		sendShieldRotate,
		sendVent,
		sendEditToken,
		sendQuery,
	};
}

export default useGameAction;
