import React from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut } from "lucide-react";

interface ZoomScaleIndicatorProps {
	zoom: number;
	minZoom: number;
	maxZoom: number;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onReset?: () => void;
	className?: string;
}

/**
 * 科幻风格缩放标尺组件
 * 显示当前缩放级别并提供缩放控制
 */
const ZoomScaleIndicator: React.FC<ZoomScaleIndicatorProps> = ({
	zoom,
	minZoom,
	maxZoom,
	onZoomIn,
	onZoomOut,
	onReset,
	className,
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

	// 计算当前缩放对应的世界单位/像素
	const getWorldUnitsPerPixel = (z: number) => {
		const baseUnits = 1000; // 基础世界单位
		return (baseUnits / z).toFixed(0);
	};

	return (
		<div className={`zoom-scale-indicator ${className || ""}`}>
			<div className="zoom-indicator-body">
				{/* 顶部：缩放级别数值 */}
				<div className="zoom-value-display">
					<div className="zoom-value">{(zoom * 100).toFixed(0)}%</div>
					<div className="zoom-scale-label">{getScaleLabel(zoom)}</div>
				</div>

				{/* 中部：比例尺条 */}
				<div className="zoom-scale-bar">
					<div className="scale-bar-track">
						<div
							className="scale-bar-fill"
							style={{ width: `${zoomPercent}%` }}
						/>
						{/* 刻度标记 */}
						<div className="scale-ticks">
							{[0, 25, 50, 75, 100].map((tick) => (
								<div
									key={tick}
									className={`scale-tick ${tick % 50 === 0 ? "major" : "minor"}`}
									style={{ left: `${tick}%` }}
								/>
							))}
						</div>
					</div>
					<div className="scale-bar-labels">
						<span className="scale-min">{minZoom}x</span>
						<span className="scale-max">{maxZoom}x</span>
					</div>
				</div>

				{/* 底部：世界单位信息 */}
				<div className="world-units-display">
					<span className="units-label">{t("zoom.resolution")}</span>
					<span className="units-value">{t("zoom.unitsPerPixel", { units: getWorldUnitsPerPixel(zoom) })}</span>
				</div>

				{/* 缩放控制按钮 */}
				<div className="zoom-controls">
					<button
						className="zoom-button"
						onClick={onZoomOut}
						disabled={zoom <= minZoom}
						title={t("zoom.out")}
					>
						<ZoomOut size={14} />
					</button>
					<button
						className="zoom-button reset"
						onClick={onReset}
						title={t("zoom.reset")}
					>
						<span className="reset-label">1:1</span>
					</button>
					<button
						className="zoom-button"
						onClick={onZoomIn}
						disabled={zoom >= maxZoom}
						title={t("zoom.in")}
					>
						<ZoomIn size={14} />
					</button>
				</div>

				{/* 装饰性元素：角落装饰 */}
				<div className="corner-decoration top-left" />
				<div className="corner-decoration top-right" />
				<div className="corner-decoration bottom-left" />
				<div className="corner-decoration bottom-right" />
			</div>

			<style>{`
				.zoom-scale-indicator {
					position: absolute;
					bottom: 20px;
					right: 20px;
					z-index: 1000;
					font-family: 'Segoe UI', 'Roboto', monospace;
				}

				.zoom-indicator-body {
					background: linear-gradient(135deg, rgba(10, 20, 40, 0.95) 0%, rgba(20, 30, 60, 0.9) 100%);
					border: 1px solid rgba(74, 158, 255, 0.3);
					border-radius: 8px;
					padding: 16px;
					min-width: 200px;
					position: relative;
					box-shadow: 
						0 0 20px rgba(74, 158, 255, 0.1),
						inset 0 0 30px rgba(74, 158, 255, 0.05);
					overflow: hidden;
				}

				/* 装饰性扫描线效果 */
				.zoom-indicator-body::before {
					content: '';
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					height: 1px;
					background: linear-gradient(90deg, 
						transparent 0%, 
						rgba(74, 158, 255, 0.5) 50%, 
						transparent 100%);
					animation: scanline 3s linear infinite;
					pointer-events: none;
				}

				@keyframes scanline {
					0% { top: 0%; }
					100% { top: 100%; }
				}

				/* 角落装饰 */
				.corner-decoration {
					position: absolute;
					width: 8px;
					height: 8px;
					border: 1px solid rgba(74, 158, 255, 0.5);
				}

				.corner-decoration.top-left {
					top: 4px;
					left: 4px;
					border-right: none;
					border-bottom: none;
				}

				.corner-decoration.top-right {
					top: 4px;
					right: 4px;
					border-left: none;
					border-bottom: none;
				}

				.corner-decoration.bottom-left {
					bottom: 4px;
					left: 4px;
					border-right: none;
					border-top: none;
				}

				.corner-decoration.bottom-right {
					bottom: 4px;
					right: 4px;
					border-left: none;
					border-top: none;
				}

				/* 缩放数值显示 */
				.zoom-value-display {
					text-align: center;
					margin-bottom: 12px;
				}

				.zoom-value {
					font-size: 28px;
					font-weight: bold;
					color: #4a9eff;
					text-shadow: 0 0 10px rgba(74, 158, 255, 0.5);
					line-height: 1;
				}

				.zoom-scale-label {
					font-size: 11px;
					color: #8a9ebf;
					margin-top: 4px;
					letter-spacing: 1px;
				}

				/* 比例尺条 */
				.zoom-scale-bar {
					margin-bottom: 12px;
				}

				.scale-bar-track {
					position: relative;
					height: 6px;
					background: rgba(10, 20, 40, 0.8);
					border-radius: 3px;
					border: 1px solid rgba(74, 158, 255, 0.2);
					overflow: hidden;
				}

				.scale-bar-fill {
					height: 100%;
					background: linear-gradient(90deg, 
						#4a9eff 0%, 
						#6ab8ff 50%, 
						#4a9eff 100%);
					border-radius: 3px;
					transition: width 0.15s ease-out;
					box-shadow: 0 0 10px rgba(74, 158, 255, 0.5);
				}

				.scale-ticks {
					position: absolute;
					top: 0;
					left: 0;
					right: 0;
					height: 100%;
				}

				.scale-tick {
					position: absolute;
					top: 0;
					width: 1px;
					background: rgba(74, 158, 255, 0.3);
				}

				.scale-tick.major {
					height: 100%;
				}

				.scale-tick.minor {
					height: 50%;
					top: 25%;
				}

				.scale-bar-labels {
					display: flex;
					justify-content: space-between;
					margin-top: 4px;
					font-size: 10px;
					color: #6a7a9f;
				}

				/* 世界单位显示 */}
				.world-units-display {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 8px 0;
					border-top: 1px solid rgba(74, 158, 255, 0.2);
					border-bottom: 1px solid rgba(74, 158, 255, 0.2);
					margin-bottom: 12px;
					font-size: 11px;
				}

				.units-label {
					color: #8a9ebf;
				}

				.units-value {
					color: #4a9eff;
					font-weight: 600;
				}

				/* 缩放控制按钮 */
				.zoom-controls {
					display: flex;
					gap: 8px;
					justify-content: center;
				}

				.zoom-button {
					width: 36px;
					height: 36px;
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

				.zoom-button:hover:not(:disabled) {
					background: rgba(74, 158, 255, 0.2);
					border-color: #4a9eff;
					box-shadow: 0 0 15px rgba(74, 158, 255, 0.3);
				}

				.zoom-button:disabled {
					opacity: 0.3;
					cursor: not-allowed;
				}

				.zoom-button.reset {
					width: 50px;
					font-size: 11px;
					font-weight: 600;
				}

				/* 响应式设计 */
				@media (max-width: 768px) {
					.zoom-scale-indicator {
						bottom: 10px;
						right: 10px;
						min-width: 160px;
					}

					.zoom-indicator-body {
						padding: 12px;
					}

					.zoom-value {
						font-size: 24px;
					}

					.zoom-button {
						width: 32px;
						height: 32px;
					}

					.zoom-button.reset {
						width: 44px;
					}
				}
			`}</style>
		</div>
	);
};

export default ZoomScaleIndicator;
