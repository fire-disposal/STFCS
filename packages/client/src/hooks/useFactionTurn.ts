/**
 * 阵营回合系统 Hook
 *
 * 提供阵营回合相关的状态和操作方法
 */

import { useCallback, useMemo } from 'react';
import { useAppDispatch, useAppSelector } from '@/store';
import {
	selectCurrentFaction,
	selectRoundNumber,
	selectFactionOrder,
	selectFactionTurnPhase,
	selectDebounceStartTime,
	selectPlayerEndStatus,
	selectCurrentFactionPlayers,
	selectEndedPlayersCount,
	selectTotalPlayersCount,
	selectIsFactionTurnInitialized,
	updatePlayerEndStatus,
	setDebounceStartTime,
	setFactionTurnPhase,
} from '@/store/slices/factionTurnSlice';
import { useRoomOperations } from '@/room';
import type { RoomClient, OperationMap } from '@/room';
import { FACTIONS, getFactionColor, getFactionLocalizedName } from '@vt/shared';
import type { FactionId, PlayerFactionInfo } from '@vt/shared';

export interface UseFactionTurnReturn {
	// 状态
	roundNumber: number;
	currentFaction: FactionId;
	factionOrder: FactionId[];
	phase: 'action' | 'transition';
	isInitialized: boolean;
	isDebouncing: boolean;
	playerEndStatus: Record<FactionId, PlayerFactionInfo[]>;
	currentFactionPlayers: PlayerFactionInfo[];
	endedCount: number;
	totalCount: number;

	// 当前玩家相关
	selectedFaction: FactionId | null;
	isCurrentPlayerTurn: boolean;
	hasEndedTurn: boolean;

	// 阵营信息
	getFactionInfo: (factionId: FactionId) => {
		name: string;
		color: string;
		icon: string;
	};
	getFactionDisplayName: (factionId: FactionId) => string;

	// 操作
	endTurn: () => Promise<void>;
	cancelEndTurn: () => Promise<void>;
}

export function useFactionTurn(client: RoomClient<OperationMap> | null): UseFactionTurnReturn {
	const dispatch = useAppDispatch();

	// 获取操作调用器
	const ops = useRoomOperations(client);

	// 基础状态
	const roundNumber = useAppSelector(selectRoundNumber);
	const currentFaction = useAppSelector(selectCurrentFaction);
	const factionOrder = useAppSelector(selectFactionOrder);
	const phase = useAppSelector(selectFactionTurnPhase);
	const isInitialized = useAppSelector(selectIsFactionTurnInitialized);
	const debounceStartTime = useAppSelector(selectDebounceStartTime);
	const playerEndStatus = useAppSelector(selectPlayerEndStatus);
	const currentFactionPlayers = useAppSelector(selectCurrentFactionPlayers);
	const endedCount = useAppSelector(selectEndedPlayersCount);
	const totalCount = useAppSelector(selectTotalPlayersCount);

	// 当前玩家相关
	const selectedFaction = useAppSelector((state) => state.faction.selectedFaction);
	const currentPlayerId = useAppSelector((state) => state.ui.connection.playerId);

	// 计算属性
	const isDebouncing = useMemo(
		() => debounceStartTime !== undefined || phase === 'transition',
		[debounceStartTime, phase]
	);

	const isCurrentPlayerTurn = useMemo(
		() => selectedFaction === currentFaction,
		[selectedFaction, currentFaction]
	);

	const currentPlayer = useMemo(
		() => currentFactionPlayers.find((p) => p.playerId === currentPlayerId),
		[currentFactionPlayers, currentPlayerId]
	);

	const hasEndedTurn = currentPlayer?.hasEndedTurn ?? false;

	// 获取阵营信息
	const getFactionInfo = useCallback((factionId: FactionId) => {
		const faction = FACTIONS[factionId];
		return {
			name: faction?.name || factionId,
			color: getFactionColor(factionId),
			icon: faction?.icon === 'shield' ? '🛡️' : faction?.icon === 'sword' ? '⚔️' : '🏴',
		};
	}, []);

	const getFactionDisplayName = useCallback((factionId: FactionId) => {
		return getFactionLocalizedName(factionId);
	}, []);

	// 结束回合
	const endTurn = useCallback(async () => {
		if (!isCurrentPlayerTurn || hasEndedTurn || !currentPlayerId || !selectedFaction) {
			return;
		}

		// 乐观更新本地状态
		dispatch(
			updatePlayerEndStatus({
				playerId: currentPlayerId,
				faction: selectedFaction,
				hasEndedTurn: true,
				endedAt: Date.now(),
			})
		);

		// 调用服务器操作
		try {
			await ops?.endTurn();
		} catch (error) {
			console.error('Failed to end turn:', error);
			// 回滚乐观更新
			dispatch(
				updatePlayerEndStatus({
					playerId: currentPlayerId,
					faction: selectedFaction,
					hasEndedTurn: false,
					endedAt: undefined,
				})
			);
		}
	}, [
		isCurrentPlayerTurn,
		hasEndedTurn,
		currentPlayerId,
		selectedFaction,
		dispatch,
		ops,
	]);

	// 取消结束回合
	const cancelEndTurn = useCallback(async () => {
		if (!hasEndedTurn || !currentPlayerId || !selectedFaction) {
			return;
		}

		// 乐观更新本地状态
		dispatch(
			updatePlayerEndStatus({
				playerId: currentPlayerId,
				faction: selectedFaction,
				hasEndedTurn: false,
				endedAt: undefined,
			})
		);

		// 取消防抖状态
		dispatch(setDebounceStartTime(undefined));
		dispatch(setFactionTurnPhase('action'));

		// 调用服务器操作
		try {
			await ops?.cancelEndTurn();
		} catch (error) {
			console.error('Failed to cancel end turn:', error);
			// 回滚乐观更新
			dispatch(
				updatePlayerEndStatus({
					playerId: currentPlayerId,
					faction: selectedFaction,
					hasEndedTurn: true,
					endedAt: Date.now(),
				})
			);
		}
	}, [hasEndedTurn, currentPlayerId, selectedFaction, dispatch, ops]);

	return {
		// 状态
		roundNumber,
		currentFaction,
		factionOrder,
		phase,
		isInitialized,
		isDebouncing,
		playerEndStatus,
		currentFactionPlayers,
		endedCount,
		totalCount,

		// 当前玩家相关
		selectedFaction,
		isCurrentPlayerTurn,
		hasEndedTurn,

		// 阵营信息
		getFactionInfo,
		getFactionDisplayName,

		// 操作
		endTurn,
		cancelEndTurn,
	};
}

export default useFactionTurn;