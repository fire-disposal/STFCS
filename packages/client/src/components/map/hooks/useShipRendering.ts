import { screenToWorld } from "@/utils/mathUtils";
import type { ShipState } from "@vt/contracts";
import { Faction } from "@vt/contracts";
import { Graphics, Text, TextStyle, Circle } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface ShipCacheItem {
	token: Graphics;
	label: Text;
	hpBar: Graphics;
	isSelected: boolean;
}

export interface ShipRenderContext {
	zoom: number;
	cameraX: number;
	cameraY: number;
	canvasWidth: number;
	canvasHeight: number;
	viewRotation: number;
}

export interface ShipRenderOptions {
	onSelectShip?: (shipId: string) => void;
	setMouseWorldPosition?: (x: number, y: number) => void;
	storeSelectShip?: (shipId: string) => void;
}

const labelStyle = new TextStyle({
	fill: 0xcfe8ff,
	fontSize: 11,
	fontFamily: "Arial",
	stroke: { color: 0x10263e, width: 2 },
});

export function useShipRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	context: Partial<ShipRenderContext>,
	options: ShipRenderOptions = {}
) {
	const cacheRef = useRef<Map<string, ShipCacheItem>>(new Map());
	const optionsRef = useRef(options);
	const contextRef = useRef(context);

	optionsRef.current = options;
	contextRef.current = context;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.ships.removeChild(item.token);
				layers.labels.removeChild(item.label);
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			const isSelected = ship.id === selectedShipId;
			const color = ship.faction === Faction.PLAYER ? 0x43c1ff : 0xff6f8f;
			const radius = 20;
			const cached = cache.get(ship.id);

			if (cached) {
				updateExistingShip(cached, ship, isSelected, color, radius);
			} else {
				createNewShip(layers, cache, ship, isSelected, color, radius, optionsRef, contextRef);
			}
		}
	}, [layers, ships, selectedShipId]);

	useEffect(() => {
		return () => cacheRef.current.clear();
	}, []);
}

function updateExistingShip(
	cached: ShipCacheItem,
	ship: ShipState,
	isSelected: boolean,
	color: number,
	radius: number
) {
	cached.token.position.set(ship.transform.x, ship.transform.y);
	cached.token.rotation = (ship.transform.heading * Math.PI) / 180;
	cached.label.position.set(ship.transform.x, ship.transform.y - radius - 8);

	if (isSelected !== cached.isSelected) {
		cached.isSelected = isSelected;
		cached.token.clear();
		cached.token
			.poly([0, -radius, radius * 0.7, radius, 0, radius * 0.45, -radius * 0.7, radius])
			.fill({ color, alpha: 0.88 })
			.stroke({
				color: isSelected ? 0xffffff : 0x10263e,
				alpha: isSelected ? 0.95 : 0.7,
				width: isSelected ? 3 : 2,
			});
	}

	const hpPercent = Math.max(0, Math.min(1, ship.hullMax > 0 ? ship.hullCurrent / ship.hullMax : 0));
	cached.hpBar.clear();
	cached.hpBar.rect(-24, radius + 8, 48, 5).fill({ color: 0x000000, alpha: 0.45 });
	cached.hpBar.rect(-24, radius + 8, 48 * hpPercent, 5).fill({ color: 0x3ddb6f, alpha: 0.95 });

	cached.label.text = `${ship.id.slice(-6)}  F:${Math.round(ship.fluxHard + ship.fluxSoft)}/${Math.round(ship.fluxMax)}`;
}

function createNewShip(
	layers: LayerRegistry,
	cache: Map<string, ShipCacheItem>,
	ship: ShipState,
	isSelected: boolean,
	color: number,
	radius: number,
	optionsRef: React.MutableRefObject<ShipRenderOptions>,
	contextRef: React.MutableRefObject<Partial<ShipRenderContext>>
) {
	const token = new Graphics();
	token
		.poly([0, -radius, radius * 0.7, radius, 0, radius * 0.45, -radius * 0.7, radius])
		.fill({ color, alpha: 0.88 })
		.stroke({
			color: isSelected ? 0xffffff : 0x10263e,
			alpha: isSelected ? 0.95 : 0.7,
			width: isSelected ? 3 : 2,
		});
	token.position.set(ship.transform.x, ship.transform.y);
	token.rotation = (ship.transform.heading * Math.PI) / 180;
	token.eventMode = "static";
	token.cursor = "pointer";
	token.hitArea = new Circle(0, 0, radius + 15);

	const shipId = ship.id;
	token.on("pointertap", () => {
		optionsRef.current.storeSelectShip?.(shipId);
		optionsRef.current.onSelectShip?.(shipId);
	});

	token.on("pointermove", (e: any) => {
		const ctx = contextRef.current;
		if (optionsRef.current.setMouseWorldPosition && ctx.canvasWidth && ctx.canvasHeight && ctx.zoom && ctx.cameraX && ctx.cameraY) {
			const { x, y } = screenToWorld(
				e.global.x - ctx.canvasWidth / 2,
				e.global.y - ctx.canvasHeight / 2,
				ctx.zoom,
				ctx.cameraX,
				ctx.cameraY,
				ctx.viewRotation || 0
			);
			optionsRef.current.setMouseWorldPosition(x, y);
		}
	});

	const hpBar = new Graphics();
	const hpPercent = Math.max(0, Math.min(1, ship.hullMax > 0 ? ship.hullCurrent / ship.hullMax : 0));
	hpBar.rect(-24, radius + 8, 48, 5).fill({ color: 0x000000, alpha: 0.45 });
	hpBar.rect(-24, radius + 8, 48 * hpPercent, 5).fill({ color: 0x3ddb6f, alpha: 0.95 });
	token.addChild(hpBar);

	const label = new Text({
		text: `${ship.id.slice(-6)}  F:${Math.round(ship.fluxHard + ship.fluxSoft)}/${Math.round(ship.fluxMax)}`,
		style: labelStyle,
	});
	label.anchor.set(0.5, 1);
	label.position.set(ship.transform.x, ship.transform.y - radius - 8);

	layers.ships.addChild(token);
	layers.labels.addChild(label);
	cache.set(ship.id, { token, label, hpBar, isSelected });
}