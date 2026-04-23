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
	lastTargets?: WeaponTargetInfo[];
}

const ARC_COLOR = 0x4fc3ff;
const RANGE_COLOR = 0x3a8fdd;

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
		if (!layers || !selectedShip || !show) {
			for (const [, cache] of arcCacheRef.current) {
				cache.root.visible = false;
			}
			if (layers) layers.weaponArcs.visible = false;
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
				arcCacheRef.current.delete(mountId);
			}
		}

		for (const mount of mounts) {
			const weapon = mount.weapon;
			if (!weapon) continue;

			const mountPos = mount.position ?? { x: 0, y: 0 };
			const mountFacing = (shipHeading + (mount.facing ?? 0)) * Math.PI / 180;

			const offsetX = mountPos.x;
			const offsetY = mountPos.y;
			const cosH = Math.cos(shipHeading * Math.PI / 180);
			const sinH = Math.sin(shipHeading * Math.PI / 180);
			const worldX = shipPosition.x + offsetX * cosH - offsetY * sinH;
			const worldY = shipPosition.y + offsetX * sinH + offsetY * cosH;

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
		}

		if (targetingDataRef.current) {
			for (const weapon of targetingDataRef.current.weapons) {
				const mount = mounts.find((m) => m.id === weapon.mountId);
				if (!mount) continue;

				const mountPos = mount.position ?? { x: 0, y: 0 };
				const mountFacing = (shipHeading + (mount.facing ?? 0)) * Math.PI / 180;
				const cosH = Math.cos(shipHeading * Math.PI / 180);
				const sinH = Math.sin(shipHeading * Math.PI / 180);
				const worldX = shipPosition.x + (mountPos.x ?? 0) * cosH - (mountPos.y ?? 0) * sinH;
				const worldY = shipPosition.y + (mountPos.x ?? 0) * sinH + (mountPos.y ?? 0) * cosH;

				const aimCached = aimLineCacheRef.current.get(weapon.mountId);
				if (!aimCached) {
					const graphics = new Graphics();
					graphics.position.set(worldX, worldY);
					graphics.rotation = mountFacing;
					layers.weaponArcs.addChild(graphics);
					aimLineCacheRef.current.set(weapon.mountId, { graphics });
					drawAimLines(graphics, weapon, ships);
				} else {
					aimCached.graphics.position.set(worldX, worldY);
					aimCached.graphics.rotation = mountFacing;
					drawAimLines(aimCached.graphics, weapon, ships);
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

	const rangeGraphics = new Graphics();
	root.addChild(rangeGraphics);

	drawWeaponArc(arcGraphics, arc, range);
	drawRangeCircles(rangeGraphics, range, minRange);

	layers.weaponArcs.addChild(root);

	cache.set(mountId, {
		root,
		arcGraphics,
		rangeGraphics,
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

	drawWeaponArc(cached.arcGraphics, arc, range);
	drawRangeCircles(cached.rangeGraphics, range, minRange);

	cached.lastData = { range, minRange, arc, mountFacing };
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
	ships: CombatToken[]
): void {
	graphics.clear();

	if (!weapon.validTargets || weapon.validTargets.length === 0) {
		return;
	}

	const AIM_LINE_COLOR = 0xff6b35;

	for (const target of weapon.validTargets) {
		const targetShip = ships.find((s) => s.$id === target.targetId);
		if (!targetShip?.runtime?.position) continue;

		const targetPos = targetShip.runtime.position;

		const dx = targetPos.x - graphics.position.x;
		const dy = targetPos.y - graphics.position.y;

		const color = target.inRange && target.inArc ? AIM_LINE_COLOR : 0xff5d7e;
		const alpha = target.inRange && target.inArc ? 0.8 : 0.3;

		const localDx = dx * Math.cos(-graphics.rotation) - dy * Math.sin(-graphics.rotation);
		const localDy = dx * Math.sin(-graphics.rotation) + dy * Math.cos(-graphics.rotation);

		graphics.moveTo(0, 0);
		graphics.lineTo(localDx, localDy);
		graphics.stroke({ color, width: 2, alpha });
	}
}