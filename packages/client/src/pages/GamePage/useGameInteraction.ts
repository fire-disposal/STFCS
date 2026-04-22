import { useCallback } from "react";
import { notify } from "@/ui/shared/Notification";
import type { ShipViewModel } from "@/renderer";
import type { WsEventName, WsPayload, WsResponseData } from "@vt/data";

interface GameInteractionHook {
	sendCommand: (command: string, payload: unknown) => Promise<void>;
	handleToggleShield: () => Promise<void>;
	handleVent: () => Promise<void>;
	handleEndTurn: () => Promise<void>;
}

interface RoomLike {
	send: <E extends WsEventName>(event: E, payload: WsPayload<E>) => Promise<WsResponseData<E>>;
}

export function useGameInteraction(
	room: RoomLike | null,
	selectedShip: ShipViewModel | null
): GameInteractionHook {
	const sendCommand = useCallback(async (command: string, payload: unknown) => {
		if (!room) throw new Error("Not connected to room");
		await room.send(command as WsEventName, payload as WsPayload<WsEventName>);
	}, [room]);

	const handleToggleShield = useCallback(async () => {
		if (!selectedShip) return;
		try {
			await sendCommand("game:action", {
				action: "shield",
				tokenId: selectedShip.id,
				active: !selectedShip.shield?.active,
			});
		} catch (error) {
			notify.error("护盾切换失败");
		}
	}, [selectedShip, sendCommand]);

	const handleVent = useCallback(async () => {
		if (!selectedShip) return;
		try {
			await sendCommand("game:action", {
				action: "vent",
				tokenId: selectedShip.id,
			});
		} catch (error) {
			notify.error("排气失败");
		}
	}, [selectedShip, sendCommand]);

	const handleEndTurn = useCallback(async () => {
		try {
			await sendCommand("game:action", { action: "end_turn" });
		} catch (error) {
			notify.error("结束回合失败");
		}
	}, [sendCommand]);

	return {
		sendCommand,
		handleToggleShield,
		handleVent,
		handleEndTurn,
	};
}