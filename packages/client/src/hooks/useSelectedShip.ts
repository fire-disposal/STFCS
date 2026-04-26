/**
 * useSelectedShip - 统一获取选中舰船的 hook
 *
 * 所有面板组件应使用此 hook，避免各自重复从 store 获取
 * 数据来源：useGameStore（Zustand 响应式状态）
 */

import { useUIStore } from "@/state/stores/uiStore";
import { useGameToken, useAllTokens as useGameAllTokens, useGameState } from "@/state/stores/gameStore";
import type { CombatToken } from "@vt/data";

/**
 * 获取当前选中的舰船
 */
export function useSelectedShip(): CombatToken | null {
	const selectedShipId = useUIStore((state) => state.selectedShipId);
	return useGameToken(selectedShipId);
}

/**
 * 获取选中舰船 ID
 */
export function useSelectedShipId(): string | null {
	return useUIStore((state) => state.selectedShipId);
}

/**
 * 获取房间内所有舰船
 */
export function useAllTokens(): CombatToken[] {
	return useGameAllTokens();
}

/**
 * 获取当前房间状态
 */
export function useRoomState() {
	return useGameState();
}