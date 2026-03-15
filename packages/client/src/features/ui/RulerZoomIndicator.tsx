/**
 * 表尺风格缩放指示器组件
 * 位于顶栏中央，提供精确的缩放控制和视觉反馈
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
					className="ruler-zoom-btn"
					onClick={onZoomOut}
					disabled={isZoomOutDisabled}
					title={t("zoom.out")}
					type="button"
				>
					<ZoomOut size={16} />
				</button>
				<button
					className="ruler-zoom-btn ruler-zoom-btn--reset"
					onClick={onReset}
					title={t("zoom.reset")}
					type="button"
				>
					<RefreshCw size={14} />
				</button>
				<button
					className="ruler-zoom-btn"
					onClick={onZoomIn}
					disabled={isZoomInDisabled}
					title={t("zoom.in")}
					type="button"
				>
					<ZoomIn size={16} />
				</button>
			</div>

			<style>{`
				.ruler-zoom-indicator {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 4px 12px;
					background: rgba(15, 18, 28, 0.9);
					border: 1px solid rgba(74, 158, 255, 0.3);
					border-radius: 2px;
				}

				.ruler-zoom-values {
					display: flex;
					flex-direction: column;
					align-items: flex-end;
					min-width: 50px;
				}

				.ruler-zoom-percentage {
					font-family: 'Share Tech Mono', monospace;
					font-size: 15px;
					font-weight: 600;
					color: #4a9eff;
					line-height: 1;
					text-shadow: 0 0 8px rgba(74, 158, 255, 0.4);
				}

				.ruler-zoom-scale {
					font-family: 'Share Tech Mono', monospace;
					font-size: 9px;
					color: #6a7a9f;
					margin-top: 1px;
				}

				.ruler-scale-container {
					position: relative;
					width: 180px;
					height: 28px;
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
					transition: all 0.2s ease;
				}

				.ruler-tick--major {
					height: 12px;
					background: rgba(74, 158, 255, 0.6);
				}

				.ruler-tick--medium {
					height: 8px;
					background: rgba(74, 158, 255, 0.5);
				}

				.ruler-tick--minor {
					height: 5px;
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
						#4a9eff 15%,
						#4a9eff 85%,
						transparent 100%
					);
					box-shadow:
						0 0 6px rgba(74, 158, 255, 0.6),
						0 0 12px rgba(74, 158, 255, 0.3);
					transition: left 0.15s ease-out;
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
					border-bottom: 4px solid #4a9eff;
				}

				.ruler-value-label {
					position: absolute;
					bottom: -20px;
					left: 50%;
					transform: translateX(-50%);
					font-family: 'Share Tech Mono', monospace;
					font-size: 9px;
					color: #4a9eff;
					background: rgba(10, 12, 20, 0.95);
					padding: 1px 4px;
					border: 1px solid rgba(74, 158, 255, 0.4);
					white-space: nowrap;
					border-radius: 0;
				}

				.ruler-zoom-controls {
					display: flex;
					gap: 3px;
				}

				.ruler-zoom-btn {
					width: 26px;
					height: 26px;
					background: rgba(40, 50, 70, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.3);
					color: #4a9eff;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					transition: all 0.15s ease;
					border-radius: 0;
					padding: 0;
				}

				.ruler-zoom-btn:hover:not(:disabled) {
					background: rgba(74, 158, 255, 0.2);
					border-color: rgba(74, 158, 255, 0.6);
					box-shadow: 0 0 8px rgba(74, 158, 255, 0.3);
				}

				.ruler-zoom-btn:disabled {
					opacity: 0.3;
					cursor: not-allowed;
				}

				.ruler-zoom-btn--reset {
					width: 30px;
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
			`}</style>
		</div>
	);
};

export default RulerZoomIndicator;
