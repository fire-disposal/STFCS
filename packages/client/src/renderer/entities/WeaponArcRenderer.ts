/**
 * 武器射界预览渲染模块
 *
 * 功能：
 * - 正确应用武器挂载点位置偏移和武器射界角度
 * - 扇形大小基于武器射程
 * - 支持最小射程（近距离无法开火时显示空心扇形）
 * - 显示可行目标的瞄准线（红色带辉光效果）
 * - 使用 fireModeStore 的权威数据绘制瞄准线
 */

import { useFireModeStore } from "@/state/stores/fireModeStore";
import type { ShipState } from "@/sync/types";
import type { WeaponSlot } from "@/sync/types";
import { DamageType, WeaponState } from "@/sync/types";
import { angleBetween, angleDifference, distance } from "@vt/rules";
import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export interface DrawWeaponArcsOptions {
	showWeaponArcs: boolean;
	showMovementRange: boolean;
	showTargetLines?: boolean; // 是否显示瞄准线
	selectedTargetId?: string | null; // 当前选中的目标（用于高亮）
}

interface ArcGraphicsMeta {
	graphics: Graphics;
	targetLines: Graphics; // 瞄准线图层
	weaponId: string;
	shipId: string;
}

/** 伤害类型颜色 */
const DAMAGE_TYPE_COLORS: Record<string, number> = {
	[DamageType.KINETIC]: 0xffd700, // 金色 - 动能
	[DamageType.HIGH_EXPLOSIVE]: 0xff6b35, // 橙红 - 高爆
	[DamageType.ENERGY]: 0x7b68ee, // 紫蓝 - 能量
	[DamageType.FRAGMENTATION]: 0x32cd32, // 绿色 - 碎片
};

/** 目标线颜色（红色带辉光） */
const TARGET_LINE_COLOR = 0xff3333;
const TARGET_LINE_GLOW_COLOR = 0xff6666;

export function useWeaponArcsRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	options: DrawWeaponArcsOptions
) {
	const arcGraphicsRef = useRef<ArcGraphicsMeta[]>([]);
	const moveGraphicsRef = useRef<Graphics | null>(null);
	const lastShipIdRef = useRef<string | null>(null);

	// 从 fireModeStore 获取选中状态（用于高亮）
	const selectedWeaponFromStore = useFireModeStore((state) => state.selectedWeapon);
	const selectedTargetIds = useFireModeStore((state) => state.selectedTargetIds);

	useEffect(() => {
		if (!layers) return;

		const selectedShip = selectedShipId ? ships.find((s) => s.id === selectedShipId) : null;

		// 切换舰船时清除旧的图形
		if (lastShipIdRef.current && lastShipIdRef.current !== selectedShipId) {
			arcGraphicsRef.current.forEach((meta) => {
				layers.weaponArcs.removeChild(meta.graphics);
				layers.weaponArcs.removeChild(meta.targetLines);
			});
			arcGraphicsRef.current = [];
			if (moveGraphicsRef.current) {
				layers.weaponArcs.removeChild(moveGraphicsRef.current);
				moveGraphicsRef.current = null;
			}
		}
		lastShipIdRef.current = selectedShipId ?? null;

		// 无选中舰船时清除所有图形
		if (!selectedShip) {
			arcGraphicsRef.current.forEach((meta) => {
				layers.weaponArcs.removeChild(meta.graphics);
				layers.weaponArcs.removeChild(meta.targetLines);
			});
			arcGraphicsRef.current = [];
			if (moveGraphicsRef.current) {
				layers.weaponArcs.removeChild(moveGraphicsRef.current);
				moveGraphicsRef.current = null;
			}
			return;
		}

		if (options.showWeaponArcs) {
			// 绘制所有武器的射界和瞄准线
			drawWeaponArcs(
				layers,
				selectedShip,
				ships,
				arcGraphicsRef,
				options.showTargetLines ?? true,
				selectedWeaponFromStore,
				selectedTargetIds
			);
		} else {
			arcGraphicsRef.current.forEach((meta) => {
				layers.weaponArcs.removeChild(meta.graphics);
				layers.weaponArcs.removeChild(meta.targetLines);
			});
			arcGraphicsRef.current = [];
		}

		if (options.showMovementRange) {
			drawMovementRange(layers, selectedShip, moveGraphicsRef);
		} else if (moveGraphicsRef.current) {
			layers.weaponArcs.removeChild(moveGraphicsRef.current);
			moveGraphicsRef.current = null;
		}
	}, [layers, ships, selectedShipId, options, selectedWeaponFromStore, selectedTargetIds]);

	useEffect(() => {
		return () => {
			arcGraphicsRef.current.forEach((meta) => {
				if (layers?.weaponArcs.children.includes(meta.graphics)) {
					layers.weaponArcs.removeChild(meta.graphics);
				}
				if (layers?.weaponArcs.children.includes(meta.targetLines)) {
					layers.weaponArcs.removeChild(meta.targetLines);
				}
			});
			if (
				moveGraphicsRef.current &&
				layers?.weaponArcs.children.includes(moveGraphicsRef.current)
			) {
				layers.weaponArcs.removeChild(moveGraphicsRef.current);
			}
		};
	}, [layers]);
}

/**
 * 绘制所有武器射界
 *
 * 遍历舰船所有武器，各自绘制瞄准线（与 WeaponPanel 选择状态解耦）
 * 不过滤友军，允许误伤显示
 */
function drawWeaponArcs(
	layers: LayerRegistry,
	ship: ShipState,
	allShips: ShipState[],
	arcGraphicsRef: React.MutableRefObject<ArcGraphicsMeta[]>,
	showTargetLines: boolean,
	selectedWeaponFromStore: WeaponSlot | null,
	selectedTargetIds: string[]
): void {
	const existingWeaponIds = new Set(arcGraphicsRef.current.map((m) => m.weaponId));
	const currentWeaponIds = new Set<string>();
	ship.weapons.forEach((w) => currentWeaponIds.add(w.instanceId));

	// 所有非摧毁舰船（包括友军，允许误伤）
	const potentialTargets = allShips.filter((s) => !s.isDestroyed && s.id !== ship.id);

	ship.weapons.forEach((weapon) => {
		const weaponId = weapon.instanceId;
		const isCurrentSelectedWeapon = selectedWeaponFromStore?.instanceId === weaponId;
		const existingMeta = arcGraphicsRef.current.find((m) => m.weaponId === weaponId);
		const arcGraphics = existingMeta?.graphics ?? new Graphics();
		const targetLineGraphics = existingMeta?.targetLines ?? new Graphics();

		if (!existingMeta) {
			layers.weaponArcs.addChild(arcGraphics);
			layers.weaponArcs.addChild(targetLineGraphics);
			arcGraphicsRef.current.push({
				graphics: arcGraphics,
				targetLines: targetLineGraphics,
				weaponId,
				shipId: ship.id,
			});
		}

		// 绘制单个武器射界
		drawSingleWeaponArc(arcGraphics, ship, weapon);

		// 绘制可行目标的瞄准线（对所有武器，不过滤友军）
		if (showTargetLines) {
			drawTargetLines(targetLineGraphics, ship, weapon, potentialTargets);

			// 如果是当前选中武器，叠加高亮选中的目标
			if (isCurrentSelectedWeapon && selectedTargetIds.length > 0) {
				drawSelectedTargetsHighlight(targetLineGraphics, ship, weapon, allShips, selectedTargetIds);
			}
		} else {
			targetLineGraphics.clear();
		}
	});

	// 清除已不存在的武器图形
	existingWeaponIds.forEach((id) => {
		if (!currentWeaponIds.has(id)) {
			const meta = arcGraphicsRef.current.find((m) => m.weaponId === id);
			if (meta) {
				layers.weaponArcs.removeChild(meta.graphics);
				layers.weaponArcs.removeChild(meta.targetLines);
				arcGraphicsRef.current = arcGraphicsRef.current.filter((m) => m.weaponId !== id);
			}
		}
	});
}

/**
 * 绘制单个武器射界扇形
 *
 * 关键计算：
 * 1. 挂载点位置：相对于船体中心的偏移 (mountOffsetX, mountOffsetY)
 * 2. 武器实际朝向：舰船 heading + 武器 mountFacing
 * 3. 射界范围：以实际朝向为中心，arc 角度范围
 * 4. 最小射程：如果 > 0，显示空心扇形（中间有空洞）
 */
function drawSingleWeaponArc(graphics: Graphics, ship: ShipState, weapon: WeaponSlot): void {
	graphics.clear();

	// 舰船位置作为基准
	const shipX = ship.transform.x;
	const shipY = ship.transform.y;
	const shipHeading = ship.transform.heading;

	// 挂载点相对于船体中心的偏移
	const mountOffsetX = weapon.mountOffsetX;
	const mountOffsetY = weapon.mountOffsetY;

	// 舰船朝向转换为弧度
	const shipHeadingRad = (shipHeading * Math.PI) / 180;

	// 将挂载点偏移从船体坐标系转换到世界坐标系
	const mountWorldX =
		shipX + mountOffsetX * Math.cos(shipHeadingRad) - mountOffsetY * Math.sin(shipHeadingRad);
	const mountWorldY =
		shipY + mountOffsetX * Math.sin(shipHeadingRad) + mountOffsetY * Math.cos(shipHeadingRad);

	// 武器实际朝向 = 舰船朝向 + 武器基准朝向
	const weaponFacing = shipHeading + weapon.mountFacing;
	const weaponFacingRad = (weaponFacing * Math.PI) / 180;

	// 射界角度范围
	const arc = weapon.arc || 90;
	const arcRad = (arc * Math.PI) / 180;

	// 射程范围
	const maxRange = weapon.range || 300;
	const minRange = weapon.minRange || 0;

	// 武器颜色（基于伤害类型）
	const weaponColor = DAMAGE_TYPE_COLORS[weapon.damageType] ?? 0xff6b35;

	// 射界扇形的起始和结束角度
	const startAngle = weaponFacingRad - arcRad / 2;
	const endAngle = weaponFacingRad + arcRad / 2;

	// 绘制射界扇形
	if (minRange > 0) {
		// 有最小射程：绘制空心扇形（环状）
		drawHollowArc(
			graphics,
			mountWorldX,
			mountWorldY,
			minRange,
			maxRange,
			startAngle,
			endAngle,
			weaponColor
		);
	} else {
		// 无最小射程：绘制实心扇形
		drawSolidArc(graphics, mountWorldX, mountWorldY, maxRange, startAngle, endAngle, weaponColor);
	}

	// 绘制武器朝向指示线（中心线）
	const centerX = mountWorldX + Math.cos(weaponFacingRad) * maxRange * 0.3;
	const centerY = mountWorldY + Math.sin(weaponFacingRad) * maxRange * 0.3;
	graphics.moveTo(mountWorldX, mountWorldY);
	graphics.lineTo(centerX, centerY);
	graphics.stroke({ color: weaponColor, alpha: 0.7, width: 2 });

	// 绘制挂载点位置标记
	graphics.circle(mountWorldX, mountWorldY, 4);
	graphics.fill({ color: 0xffffff, alpha: 0.6 });
	graphics.circle(mountWorldX, mountWorldY, 4);
	graphics.stroke({ color: weaponColor, alpha: 0.8, width: 1.5 });
}

/**
 * 绘制实心扇形（无最小射程）
 */
function drawSolidArc(
	graphics: Graphics,
	centerX: number,
	centerY: number,
	range: number,
	startAngle: number,
	endAngle: number,
	color: number
): void {
	graphics.moveTo(centerX, centerY);

	const step = (Math.PI / 180) * 2;
	for (let angle = startAngle; angle <= endAngle; angle += step) {
		const x = centerX + Math.cos(angle) * range;
		const y = centerY + Math.sin(angle) * range;
		graphics.lineTo(x, y);
	}

	const finalX = centerX + Math.cos(endAngle) * range;
	const finalY = centerY + Math.sin(endAngle) * range;
	graphics.lineTo(finalX, finalY);
	graphics.lineTo(centerX, centerY);

	graphics.fill({ color, alpha: 0.15 });
	graphics.stroke({ color, alpha: 0.5, width: 1.5 });

	// 绘制射程圆弧边缘
	graphics.arc(centerX, centerY, range, startAngle, endAngle);
	graphics.stroke({ color, alpha: 0.3, width: 1 });
}

/**
 * 绘制空心扇形（有最小射程）
 * 中间有一个空洞，表示该区域无法开火
 */
function drawHollowArc(
	graphics: Graphics,
	centerX: number,
	centerY: number,
	minRange: number,
	maxRange: number,
	startAngle: number,
	endAngle: number,
	color: number
): void {
	const step = (Math.PI / 180) * 2;

	// 绘制外圈扇形（最大射程）
	graphics.moveTo(
		centerX + Math.cos(startAngle) * minRange,
		centerY + Math.sin(startAngle) * minRange
	);

	// 从最小射程边界开始，绘制到最大射程
	for (let angle = startAngle; angle <= endAngle; angle += step) {
		const x = centerX + Math.cos(angle) * maxRange;
		const y = centerY + Math.sin(angle) * maxRange;
		graphics.lineTo(x, y);
	}

	const finalX = centerX + Math.cos(endAngle) * maxRange;
	const finalY = centerY + Math.sin(endAngle) * maxRange;
	graphics.lineTo(finalX, finalY);

	// 从最大射程边界回到最小射程边界
	for (let angle = endAngle; angle >= startAngle; angle -= step) {
		const x = centerX + Math.cos(angle) * minRange;
		const y = centerY + Math.sin(angle) * minRange;
		graphics.lineTo(x, y);
	}

	graphics.closePath();
	graphics.fill({ color, alpha: 0.15 });
	graphics.stroke({ color, alpha: 0.5, width: 1.5 });

	// 绘制外圈射程圆弧
	graphics.arc(centerX, centerY, maxRange, startAngle, endAngle);
	graphics.stroke({ color, alpha: 0.3, width: 1 });

	// 绘制内圈最小射程圆弧（红色警告色）
	graphics.arc(centerX, centerY, minRange, startAngle, endAngle);
	graphics.stroke({ color: 0xff4444, alpha: 0.6, width: 2 });

	// 在最小射程区域绘制"禁止"标记
	graphics.circle(centerX, centerY, minRange);
	graphics.fill({ color: 0xff4444, alpha: 0.08 });
}

/**
 * 绘制可行目标的瞄准线
 * 从武器挂载点中心到目标中心
 * - 武器就绪 + 舰船未过载：红色辉光效果
 * - 武器不可开火：暗淡红色，无辉光
 */
function drawTargetLines(
	graphics: Graphics,
	ship: ShipState,
	weapon: WeaponSlot,
	enemyShips: ShipState[]
): void {
	graphics.clear();

	// 计算武器挂载点的世界坐标
	const shipX = ship.transform.x;
	const shipY = ship.transform.y;
	const shipHeading = ship.transform.heading;
	const shipHeadingRad = (shipHeading * Math.PI) / 180;

	const mountOffsetX = weapon.mountOffsetX;
	const mountOffsetY = weapon.mountOffsetY;

	const mountWorldX =
		shipX + mountOffsetX * Math.cos(shipHeadingRad) - mountOffsetY * Math.sin(shipHeadingRad);
	const mountWorldY =
		shipY + mountOffsetX * Math.sin(shipHeadingRad) + mountOffsetY * Math.cos(shipHeadingRad);

	// 武器实际朝向
	const weaponFacing = shipHeading + weapon.mountFacing;
	const maxRange = weapon.range || 300;
	const minRange = weapon.minRange || 0;
	const arc = weapon.arc || 90;

	// 检查武器是否可以开火
	const canFire = isWeaponReady(ship, weapon);

	// 遍历敌方舰船，检查是否在射界内
	for (const target of enemyShips) {
		if (target.isDestroyed) continue;

		const isValid = isTargetValid(
			mountWorldX,
			mountWorldY,
			weaponFacing,
			maxRange,
			minRange,
			arc,
			target
		);

		if (isValid) {
			// 绘制瞄准线（根据武器状态调整样式）
			drawTargetLine(
				graphics,
				mountWorldX,
				mountWorldY,
				target.transform.x,
				target.transform.y,
				canFire
			);
		}
	}
}

/**
 * 检查武器是否可以开火
 */
function isWeaponReady(ship: ShipState, weapon: WeaponSlot): boolean {
	// 舰船过载无法开火
	if (ship.isOverloaded) return false;

	// 武器状态必须是就绪
	if (weapon.state !== WeaponState.READY) return false;

	// 冷却必须为0
	if (weapon.cooldownRemaining > 0) return false;

	// 本回合已射击
	if (weapon.hasFiredThisTurn) return false;

	// 弹药检查（如果有弹药限制）
	if (weapon.maxAmmo > 0 && weapon.currentAmmo <= 0) return false;

	return true;
}

/**
 * 检查目标是否在武器射界内
 * 使用 @vt/rules 权威函数，与后端一致
 */
function isTargetValid(
	mountX: number,
	mountY: number,
	weaponFacing: number,
	maxRange: number,
	minRange: number,
	arc: number,
	target: ShipState
): boolean {
	// 使用权威函数计算距离和角度
	const dist = distance(mountX, mountY, target.transform.x, target.transform.y);
	const angleToTarget = angleBetween(mountX, mountY, target.transform.x, target.transform.y);

	// 射程检查
	if (dist > maxRange) return false;
	if (minRange > 0 && dist < minRange) return false;

	// 射界检查（使用权威 angleDifference）
	const arcHalf = Math.max(0, arc) / 2;
	const diff = angleDifference(weaponFacing, angleToTarget);
	return diff <= arcHalf;
}

/**
 * 绘制单条瞄准线
 * - canFire=true: 红色带辉光效果
 * - canFire=false: 暗淡红色，无辉光
 */
function drawTargetLine(
	graphics: Graphics,
	fromX: number,
	fromY: number,
	toX: number,
	toY: number,
	canFire: boolean
): void {
	if (canFire) {
		// 武器就绪：绘制辉光效果（较宽的半透明线）
		graphics.moveTo(fromX, fromY);
		graphics.lineTo(toX, toY);
		graphics.stroke({
			color: TARGET_LINE_GLOW_COLOR,
			alpha: 0.3,
			width: 6,
		});

		// 绘制主瞄准线（红色）
		graphics.moveTo(fromX, fromY);
		graphics.lineTo(toX, toY);
		graphics.stroke({
			color: TARGET_LINE_COLOR,
			alpha: 0.7,
			width: 2,
		});

		// 在目标位置绘制命中标记
		const hitMarkerSize = 8;
		graphics.circle(toX, toY, hitMarkerSize);
		graphics.stroke({ color: TARGET_LINE_COLOR, alpha: 0.8, width: 2 });
		graphics.circle(toX, toY, hitMarkerSize * 0.5);
		graphics.fill({ color: TARGET_LINE_COLOR, alpha: 0.4 });
	} else {
		// 武器不可开火：暗淡红色，无辉光
		graphics.moveTo(fromX, fromY);
		graphics.lineTo(toX, toY);
		graphics.stroke({
			color: TARGET_LINE_COLOR,
			alpha: 0.25, // 暗淡
			width: 1.5,
		});

		// 在目标位置绘制暗淡的命中标记
		const hitMarkerSize = 6;
		graphics.circle(toX, toY, hitMarkerSize);
		graphics.stroke({ color: TARGET_LINE_COLOR, alpha: 0.3, width: 1 });
	}
}

/** 选中目标高亮颜色（黄色） */
const SELECTED_TARGET_COLOR = 0xffff00;
const SELECTED_TARGET_GLOW_COLOR = 0xffff88;

/**
 * 绘制选中目标的高亮效果
 * 使用黄色辉光突出显示用户选中的目标
 */
function drawSelectedTargetsHighlight(
	graphics: Graphics,
	ship: ShipState,
	weapon: WeaponSlot,
	allShips: ShipState[],
	selectedTargetIds: string[]
): void {
	// 计算武器挂载点的世界坐标
	const shipX = ship.transform.x;
	const shipY = ship.transform.y;
	const shipHeadingRad = (ship.transform.heading * Math.PI) / 180;

	const mountWorldX =
		shipX +
		weapon.mountOffsetX * Math.cos(shipHeadingRad) -
		weapon.mountOffsetY * Math.sin(shipHeadingRad);
	const mountWorldY =
		shipY +
		weapon.mountOffsetX * Math.sin(shipHeadingRad) +
		weapon.mountOffsetY * Math.cos(shipHeadingRad);

	// 为每个选中目标绘制高亮
	for (const targetId of selectedTargetIds) {
		const target = allShips.find((s) => s.id === targetId);
		if (!target || target.isDestroyed) continue;

		const targetX = target.transform.x;
		const targetY = target.transform.y;

		// 绘制高亮辉光（黄色宽线）
		graphics.moveTo(mountWorldX, mountWorldY);
		graphics.lineTo(targetX, targetY);
		graphics.stroke({
			color: SELECTED_TARGET_GLOW_COLOR,
			alpha: 0.5,
			width: 10,
		});

		// 绘制高亮主线（黄色）
		graphics.moveTo(mountWorldX, mountWorldY);
		graphics.lineTo(targetX, targetY);
		graphics.stroke({
			color: SELECTED_TARGET_COLOR,
			alpha: 0.9,
			width: 3,
		});

		// 在目标位置绘制选中标记（大圆环）
		const markerSize = 15;
		graphics.circle(targetX, targetY, markerSize);
		graphics.stroke({ color: SELECTED_TARGET_COLOR, alpha: 1, width: 3 });
		graphics.circle(targetX, targetY, markerSize * 0.6);
		graphics.fill({ color: SELECTED_TARGET_COLOR, alpha: 0.5 });
	}
}

/**
 * 绘制移动范围
 */
function drawMovementRange(
	layers: LayerRegistry,
	ship: ShipState,
	moveGraphicsRef: React.MutableRefObject<Graphics | null>
): void {
	if (!moveGraphicsRef.current) {
		moveGraphicsRef.current = new Graphics();
		layers.weaponArcs.addChild(moveGraphicsRef.current);
	}

	const moveGraphics = moveGraphicsRef.current;
	moveGraphics.clear();
	moveGraphics.position.set(0, 0);

	const shipX = ship.transform.x;
	const shipY = ship.transform.y;
	const maxSpeed = ship.maxSpeed || 100;

	const maxMoveDistance = maxSpeed * 4;

	moveGraphics.circle(shipX, shipY, maxMoveDistance);
	moveGraphics.stroke({ color: 0x4a9eff, alpha: 0.4, width: 2 });
	moveGraphics.fill({ color: 0x4a9eff, alpha: 0.05 });

	const turnRadius = Math.min(ship.width, ship.length) * 0.8;
	moveGraphics.circle(shipX, shipY, turnRadius);
	moveGraphics.stroke({ color: 0x4a9eff, alpha: 0.3, width: 1 });
}
