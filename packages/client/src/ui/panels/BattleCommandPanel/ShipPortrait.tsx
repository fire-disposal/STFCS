/**
 * 舰船立绘模块
 * 只显示舰船图标（不显示名称）
 */

import { Rocket } from "lucide-react";
import React from "react";
import type { ShipPortraitProps } from "./types";
import "./ShipPortrait.css";

export const ShipPortrait: React.FC<ShipPortraitProps> = ({ ship }) => {
	// 只显示舰船图标，不显示名称和阵营
	return (
		<div className="ship-portrait">
			<div className="ship-portrait__frame">
				<Rocket className="ship-portrait__icon" />
			</div>
		</div>
	);
};

export default ShipPortrait;