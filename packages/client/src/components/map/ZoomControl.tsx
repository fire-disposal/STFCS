/**
 * 画布缩放控制组件
 * 显示缩放级别并提供缩放操作按钮
 */

import { RefreshCw, ZoomIn, ZoomOut } from "lucide-react";
import React from "react";
import { useTranslation } from "react-i18next";

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
		</div>
	);
};
