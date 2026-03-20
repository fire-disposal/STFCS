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
import { websocketService } from '@/services/websocket';
import { WS_MESSAGE_TYPES } from '@vt/shared';
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
	endTurn: () => void;
	cancelEndTurn: () => void;
}

export function useFactionTurn(): UseFactionTurnReturn {
	const dispatch = useAppDispatch();

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
	const endTurn = useCallback(() => {
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

		// 发送 WebSocket 消息
		websocketService.send({
			type: WS_MESSAGE_TYPES.PLAYER_END_TURN,
			payload: {
				playerId: currentPlayerId,
				playerName: currentPlayer?.playerName || '',
				faction: selectedFaction,
				timestamp: Date.now(),
			},
		});
	}, [
		isCurrentPlayerTurn,
		hasEndedTurn,
		currentPlayerId,
		selectedFaction,
		currentPlayer,
		dispatch,
	]);

	// 取消结束回合
	const cancelEndTurn = useCallback(() => {
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

		// 发送 WebSocket 消息
		websocketService.send({
			type: WS_MESSAGE_TYPES.PLAYER_CANCEL_END_TURN,
			payload: {
				playerId: currentPlayerId,
				playerName: currentPlayer?.playerName || '',
				faction: selectedFaction,
				timestamp: Date.now(),
			},
		});
	}, [hasEndedTurn, currentPlayerId, selectedFaction, currentPlayer, dispatch]);

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