/**
 * 护盾辉光弧线渲染 Hook
 *
 * 职责：
 * 1. 渲染舰船护盾弧线可视化
 * 2. 显示护盾覆盖范围（arc 角度）
 * 3. 支持滑动条预览方向
 *
 * 渲染层：world.shieldArcs (zIndex 12)
 *
 * 护盾样式：
 * - 简洁弧线 + 辉光特效（内外两层辉光）
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
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

const SHIELD_ARC_RADIUS_OFFSET = 15;
const SHIELD_ARC_WIDTH = 2;
const SHIELD_GLOW_OUTER_WIDTH = 12;
const SHIELD_GLOW_INNER_WIDTH = 5;
const DEFAULT_SHIELD_RADIUS = 40;
const DEFAULT_SHIELD_ARC = 120;

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
		// 360度全向护盾：外层辉光
		graphics.circle(0, 0, radius + SHIELD_GLOW_OUTER_WIDTH);
		graphics.stroke({ color, width: SHIELD_GLOW_OUTER_WIDTH, alpha: alpha * 0.15 });

		// 内层辉光
		graphics.circle(0, 0, radius + SHIELD_GLOW_INNER_WIDTH);
		graphics.stroke({ color, width: SHIELD_GLOW_INNER_WIDTH, alpha: alpha * 0.4 });

		// 主弧线
		graphics.circle(0, 0, radius);
		graphics.stroke({ color, width: SHIELD_ARC_WIDTH, alpha });
		return;
	}

	// 外层辉光（大范围低透明度）
	graphics.moveTo(
		(radius + SHIELD_GLOW_OUTER_WIDTH) * Math.cos(startAngle),
		(radius + SHIELD_GLOW_OUTER_WIDTH) * Math.sin(startAngle)
	);
	graphics.arc(0, 0, radius + SHIELD_GLOW_OUTER_WIDTH, startAngle, endAngle);
	graphics.stroke({ color, width: SHIELD_GLOW_OUTER_WIDTH, alpha: alpha * 0.12 });

	// 内层辉光（小范围中透明度）
	graphics.moveTo(
		(radius + SHIELD_GLOW_INNER_WIDTH) * Math.cos(startAngle),
		(radius + SHIELD_GLOW_INNER_WIDTH) * Math.sin(startAngle)
	);
	graphics.arc(0, 0, radius + SHIELD_GLOW_INNER_WIDTH, startAngle, endAngle);
	graphics.stroke({ color, width: SHIELD_GLOW_INNER_WIDTH, alpha: alpha * 0.35 });

	// 主弧线（清晰轮廓）
	graphics.moveTo(radius * Math.cos(startAngle), radius * Math.sin(startAngle));
	graphics.arc(0, 0, radius, startAngle, endAngle);
	graphics.stroke({ color, width: SHIELD_ARC_WIDTH, alpha });
}

export interface ShieldArcCacheItem {
	root: Container;
	graphics: Graphics;
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
	shieldMax?: number;
}

export function useShieldArcRendering(
	layers: LayerRegistry | null,
	ships: CombatToken[],
	options: ShieldArcOptions = {}
) {
	const cacheRef = useRef<Map<string, ShieldArcCacheItem>>(new Map());
	const showShieldArc = useUIStore((state) => state.showShieldArc);
	const shieldDirectionPreview = useUIStore((state) => state.shieldDirectionPreview);
	const show = options.show ?? showShieldArc;
	const defaultRadius = options.shieldRadius ?? DEFAULT_SHIELD_RADIUS;
	const defaultArc = options.shieldArc ?? DEFAULT_SHIELD_ARC;
	const defaultMax = options.shieldMax ?? 100;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.$id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.shieldArcs.removeChild(item.root);
				item.graphics.destroy();
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
				createShieldArc(layers, cache, ship, defaultRadius, defaultArc, defaultMax, shieldDirectionPreview);
				continue;
			}

			if (shouldUpdateShield(cached, ship, defaultRadius, defaultMax)) {
				updateShieldArc(cached, ship, defaultRadius, defaultArc, defaultMax, shieldDirectionPreview);
			}
		}

		layers.shieldArcs.visible = show;
	}, [layers, ships, show, defaultRadius, defaultArc, defaultMax, shieldDirectionPreview]);

	useEffect(() => {
		return () => {
			for (const item of cacheRef.current.values()) {
				layers?.shieldArcs.removeChild(item.root);
				item.graphics.destroy();
				item.root.destroy();
			}
			cacheRef.current.clear();
		};
	}, [layers]);
}

function shouldUpdateShield(
	cached: ShieldArcCacheItem,
	ship: CombatToken,
	_defaultRadius: number,
	_defaultMax: number
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
	defaultMax: number,
	previewDirections: Record<string, number | undefined>
): void {
	if (!ship.runtime?.position) return;

	const root = new Container();
	root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	root.rotation = (ship.runtime.heading * Math.PI) / 180;

	const graphics = new Graphics();
	drawShieldArcForShip(graphics, ship, defaultRadius, defaultArc, defaultMax, previewDirections);
	root.addChild(graphics);

	layers.shieldArcs.addChild(root);

	cache.set(ship.$id, {
		root,
		graphics,
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
	defaultMax: number,
	previewDirections: Record<string, number | undefined>
): void {
	if (!ship.runtime?.position) return;

	cached.root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	cached.root.rotation = (ship.runtime.heading * Math.PI) / 180;

	drawShieldArcForShip(cached.graphics, ship, defaultRadius, defaultArc, defaultMax, previewDirections);

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
	defaultMax: number,
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
