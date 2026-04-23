/**
 * WeaponPreviewCanvas - 武器预览迷你画布
 * 显示武器图标，颜色区分伤害类型，形状区分尺寸
 */

import { Application } from "@pixi/react";
import { Graphics } from "pixi.js";
import React, { useRef, useCallback } from "react";
import type { WeaponJSON, WeaponSlotSize } from "@vt/data";
import { WeaponTag } from "@vt/data";
import { UI_CONFIG } from "@/config/constants";

const DAMAGE_TYPE_COLORS = UI_CONFIG.COLORS.DAMAGE_TYPE_PIXI;

const WEAPON_SIZE_RADIUS: Record<WeaponSlotSize, number> = {
	SMALL: 12,
	MEDIUM: 18,
	LARGE: 26,
};

interface WeaponPreviewCanvasProps {
	weapon: WeaponJSON;
	size?: number;
	selected?: boolean;
}

function drawWeaponIcon(
	g: Graphics,
	spec: WeaponJSON["spec"],
	centerX: number,
	centerY: number,
	alpha: number
): void {
	const radius = WEAPON_SIZE_RADIUS[spec.size];
	const color = DAMAGE_TYPE_COLORS[spec.damageType] ?? 0x7b68ee;
	const tags = spec.tags ?? [];

	g.circle(centerX, centerY, radius + 4);
	g.stroke({ color: alpha > 0.8 ? 0xffffff : 0x8899aa, width: 2, alpha: alpha * 0.7 });

	switch (spec.size) {
		case "SMALL":
			g.rect(centerX - radius, centerY - radius, radius * 2, radius * 2);
			g.stroke({ color: 0x5a6a8a, width: 1.5, alpha: alpha * 0.6 });
			break;
		case "MEDIUM":
			const o = radius * 0.4;
			g.poly([
				centerX - radius + o, centerY - radius,
				centerX + radius - o, centerY - radius,
				centerX + radius, centerY - radius + o,
				centerX + radius, centerY + radius - o,
				centerX + radius - o, centerY + radius,
				centerX - radius + o, centerY + radius,
				centerX - radius, centerY + radius - o,
				centerX - radius, centerY - radius + o,
			]);
			g.stroke({ color: 0x5a6a8a, width: 1.5, alpha: alpha * 0.6 });
			break;
		case "LARGE":
			g.circle(centerX, centerY, radius);
			g.stroke({ color: 0x5a6a8a, width: 2, alpha: alpha * 0.6 });
			break;
	}

	const isBallistic = tags.includes(WeaponTag.BALLISTIC);
	const isEnergy = tags.includes(WeaponTag.ENERGY);
	const isMissile = tags.includes(WeaponTag.GUIDED);

	const iconSize = radius * 0.7;
	const facingRad = 0;

	if (isBallistic) {
		g.poly([
			centerX + Math.cos(facingRad) * iconSize * 0.8, centerY + Math.sin(facingRad) * iconSize * 0.8,
			centerX + Math.cos(facingRad + Math.PI * 0.6) * iconSize * 0.35, centerY + Math.sin(facingRad + Math.PI * 0.6) * iconSize * 0.35,
			centerX + Math.cos(facingRad + Math.PI) * iconSize * 0.25, centerY + Math.sin(facingRad + Math.PI) * iconSize * 0.25,
			centerX + Math.cos(facingRad - Math.PI * 0.6) * iconSize * 0.35, centerY + Math.sin(facingRad - Math.PI * 0.6) * iconSize * 0.35,
		]);
		g.fill({ color, alpha: alpha * 0.6 });
		g.stroke({ color, width: 1.5, alpha });

		g.moveTo(centerX, centerY);
		g.lineTo(centerX + Math.cos(facingRad) * iconSize * 1.2, centerY + Math.sin(facingRad) * iconSize * 1.2);
		g.stroke({ color, width: 2, alpha });
	} else if (isEnergy) {
		g.poly([
			centerX + iconSize, centerY,
			centerX + Math.cos(Math.PI * 0.7) * iconSize * 0.45, centerY + Math.sin(Math.PI * 0.7) * iconSize * 0.45,
			centerX + Math.cos(-Math.PI * 0.7) * iconSize * 0.45, centerY + Math.sin(-Math.PI * 0.7) * iconSize * 0.45,
		]);
		g.fill({ color, alpha: alpha * 0.5 });
		g.stroke({ color, width: 1.5, alpha });

		g.circle(centerX + iconSize * 0.35, centerY, iconSize * 0.12);
		g.fill({ color: 0xffffff, alpha: alpha * 0.8 });
	} else if (isMissile) {
		g.poly([
			centerX + iconSize * 1.1, centerY,
			centerX + Math.cos(Math.PI * 0.5) * iconSize * 0.35, centerY + Math.sin(Math.PI * 0.5) * iconSize * 0.35,
			centerX + Math.cos(Math.PI) * iconSize * 0.45, centerY,
			centerX + Math.cos(-Math.PI * 0.5) * iconSize * 0.35, centerY + Math.sin(-Math.PI * 0.5) * iconSize * 0.35,
		]);
		g.fill({ color, alpha: alpha * 0.5 });
		g.stroke({ color, width: 1.5, alpha });

		g.circle(centerX, centerY, iconSize * 0.2);
		g.fill({ color: 0xffffff, alpha: alpha * 0.7 });
	} else {
		g.circle(centerX, centerY, iconSize * 0.45);
		g.fill({ color, alpha });
	}

	g.circle(centerX, centerY, 2);
	g.fill({ color: 0xffffff, alpha: alpha * 0.9 });
}

export const WeaponPreviewCanvas: React.FC<WeaponPreviewCanvasProps> = ({
	weapon,
	size = 70,
	selected = false,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const graphicsRef = useRef<Graphics | null>(null);

	const drawWeapon = useCallback((g: Graphics) => {
		g.clear();
		const alpha = selected ? 0.95 : 0.7;
		drawWeaponIcon(g, weapon.spec, size / 2, size / 2, alpha);
	}, [weapon, size, selected]);

	const handleInit = useCallback((app: any) => {
		const g = new Graphics();
		graphicsRef.current = g;
		app.stage.addChild(g);
		drawWeapon(g);
	}, [drawWeapon]);

	return (
		<div
			ref={containerRef}
			style={{
				width: size,
				height: size,
				background: selected ? "rgba(74, 158, 255, 0.1)" : "rgba(10, 18, 28, 0.95)",
				borderRadius: 4,
				border: selected ? "1px solid rgba(74, 158, 255, 0.5)" : "1px solid rgba(43, 66, 97, 0.3)",
				overflow: "hidden",
			}}
		>
			<Application
				resizeTo={containerRef}
				autoDensity
				antialias
				background={selected ? 0x0a1830 : 0x0a1218}
				onInit={handleInit}
			/>
		</div>
	);
};

export default WeaponPreviewCanvas;