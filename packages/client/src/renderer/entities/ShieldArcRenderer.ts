/**
 * 护盾辉光弧线渲染 Hook
 *
 * 职责：
 * 1. 渲染舰船护盾弧线可视化
 * 2. 显示护盾覆盖范围（arc 角度）
 * 3. 根据护盾值调整透明度
 *
 * 渲染层：world.shieldArcs (zIndex 12)
 *
 * 护盾样式：
 * - 弧线：表示护盾覆盖范围
 * - 辉光：多层叠加效果
 * - 颜色：根据 faction 区分（玩家蓝色，敌人粉色）
 *
 * 护盾状态：
 * - active: 显示辉光弧线
 * - inactive: 隐藏护盾可视化
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipRuntime } from "@vt/data";
import { Faction } from "@vt/data";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

const SHIELD_ARC_RADIUS_OFFSET = 15;
const SHIELD_ARC_WIDTH = 3;
const SHIELD_GLOW_LAYERS = 3;
const DEFAULT_SHIELD_RADIUS = 40;
const DEFAULT_SHIELD_ARC = 120;

const FACTION_SHIELD_COLORS: Record<string, number> = {
	[Faction.PLAYER]: 0x4fc3ff,
	[Faction.NEUTRAL]: 0xff7f9f,
};

function getShieldColor(faction?: string): number {
	return FACTION_SHIELD_COLORS[faction ?? Faction.PLAYER] ?? 0x4fc3ff;
}

function getShieldAlpha(shieldValue: number, shieldMax?: number): number {
	const max = shieldMax ?? 100;
	const ratio = shieldValue / max;
	return 0.4 + ratio * 0.5;
}

function drawShieldArc(
	graphics: Graphics,
	radius: number,
	arc: number,
	orientation: number,
	color: number,
	alpha: number
): void {
	graphics.clear();

	const screenOrientation = (orientation - 90) * Math.PI / 180;
	const arcRad = (arc * Math.PI) / 180;
	const startAngle = screenOrientation - arcRad / 2;
	const endAngle = screenOrientation + arcRad / 2;

	for (let layer = 0; layer < SHIELD_GLOW_LAYERS; layer++) {
		const layerAlpha = alpha * (1 - layer * 0.25);
		const layerWidth = SHIELD_ARC_WIDTH + layer * 2;
		const layerRadius = radius + layer * 2;

		graphics.arc(0, 0, layerRadius, startAngle, endAngle);
		graphics.stroke({ color, width: layerWidth, alpha: layerAlpha });
	}

	const endpointRadius = 4;
	const endpointAlpha = alpha * 1.2;

	const startX = radius * Math.cos(startAngle);
	const startY = radius * Math.sin(startAngle);
	graphics.circle(startX, startY, endpointRadius);
	graphics.fill({ color, alpha: endpointAlpha });

	const endX = radius * Math.cos(endAngle);
	const endY = radius * Math.sin(endAngle);
	graphics.circle(endX, endY, endpointRadius);
	graphics.fill({ color, alpha: endpointAlpha });
}

export interface ShieldArcCacheItem {
	root: Container;
	graphics: Graphics;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		shieldActive: boolean;
		shieldValue: number;
		isOverloaded: boolean;
	};
}

export interface ShieldArcOptions {
	show?: boolean;
	shieldRadius?: number;
	shieldArc?: number;
	shieldMax?: number;
}

export type ShipForShield = ShipRuntime & {
	id: string;
	shieldRadius?: number;
	shieldArc?: number;
};

export function useShieldArcRendering(
	layers: LayerRegistry | null,
	ships: ShipForShield[],
	options: ShieldArcOptions = {}
) {
	const cacheRef = useRef<Map<string, ShieldArcCacheItem>>(new Map());
	const showWeaponArcs = useUIStore((state) => state.showWeaponArcs);
	const show = options.show ?? showWeaponArcs;
	const defaultRadius = options.shieldRadius ?? DEFAULT_SHIELD_RADIUS;
	const defaultArc = options.shieldArc ?? DEFAULT_SHIELD_ARC;
	const defaultMax = options.shieldMax ?? 100;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.shieldArcs.removeChild(item.root);
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			if (ship.overloaded || !ship.shield?.active) {
				const cached = cache.get(ship.id);
				if (cached) {
					cached.graphics.clear();
				}
				continue;
			}

			const cached = cache.get(ship.id);
			if (!cached) {
				createShieldArc(layers, cache, ship, defaultRadius, defaultArc, defaultMax);
				continue;
			}

			if (shouldUpdateShield(cached, ship, defaultRadius, defaultMax)) {
				updateShieldArc(cached, ship, defaultRadius, defaultArc, defaultMax);
			}
		}

		layers.shieldArcs.visible = show;
	}, [layers, ships, show, defaultRadius, defaultArc, defaultMax]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdateShield(
	cached: ShieldArcCacheItem,
	ship: ShipForShield,
	_defaultRadius: number,
	_defaultMax: number
): boolean {
	if (!cached.lastState || !ship.position) return true;

	const last = cached.lastState;
	const dx = Math.abs(ship.position.x - last.x);
	const dy = Math.abs(ship.position.y - last.y);
	const dHeading = Math.abs(ship.heading - last.heading);

	const shieldValue = ship.shield?.value ?? 0;
	const shieldChanged =
		(ship.shield?.active ?? false) !== last.shieldActive ||
		shieldValue !== last.shieldValue ||
		(ship.overloaded ?? false) !== last.isOverloaded;

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || shieldChanged;
}

function createShieldArc(
	layers: LayerRegistry,
	cache: Map<string, ShieldArcCacheItem>,
	ship: ShipForShield,
	defaultRadius: number,
	defaultArc: number,
	defaultMax: number
): void {
	if (!ship.position) return;

	const root = new Container();
	root.position.set(ship.position.x, ship.position.y);
	root.rotation = (ship.heading * Math.PI) / 180;

	const graphics = new Graphics();
	drawShieldArcForShip(graphics, ship, defaultRadius, defaultArc, defaultMax);
	root.addChild(graphics);

	layers.shieldArcs.addChild(root);

	cache.set(ship.id, {
		root,
		graphics,
		lastState: {
			x: ship.position.x,
			y: ship.position.y,
			heading: ship.heading,
			shieldActive: ship.shield?.active ?? false,
			shieldValue: ship.shield?.value ?? 0,
			isOverloaded: ship.overloaded ?? false,
		},
	});
}

function updateShieldArc(
	cached: ShieldArcCacheItem,
	ship: ShipForShield,
	defaultRadius: number,
	defaultArc: number,
	defaultMax: number
): void {
	if (!ship.position) return;

	cached.root.position.set(ship.position.x, ship.position.y);
	cached.root.rotation = (ship.heading * Math.PI) / 180;

	drawShieldArcForShip(cached.graphics, ship, defaultRadius, defaultArc, defaultMax);

	cached.lastState = {
		x: ship.position.x,
		y: ship.position.y,
		heading: ship.heading,
		shieldActive: ship.shield?.active ?? false,
		shieldValue: ship.shield?.value ?? 0,
		isOverloaded: ship.overloaded ?? false,
	};
}

function drawShieldArcForShip(
	graphics: Graphics,
	ship: ShipForShield,
	defaultRadius: number,
	defaultArc: number,
	defaultMax: number
): void {
	if (!ship.shield?.active || ship.overloaded) {
		graphics.clear();
		return;
	}

	const radius = ship.shieldRadius ?? defaultRadius;
	const arc = ship.shieldArc ?? defaultArc;
	const orientation = ship.heading;
	const color = getShieldColor(ship.faction);
	const alpha = getShieldAlpha(ship.shield.value, defaultMax);

	drawShieldArc(graphics, radius + SHIELD_ARC_RADIUS_OFFSET, arc, orientation, color, alpha);
}