/**
 * TurnBar - 阶段标签 + 回合数 + 派系线 + 准备按钮
 *
 * 派系线：initiativeOrder 的各个 faction 从左到右排列，
 * 当前活跃的派系下方有一个带滑动动画的三角指针。
 */

import React, { useMemo } from "react";
import { CheckCircle } from "lucide-react";
import { GamePhase } from "@vt/data";
import type { RoomPlayerState, CombatToken } from "@vt/data";
import "./turn-bar.css";

interface TurnBarProps {
	phase: GamePhase;
	turnCount: number;
	activeFaction: string | undefined;
	players: Record<string, RoomPlayerState>;
	tokens?: CombatToken[];
	currentFaction?: string | undefined;
	isReady: boolean;
	onReadyToggle: () => void;
	initiativeOrder?: string[];
	factions?: Record<string, { name: string; color: string; flagAssetId?: string }>;
}

const PHASE_LABELS: Record<string, string> = {
	DEPLOYMENT: "部署",
	PLAYER_ACTION: "行动",
	FACTION_ACTION: "派系行动",
	SETTLEMENT: "结算中",
};

export const TurnBar: React.FC<TurnBarProps> = ({
	phase,
	turnCount,
	activeFaction,
	players,
	tokens,
	currentFaction,
	isReady,
	onReadyToggle,
	initiativeOrder,
	factions,
}) => {
	const readyCount = useMemo(() =>
		Object.values(players).filter((p) => p.connected && p.isReady).length,
		[players]
	);
	const totalPlayers = useMemo(() =>
		Object.values(players).filter((p) => p.connected).length,
		[players]
	);

	const isActionPhase = phase === GamePhase.PLAYER_ACTION || phase === GamePhase.FACTION_ACTION;
	const isMyTurn = isActionPhase && activeFaction === currentFaction;

	const currentIndex = activeFaction && initiativeOrder
		? initiativeOrder.indexOf(activeFaction)
		: -1;

	return (
		<div className="turn-bar">
			{/* 阶段标签 */}
			<span className={`turn-bar__phase turn-bar__phase--${phase.toLowerCase()}`}>
				{PHASE_LABELS[phase] ?? phase}
			</span>

			{/* 回合数 */}
			{phase !== GamePhase.DEPLOYMENT && (
				<span className="turn-bar__round">轮 {turnCount}</span>
			)}

			{/* 部署阶段：就绪人数 */}
			{phase === GamePhase.DEPLOYMENT && (
				<span className="turn-bar__ready-count">
					{readyCount}/{totalPlayers}
				</span>
			)}

			{/* 派系线（含指针） */}
			{isActionPhase && initiativeOrder && initiativeOrder.length > 0 && (
				<div className="turn-bar__faction-line">
					{/* 三角指针：CSS left 动画滑动 */}
					{currentIndex >= 0 && (
						<div
							className="turn-bar__pointer"
							style={{
								left: `calc(${(currentIndex / (initiativeOrder.length - 1 || 1)) * 100}% - 10px)`,
							}}
						>
							<div className="turn-bar__pointer-triangle" />
						</div>
					)}
					{initiativeOrder.map((fid, i) => {
						const def = factions?.[fid];
						const isActive = i === currentIndex;
						const done = i < currentIndex;
						return (
							<div
								key={fid}
								className={`turn-bar__faction-slot ${isActive ? "turn-bar__faction-slot--active" : done ? "turn-bar__faction-slot--done" : ""}`}
								style={{ color: def?.color }}
							>
								<span className="turn-bar__faction-dot" style={{ background: def?.color ?? "#888" }} />
								<span className="turn-bar__faction-name">{def?.name ?? fid}</span>
							</div>
						);
					})}
				</div>
			)}

			{/* 准备按钮 */}
			<button
				className={`turn-bar__btn ${isMyTurn ? "turn-bar__btn--active" : ""}`}
				onClick={onReadyToggle}
			>
				<CheckCircle size={12} />
				{phase === GamePhase.DEPLOYMENT ? (isReady ? "就绪" : "准备") : (isReady ? "完毕" : "操作中")}
			</button>
		</div>
	);
};

export default TurnBar;
