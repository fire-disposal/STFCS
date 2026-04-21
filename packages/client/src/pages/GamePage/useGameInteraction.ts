import { useCallback } from "react";
import { notify } from "@/ui/shared/Notification";
import type { ShipViewModel } from "@/renderer";

interface GameInteractionHook {
	sendCommand: (command: string, payload: unknown) => Promise<void>;
	handleToggleShield: () => Promise<void>;
	handleVent: () => Promise<void>;
	handleEndTurn: () => Promise<void>;
}

export function useGameInteraction(
	room: { send: (event: string, payload: unknown) => Promise<any> } | null,
	selectedShip: ShipViewModel | null
): GameInteractionHook {
	const sendCommand = useCallback(async (command: string, payload: unknown) => {
		if (!room) throw new Error("Not connected to room");
		await room.send(command, payload);
	}, [room]);

	const handleToggleShield = useCallback(async () => {
		if (!selectedShip) return;
		try {
			await sendCommand("game:action", {
				action: "toggle_shield",
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
				action: "vent_flux",
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