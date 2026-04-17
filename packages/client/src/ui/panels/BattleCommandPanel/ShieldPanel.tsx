/**
 * 护盾控制面板
 * 简化版：无容器/标题，直接填充Tab内容区
 */

import { Shield, Lock } from "lucide-react";
import React, { useCallback, useState } from "react";
import { ShieldType } from "@/sync/types";
import type { ShieldPanelProps } from "./types";
import "./ShieldPanel.css";

const normalizeAngle = (angle: number): number => {
	let normalized = angle % 360;
	if (normalized < 0) normalized += 360;
	return Math.round(normalized);
};

export const ShieldPanel: React.FC<ShieldPanelProps> = ({
	ship,
	disabled,
	onToggleShield,
	onSetShieldOrientation,
}) => {
	const currentOrientation = ship?.shield?.orientation ?? 0;
	const normalizedOrientation = normalizeAngle(currentOrientation);

	const [inputAngle, setInputAngle] = useState<string>(() => String(normalizedOrientation));

	const hasShield = ship?.shield?.type !== ShieldType.NONE && ship?.shield?.max > 0;
	const isOmniShield = ship?.shield?.type === ShieldType.OMNI;
	const isOverloaded = ship?.isOverloaded;
	const shieldActive = ship?.shield?.active;

	const canToggleShield = !disabled && !isOverloaded;
	const canAdjustOrientation = !disabled && !isOverloaded && shieldActive && isOmniShield;

	const shieldArc = ship?.shield?.arc ?? 120;
	const shieldEfficiency = ship?.shield?.efficiency ?? 1.0;

	// 滑动条变化
	const handleSliderChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			if (!canAdjustOrientation || !onSetShieldOrientation) return;
			const angle = normalizeAngle(Number(e.target.value));
			onSetShieldOrientation(angle);
		},
		[canAdjustOrientation, onSetShieldOrientation]
	);

	// 输入框变化
	const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
		const value = e.target.value;
		if (value === "" || /^\d+$/.test(value)) {
			setInputAngle(value);
		}
	}, []);

	// 输入确认
	const handleInputConfirm = useCallback(() => {
		if (!canAdjustOrientation || !onSetShieldOrientation) return;
		const angle = parseInt(inputAngle, 10);
		if (!isNaN(angle) && angle >= 0 && angle <= 360) {
			onSetShieldOrientation(normalizeAngle(angle));
		} else {
			setInputAngle(String(normalizedOrientation));
		}
	}, [canAdjustOrientation, inputAngle, normalizedOrientation, onSetShieldOrientation]);

	// 步进
	const handleStep = useCallback(
		(delta: number) => {
			if (!canAdjustOrientation || !onSetShieldOrientation) return;
			onSetShieldOrientation(normalizeAngle(currentOrientation + delta));
		},
		[canAdjustOrientation, currentOrientation, onSetShieldOrientation]
	);

	// 无护盾
	if (!hasShield) {
		return (
			<div className="shield-empty">
				<Shield className="shield-empty__icon" />
				<span>无护盾</span>
			</div>
		);
	}

	return (
		<div className={`shield-content ${isOverloaded ? "shield-content--overloaded" : ""}`}>
			{/* 开关按钮 */}
			<button
				className={`shield-toggle ${shieldActive ? "shield-toggle--active" : ""} ${isOverloaded ? "shield-toggle--overloaded" : ""}`}
				onClick={onToggleShield}
				disabled={!canToggleShield}
			>
				{shieldActive && !isOverloaded && <Lock className="shield-toggle__lock" />}
				<span>{isOverloaded ? "过载" : shieldActive ? "ON" : "OFF"}</span>
			</button>

			{/* 属性信息 */}
			<div className="shield-stats">
				<span>{isOmniShield ? "全盾" : "前盾"}</span>
				<span>弧 {shieldArc}°</span>
				<span>效 {shieldEfficiency.toFixed(1)}</span>
			</div>

			{/* 朝向调整（仅全盾激活时） */}
			{isOmniShield && (
				<div className={`shield-orientation ${!canAdjustOrientation ? "shield-orientation--disabled" : ""}`}>
					<div className="shield-orientation__label">
						<span>朝向</span>
						{!shieldActive && <span className="shield-orientation__hint">需激活</span>}
					</div>

					{/* 滑动条 */}
					<input
						type="range"
						className="shield-slider"
						min={0}
						max={360}
						step={1}
						value={normalizedOrientation}
						onChange={handleSliderChange}
						disabled={!canAdjustOrientation}
					/>

					{/* 角度输入 */}
					<div className="shield-orientation__input">
						<button className="shield-step-btn" onClick={() => handleStep(-15)} disabled={!canAdjustOrientation}>−</button>
						<input
							type="text"
							className="shield-angle-input"
							value={inputAngle}
							onChange={handleInputChange}
							onBlur={handleInputConfirm}
							onKeyDown={(e) => e.key === "Enter" && handleInputConfirm()}
							disabled={!canAdjustOrientation}
						/>
						<span>°</span>
						<button className="shield-step-btn" onClick={() => handleStep(15)} disabled={!canAdjustOrientation}>+</button>
					</div>
				</div>
			)}
		</div>
	);
};

export default ShieldPanel;