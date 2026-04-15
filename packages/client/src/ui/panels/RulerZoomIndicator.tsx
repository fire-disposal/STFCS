/**
 * 表尺风格缩放指示器组件
 * 使用设计系统变量，支持高分辨率屏幕
 */

import React, { useMemo } from "react";
import { ZoomIn, ZoomOut, RefreshCw } from "lucide-react";
import { useTranslation } from "react-i18next";

interface RulerZoomIndicatorProps {
	zoom: number;
	minZoom: number;
	maxZoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onReset: () => void;
}

interface RulerTick {
	position: number;
	type: "major" | "medium" | "minor";
}

export const RulerZoomIndicator: React.FC<RulerZoomIndicatorProps> = ({
	zoom,
	minZoom,
	maxZoom,
	onZoomIn,
	onZoomOut,
	onReset,
}) => {
	const { t } = useTranslation();

	// 计算当前位置百分比
	const positionPercent = Math.max(0, Math.min(100,
		((zoom - minZoom) / (maxZoom - minZoom)) * 100
	));

	// 获取比例尺标签
	const getScaleLabel = (z: number): string => {
		if (z >= 3) return "1:100";
		if (z >= 2) return "1:250";
		if (z >= 1.5) return "1:500";
		if (z >= 1) return "1:1000";
		if (z >= 0.75) return "1:2500";
		return "1:5000";
	};

	// 生成刻度
	const ticks = useMemo<RulerTick[]>(() => {
		const result: RulerTick[] = [];
		for (let i = 0; i <= 20; i++) {
			const position = (i / 20) * 100;
			let type: RulerTick["type"] = "minor";
			if (i % 10 === 0) type = "major";
			else if (i % 5 === 0) type = "medium";
			result.push({ position, type });
		}
		return result;
	}, []);

	// 判断是否禁用按钮
	const isZoomOutDisabled = zoom <= minZoom;
	const isZoomInDisabled = zoom >= maxZoom;

	return (
		<div className="ruler-zoom-indicator">
			{/* 数值显示区 */}
			<div className="ruler-zoom-values">
				<span className="ruler-zoom-percentage">{(zoom * 100).toFixed(0)}%</span>
				<span className="ruler-zoom-scale">{getScaleLabel(zoom)}</span>
			</div>

			{/* 表尺主体 */}
			<div className="ruler-scale-container">
				<div className="ruler-scale-track">
					{ticks.map((tick, index) => (
						<div
							key={index}
							className={`ruler-tick ruler-tick--${tick.type}`}
							style={{ left: `${tick.position}%` }}
						/>
					))}
				</div>

				{/* 当前值指示器 - 竖线风格 */}
				<div
					className="ruler-value-indicator"
					style={{ left: `${positionPercent}%` }}
				>
					<span className="ruler-value-label">{zoom.toFixed(2)}x</span>
				</div>
			</div>

			{/* 控制按钮 */}
			<div className="ruler-zoom-controls">
				<button
					className="btn btn-secondary btn-icon ruler-zoom-btn"
					onClick={onZoomOut}
					disabled={isZoomOutDisabled}
					title={t("zoom.out")}
					type="button"
				>
					<ZoomOut style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
				</button>
				<button
					className="btn btn-secondary btn-icon ruler-zoom-btn ruler-zoom-btn--reset"
					onClick={onReset}
					title={t("zoom.reset")}
					type="button"
				>
					<RefreshCw style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
				</button>
				<button
					className="btn btn-secondary btn-icon ruler-zoom-btn"
					onClick={onZoomIn}
					disabled={isZoomInDisabled}
					title={t("zoom.in")}
					type="button"
				>
					<ZoomIn style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
				</button>
			</div>

			<style>{`
				.ruler-zoom-indicator {
					display: flex;
					align-items: center;
					gap: var(--space-3);
					padding: var(--space-2) var(--space-3);
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-sm);
				}

				.ruler-zoom-values {
					display: flex;
					flex-direction: column;
					align-items: flex-end;
					min-width: var(--width-xs);
				}

				.ruler-zoom-percentage {
					font-family: var(--font-mono);
					font-size: var(--text-md);
					font-weight: var(--font-semibold);
					color: var(--color-primary);
					line-height: var(--leading-tight);
					text-shadow: 0 0 8px var(--color-primary-glow);
				}

				.ruler-zoom-scale {
					font-family: var(--font-mono);
					font-size: var(--text-xs);
					color: var(--text-tertiary);
					margin-top: var(--space-1);
				}

				.ruler-scale-container {
					position: relative;
					width: clamp(160px, 20vw, 200px);
					height: var(--height-md);
					display: flex;
					align-items: center;
				}

				.ruler-scale-track {
					width: 100%;
					height: 2px;
					background: rgba(74, 158, 255, 0.15);
					position: relative;
				}

				.ruler-tick {
					position: absolute;
					top: 50%;
					transform: translateY(-50%);
					width: 1px;
					background: rgba(74, 158, 255, 0.4);
					transition: var(--transition-fast);
				}

				.ruler-tick--major {
					height: clamp(10px, 1.5vw, 12px);
					background: rgba(74, 158, 255, 0.6);
				}

				.ruler-tick--medium {
					height: clamp(6px, 1vw, 8px);
					background: rgba(74, 158, 255, 0.5);
				}

				.ruler-tick--minor {
					height: clamp(4px, 0.6vw, 5px);
					background: rgba(74, 158, 255, 0.3);
				}

				.ruler-value-indicator {
					position: absolute;
					top: 0;
					bottom: 0;
					width: 2px;
					background: linear-gradient(
						180deg,
						transparent 0%,
						var(--color-primary) 15%,
						var(--color-primary) 85%,
						transparent 100%
					);
					box-shadow:
						0 0 6px var(--color-primary-glow),
						0 0 12px var(--color-primary-glow);
					transition: left var(--transition-fast);
					pointer-events: none;
					transform: translateX(-50%);
				}

				.ruler-value-indicator::before {
					content: '';
					position: absolute;
					bottom: -3px;
					left: 50%;
					transform: translateX(-50%);
					width: 0;
					height: 0;
					border-left: 3px solid transparent;
					border-right: 3px solid transparent;
					border-bottom: 4px solid var(--color-primary);
				}

				.ruler-value-label {
					position: absolute;
					bottom: -20px;
					left: 50%;
					transform: translateX(-50%);
					font-family: var(--font-mono);
					font-size: var(--text-xs);
					color: var(--color-primary);
					background: var(--bg-primary);
					padding: var(--space-1) var(--space-2);
					border: 1px solid rgba(74, 158, 255, 0.4);
					white-space: nowrap;
					border-radius: var(--radius-none);
				}

				.ruler-zoom-controls {
					display: flex;
					gap: var(--space-1);
				}

				.ruler-zoom-btn {
					width: var(--height-sm) !important;
					height: var(--height-sm) !important;
					padding: 0 !important;
				}

				.ruler-zoom-btn--reset {
					width: calc(var(--height-sm) + 4px) !important;
				}

				.ruler-zoom-btn--reset:hover svg {
					animation: spin 0.8s linear infinite;
				}

				@keyframes spin {
					from { transform: rotate(0deg); }
					to { transform: rotate(360deg); }
				}

				/* 悬停时高亮附近刻度 */
				.ruler-scale-container:hover .ruler-tick {
					background: rgba(74, 158, 255, 0.5);
				}

				.ruler-scale-container:hover .ruler-tick--major {
					background: rgba(74, 158, 255, 0.8);
				}

				/* 高分辨率屏幕适配 */
				@media (min-width: 2560px) {
					.ruler-scale-container {
						width: 240px;
					}
					
					.ruler-tick--major {
						height: 14px;
					}
					
					.ruler-tick--medium {
						height: 10px;
					}
				}
			`}</style>
		</div>
	);
};

export default RulerZoomIndicator;
