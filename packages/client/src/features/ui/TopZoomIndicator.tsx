/**
 * 顶栏缩放指示器组件
 * 包含缩放比例显示和缩放控制按钮
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, RefreshCw } from "lucide-react";

interface TopZoomIndicatorProps {
	zoom: number;
	minZoom: number;
	maxZoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onReset: () => void;
}

export const TopZoomIndicator: React.FC<TopZoomIndicatorProps> = ({
	zoom,
	minZoom,
	maxZoom,
	onZoomIn,
	onZoomOut,
	onReset,
}) => {
	const { t } = useTranslation();
	// 计算缩放百分比
	const zoomPercent = ((zoom - minZoom) / (maxZoom - minZoom)) * 100;

	// 计算比例尺显示（基于缩放级别）
	const getScaleLabel = (z: number) => {
		if (z >= 3) return "1:100";
		if (z >= 2) return "1:250";
		if (z >= 1.5) return "1:500";
		if (z >= 1) return "1:1000";
		if (z >= 0.75) return "1:2500";
		return "1:5000";
	};

	return (
		<div className="top-zoom-indicator">
			{/* 左侧：缩放数值和比例 */}
			<div className="top-zoom-indicator__info">
				<div className="zoom-value-display">
					<span className="zoom-percentage">{(zoom * 100).toFixed(0)}%</span>
					<span className="zoom-scale">{getScaleLabel(zoom)}</span>
				</div>
			</div>

			{/* 中间：缩放条 */}
			<div className="top-zoom-indicator__bar">
				<div className="zoom-bar-track">
					{/* 刻度标记 */}
					<div className="zoom-bar-ticks">
						{[0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100].map((tick) => (
							<div
								key={tick}
								className={`zoom-tick ${tick % 50 === 0 ? "zoom-tick--major" : "zoom-tick--minor"}`}
								style={{ left: `${tick}%` }}
							/>
						))}
					</div>

					{/* 填充条 */}
					<div
						className="zoom-bar-fill"
						style={{ width: `${zoomPercent}%` }}
					/>

					{/* 标签 */}
					<div className="zoom-bar-labels">
						<span className="zoom-label-min">{minZoom}x</span>
						<span className="zoom-label-max">{maxZoom}x</span>
					</div>
				</div>
			</div>

			{/* 右侧：控制按钮 */}
			<div className="top-zoom-indicator__controls">
				<button
					className="zoom-control-button"
					onClick={onZoomOut}
					disabled={zoom <= minZoom}
					title={t("zoom.out")}
				>
					<ZoomOut size={16} />
				</button>

				<button
					className="zoom-control-button zoom-control-button--reset"
					onClick={onReset}
					title={t("zoom.reset")}
				>
					<RefreshCw size={14} />
				</button>

				<button
					className="zoom-control-button"
					onClick={onZoomIn}
					disabled={zoom >= maxZoom}
					title={t("zoom.in")}
				>
					<ZoomIn size={16} />
				</button>
			</div>

			<style>{`
				.top-zoom-indicator {
					display: flex;
					align-items: center;
					gap: 16px;
					padding: 8px 16px;
					background: rgba(20, 20, 40, 0.9);
					border-radius: 8px;
					border: 1px solid rgba(74, 158, 255, 0.3);
					box-shadow: 0 2px 10px rgba(0, 0, 0, 0.3);
				}

				.top-zoom-indicator__info {
					display: flex;
					align-items: center;
					min-width: 70px;
				}

				.zoom-value-display {
					display: flex;
					flex-direction: column;
					align-items: center;
				}

				.zoom-percentage {
					font-size: 18px;
					font-weight: 600;
					color: #4a9eff;
					text-shadow: 0 0 10px rgba(74, 158, 255, 0.4);
					line-height: 1;
				}

				.zoom-scale {
					font-size: 10px;
					color: #6a7a9f;
					margin-top: 2px;
					letter-spacing: 0.5px;
				}

				.top-zoom-indicator__bar {
					flex: 1;
					min-width: 200px;
					max-width: 400px;
				}

				.zoom-bar-track {
					position: relative;
					height: 24px;
					background: rgba(10, 10, 30, 0.6);
					border-radius: 4px;
					border: 1px solid rgba(74, 158, 255, 0.25);
					overflow: visible;
				}

				.zoom-bar-ticks {
					position: absolute;
					inset: 0;
					pointer-events: none;
				}

				.zoom-tick {
					position: absolute;
					top: 0;
					width: 1px;
					background: rgba(74, 158, 255, 0.3);
				}

				.zoom-tick--major {
					height: 100%;
				}

				.zoom-tick--minor {
					height: 40%;
					top: 30%;
				}

				.zoom-bar-fill {
					position: absolute;
					left: 0;
					top: 0;
					bottom: 0;
					background: linear-gradient(
						90deg,
						rgba(74, 158, 255, 0.4) 0%,
						rgba(74, 158, 255, 0.6) 50%,
						rgba(74, 158, 255, 0.4) 100%
					);
					border-radius: 4px;
					transition: width 0.15s ease-out;
					box-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
				}

				.zoom-bar-labels {
					position: absolute;
					bottom: -18px;
					left: 0;
					right: 0;
					display: flex;
					justify-content: space-between;
					font-size: 9px;
					color: #5a6a8f;
				}

				.top-zoom-indicator__controls {
					display: flex;
					gap: 6px;
				}

				.zoom-control-button {
					width: 32px;
					height: 32px;
					border: 1px solid rgba(74, 158, 255, 0.3);
					background: rgba(20, 40, 80, 0.6);
					color: #4a9eff;
					border-radius: 6px;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;
				}

				.zoom-control-button:hover:not(:disabled) {
					background: rgba(74, 158, 255, 0.25);
					border-color: #4a9eff;
					box-shadow: 0 0 12px rgba(74, 158, 255, 0.3);
				}

				.zoom-control-button:disabled {
					opacity: 0.3;
					cursor: not-allowed;
				}

				.zoom-control-button--reset {
					width: 36px;
				}

				.zoom-control-button--reset svg {
					animation: none;
				}

				.zoom-control-button--reset:hover svg {
					animation: spin 1s linear infinite;
				}

				@keyframes spin {
					to { transform: rotate(360deg); }
				}
			`}</style>
		</div>
	);
};
