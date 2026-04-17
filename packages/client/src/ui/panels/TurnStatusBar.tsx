/**
 * 回合状态栏组件
 *
 * 显示在顶部状态栏中央：
 * - 左侧：当前阶段 + 回合数
 * - 中央：玩家列表（DM在第一位，按派系分组）
 * - 右侧：当前玩家的回合结束按钮
 */

import type { PlayerState, ShipState, PlayerRoleValue, GamePhaseValue } from "@/sync/types";
import { Faction, PlayerRole, GamePhase } from "@/sync/types";
import { Crown, User, CheckCircle, XCircle, Flag, Zap, MapPin } from "lucide-react";
import { Avatar } from "@/ui/shared/Avatar";
import React, { useMemo } from "react";
import "./turn-status-bar.css";

const phaseNames: Record<string, string> = {
	DEPLOYMENT: "部署",
	PLAYER_TURN: "玩家回合",
	DM_TURN: "DM回合",
	END_PHASE: "结算",
};

interface TurnStatusBarProps {
	currentPhase: GamePhaseValue;
	turnCount: number;
	activeFaction: string;
	players: PlayerState[];
	ships: ShipState[];
	currentSessionId: string;
	onToggleReady?: () => void;
	isReady?: boolean;
}

export const TurnStatusBar: React.FC<TurnStatusBarProps> = ({
	currentPhase,
	turnCount,
	activeFaction,
	players,
	ships,
	currentSessionId,
	onToggleReady,
	isReady = false,
}) => {
	// 按派系分组玩家：DM 优先，然后是玩家
	const groupedPlayers = useMemo(() => {
		const dmPlayers: PlayerState[] = [];
		const playerFaction: PlayerState[] = [];
		const dmFaction: PlayerState[] = [];

		players.forEach((p) => {
			if (!p.connected) return; // 排除断开的玩家
			if (p.role === PlayerRole.DM) {
				dmPlayers.push(p);
			} else {
				// 根据所控制舰船的派系分类
				const ownedShips = ships.filter((s) => s.ownerId === p.sessionId);
				const hasPlayerShips = ownedShips.some((s) => s.faction === Faction.PLAYER);
				if (hasPlayerShips) {
					playerFaction.push(p);
				} else {
					dmFaction.push(p);
				}
			}
		});

		return {
			dm: dmPlayers,
			playerFaction,
			dmFaction,
		};
	}, [players, ships]);

	// 判断当前玩家是否可以结束回合
	const currentPlayer = useMemo(() => {
		return players.find((p) => p.sessionId === currentSessionId);
	}, [players, currentSessionId]);

	const canEndTurn = useMemo(() => {
		if (!currentPlayer) return false;
		if (currentPlayer.role === PlayerRole.DM) return currentPhase === GamePhase.DM_TURN;
		return currentPhase === GamePhase.PLAYER_TURN;
	}, [currentPlayer, currentPhase]);

	// 阶段颜色
	const phaseColor = useMemo(() => {
		switch (currentPhase) {
			case GamePhase.DEPLOYMENT:
				return "#9b59b6";
			case GamePhase.PLAYER_TURN:
				return "#4a9eff";
			case GamePhase.DM_TURN:
				return "#ff6f8f";
			case GamePhase.END_PHASE:
				return "#f1c40f";
			default:
				return "#4a9eff";
		}
	}, [currentPhase]);

	return (
		<div className="turn-status-bar">
			{/* 左侧：阶段信息 */}
			<div className="turn-status-bar__phase-info" style={{ borderColor: phaseColor }}>
				<div className="phase-indicator">
					{currentPhase === GamePhase.DEPLOYMENT && <MapPin className="phase-indicator__icon" style={{ color: phaseColor }} />}
					{currentPhase === GamePhase.PLAYER_TURN && <User className="phase-indicator__icon" style={{ color: phaseColor }} />}
					{currentPhase === GamePhase.DM_TURN && <Crown className="phase-indicator__icon" style={{ color: phaseColor }} />}
					{currentPhase === GamePhase.END_PHASE && <Zap className="phase-indicator__icon" style={{ color: phaseColor }} />}
					<span className="phase-indicator__label">{phaseNames[currentPhase] || currentPhase}</span>
				</div>
				<div className="turn-count">
					<span className="turn-count__label">回合</span>
					<span className="turn-count__number">{turnCount}</span>
				</div>
			</div>

			{/* 中央：玩家列表 */}
			<div className="turn-status-bar__players">
				{/* DM 组 */}
				{groupedPlayers.dm.length > 0 && (
					<div className="player-group player-group--dm">
						<div className="player-group__label">
							<Crown className="player-group__icon" />
							DM
						</div>
						<div className="player-group__list">
							{groupedPlayers.dm.map((player) => (
								<PlayerStatusCard
									key={player.sessionId}
									player={player}
									isCurrentPlayer={player.sessionId === currentSessionId}
								/>
							))}
						</div>
					</div>
				)}

				{/* 玩家派系组 */}
				{groupedPlayers.playerFaction.length > 0 && (
					<div className="player-group player-group--player">
						<div className="player-group__label">
							<User className="player-group__icon" />
							玩家
						</div>
						<div className="player-group__list">
							{groupedPlayers.playerFaction.map((player) => (
								<PlayerStatusCard
									key={player.sessionId}
									player={player}
									isCurrentPlayer={player.sessionId === currentSessionId}
								/>
							))}
						</div>
					</div>
				)}

				{/* DM 派系组（非 DM 角色但控制敌方舰船） */}
				{groupedPlayers.dmFaction.length > 0 && (
					<div className="player-group player-group--enemy">
						<div className="player-group__label">
							<Flag className="player-group__icon" />
							敌方
						</div>
						<div className="player-group__list">
							{groupedPlayers.dmFaction.map((player) => (
								<PlayerStatusCard
									key={player.sessionId}
									player={player}
									isCurrentPlayer={player.sessionId === currentSessionId}
								/>
							))}
						</div>
					</div>
				)}
			</div>

			{/* 右侧：结束回合按钮 */}
			<div className="turn-status-bar__action">
				<button
					className={`ready-btn ${isReady ? "ready-btn--active" : ""}`}
					onClick={onToggleReady}
					disabled={!canEndTurn || !onToggleReady}
				>
					<Flag className="ready-btn__icon" />
					<span className="ready-btn__label">{isReady ? "取消" : "结束回合"}</span>
				</button>
			</div>
		</div>
	);
};

/** 单个玩家状态卡片 */
const PlayerStatusCard: React.FC<{
	player: PlayerState;
	isCurrentPlayer: boolean;
}> = ({ player, isCurrentPlayer }) => {
	return (
		<div
			className={`player-card ${isCurrentPlayer ? "player-card--current" : ""} ${player.isReady ? "player-card--ready" : ""}`}
		>
			<span className="player-card__avatar">
				<Avatar src={player.avatar} size={28} />
			</span>
			<span className="player-card__name">
				{player.nickname || player.name || `玩家${player.shortId}`}
			</span>
			<span className="player-card__status">
				{player.isReady ? (
					<CheckCircle className="player-card__status-icon player-card__status-icon--ready" />
				) : (
					<XCircle className="player-card__status-icon player-card__status-icon--waiting" />
				)}
			</span>
		</div>
	);
};

export default TurnStatusBar;