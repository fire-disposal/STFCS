import type { LayerRegistry } from "../core/useLayerSystem";
import type { CombatToken } from "@vt/data";
import { Container, Graphics } from "pixi.js";
import { useEffect, useRef, useCallback } from "react";
import { useUIStore, gameStateRef } from "@/state/stores/uiStore";

interface WeaponTargetInfo {
	targetId: string;
	distance: number;
	inRange: boolean;
	inArc: boolean;
}

interface WeaponTargetingResult {
	mountId: string;
	range: number;
	minRange: number;
	arc: number;
	mountFacing: number;
	isAvailable: boolean;
	validTargets: WeaponTargetInfo[];
}

interface ShipTargetingResult {
	shipId: string;
	weapons: WeaponTargetingResult[];
}

interface WeaponArcCache {
	root: Container;
	arcGraphics: Graphics;
	rangeGraphics: Graphics;
	lastData?: {
		range: number;
		minRange: number;
		arc: number;
		mountFacing: number;
	};
}

interface AimLineCache {
	graphics: Graphics;
	shipId: string;
}

const ARC_COLOR = 0x4fc3ff;
const AIM_LINE_COLOR = 0xff6b35;

export function useWeaponArcRendering(
	layers: LayerRegistry | null,
	ships: CombatToken[],
	selectedShipId: string | null,
	options: { show?: boolean } = {}
) {
	const arcCacheRef = useRef<Map<string, WeaponArcCache>>(new Map());
	const aimLineCacheRef = useRef<Map<string, AimLineCache>>(new Map());
	const targetingDataRef = useRef<ShipTargetingResult | null>(null);
	const pendingQueryRef = useRef(false);

	const showWeaponArcs = useUIStore((state) => state.showWeaponArcs);
	const show = options.show ?? showWeaponArcs;

	const selectedShip = ships.find((s) => s.$id === selectedShipId) ?? null;

	const fetchTargets = useCallback(async (shipId: string) => {
		const room = gameStateRef.room;
		if (!room || !room.send || pendingQueryRef.current) return;

		pendingQueryRef.current = true;
		try {
			const result = await room.send("game:query", { type: "targets", tokenId: shipId });
			targetingDataRef.current = result.result as ShipTargetingResult;
		} catch {
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
	}, [selectedShipId, show, fetchTargets]);

	useEffect(() => {
		if (!layers) return;

		if (!selectedShip || !show) {
			for (const [, cache] of arcCacheRef.current) {
				layers.weaponArcs.removeChild(cache.root);
				cache.root.destroy();
			}
			arcCacheRef.current.clear();

			for (const [, cache] of aimLineCacheRef.current) {
				layers.weaponArcs.removeChild(cache.graphics);
				cache.graphics.destroy();
			}
			aimLineCacheRef.current.clear();

			layers.weaponArcs.visible = false;
			return;
		}

		const shipPosition = selectedShip.runtime?.position;
		const shipHeading = selectedShip.runtime?.heading ?? 0;
		if (!shipPosition) return;

		const mounts = selectedShip.spec.mounts ?? [];
		const currentMountIds = new Set(mounts.map((m) => m.id));

		for (const [mountId, cache] of arcCacheRef.current) {
			if (!currentMountIds.has(mountId)) {
				layers.weaponArcs.removeChild(cache.root);
				cache.root.destroy();
				arcCacheRef.current.delete(mountId);
			}
		}

		for (const [key, cache] of aimLineCacheRef.current) {
			if (cache.shipId !== selectedShip.$id) {
				layers.weaponArcs.removeChild(cache.graphics);
				cache.graphics.destroy();
				aimLineCacheRef.current.delete(key);
			}
		}

		for (const mount of mounts) {
			const weapon = mount.weapon;
			if (!weapon) continue;

			const mountPos = mount.position ?? { x: 0, y: 0 };
			const mountFacingNautical = shipHeading + (mount.facing ?? 0);
			const mountFacing = (mountFacingNautical - 90) * Math.PI / 180;

			const headingRad = shipHeading * Math.PI / 180;
			const worldX = shipPosition.x - (mountPos.x ?? 0) * Math.cos(headingRad) + (mountPos.y ?? 0) * Math.sin(headingRad);
			const worldY = shipPosition.y - (mountPos.x ?? 0) * Math.sin(headingRad) - (mountPos.y ?? 0) * Math.cos(headingRad);

			const range = weapon.spec.range;
			const minRange = weapon.spec.minRange ?? 0;
			const arc = mount.arc ?? 360;

			const cached = arcCacheRef.current.get(mount.id);
			if (!cached) {
				createWeaponArc(layers, arcCacheRef.current, mount.id, worldX, worldY, mountFacing, range, minRange, arc);
			} else if (shouldUpdateArc(cached, range, minRange, arc, mountFacing)) {
				updateWeaponArc(cached, worldX, worldY, mountFacing, range, minRange, arc);
			}

			const finalCached = arcCacheRef.current.get(mount.id);
			if (finalCached) finalCached.root.visible = true;

			const validTargets = calculateValidTargets(selectedShip, mount, ships);
			if (validTargets.length > 0) {
				const cacheKey = `${selectedShip.$id}:${mount.id}`;
				const aimCached = aimLineCacheRef.current.get(cacheKey);
				if (!aimCached) {
					const graphics = new Graphics();
					graphics.position.set(worldX, worldY);
					graphics.rotation = mountFacing;
					layers.weaponArcs.addChild(graphics);
					aimLineCacheRef.current.set(cacheKey, { graphics, shipId: selectedShip.$id });
					drawAimLines(graphics, validTargets, ships);
				} else {
					aimCached.graphics.position.set(worldX, worldY);
					aimCached.graphics.rotation = mountFacing;
					drawAimLines(aimCached.graphics, validTargets, ships);
				}
			}
		}

		layers.weaponArcs.visible = show;
	}, [layers, selectedShip, ships, show]);

	useEffect(() => {
		return () => {
			arcCacheRef.current.clear();
			aimLineCacheRef.current.clear();
		};
	}, []);
}

function calculateValidTargets(
	attacker: CombatToken,
	mount: { id: string; weapon?: any; position?: { x: number; y: number }; facing?: number; arc?: number },
	allShips: CombatToken[]
): WeaponTargetInfo[] {
	const weapon = mount.weapon;
	if (!weapon?.spec) return [];

	const range = weapon.spec.range;
	const minRange = weapon.spec.minRange ?? 0;
	const arc = mount.arc ?? 360;
	const mountFacing = mount.facing ?? 0;

	const attackerPos = attacker.runtime?.position ?? { x: 0, y: 0 };
	const attackerHeading = attacker.runtime?.heading ?? 0;

	const results: WeaponTargetInfo[] = [];

	for (const target of allShips) {
		if (target.$id === attacker.$id) continue;
		if (target.runtime?.destroyed) continue;
		if (!target.runtime?.position) continue;

		const targetPos = target.runtime.position;
		const dist = Math.sqrt(
			Math.pow(targetPos.x - attackerPos.x, 2) +
			Math.pow(targetPos.y - attackerPos.y, 2)
		);

		const inRange = dist >= minRange && dist <= range;

		let inArc = true;
		if (arc < 360) {
			const targetAngle = Math.atan2(targetPos.y - attackerPos.y, targetPos.x - attackerPos.x) * 180 / Math.PI;
			const relativeAngle = normalizeAngle(targetAngle - attackerHeading - mountFacing);
			inArc = Math.abs(relativeAngle) <= arc / 2;
		}

		if (inRange && inArc) {
			results.push({
				targetId: target.$id,
				distance: Math.round(dist * 100) / 100,
				inRange,
				inArc,
			});
		}
	}

	return results;
}

function normalizeAngle(angle: number): number {
	return ((angle + 180) % 360) - 180;
}

function shouldUpdateArc(cached: WeaponArcCache, range: number, minRange: number, arc: number, mountFacing: number): boolean {
	if (!cached.lastData) return true;
	return (
		range !== cached.lastData.range ||
		minRange !== cached.lastData.minRange ||
		arc !== cached.lastData.arc ||
		mountFacing !== cached.lastData.mountFacing
	);
}

function createWeaponArc(
	layers: LayerRegistry,
	cache: Map<string, WeaponArcCache>,
	mountId: string,
	worldX: number,
	worldY: number,
	mountFacing: number,
	range: number,
	minRange: number,
	arc: number
): void {
	const root = new Container();
	root.position.set(worldX, worldY);
	root.rotation = mountFacing;

	const arcGraphics = new Graphics();
	root.addChild(arcGraphics);

	drawWeaponArc(arcGraphics, arc, range, minRange);

	layers.weaponArcs.addChild(root);

	cache.set(mountId, {
		root,
		arcGraphics,
		rangeGraphics: arcGraphics,
		lastData: { range, minRange, arc, mountFacing },
	});
}

function updateWeaponArc(
	cached: WeaponArcCache,
	worldX: number,
	worldY: number,
	mountFacing: number,
	range: number,
	minRange: number,
	arc: number
): void {
	cached.root.position.set(worldX, worldY);
	cached.root.rotation = mountFacing;

	drawWeaponArc(cached.arcGraphics, arc, range, minRange);

	cached.lastData = { range, minRange, arc, mountFacing };
}

function drawWeaponArc(graphics: Graphics, arc: number, range: number, minRange: number = 0): void {
	graphics.clear();

	const arcRad = (arc * Math.PI) / 180;
	const startAngle = -arcRad / 2;
	const endAngle = arcRad / 2;

	if (arc >= 360) {
		if (minRange > 0) {
			graphics.circle(0, 0, range);
			graphics.fill({ color: ARC_COLOR, alpha: 0.15 });
			graphics.circle(0, 0, minRange);
			graphics.fill({ color: 0x081423, alpha: 1 });
			graphics.circle(0, 0, range);
			graphics.stroke({ color: ARC_COLOR, width: 2, alpha: 0.5 });
			graphics.circle(0, 0, minRange);
			graphics.stroke({ color: ARC_COLOR, width: 1, alpha: 0.3 });
		} else {
			graphics.circle(0, 0, range);
			graphics.fill({ color: ARC_COLOR, alpha: 0.15 });
			graphics.stroke({ color: ARC_COLOR, width: 2, alpha: 0.5 });
		}
		return;
	}

	const startX = Math.cos(startAngle);
	const startY = Math.sin(startAngle);
	const endX = Math.cos(endAngle);
	const endY = Math.sin(endAngle);

	graphics.moveTo(startX * minRange, startY * minRange);
	graphics.arc(0, 0, minRange, startAngle, endAngle);
	graphics.lineTo(endX * range, endY * range);
	graphics.arc(0, 0, range, endAngle, startAngle, true);
	graphics.lineTo(startX * minRange, startY * minRange);
	graphics.closePath();
	graphics.fill({ color: ARC_COLOR, alpha: 0.15 });

	graphics.moveTo(0, 0);
	graphics.lineTo(startX * range, startY * range);
	graphics.stroke({ color: ARC_COLOR, width: 1.5, alpha: 0.4 });

	graphics.moveTo(0, 0);
	graphics.lineTo(endX * range, endY * range);
	graphics.stroke({ color: ARC_COLOR, width: 1.5, alpha: 0.4 });

	graphics.arc(0, 0, range, startAngle, endAngle);
	graphics.stroke({ color: ARC_COLOR, width: 2, alpha: 0.6 });

	if (minRange > 0) {
		graphics.arc(0, 0, minRange, startAngle, endAngle);
		graphics.stroke({ color: ARC_COLOR, width: 1, alpha: 0.3 });
	}
}

function drawAimLines(
	graphics: Graphics,
	validTargets: WeaponTargetInfo[],
	ships: CombatToken[]
): void {
	graphics.clear();

	if (validTargets.length === 0) return;

	for (const target of validTargets) {
		const targetShip = ships.find((s) => s.$id === target.targetId);
		if (!targetShip?.runtime?.position) continue;

		const targetPos = targetShip.runtime.position;

		const dx = targetPos.x - graphics.position.x;
		const dy = targetPos.y - graphics.position.y;

		const localDx = dx * Math.cos(-graphics.rotation) - dy * Math.sin(-graphics.rotation);
		const localDy = dx * Math.sin(-graphics.rotation) + dy * Math.cos(-graphics.rotation);

		graphics.moveTo(0, 0);
		graphics.lineTo(localDx, localDy);
		graphics.stroke({ color: AIM_LINE_COLOR, width: 2, alpha: 0.8 });
	}
}