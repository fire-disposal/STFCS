import type { ShipState } from "@vt/contracts";
import { Graphics } from "pixi.js";
import { useEffect } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface DrawWeaponArcsOptions {
	showWeaponArcs: boolean;
	showMovementRange: boolean;
}

export function drawWeaponArcs(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	options: DrawWeaponArcsOptions
): void {
	if (!layers || !options.showWeaponArcs || !selectedShipId) {
		layers?.weaponArcs?.removeChildren();
		return;
	}

	layers.weaponArcs.removeChildren();

	const selectedShip = ships.find((s) => s.id === selectedShipId);
	if (!selectedShip) return;

	selectedShip.weapons.forEach((weaponSlot) => {
		const weaponArc = 90;
		const weaponRange = weaponSlot.range || 300;

		const arcGraphics = new Graphics();
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

		arcGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);
		layers.weaponArcs.addChild(arcGraphics);
	});

	if (options.showMovementRange && selectedShip) {
		const moveGraphics = new Graphics();
		const maxSpeed = selectedShip.maxSpeed || 100;
		const maxMoveDistance = maxSpeed * 4;

		moveGraphics.circle(0, 0, maxMoveDistance);
		moveGraphics.stroke({ color: 0x4a9eff, alpha: 0.4, width: 2 });
		moveGraphics.fill({ color: 0x4a9eff, alpha: 0.05 });
		moveGraphics.position.set(selectedShip.transform.x, selectedShip.transform.y);
		layers.weaponArcs.addChild(moveGraphics);
	}
}

export function useWeaponArcsRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	options: DrawWeaponArcsOptions
) {
	useEffect(() => {
		drawWeaponArcs(layers, ships, selectedShipId, options);
	}, [layers, ships, selectedShipId, options]);
}
