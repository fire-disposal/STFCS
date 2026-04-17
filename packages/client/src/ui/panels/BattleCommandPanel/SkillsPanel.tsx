/**
 * 技能面板
 * 简化版：无容器/标题，直接填充Tab内容区
 */

import { Wind } from "lucide-react";
import React from "react";
import type { SkillsPanelProps } from "./types";
import "./SkillsPanel.css";

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
	ship,
	disabled,
	onVent,
}) => {
	// 排散条件
	const canVent = !disabled && !ship.shield.active && ship.flux.soft + ship.flux.hard > 0;

	// 辐能信息
	const fluxSoft = ship?.flux?.soft ?? 0;
	const fluxHard = ship?.flux?.hard ?? 0;
	const fluxTotal = fluxSoft + fluxHard;
	const fluxMax = ship?.flux?.max ?? 0;
	const fluxPercent = fluxMax > 0 ? Math.round((fluxTotal / fluxMax) * 100) : 0;

	return (
		<div className="skills-content">
			{/* 辐能状态 */}
			<div className="skills-flux">
				<span className="skills-flux__label">辐能</span>
				<div className="skills-flux__bar">
					<div className="skills-flux__fill" style={{ width: `${fluxPercent}%` }} />
				</div>
				<span className="skills-flux__value">{fluxTotal}/{fluxMax}</span>
			</div>

			{/* 排散按钮 */}
			<button
				className={`skills-vent ${canVent ? "skills-vent--ready" : "skills-vent--blocked"}`}
				onClick={onVent}
				disabled={!canVent}
				title={ship.shield.active ? "关闭护盾后可排散" : "清空所有辐能"}
			>
				<Wind className="skills-vent__icon" />
				<span>排散</span>
			</button>

			{/* 提示 */}
			{ship.shield.active && (
				<span className="skills-hint">需关闭护盾</span>
			)}
		</div>
	);
};

export default SkillsPanel;