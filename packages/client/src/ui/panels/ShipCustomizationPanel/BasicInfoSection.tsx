/**
 * BasicInfoSection - 基本信息编辑区
 *
 * 编辑舰船的基本信息：
 * - 名称
 * - 原型模板（显示）
 * - 尺寸
 */

import React, { useCallback } from "react";
import { getShipHullSpec } from "@vt/data";
import type { ShipCustomizationConfig, HullSizeValue } from "@vt/data";

interface BasicInfoSectionProps {
	config: ShipCustomizationConfig;
	onChange: (updates: Partial<ShipCustomizationConfig>) => void;
	disabled?: boolean;
}

export const BasicInfoSection: React.FC<BasicInfoSectionProps> = ({
	config,
	onChange,
	disabled = false,
}) => {
	// 获取舰船规格（用于显示模板信息）
	const hullSpec = config.hullType ? getShipHullSpec(config.hullType) : null;

	return (
		<div className="ship-customization-section__grid">
			{/* 名称 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">舰船名称</label>
				<input
					className="ship-customization-field__input"
					type="text"
					value={config.name || ""}
					onChange={(e) => onChange({ name: e.target.value })}
					placeholder="输入舰船名称"
					disabled={disabled}
				/>
			</div>

			{/* 原型模板（仅显示） */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">原型模板</label>
				<div className="ship-customization-field__display">
					{hullSpec ? hullSpec.name : config.hullType || "自定义"}
				</div>
			</div>

			{/* 尺寸选择 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">舰船尺寸</label>
				<select
					className="ship-customization-field__select"
					value={config.size || hullSpec?.size || "FRIGATE"}
					onChange={(e) => onChange({ size: e.target.value as HullSizeValue })}
					disabled={disabled}
				>
					<option value="FRIGATE">护卫舰 (FRIGATE)</option>
					<option value="DESTROYER">驱逐舰 (DESTROYER)</option>
					<option value="CRUISER">巡洋舰 (CRUISER)</option>
					<option value="CAPITAL">主力舰 (CAPITAL)</option>
				</select>
			</div>

			{/* 宽度 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">船体宽度</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.width || hullSpec?.width || 50}
					onChange={(e) => onChange({ width: Number(e.target.value) })}
					min={10}
					disabled={disabled}
				/>
			</div>

			{/* 长度 */}
			<div className="ship-customization-field">
				<label className="ship-customization-field__label">船体长度</label>
				<input
					className="ship-customization-field__input"
					type="number"
					value={config.length || hullSpec?.length || 100}
					onChange={(e) => onChange({ length: Number(e.target.value) })}
					min={10}
					disabled={disabled}
				/>
			</div>
		</div>
	);
};

export default BasicInfoSection;