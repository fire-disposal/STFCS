/**
 * 阶段状态条组件
 *
 * 显示在顶部状态栏中央的长条组件：
 * - 当前阶段（部署 / 玩家回合 / 结算）
 * - 回合数
 * - 活跃阵营
 * - 阶段进度指示
 */

import type { PlayerRoleValue } from "@/sync/types";
import { Faction } from "@/sync/types";
import { Crown, MapPin, Skull, User, Zap } from "lucide-react";
import React, { useMemo } from "react";

const phaseNames: Record<string, string> = {
	DEPLOYMENT: "部署阶段",
	PLAYER_TURN: "玩家回合",
	DM_TURN: "DM回合",
	END_PHASE: "结算阶段",
};

interface PhaseConfig {
	id: string;
	name: string;
	color: string;
	Icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
}

const phases: PhaseConfig[] = [
	{ id: "DEPLOYMENT", name: "部署", color: "#9b59b6", Icon: MapPin },
	{ id: "PLAYER_TURN", name: "玩家", color: "#4a9eff", Icon: User },
	{ id: "DM_TURN", name: "DM", color: "#e74c3c", Icon: Skull },
	{ id: "END_PHASE", name: "结算", color: "#f1c40f", Icon: Zap },
];

interface PhaseBarProps {
	currentPhase: string;
	turnCount: number;
	activeFaction: string;
	playerRole: PlayerRoleValue;
}

export const PhaseBar: React.FC<PhaseBarProps> = ({
	currentPhase,
	turnCount,
	activeFaction,
	playerRole,
}) => {
	const currentPhaseIndex = useMemo(() => {
		return phases.findIndex((p) => p.id === currentPhase);
	}, [currentPhase]);

	const currentConfig = phases[currentPhaseIndex] || phases[0];
	const isPlayerFaction = activeFaction === Faction.PLAYER;

	return (
		<div className="phase-bar">
			{/* 阶段指示 */}
			<div className="phase-bar__phase" style={{ borderColor: currentConfig.color }}>
				<currentConfig.Icon className="phase-bar__icon" style={{ color: currentConfig.color }} />
				<span className="phase-bar__label">{phaseNames[currentPhase] || currentPhase}</span>
			</div>

			{/* 分隔符 */}
			<div className="phase-bar__separator" />

			{/* 回合计数 */}
			<div className="phase-bar__turn">
				<span className="phase-bar__turn-label">回合</span>
				<span className="phase-bar__turn-number">{turnCount}</span>
			</div>

			{/* 分隔符 */}
			<div className="phase-bar__separator" />

			{/* 阵营指示 */}
			<div
				className={`phase-bar__faction ${
					isPlayerFaction ? "phase-bar__faction--player" : "phase-bar__faction--dm"
				}`}
			>
				{isPlayerFaction ? (
					<>
						<User className="phase-bar__faction-icon" />
						<span>玩家</span>
					</>
				) : (
					<>
						<Crown className="phase-bar__faction-icon" />
						<span>DM</span>
					</>
				)}
			</div>

			{/* 阶段进度点 */}
			<div className="phase-bar__dots">
				{phases.map((phase, index) => {
					const isActive = phase.id === currentPhase;
					const isPast = index < currentPhaseIndex;

					return (
						<div
							key={phase.id}
							className={`phase-bar__dot ${
								isActive
									? "phase-bar__dot--active"
									: isPast
										? "phase-bar__dot--past"
										: "phase-bar__dot--future"
							}`}
							style={{
								backgroundColor: isActive || isPast ? phase.color : "rgba(255,255,255,0.2)",
							}}
						/>
					);
				})}
			</div>
		</div>
	);
};

export default PhaseBar;
