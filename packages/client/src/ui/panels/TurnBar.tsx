/**
 * TurnBar - 紧凑回合条组件
 *
 * 布局：
 * 阶段徽章 | 准备按钮 | 推进按钮 | 回合计数
 */

import React, { useMemo } from "react";
import { Crown, FastForward, CheckCircle } from "lucide-react";
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
	PLAYER_ACTION: "玩家",
	DM_ACTION: "DM",
	TURN_END: "结算",
};

const FACTION_NAMES: Record<Faction, string> = {
	PLAYER: "玩家",
	ENEMY: "敌方",
	NEUTRAL: "中立",
};

export const TurnBar: React.FC<TurnBarProps> = ({
	phase,
	turnCount,
	activeFaction,
	isHost,
	isReady,
	onReadyToggle,
	onAdvancePhase,
}) => {
	const phaseColorClass = useMemo(() => {
		switch (phase) {
			case GamePhase.DEPLOYMENT:
				return "turn-bar__phase--deployment";
			case GamePhase.PLAYER_ACTION:
				return "turn-bar__phase--player";
			case GamePhase.DM_ACTION:
				return "turn-bar__phase--dm";
			case GamePhase.TURN_END:
				return "turn-bar__phase--end";
			default:
				return "";
		}
	}, [phase]);

	const getAdvanceLabel = () => {
		switch (phase) {
			case GamePhase.DEPLOYMENT:
				return "开始";
			case GamePhase.PLAYER_ACTION:
				return "推进";
			case GamePhase.DM_ACTION:
				return "结算";
			default:
				return "推进";
		}
	};

	return (
		<div className="turn-bar-compact">
			<div className={`turn-bar-compact__phase ${phaseColorClass}`}>
				{phase === GamePhase.DM_ACTION && <Crown size={14} />}
				{PHASE_NAMES[phase]}
			</div>

			{activeFaction && (
				<div className={`turn-bar-compact__faction turn-bar-compact__faction--${activeFaction.toLowerCase()}`}>
					{FACTION_NAMES[activeFaction]}
				</div>
			)}

			{phase === GamePhase.DEPLOYMENT && (
				<button
					className="turn-bar-compact__btn"
					onClick={onReadyToggle}
					style={{
						background: isReady ? "rgba(87, 227, 141, 0.15)" : "rgba(245, 158, 11, 0.15)",
						color: isReady ? "#2ecc71" : "#f59e0b",
						borderColor: isReady ? "rgba(87, 227, 141, 0.4)" : "rgba(245, 158, 11, 0.4)",
					}}
				>
					<CheckCircle size={14} />
					{isReady ? "就绪" : "准备"}
				</button>
			)}

			<button
				className={`turn-bar-compact__btn ${isHost ? "" : "turn-bar-compact__btn--disabled"}`}
				onClick={onAdvancePhase}
				disabled={!isHost}
			>
				<FastForward size={14} />
				{getAdvanceLabel()}
			</button>

			<div className="turn-bar-compact__turn">
				<span>T{turnCount}</span>
			</div>
		</div>
	);
};

export default TurnBar;