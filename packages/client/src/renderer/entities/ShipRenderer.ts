import { screenToWorld } from "@/utils/coordinateSystem";
import type { ShipState } from "@/sync/types";
import { Faction } from "@/sync/types";
import { Circle, Container, type FederatedPointerEvent, Graphics, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

const POSITION_THRESHOLD = 0.5;
const HEADING_THRESHOLD = 0.8;
const HP_THRESHOLD = 0.5;
const FLUX_THRESHOLD = 0.5;

const labelStyle = new TextStyle({
	fill: 0xcfe8ff,
	fontSize: 12,
	fontFamily: "Arial",
	fontWeight: "600",
	stroke: { color: 0x081423, width: 3 },
});

const FACTION_COLORS: Record<string, number> = {
	[Faction.PLAYER]: 0x4fc3ff,
	[Faction.DM]: 0xff7f9f,
};

export interface ShipCacheItem {
	root: Container;
	tacticalToken: Graphics;
	label: Text;
	hpBar: Graphics;
	isSelected: boolean;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		hp: number;
		flux: number;
	};
}

export interface ShipRenderContext {
	zoom: number;
	x: number;
	y: number;
	canvasWidth: number;
	canvasHeight: number;
	viewRotation: number;
}

export interface ShipRenderOptions {
	onSelectShip?: (shipId: string) => void;
	setMouseWorldPosition?: (x: number, y: number) => void;
	storeSelectShip?: (shipId: string) => void;
}

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
		const selectedId = selectedShipId ?? null;

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.tacticalTokens.removeChild(item.root);
				layers.shipLabels.removeChild(item.hpBar);
				layers.shipLabels.removeChild(item.label);
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			const isSelected = ship.id === selectedId;
			const cached = cache.get(ship.id);
			if (!cached) {
				createShipEntities(layers, cache, ship, isSelected, optionsRef, contextRef);
				continue;
			}

			if (shouldUpdate(cached, ship, isSelected, contextRef.current.viewRotation ?? 0)) {
				updateShipEntities(cached, ship, isSelected, contextRef.current.viewRotation ?? 0);
			}
		}

		// 预留：素材层入口，当前不绘制，仅确保图层存在且可扩展。
		layers.shipSprites.visible = true;
	}, [layers, ships, selectedShipId]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdate(
	cached: ShipCacheItem,
	ship: ShipState,
	isSelected: boolean,
	viewRotation: number
): boolean {
	if (!cached.lastState) return true;
	const dx = Math.abs(ship.transform.x - cached.lastState.x);
	const dy = Math.abs(ship.transform.y - cached.lastState.y);
	const dHeading = Math.abs(ship.transform.heading - cached.lastState.heading);
	const dHp = Math.abs(ship.hull.current - cached.lastState.hp);
	const dFlux = Math.abs(ship.flux.total - cached.lastState.flux);
	const selectedChanged = cached.isSelected !== isSelected;
	const labelRotationTarget = -((viewRotation * Math.PI) / 180);
	const dLabelRotation = Math.abs(cached.hpBar.rotation - labelRotationTarget);

	return (
		dx > POSITION_THRESHOLD ||
		dy > POSITION_THRESHOLD ||
		dHeading > HEADING_THRESHOLD ||
		dHp > HP_THRESHOLD ||
		dFlux > FLUX_THRESHOLD ||
		selectedChanged ||
		dLabelRotation > 0.002
	);
}

function updateShipEntities(
	cached: ShipCacheItem,
	ship: ShipState,
	isSelected: boolean,
	viewRotation: number
): void {
	const color = FACTION_COLORS[ship.faction] ?? 0xcfd8e3;
	const radius = 20;

	cached.root.position.set(ship.transform.x, ship.transform.y);
	cached.root.rotation = (ship.transform.heading * Math.PI) / 180;
	cached.label.position.set(ship.transform.x, ship.transform.y - radius - 10);
	cached.hpBar.position.set(ship.transform.x, ship.transform.y - radius - 28);
	cached.hpBar.rotation = -((viewRotation * Math.PI) / 180);
	cached.label.rotation = -((viewRotation * Math.PI) / 180);

	if (cached.isSelected !== isSelected) {
		cached.isSelected = isSelected;
		drawTacticalToken(cached.tacticalToken, color, radius, isSelected);
	}

	const hpPercent = ship.hull.percent / 100;
	drawHpBar(cached.hpBar, hpPercent);
	cached.label.text = `${ship.name || ship.id.slice(-6)}  HP:${Math.round(ship.hull.current)}/${Math.round(ship.hull.max)}`;

	cached.lastState = {
		x: ship.transform.x,
		y: ship.transform.y,
		heading: ship.transform.heading,
		hp: ship.hull.current,
		flux: ship.flux.total,
	};
}

function createShipEntities(
	layers: LayerRegistry,
	cache: Map<string, ShipCacheItem>,
	ship: ShipState,
	isSelected: boolean,
	optionsRef: React.MutableRefObject<ShipRenderOptions>,
	contextRef: React.MutableRefObject<Partial<ShipRenderContext>>
): void {
	const radius = 20;
	const color = FACTION_COLORS[ship.faction] ?? 0xcfd8e3;

	const root = new Container();
	root.position.set(ship.transform.x, ship.transform.y);
	root.rotation = (ship.transform.heading * Math.PI) / 180;
	root.eventMode = "static";
	root.cursor = "pointer";
	root.hitArea = new Circle(0, 0, radius + 14);

	const tacticalToken = new Graphics();
	drawTacticalToken(tacticalToken, color, radius, isSelected);
	root.addChild(tacticalToken);

	root.on("pointertap", () => {
		optionsRef.current.storeSelectShip?.(ship.id);
		optionsRef.current.onSelectShip?.(ship.id);
	});

	root.on("pointermove", (e: FederatedPointerEvent) => {
		const ctx = contextRef.current;
		if (
			!optionsRef.current.setMouseWorldPosition ||
			ctx.canvasWidth === undefined ||
			ctx.canvasHeight === undefined ||
			ctx.zoom === undefined ||
			ctx.x === undefined ||
			ctx.y === undefined
		) {
			return;
		}

		const world = screenToWorld(
			e.global.x - ctx.canvasWidth / 2,
			e.global.y - ctx.canvasHeight / 2,
			ctx.zoom,
			ctx.x,
			ctx.y,
			ctx.viewRotation || 0
		);
		optionsRef.current.setMouseWorldPosition(world.x, world.y);
	});

	const hpBar = new Graphics();
	drawHpBar(hpBar, ship.hull.percent / 100);
	hpBar.position.set(ship.transform.x, ship.transform.y - radius - 28);
	hpBar.rotation = -(((contextRef.current.viewRotation ?? 0) * Math.PI) / 180);

	const label = new Text({
		text: `${ship.name || ship.id.slice(-6)}  HP:${Math.round(ship.hull.current)}/${Math.round(ship.hull.max)}`,
		style: labelStyle,
	});
	label.anchor.set(0.5, 1);
	label.position.set(ship.transform.x, ship.transform.y - radius - 10);
	label.rotation = -(((contextRef.current.viewRotation ?? 0) * Math.PI) / 180);

	layers.tacticalTokens.addChild(root);
	layers.shipLabels.addChild(hpBar);
	layers.shipLabels.addChild(label);

	cache.set(ship.id, {
		root,
		tacticalToken,
		label,
		hpBar,
		isSelected,
		lastState: {
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			hp: ship.hull.current,
			flux: ship.flux.total,
		},
	});
}

function drawTacticalToken(
	target: Graphics,
	color: number,
	radius: number,
	isSelected: boolean
): void {
	target.clear();
	const outline = isSelected ? 0xffffff : color;
	const alpha = isSelected ? 0.98 : 0.9;

	// 战术视图：线框箭头 + 中心点，突出方向与中心位置
	target
		.poly([0, -radius, radius * 0.7, radius, 0, radius * 0.35, -radius * 0.7, radius])
		.stroke({ color: outline, width: isSelected ? 3 : 2, alpha });
	target
		.moveTo(0, -radius * 0.7)
		.lineTo(0, radius * 0.4)
		.stroke({ color, width: 1.2, alpha: 0.8 });
	target.circle(0, 0, 3.2).fill({ color: 0xffffff, alpha: 0.92 });
}

function drawHpBar(target: Graphics, hpPercent: number): void {
	target.clear();
	const width = 62;
	const height = 8;
	const fill = Math.max(0, Math.min(1, hpPercent)) * width;
	const color = hpPercent <= 0.3 ? 0xff5d7e : hpPercent <= 0.6 ? 0xffce66 : 0x57e38d;

	target
		.roundRect(-width / 2, -height / 2, width, height, 3)
		.fill({ color: 0x050c17, alpha: 0.95 });
	target.roundRect(-width / 2, -height / 2, fill, height, 3).fill({ color, alpha: 0.95 });
	target.rect(-width / 2, -height / 2, fill, Math.max(2, height * 0.28)).fill({
		color: 0xffffff,
		alpha: 0.2,
	});
	target.roundRect(-width / 2, -height / 2, width, height, 3).stroke({
		color: 0xb9dbff,
		alpha: 0.8,
		width: 1,
	});
}
