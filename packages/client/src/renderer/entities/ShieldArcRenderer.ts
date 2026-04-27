/**
 * 护盾辉光弧线渲染 Hook
 *
 * 职责：
 * 1. 渲染舰船护盾弧线可视化
 * 2. 显示护盾覆盖范围（arc 角度）
 * 3. 支持滑动条预览方向
 *
 * 渲染层：world.shieldArcs (zIndex 10)
 *
 * 护盾样式：
 * - 简洁弧线 + GlowFilter 发光特效
 * - 颜色：根据 faction 区分（玩家蓝色，敌人粉色）
 *
 * 坐标系说明：
 * - Container 已按 ship.runtime.heading 旋转（PixiJS rotation）
 * - drawShieldArc 只使用 shield.direction（相对船头的方向）
 * - 通过 nauticalToPixiSectorRotation 转换为 PixiJS 弧线角度
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { CombatToken } from "@vt/data";
import { FactionColors, nauticalToPixiSectorRotation } from "@vt/data";
import { Container, Graphics } from "pixi.js";
import { GlowFilter } from "pixi-filters";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

const SHIELD_ARC_RADIUS_OFFSET = 15;
const SHIELD_ARC_WIDTH = 2;
const DEFAULT_SHIELD_RADIUS = 40;
const DEFAULT_SHIELD_ARC = 120;

const GLOW_FILTER_CONFIG = {
	distance: 15,
	outerStrength: 2,
	innerStrength: 0.5,
	quality: 0.5,
};

function getShieldColor(faction?: string): number {
	return FactionColors[faction as keyof typeof FactionColors] ?? 0x4fc3ff;
}

function getShieldAlpha(): number {
	return 0.7;
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

	const screenOrientation = nauticalToPixiSectorRotation(orientation);
	const arcRad = (arc * Math.PI) / 180;
	const startAngle = screenOrientation - arcRad / 2;
	const endAngle = screenOrientation + arcRad / 2;

	if (arc >= 360) {
		// 360度全向护盾：完整圆
		graphics.circle(0, 0, radius);
		graphics.stroke({ color, width: SHIELD_ARC_WIDTH, alpha });
		return;
	}

	// 弧线绘制
	graphics.moveTo(radius * Math.cos(startAngle), radius * Math.sin(startAngle));
	graphics.arc(0, 0, radius, startAngle, endAngle);
	graphics.stroke({ color, width: SHIELD_ARC_WIDTH, alpha });
}

export interface ShieldArcCacheItem {
	root: Container;
	graphics: Graphics;
	glowFilter: GlowFilter;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		shieldActive: boolean;
		shieldDirection: number;
		isOverloaded: boolean;
	};
}

export interface ShieldArcOptions {
	show?: boolean;
	shieldRadius?: number;
	shieldArc?: number;
}

export function useShieldArcRendering(
	layers: LayerRegistry | null,
	ships: CombatToken[],
	options: ShieldArcOptions = {}
) {
	const cacheRef = useRef<Map<string, ShieldArcCacheItem>>(new Map());
	const showShieldArc = useUIStore((state) => state.toggles.shieldArc);
	const shieldDirectionPreview = useUIStore((state) => state.shieldDirectionPreview);
	const show = options.show ?? showShieldArc;
	const defaultRadius = options.shieldRadius ?? DEFAULT_SHIELD_RADIUS;
	const defaultArc = options.shieldArc ?? DEFAULT_SHIELD_ARC;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.$id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.shieldArcs.removeChild(item.root);
				item.graphics.destroy();
				item.glowFilter.destroy();
				item.root.destroy();
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			if (ship.runtime?.overloaded || !ship.runtime?.shield?.active) {
				const cached = cache.get(ship.$id);
				if (cached) {
					cached.graphics.clear();
				}
				continue;
			}

			const cached = cache.get(ship.$id);
			if (!cached) {
				createShieldArc(layers, cache, ship, defaultRadius, defaultArc, shieldDirectionPreview);
				continue;
			}

			if (shouldUpdateShield(cached, ship, defaultRadius)) {
				updateShieldArc(cached, ship, defaultRadius, defaultArc, shieldDirectionPreview);
			}
		}

		layers.shieldArcs.visible = show;
	}, [layers, ships, show, defaultRadius, defaultArc, shieldDirectionPreview]);

	useEffect(() => {
		return () => {
			for (const item of cacheRef.current.values()) {
				layers?.shieldArcs.removeChild(item.root);
				item.graphics.destroy();
				item.glowFilter.destroy();
				item.root.destroy();
			}
			cacheRef.current.clear();
		};
	}, [layers]);
}

function shouldUpdateShield(
	cached: ShieldArcCacheItem,
	ship: CombatToken,
	_defaultRadius: number
): boolean {
	if (!cached.lastState || !ship.runtime?.position) return true;

	const last = cached.lastState;
	const dx = Math.abs(ship.runtime.position.x - last.x);
	const dy = Math.abs(ship.runtime.position.y - last.y);
	const dHeading = Math.abs(ship.runtime.heading - last.heading);

	const shieldDirection = ship.runtime.shield?.direction ?? 0;
	const shieldChanged =
		(ship.runtime.shield?.active ?? false) !== last.shieldActive ||
		shieldDirection !== (last.shieldDirection ?? 0) ||
		(ship.runtime.overloaded ?? false) !== last.isOverloaded;

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || shieldChanged;
}

function createShieldArc(
	layers: LayerRegistry,
	cache: Map<string, ShieldArcCacheItem>,
	ship: CombatToken,
	defaultRadius: number,
	defaultArc: number,
	previewDirections: Record<string, number | undefined>
): void {
	if (!ship.runtime?.position) return;

	const color = getShieldColor(ship.runtime.faction);
	const root = new Container();
	root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	root.rotation = (ship.runtime.heading * Math.PI) / 180;

	const graphics = new Graphics();
	const glowFilter = new GlowFilter({
		distance: GLOW_FILTER_CONFIG.distance,
		outerStrength: GLOW_FILTER_CONFIG.outerStrength,
		innerStrength: GLOW_FILTER_CONFIG.innerStrength,
		color,
		quality: GLOW_FILTER_CONFIG.quality,
	});
	graphics.filters = [glowFilter];

	drawShieldArcForShip(graphics, ship, defaultRadius, defaultArc, previewDirections);
	root.addChild(graphics);

	layers.shieldArcs.addChild(root);

	cache.set(ship.$id, {
		root,
		graphics,
		glowFilter,
		lastState: {
			x: ship.runtime.position.x,
			y: ship.runtime.position.y,
			heading: ship.runtime.heading,
			shieldActive: ship.runtime.shield?.active ?? false,
			shieldDirection: ship.runtime.shield?.direction ?? 0,
			isOverloaded: ship.runtime.overloaded ?? false,
		},
	});
}

function updateShieldArc(
	cached: ShieldArcCacheItem,
	ship: CombatToken,
	defaultRadius: number,
	defaultArc: number,
	previewDirections: Record<string, number | undefined>
): void {
	if (!ship.runtime?.position) return;

	cached.root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	cached.root.rotation = (ship.runtime.heading * Math.PI) / 180;

	// 更新发光滤镜颜色（派系可能变化）
	const color = getShieldColor(ship.runtime.faction);
	if (cached.glowFilter.color !== color) {
		cached.glowFilter.color = color;
	}

	drawShieldArcForShip(cached.graphics, ship, defaultRadius, defaultArc, previewDirections);

	cached.lastState = {
		x: ship.runtime.position.x,
		y: ship.runtime.position.y,
		heading: ship.runtime.heading,
		shieldActive: ship.runtime.shield?.active ?? false,
		shieldDirection: ship.runtime.shield?.direction ?? 0,
		isOverloaded: ship.runtime.overloaded ?? false,
	};
}

function drawShieldArcForShip(
	graphics: Graphics,
	ship: CombatToken,
	defaultRadius: number,
	defaultArc: number,
	previewDirections: Record<string, number | undefined>
): void {
	if (!ship.runtime?.shield?.active || ship.runtime.overloaded) {
		graphics.clear();
		return;
	}

	const radius = ship.spec.shield?.radius ?? defaultRadius;
	const arc = ship.spec.shield?.arc ?? defaultArc;

	// 护盾朝向 = 仅护盾方向（航海坐标系：0°=船头向上）
	// Container 已按 ship.runtime.heading 旋转，因此这里不需要再加 heading
	const previewDir = previewDirections[ship.$id];
	const shieldDirection = previewDir ?? ship.runtime.shield?.direction ?? 0;
	const orientation = shieldDirection;

	const color = getShieldColor(ship.runtime.faction);
	const alpha = getShieldAlpha();

	drawShieldArc(graphics, radius + SHIELD_ARC_RADIUS_OFFSET, arc, orientation, color, alpha);
}
