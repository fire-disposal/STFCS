/**
 * 舰船战术渲染模块
 *
 * 适配 ShipRuntime 数据结构
 */

import { screenToWorld } from "@/utils/coordinateSystem";
import type { ShipViewModel, ShipRenderOptions } from "../types";
import type { WeaponRuntime } from "@vt/data";
import { Faction, DamageType, WeaponTag } from "@vt/data";
import { Circle, Container, type FederatedPointerEvent, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

const POSITION_THRESHOLD = 0.5;
const HEADING_THRESHOLD = 0.8;
const FLUX_THRESHOLD = 0.5;

const FACTION_COLORS: Record<string, number> = {
	[Faction.PLAYER]: 0x4fc3ff,
	[Faction.NEUTRAL]: 0xff7f9f,
};

const DAMAGE_TYPE_COLORS: Record<string, number> = {
	[DamageType.KINETIC]: 0xffd700,
	[DamageType.HIGH_EXPLOSIVE]: 0xff6b35,
	[DamageType.ENERGY]: 0x7b68ee,
	[DamageType.FRAGMENTATION]: 0x32cd32,
};

const WEAPON_SIZE_SCALE: Record<string, number> = {
	SMALL: 6,
	MEDIUM: 10,
	LARGE: 14,
};

const DEFAULT_WIDTH = 30;
const DEFAULT_LENGTH = 50;

export interface ShipCacheItem {
	root: Container;
	tacticalToken: Graphics;
	hitbox: Graphics;
	weaponMarkers: Graphics;
	isSelected: boolean;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		flux: number;
		weaponCount: number;
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

export function useShipRendering(
	layers: LayerRegistry | null,
	ships: ShipViewModel[],
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
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			if (!ship.position) continue;

			const isSelected = ship.id === selectedId;
			const cached = cache.get(ship.id);
			if (!cached) {
				createShipToken(layers, cache, ship, isSelected, optionsRef, contextRef);
				continue;
			}

			if (shouldUpdate(cached, ship, isSelected)) {
				updateShipToken(cached, ship, isSelected);
			}
		}

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
	ship: ShipViewModel,
	isSelected: boolean
): boolean {
	if (!cached.lastState || !ship.position) return true;

	const dx = Math.abs(ship.position.x - cached.lastState.x);
	const dy = Math.abs(ship.position.y - cached.lastState.y);
	const dHeading = Math.abs(ship.heading - cached.lastState.heading);
	const fluxTotal = (ship.fluxSoft ?? 0) + (ship.fluxHard ?? 0);
	const dFlux = Math.abs(fluxTotal - cached.lastState.flux);
	const selectedChanged = cached.isSelected !== isSelected;
	const weaponCount = ship.weapons?.length ?? 0;
	const weaponCountChanged = cached.lastState.weaponCount !== weaponCount;

	return (
		dx > POSITION_THRESHOLD ||
		dy > POSITION_THRESHOLD ||
		dHeading > HEADING_THRESHOLD ||
		dFlux > FLUX_THRESHOLD ||
		selectedChanged ||
		weaponCountChanged
	);
}

function updateShipToken(
	cached: ShipCacheItem,
	ship: ShipViewModel,
	isSelected: boolean
): void {
	if (!ship.position) return;

	const color = FACTION_COLORS[ship.faction ?? Faction.PLAYER] ?? 0xcfd8e3;
	const halfWidth = (ship.width ?? DEFAULT_WIDTH) / 2;
	const halfLength = (ship.length ?? DEFAULT_LENGTH) / 2;

	cached.root.position.set(ship.position.x, ship.position.y);
	cached.root.rotation = (ship.heading * Math.PI) / 180;

	if (cached.isSelected !== isSelected) {
		cached.isSelected = isSelected;
		drawTacticalToken(cached.tacticalToken, color, halfWidth, halfLength, isSelected);
		drawHitbox(cached.hitbox, halfWidth, halfLength, isSelected);
	}

	drawWeaponMarkers(cached.weaponMarkers, ship, isSelected);

	const fluxTotal = (ship.fluxSoft ?? 0) + (ship.fluxHard ?? 0);
	cached.lastState = {
		x: ship.position.x,
		y: ship.position.y,
		heading: ship.heading,
		flux: fluxTotal,
		weaponCount: ship.weapons?.length ?? 0,
	};
}

function createShipToken(
	layers: LayerRegistry,
	cache: Map<string, ShipCacheItem>,
	ship: ShipViewModel,
	isSelected: boolean,
	optionsRef: React.MutableRefObject<ShipRenderOptions>,
	contextRef: React.MutableRefObject<Partial<ShipRenderContext>>
): void {
	if (!ship.position) return;

	const color = FACTION_COLORS[ship.faction ?? Faction.PLAYER] ?? 0xcfd8e3;
	const halfWidth = (ship.width ?? DEFAULT_WIDTH) / 2;
	const halfLength = (ship.length ?? DEFAULT_LENGTH) / 2;
	const hitRadius = Math.max(halfWidth, halfLength) + 10;

	const root = new Container();
	root.position.set(ship.position.x, ship.position.y);
	root.rotation = (ship.heading * Math.PI) / 180;
	root.eventMode = "static";
	root.cursor = "pointer";
	root.hitArea = new Circle(0, 0, hitRadius);

	const hitbox = new Graphics();
	drawHitbox(hitbox, halfWidth, halfLength, isSelected);
	root.addChild(hitbox);

	const tacticalToken = new Graphics();
	drawTacticalToken(tacticalToken, color, halfWidth, halfLength, isSelected);
	root.addChild(tacticalToken);

	const weaponMarkers = new Graphics();
	drawWeaponMarkers(weaponMarkers, ship, isSelected);
	root.addChild(weaponMarkers);

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

	layers.tacticalTokens.addChild(root);

	const fluxTotal = (ship.fluxSoft ?? 0) + (ship.fluxHard ?? 0);
	cache.set(ship.id, {
		root,
		tacticalToken,
		hitbox,
		weaponMarkers,
		isSelected,
		lastState: {
			x: ship.position.x,
			y: ship.position.y,
			heading: ship.heading,
			flux: fluxTotal,
			weaponCount: ship.weapons?.length ?? 0,
		},
	});
}

function drawHitbox(
	target: Graphics,
	halfWidth: number,
	halfLength: number,
	isSelected: boolean
): void {
	target.clear();

	const outlineColor = isSelected ? 0xffffff : 0x8899aa;
	const alpha = isSelected ? 0.95 : 0.6;
	const lineWidth = isSelected ? 2 : 1.5;

	target.poly([
		0, -halfLength,
		halfWidth, 0,
		0, halfLength,
		-halfWidth, 0,
	]);
	target.stroke({ color: outlineColor, width: lineWidth, alpha });

	if (isSelected) {
		target.fill({ color: 0x4fc3ff, alpha: 0.12 });
	}
}

function drawTacticalToken(
	target: Graphics,
	color: number,
	halfWidth: number,
	halfLength: number,
	isSelected: boolean
): void {
	target.clear();

	const arrowLength = Math.max(halfLength * 0.6, 15);
	const arrowWidth = Math.max(halfWidth * 0.4, 8);

	const outline = isSelected ? 0xffffff : color;
	const alpha = isSelected ? 0.98 : 0.85;
	const lineWidth = isSelected ? 2.5 : 2;

	target
		.poly([
			0, -arrowLength,
			arrowWidth * 0.6, arrowLength * 0.3,
			arrowWidth, arrowLength * 0.6,
			0, arrowLength * 0.35,
			-arrowWidth, arrowLength * 0.6,
			-arrowWidth * 0.6, arrowLength * 0.3,
		])
		.stroke({ color: outline, width: lineWidth, alpha });

	target
		.moveTo(0, -arrowLength * 0.7)
		.lineTo(0, arrowLength * 0.4)
		.stroke({ color: color, width: 1.2, alpha: 0.7 });

	target.circle(0, 0, 2.5).fill({ color: 0xffffff, alpha: 0.9 });
}

function drawWeaponMarkers(
	target: Graphics,
	ship: ShipViewModel,
	isSelected: boolean
): void {
	target.clear();

	if (!ship.weapons) return;

	for (const weapon of ship.weapons) {
		drawSingleWeaponMarker(target, weapon, isSelected);
	}
}

function drawSingleWeaponMarker(
	target: Graphics,
	weapon: WeaponRuntime,
	isSelected: boolean
): void {
	const spec = weapon.weapon;
	if (!spec) return;

	const offsetX = 0;
	const offsetY = 0;
	const facingRad = 0;

	const weaponColor = DAMAGE_TYPE_COLORS[spec.damageType] ?? 0x7b68ee;
	const iconSize = WEAPON_SIZE_SCALE[spec.size] ?? 8;
	const alpha = isSelected ? 0.95 : 0.75;
	const outlineAlpha = isSelected ? 1 : 0.8;

	const isBallistic = spec.tags?.includes(WeaponTag.BALLISTIC);
	const isEnergy = spec.tags?.includes(WeaponTag.ENERGY);
	const isMissile = spec.tags?.includes(WeaponTag.GUIDED);

	if (isBallistic) {
		drawBallisticWeapon(target, offsetX, offsetY, facingRad, iconSize, weaponColor, alpha, outlineAlpha);
	} else if (isEnergy) {
		drawEnergyWeapon(target, offsetX, offsetY, facingRad, iconSize, weaponColor, alpha, outlineAlpha);
	} else if (isMissile) {
		drawMissileWeapon(target, offsetX, offsetY, facingRad, iconSize, weaponColor, alpha, outlineAlpha);
	} else {
		target.circle(offsetX, offsetY, iconSize * 0.5);
		target.fill({ color: weaponColor, alpha });
	}
}

function drawBallisticWeapon(
	target: Graphics,
	x: number,
	y: number,
	facingRad: number,
	size: number,
	color: number,
	alpha: number,
	outlineAlpha: number
): void {
	target.poly([
		x + Math.cos(facingRad) * size * 0.8, y + Math.sin(facingRad) * size * 0.8,
		x + Math.cos(facingRad + Math.PI * 0.6) * size * 0.4, y + Math.sin(facingRad + Math.PI * 0.6) * size * 0.4,
		x + Math.cos(facingRad + Math.PI) * size * 0.3, y + Math.sin(facingRad + Math.PI) * size * 0.3,
		x + Math.cos(facingRad - Math.PI * 0.6) * size * 0.4, y + Math.sin(facingRad - Math.PI * 0.6) * size * 0.4,
	]);
	target.fill({ color, alpha: alpha * 0.6 });
	target.stroke({ color, width: 1.2, alpha: outlineAlpha });

	target
		.moveTo(x, y)
		.lineTo(x + Math.cos(facingRad) * size * 1.2, y + Math.sin(facingRad) * size * 1.2)
		.stroke({ color, width: 1.5, alpha: outlineAlpha });
}

function drawEnergyWeapon(
	target: Graphics,
	x: number,
	y: number,
	facingRad: number,
	size: number,
	color: number,
	alpha: number,
	outlineAlpha: number
): void {
	target.poly([
		x + Math.cos(facingRad) * size, y + Math.sin(facingRad) * size,
		x + Math.cos(facingRad + Math.PI * 0.7) * size * 0.5, y + Math.sin(facingRad + Math.PI * 0.7) * size * 0.5,
		x + Math.cos(facingRad - Math.PI * 0.7) * size * 0.5, y + Math.sin(facingRad - Math.PI * 0.7) * size * 0.5,
	]);
	target.fill({ color, alpha: alpha * 0.5 });
	target.stroke({ color, width: 1.2, alpha: outlineAlpha });

	target.circle(x + Math.cos(facingRad) * size * 0.3, y + Math.sin(facingRad) * size * 0.3, size * 0.15);
	target.fill({ color: 0xffffff, alpha: alpha * 0.8 });
}

function drawMissileWeapon(
	target: Graphics,
	x: number,
	y: number,
	facingRad: number,
	size: number,
	color: number,
	alpha: number,
	outlineAlpha: number
): void {
	target.poly([
		x + Math.cos(facingRad) * size * 1.2, y + Math.sin(facingRad) * size * 1.2,
		x + Math.cos(facingRad + Math.PI * 0.5) * size * 0.4, y + Math.sin(facingRad + Math.PI * 0.5) * size * 0.4,
		x + Math.cos(facingRad + Math.PI) * size * 0.5, y + Math.sin(facingRad + Math.PI) * size * 0.5,
		x + Math.cos(facingRad - Math.PI * 0.5) * size * 0.4, y + Math.sin(facingRad - Math.PI * 0.5) * size * 0.4,
	]);
	target.fill({ color, alpha: alpha * 0.5 });
	target.stroke({ color, width: 1.2, alpha: outlineAlpha });

	target.circle(x, y, size * 0.2);
	target.fill({ color: 0xffffff, alpha: alpha * 0.7 });
}