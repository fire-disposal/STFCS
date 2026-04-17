/**
 * FluxSystemSection - 辐能系统编辑区
 */

import React, { useCallback } from "react";
import type { ShipState } from "@/sync/types";
import type { ShipCustomizationConfig } from "@vt/data";

interface FluxSystemSectionProps {
	config: ShipCustomizationConfig;
	onChange: (updates: Partial<ShipCustomizationConfig>) => void;
	disabled?: boolean;
	ship: ShipState;
}

export const FluxSystemSection: React.FC<FluxSystemSectionProps> = ({
	config,
	onChange,
	disabled = false,
	ship,
}) => {
	return (
		<div className="ship-customization-section__grid">
			{/* 辐能容量上限 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">辐能容量上限</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.fluxCapacityMax ?? ship.flux.max}
					onChange={(e) => onChange({ fluxCapacityMax: Number(e.target.value) })}
					min={0}
					disabled={disabled}
				/>
			</div>

			{/* 辐能散逸率 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">每回合散逸量</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.fluxDissipation ?? ship.flux.dissipation}
					onChange={(e) => onChange({ fluxDissipation: Number(e.target.value) })}
					min={0}
					disabled={disabled}
				/>
			</div>

			{/* 当前软辐能 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">当前软辐能</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.fluxSoftCurrent ?? ship.flux.soft}
					onChange={(e) => onChange({ fluxSoftCurrent: Number(e.target.value) })}
					min={0}
					max={config.fluxCapacityMax ?? ship.flux.max}
					disabled={disabled}
				/>
			</div>

			{/* 当前硬辐能 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">当前硬辐能</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.fluxHardCurrent ?? ship.flux.hard}
					onChange={(e) => onChange({ fluxHardCurrent: Number(e.target.value) })}
					min={0}
					max={config.fluxCapacityMax ?? ship.flux.max}
					disabled={disabled}
				/>
			</div>

			{/* 过载状态显示 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">过载状态</label>
				<div className="ship-customization-field__display">
					{ship.isOverloaded ? (
						<span style={{ color: "#e74c3c" }}>过载</span>
					) : (
						<span style={{ color: "#2ecc71" }}>正常</span>
					)}
				</div>
			</div>
		</div>
	);
};

export default FluxSystemSection;