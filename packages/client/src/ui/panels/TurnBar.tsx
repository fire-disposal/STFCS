/**
 * TurnBar - 阶段标签 + 回合数 + 派系线（含三角指针）
 */

import React from "react";
import { GamePhase } from "@vt/data";
import "./turn-bar.css";

interface TurnBarProps {
	phase: GamePhase;
	turnCount: number;
	activeFaction: string | undefined;
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
	initiativeOrder,
	factions,
}) => {
	const isActionPhase = phase === GamePhase.PLAYER_ACTION || phase === GamePhase.FACTION_ACTION;
	const currentIndex = isActionPhase && activeFaction && initiativeOrder
		? initiativeOrder.indexOf(activeFaction)
		: -1;

	return (
		<div className="turn-bar">
			<span className={`turn-bar__phase turn-bar__phase--${phase.toLowerCase()}`}>
				{PHASE_LABELS[phase] ?? phase}
			</span>

			{phase !== GamePhase.DEPLOYMENT && (
				<span className="turn-bar__round">轮 {turnCount}</span>
			)}

			{initiativeOrder && initiativeOrder.length > 0 && (
				<div className="turn-bar__faction-line">
					{isActionPhase && currentIndex >= 0 && (
						<div
							className="turn-bar__pointer"
							style={{ left: `calc(${(currentIndex / (initiativeOrder.length - 1 || 1)) * 100}% - 10px)` }}
						>
							<div className="turn-bar__pointer-triangle" />
						</div>
					)}
					{initiativeOrder.map((fid, i) => {
						const def = factions?.[fid];
						const isActive = isActionPhase && i === currentIndex;
						const done = isActionPhase && i < currentIndex;
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
		</div>
	);
};

export default TurnBar;
