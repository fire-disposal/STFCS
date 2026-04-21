/**
 * 护甲六边形渲染 Hook
 *
 * 职责：
 * 1. 渲染舰船护甲六边形可视化
 * 2. 显示六个护甲扇区状态（RF/RR/RB/LB/LL/LF）
 * 3. 根据护甲值变化颜色（绿->黄->红）
 *
 * 渲染层：world.hexagonArmor (zIndex 13)
 *
 * 六边形结构：
 * - 中心点：舰船位置
 * - 六个边：对应六个护甲扇区
 * - 颜色：根据护甲百分比动态计算
 *
 * 颜色映射：
 * - 75-100%: 绿色系 (#57e38d -> #ffcc66)
 * - 50-75%: 黄色系
 * - 25-50%: 橙色系
 * - 0-25%: 红色系
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipRuntime } from "@vt/data";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

const ARMOR_HEX_RADIUS = 32;
const HEX_VERTEX_ANGLES = [0, 60, 120, 180, 240, 300];
const DEFAULT_ARMOR_MAX = 100;

const QUADRANT_TO_EDGE: Record<number, { from: number; to: number }> = {
	0: { from: 5, to: 0 },
	1: { from: 4, to: 5 },
	2: { from: 3, to: 4 },
	3: { from: 2, to: 3 },
	4: { from: 0, to: 1 },
	5: { from: 1, to: 2 },
};

function getArmorColor(percent: number): number {
	if (percent >= 0.75) {
		const t = (percent - 0.75) / 0.25;
		const r = Math.round(87 + (255 - 87) * (1 - t));
		const g = Math.round(227 + (206 - 227) * (1 - t));
		const b = Math.round(141 + (102 - 141) * (1 - t));
		return (r << 16) | (g << 8) | b;
	} else if (percent >= 0.5) {
		const t = (percent - 0.5) / 0.25;
		const r = 255;
		const g = Math.round(206 + (227 - 206) * t);
		const b = Math.round(102 + (141 - 102) * t);
		return (r << 16) | (g << 8) | b;
	} else if (percent >= 0.25) {
		const t = (percent - 0.25) / 0.25;
		const r = 255;
		const g = Math.round(127 + (206 - 127) * t);
		const b = Math.round(127 + (102 - 127) * t);
		return (r << 16) | (g << 8) | b;
	} else {
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
		armor: number[];
	};
}

export interface ArmorHexagonOptions {
	show?: boolean;
	armorMaxPerQuadrant?: number;
}

export function useArmorHexagonRendering(
	layers: LayerRegistry | null,
	ships: (ShipRuntime & { id: string })[],
	options: ArmorHexagonOptions = {}
) {
	const cacheRef = useRef<Map<string, ArmorHexagonCacheItem>>(new Map());
	const showHexagonArmor = useUIStore((state) => state.showHexagonArmor);
	const show = options.show ?? showHexagonArmor;
	const armorMax = options.armorMaxPerQuadrant ?? DEFAULT_ARMOR_MAX;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.hexagonArmor.removeChild(item.root);
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			const cached = cache.get(ship.id);
			if (!cached) {
				createArmorHexagon(layers, cache, ship, armorMax);
				continue;
			}

			if (shouldUpdateArmor(cached, ship)) {
				updateArmorHexagon(cached, ship, armorMax);
			}
		}

		layers.hexagonArmor.visible = show;
	}, [layers, ships, show, armorMax]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdateArmor(cached: ArmorHexagonCacheItem, ship: ShipRuntime & { id: string }): boolean {
	if (!cached.lastState || !ship.position) return true;

	const dx = Math.abs(ship.position.x - cached.lastState.x);
	const dy = Math.abs(ship.position.y - cached.lastState.y);
	const dHeading = Math.abs(ship.heading - cached.lastState.heading);

	if (!ship.armor) return dx > 0.5 || dy > 0.5 || dHeading > 1;

	const armorChanged = ship.armor.some(
		(v: number, i: number) => v !== cached.lastState!.armor[i]
	);

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || armorChanged;
}

function createArmorHexagon(
	layers: LayerRegistry,
	cache: Map<string, ArmorHexagonCacheItem>,
	ship: ShipRuntime & { id: string },
	armorMax: number
): void {
	if (!ship.position) return;

	const root = new Container();
	root.position.set(ship.position.x, ship.position.y);
	root.rotation = (ship.heading * Math.PI) / 180;

	const graphics = new Graphics();
	drawArmorHexagon(graphics, ship, armorMax);
	root.addChild(graphics);

	layers.hexagonArmor.addChild(root);

	cache.set(ship.id, {
		root,
		graphics,
		lastState: {
			x: ship.position.x,
			y: ship.position.y,
			heading: ship.heading,
			armor: ship.armor ? Array.from(ship.armor) : [],
		},
	});
}

function updateArmorHexagon(
	cached: ArmorHexagonCacheItem,
	ship: ShipRuntime & { id: string },
	armorMax: number
): void {
	if (!ship.position) return;

	cached.root.position.set(ship.position.x, ship.position.y);
	cached.root.rotation = (ship.heading * Math.PI) / 180;

	drawArmorHexagon(cached.graphics, ship, armorMax);

	cached.lastState = {
		x: ship.position.x,
		y: ship.position.y,
		heading: ship.heading,
		armor: ship.armor ? Array.from(ship.armor) : [],
	};
}

function drawArmorHexagon(graphics: Graphics, ship: ShipRuntime & { id: string }, armorMax: number): void {
	graphics.clear();

	const radius = ARMOR_HEX_RADIUS;
	const armor = ship.armor || [];

	const vertices: { x: number; y: number }[] = HEX_VERTEX_ANGLES.map((angleDeg) => {
		const rad = (angleDeg - 90) * Math.PI / 180;
		return {
			x: radius * Math.cos(rad),
			y: radius * Math.sin(rad),
		};
	});

	for (let quadrantIndex = 0; quadrantIndex < 6; quadrantIndex++) {
		const armorValue = armor[quadrantIndex] ?? 0;
		const percent = armorValue / armorMax;

		if (armorValue <= 0 || percent <= 0) continue;

		const edge = QUADRANT_TO_EDGE[quadrantIndex];
		const fromVertex = vertices[edge.from];
		const toVertex = vertices[edge.to];

		const color = getArmorColor(percent);
		const lineWidth = 2 + percent * 2;
		const alpha = 0.7 + percent * 0.3;

		graphics
			.moveTo(fromVertex.x, fromVertex.y)
			.lineTo(toVertex.x, toVertex.y)
			.stroke({ color, width: lineWidth, alpha });
	}

	graphics.circle(0, 0, 3).fill({ color: 0xffffff, alpha: 0.3 });
}