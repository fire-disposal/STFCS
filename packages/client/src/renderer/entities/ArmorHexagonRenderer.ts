/**
 * 六边形护甲渲染器
 *
 * 在舰船周围绘制六边形护甲可视化：
 * - 6条边对应6个护甲象限
 * - 根据护甲百分比从绿色（满）到红色（空）渐变
 * - 护甲为0时不绘制该边
 * - 独立图层，不受特效干扰
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipState } from "@/sync/types";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

/** 六边形护甲半径（相对于舰船大小） */
const ARMOR_HEX_RADIUS = 32;

/** 六边形顶点角度（数学角度，0°东，逆时针） */
const HEX_VERTEX_ANGLES = [0, 60, 120, 180, 240, 300];

/**
 * 象限索引到六边形边的映射
 * 
 * 象限定义（相对于舰船朝向）：
 * - 0: FRONT_TOP    330°-30°   (前方正中)
 * - 1: FRONT_BOTTOM 270°-330°  (前下方)
 * - 2: LEFT_TOP     210°-270°  (左前方)
 * - 3: LEFT_BOTTOM  150°-210°  (左后方)
 * - 4: RIGHT_TOP    30°-90°    (右前方)
 * - 5: RIGHT_BOTTOM 90°-150°  (右后方)
 * 
 * 六边形顶点（顺时针，顶点0在舰船前方0°）：
 * 顶点0: 0°(前) → 顶点1: 60°(右前) → 顶点2: 120°(右后)
 * 顶点3: 180°(左后) → 顶点4: 240°(左前) → 顶点5: 300°(前下)
 * 
 * 边（顶点i到顶点(i+1)%6）对应象限：
 * 边5-0: -30°到30°  → FRONT_TOP (索引0)
 * 边0-1: 30°到90°   → RIGHT_TOP (索引4)
 * 边1-2: 90°到150°  → RIGHT_BOTTOM (索引5)
 * 边2-3: 150°到210° → LEFT_BOTTOM (索引3)
 * 边3-4: 210°到270° → LEFT_TOP (索引2)
 * 边4-5: 270°到330° → FRONT_BOTTOM (索引1)
 */
const QUADRANT_TO_EDGE: Record<number, { from: number; to: number }> = {
	0: { from: 5, to: 0 }, // FRONT_TOP
	1: { from: 4, to: 5 }, // FRONT_BOTTOM
	2: { from: 3, to: 4 }, // LEFT_TOP
	3: { from: 2, to: 3 }, // LEFT_BOTTOM
	4: { from: 0, to: 1 }, // RIGHT_TOP
	5: { from: 1, to: 2 }, // RIGHT_BOTTOM
};

/** 护甲百分比到颜色（绿到红渐变） */
function getArmorColor(percent: number): number {
	// 100% = 绿色 (0x57e38d)
	// 50%  = 黄色 (0xffce66)
	// 0%   = 红色 (0xff5d7e)
	if (percent >= 0.75) {
		// 绿色到黄绿色
		const t = (percent - 0.75) / 0.25;
		const r = Math.round(87 + (255 - 87) * (1 - t));
		const g = Math.round(227 + (206 - 227) * (1 - t));
		const b = Math.round(141 + (102 - 141) * (1 - t));
		return (r << 16) | (g << 8) | b;
	} else if (percent >= 0.5) {
		// 黄绿色到黄色
		const t = (percent - 0.5) / 0.25;
		const r = Math.round(255);
		const g = Math.round(206 + (227 - 206) * t);
		const b = Math.round(102 + (141 - 102) * t);
		return (r << 16) | (g << 8) | b;
	} else if (percent >= 0.25) {
		// 黄色到橙色
		const t = (percent - 0.25) / 0.25;
		const r = 255;
		const g = Math.round(127 + (206 - 127) * t);
		const b = Math.round(127 + (102 - 127) * t);
		return (r << 16) | (g << 8) | b;
	} else {
		// 橙色到红色
		const t = percent / 0.25;
		const r = 255;
		const g = Math.round(93 + (127 - 93) * t);
		const b = Math.round(126 + (127 - 126) * t);
		return (r << 16) | (g << 8) | b;
	}
}

export interface ArmorHexagonCacheItem {
	root: Container;
	graphics: Graphics;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		quadrants: number[];
		maxPerQuadrant: number;
	};
}

export interface ArmorHexagonOptions {
	/** 是否显示护甲六边形 */
	show?: boolean;
}

export function useArmorHexagonRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	options: ArmorHexagonOptions = {}
) {
	const cacheRef = useRef<Map<string, ArmorHexagonCacheItem>>(new Map());
	const showHexagonArmor = useUIStore((state) => state.showHexagonArmor);
	const show = options.show ?? showHexagonArmor;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));

		// 清理已删除舰船的护甲渲染
		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.hexagonArmor.removeChild(item.root);
				cache.delete(id);
			}
		}

		// 更新或创建护甲渲染
		for (const ship of ships) {
			const cached = cache.get(ship.id);
			if (!cached) {
				createArmorHexagon(layers, cache, ship);
				continue;
			}

			if (shouldUpdateArmor(cached, ship)) {
				updateArmorHexagon(cached, ship);
			}
		}

		// 控制图层可见性
		layers.hexagonArmor.visible = show;
	}, [layers, ships, show]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdateArmor(cached: ArmorHexagonCacheItem, ship: ShipState): boolean {
	if (!cached.lastState) return true;

	const dx = Math.abs(ship.transform.x - cached.lastState.x);
	const dy = Math.abs(ship.transform.y - cached.lastState.y);
	const dHeading = Math.abs(ship.transform.heading - cached.lastState.heading);

	// 检查象限值变化（直接数组访问）
	const quadrants = ship.armor.quadrants;
	const quadrantsChanged = quadrants.some(
		(v, i) => v !== cached.lastState!.quadrants[i]
	);

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || quadrantsChanged;
}

function createArmorHexagon(
	layers: LayerRegistry,
	cache: Map<string, ArmorHexagonCacheItem>,
	ship: ShipState
): void {
	const root = new Container();
	root.position.set(ship.transform.x, ship.transform.y);
	root.rotation = (ship.transform.heading * Math.PI) / 180;

	const graphics = new Graphics();
	drawArmorHexagon(graphics, ship);
	root.addChild(graphics);

	layers.hexagonArmor.addChild(root);

	const quadrants = Array.from(ship.armor.quadrants);
	cache.set(ship.id, {
		root,
		graphics,
		lastState: {
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			quadrants,
			maxPerQuadrant: ship.armor.maxPerQuadrant,
		},
	});
}

function updateArmorHexagon(cached: ArmorHexagonCacheItem, ship: ShipState): void {
	cached.root.position.set(ship.transform.x, ship.transform.y);
	cached.root.rotation = (ship.transform.heading * Math.PI) / 180;

	drawArmorHexagon(cached.graphics, ship);

	const quadrants = Array.from(ship.armor.quadrants);
	cached.lastState = {
		x: ship.transform.x,
		y: ship.transform.y,
		heading: ship.transform.heading,
		quadrants,
		maxPerQuadrant: ship.armor.maxPerQuadrant,
	};
}

function drawArmorHexagon(graphics: Graphics, ship: ShipState): void {
	graphics.clear();

	const radius = ARMOR_HEX_RADIUS;
	const maxPerQuadrant = ship.armor.maxPerQuadrant;
	// 直接访问数组，前端数据是纯对象，没有 Schema 方法
	const quadrants = ship.armor.quadrants;

	// 计算六边形顶点位置（相对于Container，朝向已通过rotation处理）
	const vertices: { x: number; y: number }[] = HEX_VERTEX_ANGLES.map((angleDeg) => {
		// 转换为数学角度：顶点0应在舰船前方（朝向方向）
		// 由于Container已旋转，这里使用相对于舰船的角度
		// 舰船朝向为0°时，前方是数学角度90°（北）
		// 但在PixiJS中，我们使用屏幕角度：0°右，顺时针
		// 舰船朝向0°时，前方应该是数学角度90°，屏幕角度270°
		// 简化：让顶点0在舰船前方（相对于舰船坐标系，前方是+Y方向）
		const rad = (angleDeg - 90) * Math.PI / 180; // 调整使顶点0在前方
		return {
			x: radius * Math.cos(rad),
			y: radius * Math.sin(rad),
		};
	});

	// 绘制每条边（对应象限）
	for (let quadrantIndex = 0; quadrantIndex < 6; quadrantIndex++) {
		const armorValue = quadrants[quadrantIndex] ?? 0;
		const percent = armorValue / maxPerQuadrant;

		// 护甲为0时不绘制该边
		if (armorValue <= 0 || percent <= 0) continue;

		const edge = QUADRANT_TO_EDGE[quadrantIndex];
		const fromVertex = vertices[edge.from];
		const toVertex = vertices[edge.to];

		const color = getArmorColor(percent);
		const lineWidth = 2 + percent * 2; // 护甲越多线越粗
		const alpha = 0.7 + percent * 0.3; // 护甲越多越亮

		graphics
			.moveTo(fromVertex.x, fromVertex.y)
			.lineTo(toVertex.x, toVertex.y)
			.stroke({ color, width: lineWidth, alpha });
	}

	// 绘制中心点指示舰船位置
	graphics.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.3 });
}