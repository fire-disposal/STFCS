import type { ShipState } from "@vt/types";
import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface DrawWeaponArcsOptions {
	showWeaponArcs: boolean;
	showMovementRange: boolean;
}

interface ArcGraphicsMeta {
	graphics: Graphics;
	weaponId: string;
	shipId: string;
}

export function useWeaponArcsRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	options: DrawWeaponArcsOptions
) {
	const arcGraphicsRef = useRef<ArcGraphicsMeta[]>([]);
	const moveGraphicsRef = useRef<Graphics | null>(null);
	const lastShipIdRef = useRef<string | null>(null);

	useEffect(() => {
		if (!layers) return;

		const selectedShip = selectedShipId ? ships.find((s) => s.id === selectedShipId) : null;

		if (lastShipIdRef.current && lastShipIdRef.current !== selectedShipId) {
			arcGraphicsRef.current.forEach((meta) => {
				layers.weaponArcs.removeChild(meta.graphics);
			});
			arcGraphicsRef.current = [];
			if (moveGraphicsRef.current) {
				layers.weaponArcs.removeChild(moveGraphicsRef.current);
				moveGraphicsRef.current = null;
			}
		}
		lastShipIdRef.current = selectedShipId ?? null;

		if (!selectedShip) {
			arcGraphicsRef.current.forEach((meta) => {
				layers.weaponArcs.removeChild(meta.graphics);
			});
			arcGraphicsRef.current = [];
			if (moveGraphicsRef.current) {
				layers.weaponArcs.removeChild(moveGraphicsRef.current);
				moveGraphicsRef.current = null;
			}
			return;
		}

		if (options.showWeaponArcs) {
			const existingWeaponIds = new Set(arcGraphicsRef.current.map((m) => m.weaponId));
			const currentWeaponIds = new Set<string>();
			selectedShip.weapons.forEach((w) => currentWeaponIds.add(w.id));

			selectedShip.weapons.forEach((weaponSlot) => {
				const existingMeta = arcGraphicsRef.current.find((m) => m.weaponId === weaponSlot.id);
				const arcGraphics = existingMeta?.graphics ?? new Graphics();

				if (!existingMeta) {
					layers.weaponArcs.addChild(arcGraphics);
					arcGraphicsRef.current.push({
						graphics: arcGraphics,
						weaponId: weaponSlot.id,
						shipId: selectedShip.id,
					});
				}

				arcGraphics.clear();
				arcGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);

				const weaponArc = weaponSlot.arc || 90;
				const weaponRange = weaponSlot.range || 300;
				const arcRad = (weaponArc * Math.PI) / 180;
				const baseAngle = ((selectedShip.transform.heading - 90) * Math.PI) / 180;
				const startAngle = baseAngle - arcRad / 2;
				const endAngle = baseAngle + arcRad / 2;

				arcGraphics.moveTo(0, 0);
				for (let angle = startAngle; angle <= endAngle; angle += 0.05) {
					const x = Math.cos(angle) * weaponRange;
					const y = Math.sin(angle) * weaponRange;
					arcGraphics.lineTo(x, y);
				}
				arcGraphics.lineTo(0, 0);
				arcGraphics.fill({ color: 0xff6b35, alpha: 0.15 });
				arcGraphics.stroke({ color: 0xff6b35, alpha: 0.6, width: 1 });
				arcGraphics.circle(0, 0, weaponRange);
				arcGraphics.stroke({ color: 0xffa500, alpha: 0.3, width: 1 });
			});

			existingWeaponIds.forEach((id) => {
				if (!currentWeaponIds.has(id)) {
					const meta = arcGraphicsRef.current.find((m) => m.weaponId === id);
					if (meta) {
						layers.weaponArcs.removeChild(meta.graphics);
						arcGraphicsRef.current = arcGraphicsRef.current.filter((m) => m.weaponId !== id);
					}
				}
			});
		} else {
			arcGraphicsRef.current.forEach((meta) => {
				layers.weaponArcs.removeChild(meta.graphics);
			});
			arcGraphicsRef.current = [];
		}

		if (options.showMovementRange && selectedShip) {
			if (!moveGraphicsRef.current) {
				moveGraphicsRef.current = new Graphics();
				layers.weaponArcs.addChild(moveGraphicsRef.current);
			}

			const moveGraphics = moveGraphicsRef.current;
			moveGraphics.clear();
			moveGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);

			const maxSpeed = selectedShip.maxSpeed || 100;
			const maxMoveDistance = maxSpeed * 4;

			moveGraphics.circle(0, 0, maxMoveDistance);
			moveGraphics.stroke({ color: 0x4a9eff, alpha: 0.4, width: 2 });
			moveGraphics.fill({ color: 0x4a9eff, alpha: 0.05 });
		} else if (moveGraphicsRef.current) {
			layers.weaponArcs.removeChild(moveGraphicsRef.current);
			moveGraphicsRef.current = null;
		}
	}, [layers, ships, selectedShipId, options]);

	useEffect(() => {
		return () => {
			arcGraphicsRef.current.forEach((meta) => {
				if (layers?.weaponArcs.children.includes(meta.graphics)) {
					layers.weaponArcs.removeChild(meta.graphics);
				}
			});
			if (
				moveGraphicsRef.current &&
				layers?.weaponArcs.children.includes(moveGraphicsRef.current)
			) {
				layers.weaponArcs.removeChild(moveGraphicsRef.current);
			}
		};
	}, [layers]);
}
