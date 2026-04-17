/**
 * MobilitySection - 机动属性编辑区
 */

import React, { useCallback } from "react";
import type { ShipState } from "@/sync/types";
import type { ShipCustomizationConfig } from "@vt/data";

interface MobilitySectionProps {
	config: ShipCustomizationConfig;
	onChange: (updates: Partial<ShipCustomizationConfig>) => void;
	disabled?: boolean;
	ship: ShipState;
}

export const MobilitySection: React.FC<MobilitySectionProps> = ({
	config,
	onChange,
	disabled = false,
	ship,
}) => {
	return (
		<div className="ship-customization-section__grid">
			{/* 最大航速 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">每阶段航速</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.maxSpeed ?? ship.maxSpeed}
					onChange={(e) => onChange({ maxSpeed: Number(e.target.value) })}
					min={0}
					disabled={disabled}
				/>
			</div>

			{/* 最大转向速度 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">每回合转向角度</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.maxTurnRate ?? ship.maxTurnRate}
					onChange={(e) => onChange({ maxTurnRate: Number(e.target.value) })}
					min={0}
					max={180}
					disabled={disabled}
				/>
			</div>

			{/* 当前位置 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">当前位置 X</label>
				<div className="ship-customization-field__display">
					{ship.transform.x}
				</div>
			</div>

			<div className="ship-customization-field">
				<label className="ship-customization-field__label">当前位置 Y</label>
				<div className="ship-customization-field__display">
					{ship.transform.y}
				</div>
			</div>

			{/* 当前朝向 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">当前朝向</label>
				<div className="ship-customization-field__display">
					{ship.transform.heading}°
				</div>
			</div>
		</div>
	);
};

export default MobilitySection;