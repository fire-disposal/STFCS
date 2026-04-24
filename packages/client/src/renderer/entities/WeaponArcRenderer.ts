import type { LayerRegistry } from "../core/useLayerSystem";
import type { CombatToken } from "@vt/data";
import { getMountWorldPosition, nauticalToMath, toRadians, distanceBetween, angleBetween, normalizeAngleSigned } from "@vt/data";
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
		worldX: number;
		worldY: number;
		range: number;
		minRange: number;
		arc: number;
		mountFacing: number;
	};
}

interface AimLineCache {
	graphics: Graphics;
	arrow: Graphics;
	shipId: string;
	mountId: string;
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
				layers.weaponArcs.removeChild(cache.arrow);
				cache.graphics.destroy();
				cache.arrow.destroy();
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
				layers.weaponArcs.removeChild(cache.arrow);
				cache.graphics.destroy();
				cache.arrow.destroy();
				aimLineCacheRef.current.delete(key);
			}
		}

		for (const mount of mounts) {
			const weapon = mount.weapon;
			if (!weapon) continue;

			const mountPos = mount.position ?? { x: 0, y: 0 };
			const mountFacingNautical = shipHeading + (mount.facing ?? 0);
			const mountFacing = toRadians(nauticalToMath(mountFacingNautical));

			const worldPos = getMountWorldPosition(shipPosition, shipHeading, mountPos);
			const worldX = worldPos.x;
			const worldY = worldPos.y;

			const range = weapon.spec.range;
			const minRange = weapon.spec.minRange ?? 0;
			const arc = mount.arc ?? 360;

			const cached = arcCacheRef.current.get(mount.id);
			if (!cached) {
				createWeaponArc(layers, arcCacheRef.current, mount.id, worldX, worldY, mountFacing, range, minRange, arc);
			} else if (shouldUpdateArc(cached, worldX, worldY, range, minRange, arc, mountFacing)) {
				updateWeaponArc(cached, worldX, worldY, mountFacing, range, minRange, arc);
			}

			const finalCached = arcCacheRef.current.get(mount.id);
			if (finalCached) finalCached.root.visible = true;

			const validTargets = calculateValidTargets(selectedShip, mount, ships);
			if (validTargets.length > 0) {
				const cacheKey = `${selectedShip.$id}:${mount.id}`;
				let aimCached = aimLineCacheRef.current.get(cacheKey);
				if (!aimCached) {
					const graphics = new Graphics();
					const arrow = new Graphics();
					layers.weaponArcs.addChild(graphics);
					layers.weaponArcs.addChild(arrow);
					aimCached = { graphics, arrow, shipId: selectedShip.$id, mountId: mount.id };
					aimLineCacheRef.current.set(cacheKey, aimCached);
				}
				drawAimLinesWorld(aimCached.graphics, aimCached.arrow, worldX, worldY, validTargets, ships);
			} else {
				const cacheKey = `${selectedShip.$id}:${mount.id}`;
				const aimCached = aimLineCacheRef.current.get(cacheKey);
				if (aimCached) {
					aimCached.graphics.clear();
					aimCached.arrow.clear();
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

	const mountOffset = mount.position ?? { x: 0, y: 0 };
	const mountWorldPos = getMountWorldPosition(attackerPos, attackerHeading, mountOffset);

	const results: WeaponTargetInfo[] = [];

	for (const target of allShips) {
		if (target.$id === attacker.$id) continue;
		if (target.runtime?.destroyed) continue;
		if (!target.runtime?.position) continue;

		const targetPos = target.runtime.position;
		const dist = distanceBetween(mountWorldPos, targetPos);

		const inRange = dist >= minRange && dist <= range;

		let inArc = true;
		if (arc < 360) {
			const targetAngle = angleBetween(mountWorldPos, targetPos);
			const weaponFacing = attackerHeading + mountFacing;
			const relativeAngle = normalizeAngleSigned(targetAngle - weaponFacing);
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

function shouldUpdateArc(
	cached: WeaponArcCache,
	worldX: number,
	worldY: number,
	range: number,
	minRange: number,
	arc: number,
	mountFacing: number
): boolean {
	if (!cached.lastData) return true;
	return (
		worldX !== cached.lastData.worldX ||
		worldY !== cached.lastData.worldY ||
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
		lastData: { worldX, worldY, range, minRange, arc, mountFacing },
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

	cached.lastData = { worldX, worldY, range, minRange, arc, mountFacing };
}

function drawWeaponArc(graphics: Graphics, arc: number, range: number, minRange: number = 0): void {
	graphics.clear();

	const arcRad = (arc * Math.PI) / 180;
	const startAngle = -arcRad / 2;
	const endAngle = arcRad / 2;

	if (arc >= 360) {
		// 360度 = 圆形射程，只画外圈，内圈自然透明
		graphics.circle(0, 0, range);
		graphics.fill({ color: ARC_COLOR, alpha: 0.15 });
		return;
	}

	const startX = Math.cos(startAngle);
	const startY = Math.sin(startAngle);
	const endX = Math.cos(endAngle);
	const endY = Math.sin(endAngle);

	// 绘制扇形填充（从 minRange 到 range）
	if (minRange > 0) {
		// 有最小射程：绘制环形扇形
		graphics.moveTo(startX * minRange, startY * minRange);
		graphics.arc(0, 0, minRange, startAngle, endAngle);
		graphics.lineTo(endX * range, endY * range);
		graphics.arc(0, 0, range, endAngle, startAngle, true);
		graphics.closePath();
	} else {
		// 无最小射程：绘制完整扇形
		graphics.moveTo(0, 0);
		graphics.lineTo(startX * range, startY * range);
		graphics.arc(0, 0, range, startAngle, endAngle);
		graphics.closePath();
	}
	graphics.fill({ color: ARC_COLOR, alpha: 0.12 });

	// 左射界线
	graphics.moveTo(minRange > 0 ? startX * minRange : 0, minRange > 0 ? startY * minRange : 0);
	graphics.lineTo(startX * range, startY * range);
	graphics.stroke({ color: ARC_COLOR, width: 2, alpha: 0.7 });

	// 右射界线
	graphics.moveTo(minRange > 0 ? endX * minRange : 0, minRange > 0 ? endY * minRange : 0);
	graphics.lineTo(endX * range, endY * range);
	graphics.stroke({ color: ARC_COLOR, width: 2, alpha: 0.7 });
}

function drawAimLinesWorld(
	graphics: Graphics,
	arrowGraphics: Graphics,
	mountWorldX: number,
	mountWorldY: number,
	validTargets: WeaponTargetInfo[],
	ships: CombatToken[]
): void {
	graphics.clear();
	arrowGraphics.clear();

	if (validTargets.length === 0) return;

	for (const target of validTargets) {
		const targetShip = ships.find((s) => s.$id === target.targetId);
		if (!targetShip?.runtime?.position) continue;

		const targetPos = targetShip.runtime.position;

		const dx = targetPos.x - mountWorldX;
		const dy = targetPos.y - mountWorldY;
		const midX = mountWorldX + dx * 0.5;
		const midY = mountWorldY + dy * 0.5;
		const angle = Math.atan2(dy, dx);

		graphics.moveTo(mountWorldX, mountWorldY);
		graphics.lineTo(targetPos.x, targetPos.y);
		graphics.stroke({ color: AIM_LINE_COLOR, width: 2, alpha: 0.8 });

		const arrowSize = 8;
		arrowGraphics.moveTo(midX, midY);
		arrowGraphics.lineTo(
			midX - arrowSize * Math.cos(angle - Math.PI / 6),
			midY - arrowSize * Math.sin(angle - Math.PI / 6)
		);
		arrowGraphics.moveTo(midX, midY);
		arrowGraphics.lineTo(
			midX - arrowSize * Math.cos(angle + Math.PI / 6),
			midY - arrowSize * Math.sin(angle + Math.PI / 6)
		);
		arrowGraphics.stroke({ color: AIM_LINE_COLOR, width: 2, alpha: 0.9 });
	}
}