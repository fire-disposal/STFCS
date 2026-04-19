/**
 * 舰船战术渲染模块
 *
 * 渲染策略：
 * - 使用舰船长宽定义渲染真实大小的判定框
 * - 渲染武器挂载节点及简化的矢量风格武器图标
 * - 不同伤害类型使用不同颜色、不同形状
 * - 根据挂载点位置与船体中心关系、武器朝向正确显示
 */

import { screenToWorld } from "@/utils/coordinateSystem";
import type { ShipState } from "@/sync/types";
import { Faction, DamageType, WeaponCategory } from "@/sync/types";
import type { WeaponSlot } from "@/sync/types";
import { Circle, Container, type FederatedPointerEvent, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

const POSITION_THRESHOLD = 0.5;
const HEADING_THRESHOLD = 0.8;
const FLUX_THRESHOLD = 0.5;

/** 阵营颜色 */
const FACTION_COLORS: Record<string, number> = {
	[Faction.PLAYER]: 0x4fc3ff,
	[Faction.NEUTRAL]: 0xff7f9f,
};

/** 伤害类型颜色 */
const DAMAGE_TYPE_COLORS: Record<string, number> = {
	[DamageType.KINETIC]: 0xffd700,      // 金色 - 动能（反盾）
	[DamageType.HIGH_EXPLOSIVE]: 0xff6b35, // 橙红 - 高爆（反甲）
	[DamageType.ENERGY]: 0x7b68ee,       // 紫蓝 - 能量（通用）
	[DamageType.FRAGMENTATION]: 0x32cd32, // 绿色 - 碎片（点防御）
};

/** 武器尺寸对应的图标大小 */
const WEAPON_SIZE_SCALE: Record<string, number> = {
	SMALL: 6,
	MEDIUM: 10,
	LARGE: 14,
};

export interface ShipCacheItem {
	root: Container;
	tacticalToken: Graphics;
	hitbox: Graphics;
	weaponMarkers: Graphics;
	isSelected: boolean;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		flux: number;
		weaponCount: number;
	};
}

export interface ShipRenderContext {
	zoom: number;
	x: number;
	y: number;
	canvasWidth: number;
	canvasHeight: number;
	viewRotation: number;
}

export interface ShipRenderOptions {
	onSelectShip?: (shipId: string) => void;
	setMouseWorldPosition?: (x: number, y: number) => void;
	storeSelectShip?: (shipId: string) => void;
}

/**
 * 舰船战术渲染 Hook
 */
export function useShipRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	context: Partial<ShipRenderContext>,
	options: ShipRenderOptions = {}
) {
	const cacheRef = useRef<Map<string, ShipCacheItem>>(new Map());
	const optionsRef = useRef(options);
	const contextRef = useRef(context);

	optionsRef.current = options;
	contextRef.current = context;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));
		const selectedId = selectedShipId ?? null;

		// 清除不在当前列表中的舰船
		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.tacticalTokens.removeChild(item.root);
				cache.delete(id);
			}
		}

		// 创建或更新舰船战术标记
		for (const ship of ships) {
			const isSelected = ship.id === selectedId;
			const cached = cache.get(ship.id);
			if (!cached) {
				createShipToken(layers, cache, ship, isSelected, optionsRef, contextRef);
				continue;
			}

			if (shouldUpdate(cached, ship, isSelected)) {
				updateShipToken(cached, ship, isSelected);
			}
		}

		layers.shipSprites.visible = true;
	}, [layers, ships, selectedShipId]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdate(
	cached: ShipCacheItem,
	ship: ShipState,
	isSelected: boolean
): boolean {
	if (!cached.lastState) return true;

	const dx = Math.abs(ship.transform.x - cached.lastState.x);
	const dy = Math.abs(ship.transform.y - cached.lastState.y);
	const dHeading = Math.abs(ship.transform.heading - cached.lastState.heading);
	const dFlux = Math.abs(ship.flux.total - cached.lastState.flux);
	const selectedChanged = cached.isSelected !== isSelected;
	const weaponCountChanged = cached.lastState.weaponCount !== ship.weapons.size;

	return (
		dx > POSITION_THRESHOLD ||
		dy > POSITION_THRESHOLD ||
		dHeading > HEADING_THRESHOLD ||
		dFlux > FLUX_THRESHOLD ||
		selectedChanged ||
		weaponCountChanged
	);
}

function updateShipToken(
	cached: ShipCacheItem,
	ship: ShipState,
	isSelected: boolean
): void {
	const color = FACTION_COLORS[ship.faction] ?? 0xcfd8e3;
	const halfWidth = ship.width / 2;
	const halfLength = ship.length / 2;

	// 更新位置和旋转
	cached.root.position.set(ship.transform.x, ship.transform.y);
	cached.root.rotation = (ship.transform.heading * Math.PI) / 180;

	// 更新选中状态
	if (cached.isSelected !== isSelected) {
		cached.isSelected = isSelected;
		drawTacticalToken(cached.tacticalToken, color, halfWidth, halfLength, isSelected);
		drawHitbox(cached.hitbox, halfWidth, halfLength, isSelected);
	}

	// 重绘武器标记（武器可能变化）
	drawWeaponMarkers(cached.weaponMarkers, ship, isSelected);

	// 保存状态
	cached.lastState = {
		x: ship.transform.x,
		y: ship.transform.y,
		heading: ship.transform.heading,
		flux: ship.flux.total,
		weaponCount: ship.weapons.size,
	};
}

function createShipToken(
	layers: LayerRegistry,
	cache: Map<string, ShipCacheItem>,
	ship: ShipState,
	isSelected: boolean,
	optionsRef: React.MutableRefObject<ShipRenderOptions>,
	contextRef: React.MutableRefObject<Partial<ShipRenderContext>>
): void {
	const color = FACTION_COLORS[ship.faction] ?? 0xcfd8e3;
	const halfWidth = ship.width / 2;
	const halfLength = ship.length / 2;
	// 计算判定框半径（用于点击检测）
	const hitRadius = Math.max(halfWidth, halfLength) + 10;

	// 创建舰船战术标记容器
	const root = new Container();
	root.position.set(ship.transform.x, ship.transform.y);
	root.rotation = (ship.transform.heading * Math.PI) / 180;
	root.eventMode = "static";
	root.cursor = "pointer";
	root.hitArea = new Circle(0, 0, hitRadius);

	// 绘制判定框（船体轮廓）
	const hitbox = new Graphics();
	drawHitbox(hitbox, halfWidth, halfLength, isSelected);
	root.addChild(hitbox);

	// 绘制战术标记（箭头形状）
	const tacticalToken = new Graphics();
	drawTacticalToken(tacticalToken, color, halfWidth, halfLength, isSelected);
	root.addChild(tacticalToken);

	// 绘制武器挂载点标记
	const weaponMarkers = new Graphics();
	drawWeaponMarkers(weaponMarkers, ship, isSelected);
	root.addChild(weaponMarkers);

	// 点击事件
	root.on("pointertap", () => {
		optionsRef.current.storeSelectShip?.(ship.id);
		optionsRef.current.onSelectShip?.(ship.id);
	});

	// 鼠标移动事件（更新世界坐标）
	root.on("pointermove", (e: FederatedPointerEvent) => {
		const ctx = contextRef.current;
		if (
			!optionsRef.current.setMouseWorldPosition ||
			ctx.canvasWidth === undefined ||
			ctx.canvasHeight === undefined ||
			ctx.zoom === undefined ||
			ctx.x === undefined ||
			ctx.y === undefined
		) {
			return;
		}

		const world = screenToWorld(
			e.global.x - ctx.canvasWidth / 2,
			e.global.y - ctx.canvasHeight / 2,
			ctx.zoom,
			ctx.x,
			ctx.y,
			ctx.viewRotation || 0
		);
		optionsRef.current.setMouseWorldPosition(world.x, world.y);
	});

	// 添加到战术标记层
	layers.tacticalTokens.addChild(root);

	// 缓存
	cache.set(ship.id, {
		root,
		tacticalToken,
		hitbox,
		weaponMarkers,
		isSelected,
		lastState: {
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			flux: ship.flux.total,
			weaponCount: ship.weapons.size,
		},
	});
}

/**
 * 绘制船体判定框（菱形轮廓）
 * 船体中心在原点，船头朝向 -Y 方向（因为 heading 0 度朝上）
 * 菱形顶点在船头/船尾，左右两侧为宽度
 */
function drawHitbox(
	target: Graphics,
	halfWidth: number,
	halfLength: number,
	isSelected: boolean
): void {
	target.clear();
	
	const outlineColor = isSelected ? 0xffffff : 0x8899aa;
	const alpha = isSelected ? 0.95 : 0.6;
	const lineWidth = isSelected ? 2 : 1.5;
	
	// 菱形：顶点 (船头)、底点 (船尾)、左右两侧
	// 船头朝上 (-Y)，船尾朝下 (+Y)
	target.poly([
		0, -halfLength,           // 船头顶点
		halfWidth, 0,             // 右侧宽度点
		0, halfLength,            // 船尾底点
		-halfWidth, 0,            // 左侧宽度点
	]);
	target.stroke({ color: outlineColor, width: lineWidth, alpha });
	
	// 选中时显示填充
	if (isSelected) {
		target.fill({ color: 0x4fc3ff, alpha: 0.12 });
	}
}

/**
 * 绘制战术标记（箭头形状）
 * 根据船体大小调整箭头尺寸
 */
function drawTacticalToken(
	target: Graphics,
	color: number,
	halfWidth: number,
	halfLength: number,
	isSelected: boolean
): void {
	target.clear();
	
	// 箭头尺寸基于船体大小，但保持最小可视尺寸
	const arrowLength = Math.max(halfLength * 0.6, 15);
	const arrowWidth = Math.max(halfWidth * 0.4, 8);
	
	const outline = isSelected ? 0xffffff : color;
	const alpha = isSelected ? 0.98 : 0.85;
	const lineWidth = isSelected ? 2.5 : 2;
	
	// 箭头形状：船头朝上 (-Y 方向)
	// 顶点 (船头): (0, -arrowLength)
	// 底部两端 (船尾): (-arrowWidth, arrowLength * 0.6), (arrowWidth, arrowLength * 0.6)
	target
		.poly([
			0, -arrowLength,                         // 船头顶点
			arrowWidth * 0.6, arrowLength * 0.3,     // 右侧中间
			arrowWidth, arrowLength * 0.6,           // 右侧尾部
			0, arrowLength * 0.35,                   // 尾部中心凹陷
			-arrowWidth, arrowLength * 0.6,          // 左侧尾部
			-arrowWidth * 0.6, arrowLength * 0.3,    // 左侧中间
		])
		.stroke({ color: outline, width: lineWidth, alpha });
	
	// 中心轴线指示
	target
		.moveTo(0, -arrowLength * 0.7)
		.lineTo(0, arrowLength * 0.4)
		.stroke({ color: color, width: 1.2, alpha: 0.7 });
	
	// 中心点
	target.circle(0, 0, 2.5).fill({ color: 0xffffff, alpha: 0.9 });
}

/**
 * 绘制武器挂载点标记
 * 根据挂载点位置、朝向和武器类型渲染不同的矢量图标
 */
function drawWeaponMarkers(
	target: Graphics,
	ship: ShipState,
	isSelected: boolean
): void {
	target.clear();
	
	// 遍历所有武器
	ship.weapons.forEach((weapon: WeaponSlot) => {
		drawSingleWeaponMarker(target, weapon, isSelected);
	});
}

/**
 * 绘制单个武器挂载点标记
 */
function drawSingleWeaponMarker(
	target: Graphics,
	weapon: WeaponSlot,
	isSelected: boolean
): void {
	// 挂载点位置（相对于船体中心）
	const offsetX = weapon.mountOffsetX;
	const offsetY = weapon.mountOffsetY;
	
	// 武器朝向角度（相对于船体，转换为弧度）
	// mountFacing 是相对于船体的基准朝向，船头方向为 0°
	// 在 Pixi 坐标系中，船头朝上 (-Y)，我们需要转换：
	// Pixi 角度 0° = 朝右 (+X)，90° = 朝下 (+Y)
	// 船体角度 0° = 朝上 (-Y) = Pixi 的 -90° 或 270°
	// 转换公式：pixiAngle = (mountFacing - 90) 或 (-mountFacing + 90)
	// 但由于 root 已经旋转了 heading，我们需要使用相对于 root 的角度
	// 在 root 内部，船头仍然是朝上 (-Y)，所以直接使用 mountFacing 即可
	// 但 Pixi 绘制时，角度需要转换为标准数学坐标系（0° 朝右）
	const facingDeg = weapon.mountFacing;
	// 使用炮塔当前朝向（如果有），用于显示炮塔瞄准方向
	const turretAngleDeg = weapon.currentTurretAngle ?? facingDeg;
	const facingRad = (turretAngleDeg - 90) * Math.PI / 180;  // 转换：船体0° → Pixi -90°
	
	// 武器颜色基于伤害类型
	const weaponColor = DAMAGE_TYPE_COLORS[weapon.damageType] ?? 0x7b68ee;
	
	// 武器图标大小基于尺寸
	const iconSize = WEAPON_SIZE_SCALE[weapon.size] ?? 8;
	
	// alpha
	const alpha = isSelected ? 0.95 : 0.75;
	const outlineAlpha = isSelected ? 1 : 0.8;
	
	// 根据武器类别绘制不同形状
	switch (weapon.category) {
		case WeaponCategory.BALLISTIC:
			drawBallisticWeapon(target, offsetX, offsetY, facingRad, iconSize, weaponColor, alpha, outlineAlpha);
			break;
		case WeaponCategory.ENERGY:
			drawEnergyWeapon(target, offsetX, offsetY, facingRad, iconSize, weaponColor, alpha, outlineAlpha);
			break;
		case WeaponCategory.MISSILE:
			drawMissileWeapon(target, offsetX, offsetY, facingRad, iconSize, weaponColor, alpha, outlineAlpha);
			break;
		default:
			// 默认：简单圆点
			target.circle(offsetX, offsetY, iconSize * 0.5);
			target.fill({ color: weaponColor, alpha });
	}
	
	// 显示射界扇形指示（简化版）
	const arcRad = (weapon.arc * Math.PI) / 180;
	drawWeaponArcIndicator(target, offsetX, offsetY, arcRad, facingRad, weaponColor, alpha * 0.4);
}

/**
 * 绘制弹道武器（矩形炮塔形状）
 */
function drawBallisticWeapon(
	target: Graphics,
	x: number,
	y: number,
	facingRad: number,
	size: number,
	color: number,
	alpha: number,
	outlineAlpha: number
): void {
	target.poly([
		x + Math.cos(facingRad) * size * 0.8, y + Math.sin(facingRad) * size * 0.8,
		x + Math.cos(facingRad + Math.PI * 0.6) * size * 0.4, y + Math.sin(facingRad + Math.PI * 0.6) * size * 0.4,
		x + Math.cos(facingRad + Math.PI) * size * 0.3, y + Math.sin(facingRad + Math.PI) * size * 0.3,
		x + Math.cos(facingRad - Math.PI * 0.6) * size * 0.4, y + Math.sin(facingRad - Math.PI * 0.6) * size * 0.4,
	]);
	target.fill({ color, alpha: alpha * 0.6 });
	target.stroke({ color, width: 1.2, alpha: outlineAlpha });
	
	// 炮管指示线
	target
		.moveTo(x, y)
		.lineTo(x + Math.cos(facingRad) * size * 1.2, y + Math.sin(facingRad) * size * 1.2)
		.stroke({ color, width: 1.5, alpha: outlineAlpha });
}

/**
 * 绘制能量武器（三角形光束形状）
 */
function drawEnergyWeapon(
	target: Graphics,
	x: number,
	y: number,
	facingRad: number,
	size: number,
	color: number,
	alpha: number,
	outlineAlpha: number
): void {
	// 三角形指向发射方向
	target.poly([
		x + Math.cos(facingRad) * size, y + Math.sin(facingRad) * size,
		x + Math.cos(facingRad + Math.PI * 0.7) * size * 0.5, y + Math.sin(facingRad + Math.PI * 0.7) * size * 0.5,
		x + Math.cos(facingRad - Math.PI * 0.7) * size * 0.5, y + Math.sin(facingRad - Math.PI * 0.7) * size * 0.5,
	]);
	target.fill({ color, alpha: alpha * 0.5 });
	target.stroke({ color, width: 1.2, alpha: outlineAlpha });
	
	// 光束发射点
	target.circle(x + Math.cos(facingRad) * size * 0.3, y + Math.sin(facingRad) * size * 0.3, size * 0.15);
	target.fill({ color: 0xffffff, alpha: alpha * 0.8 });
}

/**
 * 绘制导弹武器（菱形形状）
 */
function drawMissileWeapon(
	target: Graphics,
	x: number,
	y: number,
	facingRad: number,
	size: number,
	color: number,
	alpha: number,
	outlineAlpha: number
): void {
	// 菱形/导弹形状
	target.poly([
		x + Math.cos(facingRad) * size * 1.2, y + Math.sin(facingRad) * size * 1.2,
		x + Math.cos(facingRad + Math.PI * 0.5) * size * 0.4, y + Math.sin(facingRad + Math.PI * 0.5) * size * 0.4,
		x + Math.cos(facingRad + Math.PI) * size * 0.5, y + Math.sin(facingRad + Math.PI) * size * 0.5,
		x + Math.cos(facingRad - Math.PI * 0.5) * size * 0.4, y + Math.sin(facingRad - Math.PI * 0.5) * size * 0.4,
	]);
	target.fill({ color, alpha: alpha * 0.5 });
	target.stroke({ color, width: 1.2, alpha: outlineAlpha });
	
	// 导弹发射口指示
	target.circle(x, y, size * 0.2);
	target.fill({ color: 0xffffff, alpha: alpha * 0.7 });
}

/**
 * 绘制武器射界扇形指示（简化版）
 */
function drawWeaponArcIndicator(
	target: Graphics,
	x: number,
	y: number,
	arc: number,
	facingRad: number,
	color: number,
	alpha: number
): void {
	if (arc <= 0) return;
	
	// 绘制简化的射界扇形线
	const arcRad = (arc * Math.PI) / 180;
	const indicatorLength = 25; // 固定长度指示
	
	// 左边界线
	target
		.moveTo(x, y)
		.lineTo(
			x + Math.cos(facingRad - arcRad / 2) * indicatorLength,
			y + Math.sin(facingRad - arcRad / 2) * indicatorLength
		)
		.stroke({ color, width: 0.8, alpha });
	
	// 右边界线
	target
		.moveTo(x, y)
		.lineTo(
			x + Math.cos(facingRad + arcRad / 2) * indicatorLength,
			y + Math.sin(facingRad + arcRad / 2) * indicatorLength
		)
		.stroke({ color, width: 0.8, alpha });
}