/**
 * 护盾辉光弧线渲染器
 *
 * 渲染策略：
 * - 使用辉光弧线而非填充扇形，更符合科幻美学
 * - 护盾颜色基于舰船阵营
 * - 护盾透明度基于护盾效率（越高越亮）
 * - 过载状态时护盾不显示
 * - 支持前盾(FRONT)和全盾(OMNI)两种类型
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipState } from "@/sync/types";
import { Faction, ShieldType } from "@/sync/types";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

/** 护盾弧线半径偏移（相对于舰船大小） */
const SHIELD_ARC_RADIUS_OFFSET = 15;

/** 护盾弧线宽度 */
const SHIELD_ARC_WIDTH = 3;

/** 护盾辉光效果层数 */
const SHIELD_GLOW_LAYERS = 3;

/** 阵营护盾颜色 */
const FACTION_SHIELD_COLORS: Record<string, number> = {
	[Faction.PLAYER]: 0x4fc3ff,   // 蓝色
	[Faction.DM]: 0xff7f9f,        // 红色
};

/**
 * 计算护盾弧线半径
 * 基于舰船护盾半径属性
 */
function calculateShieldRadius(ship: ShipState): number {
	// 护盾半径由舰船属性决定，加上视觉偏移
	return ship.shield.radius + SHIELD_ARC_RADIUS_OFFSET;
}

/**
 * 获取护盾颜色
 */
function getShieldColor(ship: ShipState): number {
	return FACTION_SHIELD_COLORS[ship.faction] ?? 0x4fc3ff;
}

/**
 * 获取护盾透明度（基于效率）
 * 效率越高，护盾越亮
 */
function getShieldAlpha(efficiency: number): number {
	// 效率范围 0.5-2.0，映射到透明度 0.4-1.0
	const normalizedEfficiency = Math.max(0.5, Math.min(2.0, efficiency));
	return 0.4 + (normalizedEfficiency - 0.5) * 0.6;
}

/**
 * 绘制护盾辉光弧线
 */
function drawShieldArc(
	graphics: Graphics,
	radius: number,
	arc: number,
	orientation: number,
	color: number,
	alpha: number,
	isOmni: boolean
): void {
	graphics.clear();

	// 护盾弧线的起始角度和结束角度
	// orientation 是护盾中心朝向（相对于船体，船头为0°）
	// 在 Pixi 坐标系中，船头朝上(-Y)，对应屏幕角度270°或-90°
	// 转换：屏幕角度 = orientation - 90
	const screenOrientation = (orientation - 90) * Math.PI / 180;
	const arcRad = (arc * Math.PI) / 180;

	// 计算弧线起始和结束角度
	const startAngle = screenOrientation - arcRad / 2;
	const endAngle = screenOrientation + arcRad / 2;

	// 绘制多层辉光效果
	for (let layer = 0; layer < SHIELD_GLOW_LAYERS; layer++) {
		const layerAlpha = alpha * (1 - layer * 0.25);
		const layerWidth = SHIELD_ARC_WIDTH + layer * 2;
		const layerRadius = radius + layer * 2;

		// 主弧线
		graphics.arc(0, 0, layerRadius, startAngle, endAngle);
		graphics.stroke({ color, width: layerWidth, alpha: layerAlpha });
	}

	// 绘制护盾边缘端点标记（两个小圆点）
	const endpointRadius = 4;
	const endpointAlpha = alpha * 1.2;

	// 左端点
	const leftEndpointX = radius * Math.cos(startAngle);
	const leftEndpointY = radius * Math.sin(startAngle);
	graphics.circle(leftEndpointX, leftEndpointY, endpointRadius);
	graphics.fill({ color, alpha: endpointAlpha * 0.5 });

	// 右端点
	const rightEndpointX = radius * Math.cos(endAngle);
	const rightEndpointY = radius * Math.sin(endAngle);
	graphics.circle(rightEndpointX, rightEndpointY, endpointRadius);
	graphics.fill({ color, alpha: endpointAlpha * 0.5 });

	// 全盾时绘制中心朝向指示器
	if (isOmni) {
		// 绘制朝向指示线
		const indicatorLength = radius * 0.3;
		graphics.moveTo(0, 0);
		graphics.lineTo(
			radius * Math.cos(screenOrientation) * indicatorLength / radius,
			radius * Math.sin(screenOrientation) * indicatorLength / radius
		);
		graphics.stroke({ color, width: 2, alpha: alpha * 0.7 });
	}
}

export interface ShieldArcCacheItem {
	root: Container;
	graphics: Graphics;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		shieldActive: boolean;
		shieldArc: number;
		shieldOrientation: number;
		shieldRadius: number;
		shieldEfficiency: number;
		shieldType: string;
		isOverloaded: boolean;
	};
}

export interface ShieldArcOptions {
	/** 是否显示护盾弧线 */
	show?: boolean;
}

export function useShieldArcRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	options: ShieldArcOptions = {}
) {
	const cacheRef = useRef<Map<string, ShieldArcCacheItem>>(new Map());
	const showShieldArc = useUIStore((state) => state.showShieldArc);
	const show = options.show ?? showShieldArc;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));

		// 清理已删除舰船的护盾渲染
		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.shieldArcs.removeChild(item.root);
				cache.delete(id);
			}
		}

		// 更新或创建护盾渲染
		for (const ship of ships) {
			// 过载状态不显示护盾
			if (ship.isOverloaded || !ship.shield.active) {
				const cached = cache.get(ship.id);
				if (cached) {
					cached.graphics.clear();
				}
				continue;
			}

			const cached = cache.get(ship.id);
			if (!cached) {
				createShieldArc(layers, cache, ship);
				continue;
			}

			if (shouldUpdateShield(cached, ship)) {
				updateShieldArc(cached, ship);
			}
		}

		// 控制图层可见性
		layers.shieldArcs.visible = show;
	}, [layers, ships, show]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdateShield(cached: ShieldArcCacheItem, ship: ShipState): boolean {
	if (!cached.lastState) return true;

	const last = cached.lastState;

	// 位置变化
	const dx = Math.abs(ship.transform.x - last.x);
	const dy = Math.abs(ship.transform.y - last.y);
	const dHeading = Math.abs(ship.transform.heading - last.heading);

	// 护盾状态变化
	const shieldChanged =
		ship.shield.active !== last.shieldActive ||
		ship.shield.arc !== last.shieldArc ||
		ship.shield.orientation !== last.shieldOrientation ||
		ship.shield.radius !== last.shieldRadius ||
		ship.shield.efficiency !== last.shieldEfficiency ||
		ship.shield.type !== last.shieldType ||
		ship.isOverloaded !== last.isOverloaded;

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || shieldChanged;
}

function createShieldArc(
	layers: LayerRegistry,
	cache: Map<string, ShieldArcCacheItem>,
	ship: ShipState
): void {
	const root = new Container();
	root.position.set(ship.transform.x, ship.transform.y);
	root.rotation = (ship.transform.heading * Math.PI) / 180;

	const graphics = new Graphics();
	drawShieldArcForShip(graphics, ship);
	root.addChild(graphics);

	layers.shieldArcs.addChild(root);

	cache.set(ship.id, {
		root,
		graphics,
		lastState: {
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			shieldActive: ship.shield.active,
			shieldArc: ship.shield.arc,
			shieldOrientation: ship.shield.orientation,
			shieldRadius: ship.shield.radius,
			shieldEfficiency: ship.shield.efficiency,
			shieldType: ship.shield.type,
			isOverloaded: ship.isOverloaded,
		},
	});
}

function updateShieldArc(cached: ShieldArcCacheItem, ship: ShipState): void {
	cached.root.position.set(ship.transform.x, ship.transform.y);
	cached.root.rotation = (ship.transform.heading * Math.PI) / 180;

	drawShieldArcForShip(cached.graphics, ship);

	cached.lastState = {
		x: ship.transform.x,
		y: ship.transform.y,
		heading: ship.transform.heading,
		shieldActive: ship.shield.active,
		shieldArc: ship.shield.arc,
		shieldOrientation: ship.shield.orientation,
		shieldRadius: ship.shield.radius,
		shieldEfficiency: ship.shield.efficiency,
		shieldType: ship.shield.type,
		isOverloaded: ship.isOverloaded,
	};
}

function drawShieldArcForShip(graphics: Graphics, ship: ShipState): void {
	// 过载或护盾未激活时不绘制
	if (ship.isOverloaded || !ship.shield.active) {
		graphics.clear();
		return;
	}

	const radius = calculateShieldRadius(ship);
	const color = getShieldColor(ship);
	const alpha = getShieldAlpha(ship.shield.efficiency);
	const isOmni = ship.shield.type === ShieldType.OMNI;

	drawShieldArc(
		graphics,
		radius,
		ship.shield.arc,
		ship.shield.orientation,
		color,
		alpha,
		isOmni
	);
}