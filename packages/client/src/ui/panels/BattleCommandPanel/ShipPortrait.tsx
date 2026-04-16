/**
 * 舰船头像模块
 * 显示舰船图标、名称、阵营信息
 */

import { Faction } from "@/sync/types";
import { Rocket } from "lucide-react";
import React from "react";
import type { ShipPortraitProps } from "./types";
import "./ShipPortrait.css";

export const ShipPortrait: React.FC<ShipPortraitProps> = ({ ship }) => {
	const isPlayer = ship.faction === Faction.PLAYER;

	return (
		<div className="ship-portrait">
			<div className="ship-portrait__frame">
				<Rocket className="ship-portrait__icon" />
			</div>
			<div className="ship-portrait__info">
				<div className="ship-portrait__name">{ship.name || ship.hullType}</div>
				<div
					className={`ship-portrait__faction ${
						isPlayer ? "ship-portrait__faction--player" : "ship-portrait__faction--enemy"
					}`}
				>
					{isPlayer ? "友军" : "敌方"}
				</div>
			</div>
		</div>
	);
};

export default ShipPortrait;
