import { useUIStore } from "@/state/stores/uiStore";
import { useGameToken } from "@/state/stores/gameStore";
import type { CombatToken } from "@vt/data";

export function useSelectedShip(): CombatToken | null {
	const selectedShipId = useUIStore((state) => state.selectedShipId);
	return useGameToken(selectedShipId);
}

export function useSelectedShipId(): string | null {
	return useUIStore((state) => state.selectedShipId);
}
