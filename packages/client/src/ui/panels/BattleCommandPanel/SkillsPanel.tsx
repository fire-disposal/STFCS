/**
 * 技能面板模块
 * 护盾开关、辐能排散等技能控制
 */

import { Shield, Wind } from "lucide-react";
import React from "react";
import type { SkillsPanelProps } from "./types";
import "./SkillsPanel.css";

export const SkillsPanel: React.FC<SkillsPanelProps> = ({
	ship,
	disabled,
	onToggleShield,
	onVent,
}) => {
	const canToggleShield = !disabled || (ship.isOverloaded && !ship.shield.active);
	const canVent = !disabled && !ship.shield.active && ship.flux.soft + ship.flux.hard > 0;

	return (
		<div className="skills-panel">
			<div className="skills-panel__header">
				<span>技能</span>
			</div>
			<div className="skills-panel__buttons">
				<button
					className={`battle-btn battle-btn--shield ${ship.shield.active ? "battle-btn--active" : ""}`}
					onClick={onToggleShield}
					disabled={!canToggleShield}
				>
					<Shield className="battle-btn__icon" />
					{ship.shield.active ? "护盾" : "开盾"}
				</button>
				<button className="battle-btn battle-btn--vent" onClick={onVent} disabled={!canVent}>
					<Wind className="battle-btn__icon" />
					排散
				</button>
			</div>
		</div>
	);
};

export default SkillsPanel;
