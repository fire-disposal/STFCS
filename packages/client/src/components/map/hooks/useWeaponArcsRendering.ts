import type { ShipState } from "@vt/contracts";
import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface DrawWeaponArcsOptions {
	showWeaponArcs: boolean;
	showMovementRange: boolean;
}

export function useWeaponArcsRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	options: DrawWeaponArcsOptions
) {
	const arcGraphicsRef = useRef<Graphics[]>([]);
	const moveGraphicsRef = useRef<Graphics | null>(null);

	useEffect(() => {
		if (!layers) return;

		arcGraphicsRef.current.forEach((g) => layers.weaponArcs.removeChild(g));
		arcGraphicsRef.current = [];
		if (moveGraphicsRef.current) {
			layers.weaponArcs.removeChild(moveGraphicsRef.current);
			moveGraphicsRef.current = null;
		}

		if (!options.showWeaponArcs || !selectedShipId) return;

		const selectedShip = ships.find((s) => s.id === selectedShipId);
		if (!selectedShip) return;

		selectedShip.weapons.forEach((weaponSlot) => {
			const weaponArc = 90;
			const weaponRange = weaponSlot.range || 300;

			let arcGraphics = arcGraphicsRef.current.find(
				(g) => g.position.x === selectedShip.transform.x && g.position.y === selectedShip.transform.y
			);
			if (!arcGraphics) {
				arcGraphics = new Graphics();
				arcGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);
				layers.weaponArcs.addChild(arcGraphics);
				arcGraphicsRef.current.push(arcGraphics);
			}

			arcGraphics.clear();
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

		if (options.showMovementRange && selectedShip) {
			const moveGraphics = new Graphics();
			moveGraphicsRef.current = moveGraphics;
			layers.weaponArcs.addChild(moveGraphics);

			const maxSpeed = selectedShip.maxSpeed || 100;
			const maxMoveDistance = maxSpeed * 4;

			moveGraphics.clear();
			moveGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);
			moveGraphics.circle(0, 0, maxMoveDistance);
			moveGraphics.stroke({ color: 0x4a9eff, alpha: 0.4, width: 2 });
			moveGraphics.fill({ color: 0x4a9eff, alpha: 0.05 });
		}
	}, [layers, ships, selectedShipId, options]);

	useEffect(() => {
		return () => {
			arcGraphicsRef.current.forEach((g) => {
				if (layers?.weaponArcs.children.includes(g)) {
					layers.weaponArcs.removeChild(g);
				}
			});
			if (moveGraphicsRef.current && layers?.weaponArcs.children.includes(moveGraphicsRef.current)) {
				layers.weaponArcs.removeChild(moveGraphicsRef.current);
			}
		};
	}, [layers]);
}