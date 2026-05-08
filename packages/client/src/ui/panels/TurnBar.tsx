/**
 * TurnBar - 阶段标签 + 回合数 + 派系线（含三角指针）
 *
 * 在任何阶段都显示派系线预览，FACTION_ACTION 阶段有活跃指针。
 */

import React from "react";
import { GamePhase } from "@vt/data";
import "./turn-bar.css";

interface TurnBarProps {
	phase: GamePhase;
	turnCount: number;
	activeFaction: string | undefined;
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
	isReady,
	onReadyToggle,
	initiativeOrder,
	factions,
}) => {
	const isActionPhase = phase === GamePhase.PLAYER_ACTION || phase === GamePhase.FACTION_ACTION;
	const currentIndex = isActionPhase && activeFaction && initiativeOrder
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

			{/* 派系线 */}
			{initiativeOrder && initiativeOrder.length > 0 && (
				<div className="turn-bar__faction-line">
					{/* 三角指针（仅行动阶段显示） */}
					{isActionPhase && currentIndex >= 0 && (
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

			{/* 准备按钮 */}
			<button
				className={`turn-bar__btn ${activeFaction ? "turn-bar__btn--active" : ""}`}
				onClick={onReadyToggle}
			>
				{phase === GamePhase.DEPLOYMENT
					? (isReady ? "✓ 已就绪" : "准备")
					: (isReady ? "✓ 完毕" : "待命")}
			</button>
		</div>
	);
};

export default TurnBar;
