/**
 * WeaponArcRenderer - 武器射界与瞄准线渲染
 *
 * 职责：
 * 1. 渲染武器射界弧线（基于 mount.arc 和 mount.facing）
 * 2. 渲染射程范围圆（最大/最小射程）
 * 3. 渲染目标瞄准线（挂载点到有效目标）
 *
 * 渲染层：world.weaponArcs (zIndex 9)
 *
 * 数据来源：
 * - gameStateRef.room.send("game:query", { type: "targets", tokenId })
 * - uiStore.selectedShipId, showWeaponArcs
 *
 * 显示条件：
 * - 选中舰船 + showWeaponArcs=true + room已连接
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipViewModel } from "../types";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef, useCallback } from "react";
import { useUIStore, gameStateRef } from "@/state/stores/uiStore";

interface WeaponTargetInfo {
	targetId: string;
	targetName: string;
	distance: number;
	inRange: boolean;
	inArc: boolean;
	hitAngle: number;
	targetQuadrant: number;
}

interface WeaponTargetingResult {
	mountId: string;
	weaponName: string;
	range: number;
	minRange: number;
	arc: number;
	mountFacing: number;
	isAvailable: boolean;
	uiStatus: string;
	validTargets: WeaponTargetInfo[];
}

interface ShipTargetingResult {
	shipId: string;
	canAttack: boolean;
	weapons: WeaponTargetingResult[];
}

interface WeaponArcCache {
	root: Container;
	arcGraphics: Graphics;
	rangeGraphics: Graphics;
	aimLines: Graphics;
	lastData?: {
		mountId: string;
		range: number;
		minRange: number;
		arc: number;
		mountFacing: number;
		targetCount: number;
	};
}

const ARC_COLOR = 0x4fc3ff;
const RANGE_COLOR = 0x3a8fdd;
const AIM_LINE_COLOR = 0xff6b35;
const VALID_TARGET_COLOR = 0x57e38d;
const INVALID_TARGET_COLOR = 0xff5d7e;

export function useWeaponArcRendering(
	layers: LayerRegistry | null,
	ships: ShipViewModel[],
	selectedShipId: string | null,
	options: { show?: boolean } = {}
) {
	const cacheRef = useRef<Map<string, WeaponArcCache>>(new Map());
	const targetingDataRef = useRef<ShipTargetingResult | null>(null);
	const pendingQueryRef = useRef(false);

	const showWeaponArcs = useUIStore((state) => state.showWeaponArcs);
	const show = options.show ?? showWeaponArcs;

	const selectedShip = ships.find((s) => s.id === selectedShipId) ?? null;

	const fetchTargets = useCallback(async (shipId: string) => {
		const room = gameStateRef.room;
		if (!room || !room.send || pendingQueryRef.current) return;

		pendingQueryRef.current = true;
		try {
			const result = await room.send("game:query", {
				type: "targets",
				tokenId: shipId,
			});
			targetingDataRef.current = result.result as ShipTargetingResult;
		} catch (error) {
			console.warn("WeaponArcRenderer: Failed to fetch targets:", error);
			targetingDataRef.current = null;
		} finally {
			pendingQueryRef.current = false;
		}
	}, []);

	useEffect(() => {
		if (!selectedShipId || !show) {
			targetingDataRef.current = null;
			return;
		}

		fetchTargets(selectedShipId);

		const intervalId = setInterval(() => {
			if (!pendingQueryRef.current) {
				fetchTargets(selectedShipId);
			}
		}, 2000);

		return () => {
			clearInterval(intervalId);
			targetingDataRef.current = null;
		};
	}, [selectedShipId, show, fetchTargets]);

	useEffect(() => {
		if (!layers || !selectedShip || !show || !targetingDataRef.current) {
			for (const [, cache] of cacheRef.current) {
				if (cache.root.parent) {
					cache.root.visible = false;
				}
			}
			return;
		}

		const cache = cacheRef.current;
		const shipPosition = selectedShip.runtime?.position;
		const shipHeading = selectedShip.runtime?.heading ?? 0;

		if (!shipPosition) return;

		const mounts = selectedShip.spec.mounts ?? [];
		const currentMountIds = new Set(mounts.map((m) => m.id));

		for (const [mountId, item] of cache) {
			if (!currentMountIds.has(mountId)) {
				layers.weaponArcs.removeChild(item.root);
				cache.delete(mountId);
			}
		}

		for (const weapon of targetingDataRef.current.weapons) {
			const mount = mounts.find((m) => m.id === weapon.mountId);
			if (!mount) continue;

			const mountPos = mount.position ?? { x: 0, y: 0 };
			const mountFacing = (shipHeading + (mount.facing ?? 0)) * Math.PI / 180;

			const offsetX = mountPos.x;
			const offsetY = mountPos.y;
			const worldX = shipPosition.x + offsetX * Math.cos(shipHeading * Math.PI / 180) - offsetY * Math.sin(shipHeading * Math.PI / 180);
			const worldY = shipPosition.y + offsetX * Math.sin(shipHeading * Math.PI / 180) + offsetY * Math.cos(shipHeading * Math.PI / 180);

			const cached = cache.get(weapon.mountId);
			if (!cached) {
				createWeaponArc(layers, cache, weapon, worldX, worldY, mountFacing, ships);
				continue;
			}

			if (shouldUpdate(cached, weapon)) {
				updateWeaponArc(cached, weapon, worldX, worldY, mountFacing, ships);
			}

			cached.root.visible = weapon.isAvailable;
		}

		layers.weaponArcs.visible = show;
	}, [layers, selectedShip, ships, show]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdate(cached: WeaponArcCache, weapon: WeaponTargetingResult): boolean {
	if (!cached.lastData) return true;

	const last = cached.lastData;
	return (
		weapon.range !== last.range ||
		weapon.minRange !== last.minRange ||
		weapon.arc !== last.arc ||
		weapon.mountFacing !== last.mountFacing ||
		weapon.validTargets.length !== last.targetCount
	);
}

function createWeaponArc(
	layers: LayerRegistry,
	cache: Map<string, WeaponArcCache>,
	weapon: WeaponTargetingResult,
	worldX: number,
	worldY: number,
	mountFacing: number,
	ships: ShipViewModel[]
): void {
	const root = new Container();
	root.position.set(worldX, worldY);
	root.rotation = mountFacing;

	const arcGraphics = new Graphics();
	root.addChild(arcGraphics);

	const rangeGraphics = new Graphics();
	root.addChild(rangeGraphics);

	const aimLines = new Graphics();
	root.addChild(aimLines);

	drawWeaponArc(arcGraphics, weapon.arc, weapon.range);
	drawRangeCircles(rangeGraphics, weapon.range, weapon.minRange);
	drawAimLines(aimLines, weapon, ships, worldX, worldY, mountFacing);

	layers.weaponArcs.addChild(root);

	cache.set(weapon.mountId, {
		root,
		arcGraphics,
		rangeGraphics,
		aimLines,
		lastData: {
			mountId: weapon.mountId,
			range: weapon.range,
			minRange: weapon.minRange,
			arc: weapon.arc,
			mountFacing: weapon.mountFacing,
			targetCount: weapon.validTargets.length,
		},
	});

	root.visible = weapon.isAvailable;
}

function updateWeaponArc(
	cached: WeaponArcCache,
	weapon: WeaponTargetingResult,
	worldX: number,
	worldY: number,
	mountFacing: number,
	ships: ShipViewModel[]
): void {
	cached.root.position.set(worldX, worldY);
	cached.root.rotation = mountFacing;

	drawWeaponArc(cached.arcGraphics, weapon.arc, weapon.range);
	drawRangeCircles(cached.rangeGraphics, weapon.range, weapon.minRange);
	drawAimLines(cached.aimLines, weapon, ships, worldX, worldY, mountFacing);

	cached.lastData = {
		mountId: weapon.mountId,
		range: weapon.range,
		minRange: weapon.minRange,
		arc: weapon.arc,
		mountFacing: weapon.mountFacing,
		targetCount: weapon.validTargets.length,
	};

	cached.root.visible = weapon.isAvailable;
}

function drawWeaponArc(graphics: Graphics, arc: number, range: number): void {
	graphics.clear();

	if (arc >= 360) {
		graphics.circle(0, 0, range);
		graphics.stroke({ color: ARC_COLOR, width: 2, alpha: 0.5 });
		return;
	}

	const arcRad = (arc * Math.PI) / 180;
	const startAngle = -arcRad / 2;
	const endAngle = arcRad / 2;

	graphics.arc(0, 0, range, startAngle, endAngle);
	graphics.stroke({ color: ARC_COLOR, width: 2, alpha: 0.6 });

	graphics.moveTo(0, 0);
	graphics.lineTo(Math.cos(startAngle) * range, Math.sin(startAngle) * range);
	graphics.stroke({ color: ARC_COLOR, width: 1.5, alpha: 0.4 });

	graphics.moveTo(0, 0);
	graphics.lineTo(Math.cos(endAngle) * range, Math.sin(endAngle) * range);
	graphics.stroke({ color: ARC_COLOR, width: 1.5, alpha: 0.4 });
}

function drawRangeCircles(graphics: Graphics, maxRange: number, minRange: number): void {
	graphics.clear();

	graphics.circle(0, 0, maxRange);
	graphics.stroke({ color: RANGE_COLOR, width: 1, alpha: 0.3 });

	if (minRange > 0) {
		graphics.circle(0, 0, minRange);
		graphics.stroke({ color: 0xff5d7e, width: 1, alpha: 0.25 });
	}
}

function drawAimLines(
	graphics: Graphics,
	weapon: WeaponTargetingResult,
	ships: ShipViewModel[],
	mountWorldX: number,
	mountWorldY: number,
	mountFacing: number
): void {
	graphics.clear();

	if (weapon.validTargets.length === 0) return;

	for (const target of weapon.validTargets) {
		const targetShip = ships.find((s) => s.id === target.targetId);
		if (!targetShip?.runtime?.position) continue;

		const targetPos = targetShip.runtime.position;

		const dx = targetPos.x - mountWorldX;
		const dy = targetPos.y - mountWorldY;
		const distance = Math.sqrt(dx * dx + dy * dy);

		const angleToTarget = Math.atan2(dy, dx);
		const relativeAngle = angleToTarget - mountFacing;

		const lineEndX = Math.cos(relativeAngle) * distance;
		const lineEndY = Math.sin(relativeAngle) * distance;

		const color = target.inRange && target.inArc ? VALID_TARGET_COLOR : INVALID_TARGET_COLOR;
		const alpha = target.inRange && target.inArc ? 0.7 : 0.3;

		graphics.moveTo(0, 0);
		graphics.lineTo(lineEndX, lineEndY);
		graphics.stroke({ color, width: 1.5, alpha });

		if (target.inRange && target.inArc) {
			graphics.circle(lineEndX, lineEndY, 4);
			graphics.fill({ color: AIM_LINE_COLOR, alpha: 0.8 });
		}
	}
}

export default useWeaponArcRendering;