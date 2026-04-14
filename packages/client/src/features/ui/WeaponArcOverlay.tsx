/**
 * 武器射界可视化组件
 * 显示武器的攻击范围和射界区域
 */

import { distance } from "@vt/rules";
import type { ShipState } from "@vt/types";
import { Container, Graphics } from "pixi.js";
import React, { useEffect, useMemo } from "react";

interface WeaponArcOverlayProps {
	ships: ShipState[];
	selectedShipId?: string | null;
	showWeaponArcs?: boolean;
	showRanges?: boolean;
}

export const WeaponArcOverlay: React.FC<WeaponArcOverlayProps> = ({
	ships,
	selectedShipId,
	showWeaponArcs = true,
	showRanges = true,
}) => {
	const containerRef = useMemo(() => new Container(), []);

	useEffect(() => {
		containerRef.removeChildren();

		if (!showWeaponArcs && !showRanges) return;

		for (const ship of ships) {
			// 只为选中的舰船显示武器射界
			if (ship.id !== selectedShipId) continue;

			// 绘制武器挂载点射界
			ship.weapons.forEach((weaponSlot, _mountId) => {
				const ws = weaponSlot as unknown as {
					mountId: string;
					weaponSpecId: string;
					mountFacing: number;
					arcMin: number;
					arcMax: number;
					range: number;
					mountType: string;
					offsetX: number;
					offsetY: number;
				};

				const mountX = ship.transform.x + ws.offsetX;
				const mountY = ship.transform.y + ws.offsetY;

				const weaponAbsoluteAngle = ship.transform.heading + ws.mountFacing;
				const arcWidth = ws.arcMax - ws.arcMin;

				if (showRanges) {
					const rangeCircle = new Graphics();
					rangeCircle.circle(0, 0, ws.range).stroke({ color: 0xffa500, alpha: 0.3, width: 1 });
					rangeCircle.position.set(mountX, mountY);
					containerRef.addChild(rangeCircle);
				}

				if (showWeaponArcs) {
					const arcGraphics = new Graphics();
					const arcRad = (arcWidth * Math.PI) / 180;
					const baseAngle = ((weaponAbsoluteAngle - 90) * Math.PI) / 180;
					const startAngle = baseAngle - arcRad / 2;
					const endAngle = baseAngle + arcRad / 2;

					arcGraphics.moveTo(0, 0);
					for (let angle = startAngle; angle <= endAngle; angle += 0.05) {
						const x = Math.cos(angle) * ws.range;
						const y = Math.sin(angle) * ws.range;
						arcGraphics.lineTo(x, y);
					}
					arcGraphics.lineTo(0, 0);
					arcGraphics.fill({ color: 0xff6b35, alpha: 0.15 });
					arcGraphics.stroke({ color: 0xff6b35, alpha: 0.6, width: 1 });

					arcGraphics.position.set(mountX, mountY);
					arcGraphics.rotation = ((weaponAbsoluteAngle - 90) * Math.PI) / 180;
					containerRef.addChild(arcGraphics);
				}
			});

			// 绘制护盾范围
			if (ship.isShieldUp) {
				const shieldGraphics = new Graphics();
				const shieldRadius = ship.transform.heading; // 使用朝向作为临时半径参考
				// 护盾弧
				const arcRad = (ship.shieldArc * Math.PI) / 180;
				const baseAngle = ((ship.shieldOrientation - 90) * Math.PI) / 180;

				shieldGraphics.moveTo(0, 0);
				for (let angle = baseAngle - arcRad / 2; angle <= baseAngle + arcRad / 2; angle += 0.05) {
					const x = Math.cos(angle) * 50;
					const y = Math.sin(angle) * 50;
					shieldGraphics.lineTo(x, y);
				}
				shieldGraphics.lineTo(0, 0);
				shieldGraphics.fill({ color: 0x4a9eff, alpha: 0.2 });
				shieldGraphics.stroke({ color: 0x4a9eff, alpha: 0.5, width: 2 });
				shieldGraphics.position.set(ship.transform.x, ship.transform.y);
				containerRef.addChild(shieldGraphics);
			}
		}
	}, [ships, selectedShipId, showWeaponArcs, showRanges, containerRef]);

	return <>{/* Pixi 容器由父组件管理 */}</>;
};

/**
 * 绘制武器射界到指向 Graphics
 */
export function drawWeaponArc(
	graphics: Graphics,
	centerX: number,
	centerY: number,
	heading: number,
	range: number,
	arc: number,
	color: number = 0xff6b35,
	alpha: number = 0.3
): void {
	const arcRad = (arc * Math.PI) / 180;
	const baseAngle = ((heading - 90) * Math.PI) / 180;
	const startAngle = baseAngle - arcRad / 2;
	const endAngle = baseAngle + arcRad / 2;

	graphics.position.set(centerX, centerY);

	// 扇形填充
	graphics.moveTo(0, 0);
	for (let angle = startAngle; angle <= endAngle; angle += 0.05) {
		const x = Math.cos(angle) * range;
		const y = Math.sin(angle) * range;
		graphics.lineTo(x, y);
	}
	graphics.lineTo(0, 0);
	graphics.fill({ color, alpha });

	// 扇形边框
	graphics.stroke({ color, alpha: alpha + 0.3, width: 1 });

	// 射程标记
	graphics.circle(0, 0, range);
	graphics.stroke({ color, alpha: 0.2, width: 1 });
}

/**
 * 绘制射程范围
 */
export function drawRangeCircle(
	graphics: Graphics,
	centerX: number,
	centerY: number,
	range: number,
	color: number = 0xffa500,
	alpha: number = 0.3
): void {
	graphics.position.set(centerX, centerY);
	graphics.circle(0, 0, range);
	graphics.stroke({ color, alpha, width: 1 });
}

/**
 * 计算目标是否在武器射界内
 */
export function isTargetInWeaponArc(
	attackerX: number,
	attackerY: number,
	attackerHeading: number,
	weaponRange: number,
	weaponArc: number,
	weaponAngle: number,
	targetX: number,
	targetY: number
): boolean {
	// 检查距离
	const dist = distance(attackerX, attackerY, targetX, targetY);
	if (dist > weaponRange) return false;

	// 计算武器绝对角度
	const weaponAbsoluteAngle = attackerHeading + weaponAngle;

	// 计算目标相对角度
	const angleToTarget = angleBetween(attackerX, attackerY, targetX, targetY);

	// 检查角度是否在射界内
	const angleDiff = angleDifference(weaponAbsoluteAngle, angleToTarget);
	return angleDiff <= weaponArc / 2;
}

/**
 * 获取目标在武器射界内的百分比
 */
export function getTargetArcCoverage(
	attackerX: number,
	attackerY: number,
	attackerHeading: number,
	weaponRange: number,
	weaponArc: number,
	weaponAngle: number,
	targetX: number,
	targetY: number,
	targetRadius: number = 20
): number {
	const angleToTarget = angleBetween(attackerX, attackerY, targetX, targetY);
	const weaponAbsoluteAngle = attackerHeading + weaponAngle;
	const angleDiff = angleDifference(weaponAbsoluteAngle, angleToTarget);

	// 完全在射界内
	if (angleDiff <= weaponArc / 2 - targetRadius) return 1;

	// 部分在射界内
	if (angleDiff <= weaponArc / 2 + targetRadius) {
		return (weaponArc / 2 + targetRadius - angleDiff) / (targetRadius * 2);
	}

	// 完全不在射界内
	return 0;
}

// 辅助函数
function angleBetween(x1: number, y1: number, x2: number, y2: number): number {
	const dx = x2 - x1;
	const dy = y2 - y1;
	let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
	if (angle < 0) angle += 360;
	return angle;
}

function angleDifference(angle1: number, angle2: number): number {
	let diff = Math.abs(angle1 - angle2) % 360;
	if (diff > 180) diff = 360 - diff;
	return diff;
}

export default WeaponArcOverlay;
