/**
 * Token 选择 Hook - Zustand 版本
 */

import { useGameStore } from "@/state/stores";
import { TokenType } from "@/sync/types";
import type { TokenInfo, TokenTypeValue } from "@/sync/types";
import { useCallback, useMemo } from "react";

export function useTokenSelection() {
	const selectedShipId = useGameStore((state) => state.selectedShipId);
	const selectedTargetId = useGameStore((state) => state.selectedTargetId);
	const ships = useGameStore((state) => state.ships);
	const selectShip = useGameStore((state) => state.selectShip);
	const selectTarget = useGameStore((state) => state.selectTarget);

	// 获取选中的 Token
	const selectedToken: TokenInfo | null = useMemo(() => {
		if (!selectedShipId) return null;
		const ship = ships.get(selectedShipId);
		if (!ship) return null;
		return {
			id: ship.id,
			type: TokenType.SHIP,
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			name: ship.name,
			ownerId: ship.ownerId,
		};
	}, [selectedShipId, ships]);

	// 选择 Token
	const selectToken = useCallback((tokenId: string | null) => {
		selectShip(tokenId);
	}, [selectShip]);

	// 按类型筛选 Token
	const getTokensByType = useCallback((_type: TokenTypeValue) => {
		const tokens: TokenInfo[] = [];
		ships.forEach((ship) => {
			tokens.push({
				id: ship.id,
				type: TokenType.SHIP,
				x: ship.transform.x,
				y: ship.transform.y,
				heading: ship.transform.heading,
				name: ship.name,
				ownerId: ship.ownerId,
			});
		});
		return tokens;
	}, [ships]);

	// 获取所有者的 Token
	const getTokensByOwner = useCallback((ownerId: string) => {
		const tokens: TokenInfo[] = [];
		ships.forEach((ship) => {
			if (ship.ownerId === ownerId) {
				tokens.push({
					id: ship.id,
					type: TokenType.SHIP,
					x: ship.transform.x,
					y: ship.transform.y,
					heading: ship.transform.heading,
					name: ship.name,
					ownerId: ship.ownerId,
				});
			}
		});
		return tokens;
	}, [ships]);

	// 检查 Token 是否被选中
	const isSelected = useCallback((tokenId: string) => selectedShipId === tokenId, [selectedShipId]);

	return {
		selectedToken,
		selectedTokenId: selectedShipId,
		selectedTargetId,
		allTokens: ships,
		selectToken,
		selectTarget,
		getTokensByType,
		getTokensByOwner,
		isSelected,
	};
}