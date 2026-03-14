/**
 * Token 选择 Hook
 * 管理 Token 的选择状态和相关操作
 */

import { useCallback, useMemo } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
	selectToken as selectTokenAction,
	updateToken as updateTokenAction,
	removeToken as removeTokenAction,
} from "@/store/slices/mapSlice";
import { selectShip } from "@/store/slices/shipSlice";
import type { TokenInfo, TokenType } from "@vt/shared/types";

export function useTokenSelection() {
	const dispatch = useAppDispatch();
	const { selectedTokenId, tokens } = useAppSelector((state) => state.map);

	// 获取选中的 Token
	const selectedToken: TokenInfo | null = useMemo(() => {
		return selectedTokenId ? tokens[selectedTokenId] : null;
	}, [selectedTokenId, tokens]);

	// 选择 Token
	const selectToken = useCallback(
		(tokenId: string | null) => {
			dispatch(selectTokenAction(tokenId));

			// 如果是舰船 Token，同时选中对应的舰船
			if (tokenId && tokens[tokenId]?.type === "ship") {
				dispatch(selectShip(tokenId));
			}
		},
		[dispatch, tokens]
	);

	// 更新 Token
	const updateToken = useCallback(
		(id: string, updates: Partial<TokenInfo>) => {
			dispatch(updateTokenAction({ id, updates }));
		},
		[dispatch]
	);

	// 删除 Token
	const removeToken = useCallback(
		(tokenId: string) => {
			dispatch(removeTokenAction(tokenId));
		},
		[dispatch]
	);

	// 按类型筛选 Token
	const getTokensByType = useCallback(
		(type: TokenType) => {
			return Object.values(tokens).filter((token) => token.type === type);
		},
		[tokens]
	);

	// 获取所有者的 Token
	const getTokensByOwner = useCallback(
		(ownerId: string) => {
			return Object.values(tokens).filter((token) => token.ownerId === ownerId);
		},
		[tokens]
	);

	// 检查 Token 是否被选中
	const isSelected = useCallback(
		(tokenId: string) => {
			return selectedTokenId === tokenId;
		},
		[selectedTokenId]
	);

	// 批量操作
	const batchUpdate = useCallback(
		(updates: Array<{ id: string; updates: Partial<TokenInfo> }>) => {
			updates.forEach(({ id, updates: tokenUpdates }) => {
				dispatch(updateTokenAction({ id, updates: tokenUpdates }));
			});
		},
		[dispatch]
	);

	return {
		// 状态
		selectedToken,
		selectedTokenId,
		allTokens: tokens,

		// 方法
		selectToken,
		updateToken,
		removeToken,
		getTokensByType,
		getTokensByOwner,
		isSelected,
		batchUpdate,
	};
}
