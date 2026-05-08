/**
 * TurnBar - 阶段标签 + 回合数 + 派系卡片列 + 三角指针
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
					{initiativeOrder.map((fid, i) => {
						const def = factions?.[fid];
						const isActive = isActionPhase && i === currentIndex;
						const done = isActionPhase && i < currentIndex;
						return (
							<div
								key={fid}
								className={`turn-bar__card ${isActive ? "turn-bar__card--active" : done ? "turn-bar__card--done" : ""}`}
								style={{ borderColor: isActive ? def?.color ?? "#4a9eff" : "transparent" }}
							>
								<div
									className="turn-bar__flag"
									style={def ? { background: def.color } : { background: "#888" }}
								>
									<span className="turn-bar__flag-initial">
										{def?.name?.charAt(0) ?? "?"}
									</span>
								</div>
								<span className="turn-bar__card-name">{def?.name ?? fid}</span>
								{isActive && (
									<div className="turn-bar__pointer">
										<div className="turn-bar__pointer-triangle" />
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}
		</div>
	);
};

export default TurnBar;
