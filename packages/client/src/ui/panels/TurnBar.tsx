/**
 * TurnBar - 回合条组件
 *
 * 布局：
 * 阶段徽章 | 轮次 | 派系进度条 | 准备按钮 | 推进按钮
 * 
 * 概念说明：
 * - 轮（Turn）：所有派系完成一次行动为一轮，turnCount
 * - 回合（Phase）：当前行动中的派系阶段，activeFaction
 * - 派系进度条：显示 TURN_ORDER 中所有派系的行动状态
 * 
 * 准备按钮：
 * - 部署阶段：表示"游戏开始准备"
 * - 行动回合：表示"本派系操作完毕"
 */

import React, { useMemo } from "react";
import { FastForward, CheckCircle } from "lucide-react";
import { GamePhase, Faction, FactionLabels, TURN_ORDER } from "@vt/data";
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
	PLAYER_ACTION: "行动",
};

/** 派系缩写标签 */
const FACTION_SHORT_LABELS: Record<string, string> = {
	PLAYER_ALLIANCE: "联",
	FATE_GRIP: "命",
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
			default:
				return "";
		}
	}, [phase]);

	const getAdvanceLabel = () => {
		switch (phase) {
			case GamePhase.DEPLOYMENT:
				return "开始";
			case GamePhase.PLAYER_ACTION:
				return isLastFaction ? "结算回合" : "推进";
			default:
				return "推进";
		}
	};

	// 判断当前 activeFaction 是否是 TURN_ORDER 中的最后一个派系
	const isLastFaction = useMemo(() => {
		if (!activeFaction || phase !== GamePhase.PLAYER_ACTION) return false;
		return TURN_ORDER.indexOf(activeFaction) === TURN_ORDER.length - 1;
	}, [activeFaction, phase]);

	// 计算每个派系在进度条中的状态
	const factionTrackItems = useMemo(() => {
		if (phase !== GamePhase.PLAYER_ACTION || !activeFaction) return [];

		const currentIndex = TURN_ORDER.indexOf(activeFaction);

		return TURN_ORDER.map((faction, index) => {
			let status: "done" | "active" | "pending";
			if (index < currentIndex) {
				status = "done";
			} else if (index === currentIndex) {
				status = "active";
			} else {
				status = "pending";
			}

			return {
				faction,
				status,
				label: FACTION_SHORT_LABELS[faction] ?? faction.slice(0, 1),
			};
		});
	}, [phase, activeFaction]);

	// 准备按钮文案
	const getReadyLabel = () => {
		if (phase === GamePhase.DEPLOYMENT) {
			return isReady ? "就绪" : "准备";
		}
		return isReady ? "完毕" : "操作中";
	};

	// 准备按钮在所有阶段显示
	const showReadyButton = true;

	return (
		<div className="turn-bar-compact">
			{/* 阶段徽章 */}
			<div className={`turn-bar-compact__phase ${phaseColorClass}`}>
				{PHASE_NAMES[phase]}
			</div>

			{/* 轮次计数 */}
			{phase === GamePhase.PLAYER_ACTION && (
				<div className="turn-bar-compact__turn">
					<span className="turn-bar-compact__turn-label">轮</span>
					<span className="turn-bar-compact__turn-number">{turnCount}</span>
				</div>
			)}

			{/* 派系进度条 */}
			{factionTrackItems.length > 0 && (
				<div className="turn-bar-compact__faction-track">
					{factionTrackItems.map((item, index) => (
						<React.Fragment key={item.faction}>
							{index > 0 && <div className="turn-bar-compact__faction-divider" />}
							<div
								className={`turn-bar-compact__faction-dot turn-bar-compact__faction-dot--${item.status} turn-bar-compact__faction-dot--${item.faction.toLowerCase()}`}
								title={`${FactionLabels[item.faction]} - ${item.status === "done" ? "已完成" : item.status === "active" ? "行动中" : "待行动"}`}
							>
								{item.label}
							</div>
						</React.Fragment>
					))}
				</div>
			)}

			{/* 准备按钮 */}
			{showReadyButton && (
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
					{getReadyLabel()}
				</button>
			)}

			{/* 推进按钮 */}
			<button
				className={`turn-bar-compact__btn ${isHost ? "" : "turn-bar-compact__btn--disabled"} ${isLastFaction ? "turn-bar-compact__btn--turn-end" : ""}`}
				onClick={onAdvancePhase}
				disabled={!isHost}
				style={isLastFaction ? {
					background: "rgba(239, 68, 68, 0.2)",
					color: "#ef4444",
					borderColor: "rgba(239, 68, 68, 0.5)",
				} : undefined}
			>
				<FastForward size={14} />
				{getAdvanceLabel()}
			</button>
		</div>
	);
};

export default TurnBar;
