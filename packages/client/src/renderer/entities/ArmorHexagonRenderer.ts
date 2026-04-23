/**
 * 护甲六边形渲染 Hook
 *
 * 职责：
 * 1. 渲染舰船护甲六边形可视化
 * 2. 显示六个护甲扇区状态
 * 3. 根据护甲值变化颜色（简化版）
 *
 * 渲染层：world.hexagonArmor (zIndex 13)
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { CombatToken } from "@vt/data";
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

const ARMOR_COLORS = {
	FULL: 0x57e38d,
	HIGH: 0xffcc66,
	MEDIUM: 0xffa366,
	LOW: 0xff5d7e,
} as const;

function getArmorColor(percent: number): number {
	if (percent >= 0.75) return ARMOR_COLORS.FULL;
	if (percent >= 0.5) return ARMOR_COLORS.HIGH;
	if (percent >= 0.25) return ARMOR_COLORS.MEDIUM;
	return ARMOR_COLORS.LOW;
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
	ships: CombatToken[],
	options: ArmorHexagonOptions = {}
) {
	const cacheRef = useRef<Map<string, ArmorHexagonCacheItem>>(new Map());
	const showHexagonArmor = useUIStore((state) => state.showHexagonArmor);
	const show = options.show ?? showHexagonArmor;
	const armorMax = options.armorMaxPerQuadrant ?? DEFAULT_ARMOR_MAX;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.$id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.hexagonArmor.removeChild(item.root);
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			const cached = cache.get(ship.$id);
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

function shouldUpdateArmor(cached: ArmorHexagonCacheItem, ship: CombatToken): boolean {
	if (!cached.lastState || !ship.runtime?.position) return true;

	const dx = Math.abs(ship.runtime.position.x - cached.lastState.x);
	const dy = Math.abs(ship.runtime.position.y - cached.lastState.y);
	const dHeading = Math.abs(ship.runtime.heading - cached.lastState.heading);

	if (!ship.runtime.armor) return dx > 0.5 || dy > 0.5 || dHeading > 1;

	const armorChanged = ship.runtime.armor.some(
		(v: number, i: number) => v !== cached.lastState!.armor[i]
	);

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || armorChanged;
}

function createArmorHexagon(
	layers: LayerRegistry,
	cache: Map<string, ArmorHexagonCacheItem>,
	ship: CombatToken,
	armorMax: number
): void {
	if (!ship.runtime?.position) return;

	const root = new Container();
	root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	root.rotation = (ship.runtime.heading * Math.PI) / 180;

	const graphics = new Graphics();
	drawArmorHexagon(graphics, ship, armorMax);
	root.addChild(graphics);

	layers.hexagonArmor.addChild(root);

	cache.set(ship.$id, {
		root,
		graphics,
		lastState: {
			x: ship.runtime.position.x,
			y: ship.runtime.position.y,
			heading: ship.runtime.heading,
			armor: ship.runtime.armor ? Array.from(ship.runtime.armor) : [],
		},
	});
}

function updateArmorHexagon(
	cached: ArmorHexagonCacheItem,
	ship: CombatToken,
	armorMax: number
): void {
	if (!ship.runtime?.position) return;

	cached.root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	cached.root.rotation = (ship.runtime.heading * Math.PI) / 180;

	drawArmorHexagon(cached.graphics, ship, armorMax);

	cached.lastState = {
		x: ship.runtime.position.x,
		y: ship.runtime.position.y,
		heading: ship.runtime.heading,
		armor: ship.runtime.armor ? Array.from(ship.runtime.armor) : [],
	};
}

function drawArmorHexagon(graphics: Graphics, ship: CombatToken, armorMax: number): void {
	graphics.clear();

	const radius = ARMOR_HEX_RADIUS;
	const armor = ship.runtime?.armor || [];

	const vertices: { x: number; y: number }[] = HEX_VERTEX_ANGLES.map((angleDeg) => {
		const rad = (angleDeg - 90) * Math.PI / 180;
		return {
			x: radius * Math.cos(rad),
			y: radius * Math.sin(rad),
		};
	});

	for (let quadrantIndex = 0; quadrantIndex < 6; quadrantIndex++) {
		const armorValue = armor[quadrantIndex] ?? 0;
		const percent = Math.max(0, Math.min(1, armorValue / armorMax));

		if (armorValue <= 0) continue;

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