/**
 * TurnBar - 回合顶栏组件
 *
 * 布局：
 * 左侧：准备按钮 + 回合推进按钮
 * 中部：玩家头像（按阵营分组）
 * 右侧：当前活动阵营指示器
 * 最右侧：回合计数
 */

import React, { useMemo } from "react";
import { Crown, FastForward, CheckCircle, Sword, Users } from "lucide-react";
import { GamePhase, Faction } from "@vt/data";
import type { RoomPlayerState } from "@vt/data";
import "./turn-bar.css";

interface TurnBarProps {
	phase: GamePhase;
	turnCount: number;
	activeFaction: Faction | undefined;
	players: Record<string, RoomPlayerState>;
	currentPlayerId: string | null;
	isHost: boolean;
	isReady: boolean;
	onReadyToggle: () => void;
	onAdvancePhase: () => void;
}

const PHASE_NAMES: Record<GamePhase, string> = {
	DEPLOYMENT: "部署",
	PLAYER_ACTION: "玩家回合",
	DM_ACTION: "DM回合",
	TURN_END: "结算",
};

const FACTION_NAMES: Record<Faction, string> = {
	PLAYER: "玩家",
	ENEMY: "敌方",
	NEUTRAL: "中立",
};

const FACTION_ICONS: Record<Faction, React.ReactNode> = {
	PLAYER: <Users size={10} />,
	ENEMY: <Sword size={10} />,
	NEUTRAL: null,
};

function getAvatarBorderColor(
	player: RoomPlayerState,
	phase: GamePhase,
	currentPlayerId: string | null
): string {
	const playerFaction = player.faction ?? "PLAYER";
	const isCurrentPlayer = player.sessionId === currentPlayerId;

	if (phase === GamePhase.DEPLOYMENT) {
		if (isCurrentPlayer) {
			return player.isReady ? "ready" : "not-ready";
		}
		return player.isReady ? "ready" : "waiting";
	}

	if (phase === GamePhase.PLAYER_ACTION) {
		if (playerFaction === "PLAYER") {
			if (isCurrentPlayer) {
				return player.isReady ? "active-player" : "not-ready";
			}
			return player.isReady ? "active-player" : "waiting";
		}
		return "waiting";
	}

	if (phase === GamePhase.DM_ACTION) {
		if (playerFaction === "ENEMY") {
			return "active-enemy";
		}
		return "waiting";
	}

	return "waiting";
}

export const TurnBar: React.FC<TurnBarProps> = ({
	phase,
	turnCount,
	activeFaction,
	players,
	currentPlayerId,
	isHost,
	isReady,
	onReadyToggle,
	onAdvancePhase,
}) => {
	const playerList = useMemo(() => {
		return Object.values(players).filter((p) => p.connected);
	}, [players]);

	const groupedPlayers = useMemo(() => {
		const groups: Record<string, RoomPlayerState[]> = {
			PLAYER: [],
			ENEMY: [],
			NEUTRAL: [],
		};

		for (const player of playerList) {
			const faction = player.faction ?? "PLAYER";
			groups[faction].push(player);
		}

		return groups;
	}, [playerList]);

	const phaseColorClass = useMemo(() => {
		switch (phase) {
			case GamePhase.DEPLOYMENT:
				return "turn-bar__phase-badge--deployment";
			case GamePhase.PLAYER_ACTION:
				return "turn-bar__phase-badge--player-action";
			case GamePhase.DM_ACTION:
				return "turn-bar__phase-badge--dm-action";
			case GamePhase.TURN_END:
				return "turn-bar__phase-badge--turn-end";
			default:
				return "";
		}
	}, [phase]);

	const advanceBtnDisabled = !isHost;
	const advanceBtnClass = advanceBtnDisabled
		? "turn-bar__advance-btn--disabled"
		: "turn-bar__advance-btn--active";

	const getAdvanceLabel = () => {
		switch (phase) {
			case GamePhase.DEPLOYMENT:
				return "开始游戏";
			case GamePhase.PLAYER_ACTION:
				return "结束玩家回合";
			case GamePhase.DM_ACTION:
				return "结束DM回合";
			case GamePhase.TURN_END:
				return "开始新回合";
			default:
				return "推进";
		}
	};

	return (
		<div className="turn-bar">
			<div className="turn-bar__left">
				<div className={`turn-bar__phase-badge ${phaseColorClass}`}>
					{phase === GamePhase.DM_ACTION && <Crown size={10} />}
					{PHASE_NAMES[phase]}
				</div>

				{phase === GamePhase.DEPLOYMENT && (
					<button
						className={`turn-bar__advance-btn ${isReady ? "turn-bar__advance-btn--disabled" : "turn-bar__advance-btn--active"}`}
						onClick={onReadyToggle}
						style={{
							background: isReady ? "rgba(87, 227, 141, 0.2)" : "rgba(245, 158, 11, 0.2)",
							color: isReady ? "#2ecc71" : "#f59e0b",
							border: isReady ? "1px solid rgba(87, 227, 141, 0.4)" : "1px solid rgba(245, 158, 11, 0.4)",
						}}
					>
						<CheckCircle size={12} />
						{isReady ? "取消准备" : "准备"}
					</button>
				)}

				<button
					className={`turn-bar__advance-btn ${advanceBtnClass}`}
					onClick={onAdvancePhase}
					disabled={advanceBtnDisabled}
				>
					<FastForward size={12} />
					{getAdvanceLabel()}
				</button>
			</div>

			<div className="turn-bar__center">
				{(Object.entries(groupedPlayers) as [Faction, RoomPlayerState[]][]).map(([faction, factionPlayers]) => {
					if (factionPlayers.length === 0) return null;

					const factionClass = `turn-bar__faction-label--${faction.toLowerCase()}`;

					return (
						<div key={faction} className="turn-bar__faction-group">
							<span className={`turn-bar__faction-label ${factionClass}`}>
								{FACTION_ICONS[faction]}
								{FACTION_NAMES[faction]}
							</span>
{factionPlayers.map((player) => {
								const borderClass = getAvatarBorderColor(player, phase, currentPlayerId);
								const isCurrentPlayer = player.sessionId === currentPlayerId;
								const initials = player.nickname.charAt(0).toUpperCase();
								const colorIndex = player.nickname.charCodeAt(0) % 6;
								const colors = ["#4a9eff", "#ff6f8f", "#9b59b6", "#f1c40f", "#2ecc71", "#e74c3c"];

								return (
									<div key={player.sessionId} className="turn-avatar">
										<div className={`turn-avatar__frame turn-avatar__frame--${borderClass}`} />
										<div
											className="turn-avatar__inner"
											style={{ color: isCurrentPlayer ? colors[colorIndex] : "#8ba4c7" }}
										>
											{initials}
										</div>
										{player.role === "HOST" && (
											<div className="turn-avatar__crown">
												<Crown size={10} />
											</div>
										)}
										{(phase === GamePhase.DEPLOYMENT || phase === GamePhase.PLAYER_ACTION) && (
											<div className={`turn-avatar__ready-dot ${player.isReady ? "" : "turn-avatar__ready-dot--not-ready"}`} />
										)}
									</div>
								);
							})}
						</div>
					);
				})}
			</div>

			<div className="turn-bar__right">
				{activeFaction && (
					<div className={`turn-bar__active-faction turn-bar__active-faction--${activeFaction.toLowerCase()}`}>
						{FACTION_ICONS[activeFaction]}
						{FACTION_NAMES[activeFaction]}行动
					</div>
				)}

				<div className="turn-bar__turn-counter">
					<span className="turn-bar__turn-label">回合</span>
					<span className="turn-bar__turn-number">{turnCount}</span>
				</div>
			</div>
		</div>
	);
};

export default TurnBar;