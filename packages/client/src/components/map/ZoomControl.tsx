/**
 * 画布缩放控制组件
 * 显示缩放级别并提供缩放操作按钮
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { ZoomIn, ZoomOut, RefreshCw } from "lucide-react";

interface ZoomControlProps {
	zoom: number;
	minZoom: number;
	maxZoom: number;
	onZoomIn: () => void;
	onZoomOut: () => void;
	onReset: () => void;
}

export const ZoomControl: React.FC<ZoomControlProps> = ({
	zoom,
	minZoom,
	maxZoom,
	onZoomIn,
	onZoomOut,
	onReset,
}) => {
	const { t } = useTranslation();
	const zoomPercent = Math.round(zoom * 100);

	return (
		<div className="zoom-control">
			<div className="zoom-control__value">{zoomPercent}%</div>

			<div className="zoom-control__buttons">
				<button
					className="zoom-control__button"
					onClick={onZoomOut}
					disabled={zoom <= minZoom}
					title={t("zoom.out")}
				>
					<ZoomOut size={14} />
				</button>

				<button
					className="zoom-control__button zoom-control__button--reset"
					onClick={onReset}
					title={t("zoom.reset")}
				>
					<RefreshCw size={12} />
				</button>

				<button
					className="zoom-control__button"
					onClick={onZoomIn}
					disabled={zoom >= maxZoom}
					title={t("zoom.in")}
				>
					<ZoomIn size={14} />
				</button>
			</div>

			<style>{`
				.zoom-control {
					position: absolute;
					bottom: 16px;
					right: 16px;
					background: rgba(20, 20, 40, 0.9);
					border: 1px solid rgba(74, 158, 255, 0.3);
					border-radius: 8px;
					padding: 8px 12px;
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 8px;
				}

				.zoom-control__value {
					font-size: 18px;
					font-weight: 600;
					color: #4a9eff;
					text-shadow: 0 0 10px rgba(74, 158, 255, 0.3);
				}

				.zoom-control__buttons {
					display: flex;
					gap: 4px;
				}

				.zoom-control__button {
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

				.zoom-control__button:hover:not(:disabled) {
					background: rgba(74, 158, 255, 0.2);
					border-color: #4a9eff;
					box-shadow: 0 0 10px rgba(74, 158, 255, 0.2);
				}

				.zoom-control__button:disabled {
					opacity: 0.3;
					cursor: not-allowed;
				}

				.zoom-control__button--reset {
					width: 36px;
				}
			`}</style>
		</div>
	);
};
