/**
 * ShipPreviewCanvas - 舰船预览迷你画布
 * 复用 ShipRenderer 的菱形体和武器挂载点绘制样式
 * 船头统一向右（heading = 90°）
 *
 * 挂载点形状：SMALL=正方形, MEDIUM=八边形, LARGE=圆形
 * 武器层在挂载点和舰船之上，颜色区分伤害类型
 */

import { Application } from "@pixi/react";
import { Graphics } from "pixi.js";
import React, { useRef, useCallback } from "react";
import type { InventoryToken } from "@vt/data";
import { WeaponSlotSize } from "@vt/data";

const DAMAGE_TYPE_COLORS = {
	KINETIC: 0xffd700,
	HIGH_EXPLOSIVE: 0xff6b35,
	ENERGY: 0x7b68ee,
	FRAGMENTATION: 0x32cd32,
} as const;

const MOUNT_SLOT_SIZE: Record<WeaponSlotSize, number> = {
	SMALL: 5,
	MEDIUM: 7,
	LARGE: 10,
};

const DEFAULT_WIDTH = 30;
const DEFAULT_LENGTH = 50;
const HEADING_RIGHT = 90;

interface ShipPreviewCanvasProps {
	token: InventoryToken;
	size?: number;
	selected?: boolean;
}

function drawMountSlotShape(
	g: Graphics,
	x: number,
	y: number,
	size: WeaponSlotSize,
	slotRadius: number,
	alpha: number,
	facing: number = 0
): void {
	const r = slotRadius;
	const facingRad = facing * Math.PI / 180;
	g.rotation = facingRad;
	
	switch (size) {
		case "SMALL":
			g.rect(x - r, y - r, r * 2, r * 2);
			g.stroke({ color: 0x5a6a8a, width: 1, alpha });
			break;
		case "MEDIUM":
			const o = r * 0.4;
			g.poly([
				x - r + o, y - r,
				x + r - o, y - r,
				x + r, y - r + o,
				x + r, y + r - o,
				x + r - o, y + r,
				x - r + o, y + r,
				x - r, y + r - o,
				x - r, y - r + o,
			]);
			g.stroke({ color: 0x5a6a8a, width: 1, alpha });
			break;
		case "LARGE":
			const ol = r * 0.35;
			g.poly([
				x - r + ol, y - r,
				x + r - ol, y - r,
				x + r, y - r + ol,
				x + r, y + r - ol,
				x + r - ol, y + r,
				x - r + ol, y + r,
				x - r, y + r - ol,
				x - r, y - r + ol,
			]);
			g.stroke({ color: 0x5a6a8a, width: 1, alpha });
			break;
	}
	
	g.rotation = 0;
	
	const arrowLen = r * 0.6;
	g.moveTo(x, y);
	g.lineTo(x + Math.cos(facingRad) * arrowLen, y + Math.sin(facingRad) * arrowLen);
	g.stroke({ color: 0xffffff, width: 1.5, alpha: alpha * 0.8 });
}

function drawWeaponBar(
	g: Graphics,
	x: number,
	y: number,
	facingRad: number,
	iconSize: number,
	color: number,
	alpha: number,
	damageType: string
): void {
	const length = iconSize * 1.4;
	const width = iconSize * 0.25;

	g.moveTo(x + Math.cos(facingRad + Math.PI) * length * 0.3, y + Math.sin(facingRad + Math.PI) * length * 0.3);
	g.lineTo(x + Math.cos(facingRad) * length, y + Math.sin(facingRad) * length);
	g.stroke({ color, width, alpha: alpha * 0.7 });

	g.poly([
		x + Math.cos(facingRad) * length, y + Math.sin(facingRad) * length,
		x + Math.cos(facingRad + Math.PI * 0.85) * length * 0.15, y + Math.sin(facingRad + Math.PI * 0.85) * length * 0.15,
		x + Math.cos(facingRad + Math.PI) * length * 0.3, y + Math.sin(facingRad + Math.PI) * length * 0.3,
		x + Math.cos(facingRad - Math.PI * 0.85) * length * 0.15, y + Math.sin(facingRad - Math.PI * 0.85) * length * 0.15,
	]);
	g.fill({ color, alpha: alpha * 0.5 });
	g.stroke({ color, width: 1.2, alpha });

	switch (damageType) {
		case "KINETIC":
			g.circle(x + Math.cos(facingRad) * length * 0.6, y + Math.sin(facingRad) * length * 0.6, iconSize * 0.1);
			g.fill({ color: 0xffffff, alpha: alpha * 0.6 });
			break;
		case "HIGH_EXPLOSIVE":
			g.poly([
				x + Math.cos(facingRad) * length, y + Math.sin(facingRad) * length,
				x + Math.cos(facingRad + Math.PI * 0.75) * iconSize * 0.2, y + Math.sin(facingRad + Math.PI * 0.75) * iconSize * 0.2,
				x + Math.cos(facingRad - Math.PI * 0.75) * iconSize * 0.2, y + Math.sin(facingRad - Math.PI * 0.75) * iconSize * 0.2,
			]);
			g.fill({ color, alpha: alpha * 0.8 });
			break;
		case "ENERGY":
			g.circle(x + Math.cos(facingRad) * length * 0.4, y + Math.sin(facingRad) * length * 0.4, iconSize * 0.12);
			g.fill({ color: 0xffffff, alpha: alpha * 0.9 });
			break;
		case "FRAGMENTATION":
			for (let i = -1; i <= 1; i += 2) {
				const branchAngle = facingRad + i * Math.PI * 0.3;
				g.moveTo(x + Math.cos(facingRad) * length * 0.7, y + Math.sin(facingRad) * length * 0.7);
				g.lineTo(x + Math.cos(branchAngle) * length * 0.9, y + Math.sin(branchAngle) * length * 0.9);
				g.stroke({ color, width: width * 0.6, alpha: alpha * 0.6 });
			}
			break;
	}
}

export const ShipPreviewCanvas: React.FC<ShipPreviewCanvasProps> = ({
	token,
	size = 80,
	selected = false,
}) => {
	const containerRef = useRef<HTMLDivElement>(null);
	const graphicsRef = useRef<Graphics | null>(null);

	const drawShip = useCallback((g: Graphics) => {
		g.clear();

		const spec = token.spec;
		const halfWidth = (spec.width ?? DEFAULT_WIDTH) / 2;
		const halfLength = (spec.length ?? DEFAULT_LENGTH) / 2;

		const scale = Math.min(size / (halfWidth * 2 + 20), size / (halfLength * 2 + 20)) * 0.85;
		const scaledHalfW = halfWidth * scale;
		const scaledHalfL = halfLength * scale;

		const color = selected ? 0x4fc3ff : 0x88aacc;
		const alpha = selected ? 0.95 : 0.7;
		const lineWidth = selected ? 2 : 1.5;

		g.rotation = (HEADING_RIGHT * Math.PI) / 180;

		g.poly([
			0, -scaledHalfL,
			scaledHalfW, 0,
			0, scaledHalfL,
			-scaledHalfW, 0,
		]);
		g.stroke({ color: selected ? 0xffffff : color, width: lineWidth, alpha });

		if (selected) {
			g.fill({ color: 0x4fc3ff, alpha: 0.12 });
		}

		const arrowLength = scaledHalfL * 0.65;
		const arrowWidth = scaledHalfW * 0.4;

		g.poly([
			0, -arrowLength,
			arrowWidth * 0.55, arrowLength * 0.3,
			arrowWidth, arrowLength * 0.5,
			0, arrowLength * 0.25,
			-arrowWidth, arrowLength * 0.5,
			-arrowWidth * 0.55, arrowLength * 0.3,
		]);
		g.stroke({ color: selected ? 0xffffff : color, width: lineWidth * 0.8, alpha });

		g.circle(0, 0, 2);
		g.fill({ color: 0xffffff, alpha: 0.85 });

		const mounts = spec.mounts ?? [];
		const mountAlpha = selected ? 0.8 : 0.5;

		for (const mount of mounts) {
			const offsetX = (mount.position?.x ?? 0) * scale;
			const offsetY = (mount.position?.y ?? 0) * scale;
			const mountSize = mount.size;
			const slotRadius = MOUNT_SLOT_SIZE[mountSize] * scale;
			const mountFacing = mount.facing ?? 0;

			drawMountSlotShape(g, offsetX, offsetY, mountSize, slotRadius, mountAlpha, mountFacing);
		}

		for (const mount of mounts) {
			if (!mount.weapon) continue;
			const weaponSpec = mount.weapon.spec;
			if (!weaponSpec) continue;

			const offsetX = (mount.position?.x ?? 0) * scale;
			const offsetY = (mount.position?.y ?? 0) * scale;
			const facingRad = ((mount.facing ?? 0) + HEADING_RIGHT) * Math.PI / 180;

			const weaponColor = DAMAGE_TYPE_COLORS[weaponSpec.damageType] ?? 0x7b68ee;
			const iconSize = MOUNT_SLOT_SIZE[weaponSpec.size] * scale;
			const wAlpha = selected ? 0.9 : 0.7;

			drawWeaponBar(g, offsetX, offsetY, facingRad, iconSize, weaponColor, wAlpha, weaponSpec.damageType);
		}
	}, [token, size, selected]);

	const handleInit = useCallback((app: any) => {
		const g = new Graphics();
		graphicsRef.current = g;
		g.position.set(size / 2, size / 2);
		app.stage.addChild(g);
		drawShip(g);
	}, [drawShip, size]);

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

export default ShipPreviewCanvas;