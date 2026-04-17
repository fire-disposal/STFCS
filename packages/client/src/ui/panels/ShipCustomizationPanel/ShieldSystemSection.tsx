/**
 * ShieldSystemSection - 护盾系统编辑区
 */

import React, { useCallback } from "react";
import type { ShipState } from "@/sync/types";
import type { ShipCustomizationConfig, ShieldTypeValue } from "@vt/data";

interface ShieldSystemSectionProps {
	config: ShipCustomizationConfig;
	onChange: (updates: Partial<ShipCustomizationConfig>) => void;
	disabled?: boolean;
	ship: ShipState;
}

export const ShieldSystemSection: React.FC<ShieldSystemSectionProps> = ({
	config,
	onChange,
	disabled = false,
	ship,
}) => {
	// 是否有护盾
	const hasShield = ship.shield.type !== "NONE";

	if (!hasShield) {
		return (
			<div className="ship-customization-empty">
				该舰船无护盾系统
			</div>
		);
	}

	return (
		<div className="ship-customization-section__grid">
			{/* 护盾类型 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">护盾类型</label>
				<select
					className="ship-customization-field__select"
					value={config.shieldType ?? ship.shield.type}
					onChange={(e) => onChange({ shieldType: e.target.value as ShieldTypeValue })}
					disabled={disabled}
				>
					<option value="FRONT">前盾 (FRONT)</option>
					<option value="OMNI">全盾 (OMNI)</option>
					<option value="NONE">无盾 (NONE)</option>
				</select>
			</div>

			{/* 覆盖角度 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">覆盖角度</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.shieldArc ?? ship.shield.arc}
					onChange={(e) => onChange({ shieldArc: Number(e.target.value) })}
					min={0}
					max={360}
					disabled={disabled}
				/>
			</div>

			{/* 效率 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">效率倍率</label>
				<input
					className="ship-customization-field__input"
					type="number"
					step="0.1"
					value={config.shieldEfficiency ?? ship.shield.efficiency}
					onChange={(e) => onChange({ shieldEfficiency: Number(e.target.value) })}
					min={0.1}
					max={2}
					disabled={disabled}
				/>
			</div>

			{/* 护盾半径 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">护盾半径</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.shieldRadius ?? ship.shield.radius}
					onChange={(e) => onChange({ shieldRadius: Number(e.target.value) })}
					min={0}
					disabled={disabled}
				/>
			</div>

			{/* 当前状态 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">当前状态</label>
				<div className="ship-customization-field__display">
					{ship.shield.active ? (
						<span style={{ color: "#4a9eff" }}>开启</span>
					) : (
						<span style={{ color: "#8ba4c7" }}>关闭</span>
					)}
				</div>
			</div>
		</div>
	);
};

export default ShieldSystemSection;