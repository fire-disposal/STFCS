/**
 * 舰船战术标记渲染 Hook
 *
 * 职责：
 * 1. 渲染舰船在世界坐标系中的战术标记
 * 2. 处理舰船点击选择交互
 * 3. 实时更新舰船位置/朝向/状态可视化
 *
 * 渲染层：world.shipSprites / world.tacticalTokens
 *
 * 渲染内容：
 * ├── 舰船本体：根据 faction 显示不同颜色
 * ├── 朝向箭头：指向 heading 方向
 * ├── 挂载点：SMALL=正方形, MEDIUM=八边形, LARGE=圆形
 * ├── 武器标记：显示武器类型图标，颜色区分伤害类型
 * ├── 状态指示：destroyed 标记
 * └── 命中区域：hitArea 圆形
 *
 * 交互：
 * - pointerdown: 选择舰船（调用 uiStore.selectShip）
 * - hitArea: 点击检测区域
 */

import { screenToWorld } from "@/utils/coordinateSystem";
import type { ShipRenderOptions } from "../types";
import type { CombatToken, WeaponRuntime, MountSpec, WeaponSlotSize } from "@vt/data";
import { Faction, FactionColors, toPixiRotation, nauticalToPixiSectorRotation, mountOffsetToScreen } from "@vt/data";
import { Circle, Container, type FederatedPointerEvent, Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";
import { UI_CONFIG } from "@/config/constants";

const POSITION_THRESHOLD = 0.5;
const HEADING_THRESHOLD = 0.8;
const FLUX_THRESHOLD = 0.5;


const DAMAGE_TYPE_COLORS = UI_CONFIG.COLORS.DAMAGE_TYPE_PIXI;

const MOUNT_SLOT_SIZE: Record<WeaponSlotSize, number> = {
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
	mountMarkers: Graphics;
	weaponMarkers: Graphics;
	isSelected: boolean;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		flux: number;
		weaponCount: number;
		mountsHash: string;
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
	ships: CombatToken[],
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
		const currentIds = new Set(ships.map((s) => s.$id));
		const selectedId = selectedShipId ?? null;

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.tacticalTokens.removeChild(item.root);
				item.tacticalToken.destroy();
				item.hitbox.destroy();
				item.mountMarkers.destroy();
				item.weaponMarkers.destroy();
				item.root.destroy();
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			if (!ship.runtime?.position) continue;

			const isSelected = ship.$id === selectedId;
			const cached = cache.get(ship.$id);
			if (!cached) {
				createShipToken(layers, cache, ship, isSelected, optionsRef, contextRef);
				continue;
			}

			if (shouldUpdate(cached, ship, isSelected)) {
				updateShipToken(cached, ship, isSelected);
			}
		}

		layers.tacticalTokens.visible = true;
	}, [layers, ships, selectedShipId]);

	useEffect(() => {
		return () => {
			for (const item of cacheRef.current.values()) {
				layers?.tacticalTokens.removeChild(item.root);
				item.tacticalToken.destroy();
				item.hitbox.destroy();
				item.mountMarkers.destroy();
				item.weaponMarkers.destroy();
				item.root.destroy();
			}
			cacheRef.current.clear();
		};
	}, [layers]);
}

function computeMountsHash(mounts: MountSpec[] | undefined): string {
	if (!mounts?.length) return "empty";
	return mounts.map(m => `${m.id}:${m.position?.x ?? 0},${m.position?.y ?? 0}:${m.facing ?? 0}:${m.arc ?? 360}:${m.size}:${m.weapon?.$id ?? "none"}`).join("|");
}

function shouldUpdate(
	cached: ShipCacheItem,
	ship: CombatToken,
	isSelected: boolean
): boolean {
	if (!cached.lastState || !ship.runtime?.position) return true;

	const dx = Math.abs(ship.runtime.position.x - cached.lastState.x);
	const dy = Math.abs(ship.runtime.position.y - cached.lastState.y);
	const dHeading = Math.abs(ship.runtime.heading - cached.lastState.heading);
	const fluxTotal = (ship.runtime.fluxSoft ?? 0) + (ship.runtime.fluxHard ?? 0);
	const dFlux = Math.abs(fluxTotal - cached.lastState.flux);
	const selectedChanged = cached.isSelected !== isSelected;
	const weaponCount = ship.runtime.weapons?.length ?? 0;
	const weaponCountChanged = cached.lastState.weaponCount !== weaponCount;
	const mountsHash = computeMountsHash(ship.spec.mounts);
	const mountsChanged = cached.lastState.mountsHash !== mountsHash;

	return (
		dx > POSITION_THRESHOLD ||
		dy > POSITION_THRESHOLD ||
		dHeading > HEADING_THRESHOLD ||
		dFlux > FLUX_THRESHOLD ||
		selectedChanged ||
		weaponCountChanged ||
		mountsChanged
	);
}

function updateShipToken(
	cached: ShipCacheItem,
	ship: CombatToken,
	isSelected: boolean
): void {
	if (!ship.runtime?.position) return;

	const color = FactionColors[ship.runtime.faction ?? Faction.PLAYER_ALLIANCE] ?? 0xcfd8e3;
	const halfWidth = (ship.spec.width ?? DEFAULT_WIDTH) / 2;
	const halfLength = (ship.spec.length ?? DEFAULT_LENGTH) / 2;

	cached.root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	cached.root.rotation = toPixiRotation(ship.runtime.heading);

	if (cached.isSelected !== isSelected) {
		cached.isSelected = isSelected;
		drawTacticalToken(cached.tacticalToken, color, halfWidth, halfLength, isSelected);
		drawHitbox(cached.hitbox, halfWidth, halfLength, isSelected);
	}

	drawMountMarkers(cached.mountMarkers, ship.spec.mounts, isSelected);
	drawWeaponMarkers(cached.weaponMarkers, ship, isSelected);

	const fluxTotal = (ship.runtime.fluxSoft ?? 0) + (ship.runtime.fluxHard ?? 0);
	cached.lastState = {
		x: ship.runtime.position.x,
		y: ship.runtime.position.y,
		heading: ship.runtime.heading,
		flux: fluxTotal,
		weaponCount: ship.runtime.weapons?.length ?? 0,
		mountsHash: computeMountsHash(ship.spec.mounts),
	};
}

function createShipToken(
	layers: LayerRegistry,
	cache: Map<string, ShipCacheItem>,
	ship: CombatToken,
	isSelected: boolean,
	optionsRef: React.MutableRefObject<ShipRenderOptions>,
	contextRef: React.MutableRefObject<Partial<ShipRenderContext>>
): void {
	if (!ship.runtime?.position) return;

	const color = FactionColors[ship.runtime.faction ?? Faction.PLAYER_ALLIANCE] ?? 0xcfd8e3;
	const halfWidth = (ship.spec.width ?? DEFAULT_WIDTH) / 2;
	const halfLength = (ship.spec.length ?? DEFAULT_LENGTH) / 2;
	const hitRadius = Math.max(halfWidth, halfLength) + 10;

	const root = new Container();
	root.position.set(ship.runtime.position.x, ship.runtime.position.y);
	root.rotation = toPixiRotation(ship.runtime.heading);
	root.eventMode = "static";
	root.cursor = "pointer";
	root.hitArea = new Circle(0, 0, hitRadius);

	const hitbox = new Graphics();
	drawHitbox(hitbox, halfWidth, halfLength, isSelected);
	root.addChild(hitbox);

	const tacticalToken = new Graphics();
	drawTacticalToken(tacticalToken, color, halfWidth, halfLength, isSelected);
	root.addChild(tacticalToken);

	const mountMarkers = new Graphics();
	drawMountMarkers(mountMarkers, ship.spec.mounts, isSelected);
	root.addChild(mountMarkers);

	const weaponMarkers = new Graphics();
	drawWeaponMarkers(weaponMarkers, ship, isSelected);
	root.addChild(weaponMarkers);

	root.on("pointertap", () => {
		optionsRef.current.storeSelectShip?.(ship.$id);
		optionsRef.current.onSelectShip?.(ship.$id);
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

	const fluxTotal = (ship.runtime.fluxSoft ?? 0) + (ship.runtime.fluxHard ?? 0);
	cache.set(ship.$id, {
		root,
		tacticalToken,
		hitbox,
		mountMarkers,
		weaponMarkers,
		isSelected,
		lastState: {
			x: ship.runtime.position.x,
			y: ship.runtime.position.y,
			heading: ship.runtime.heading,
			flux: fluxTotal,
			weaponCount: ship.runtime.weapons?.length ?? 0,
			mountsHash: computeMountsHash(ship.spec.mounts),
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

function drawMountSlotShape(
	target: Graphics,
	x: number,
	y: number,
	size: WeaponSlotSize,
	slotRadius: number,
	alpha: number,
	facing: number = 0,
	arc: number = 360
): void {
	const r = slotRadius;
	const nauticalRad = nauticalToPixiSectorRotation(facing);

	target.poly([
		x + Math.cos(nauticalRad) * r * 0.6, y + Math.sin(nauticalRad) * r * 0.6,
		x, y,
	]);
	target.stroke({ color: 0xffffff, width: 1.5, alpha: alpha * 0.8 });

	if (arc < 360) {
		const arcRad = (arc * Math.PI) / 180;
		const leftRad = nauticalRad - arcRad / 2;
		const rightRad = nauticalRad + arcRad / 2;
		const lineLen = r * 1.8;

		target.moveTo(x, y);
		target.lineTo(x + Math.cos(leftRad) * lineLen, y + Math.sin(leftRad) * lineLen);
		target.stroke({ color: 0x5a6a8a, width: 1, alpha: alpha * 0.5 });

		target.moveTo(x, y);
		target.lineTo(x + Math.cos(rightRad) * lineLen, y + Math.sin(rightRad) * lineLen);
		target.stroke({ color: 0x5a6a8a, width: 1, alpha: alpha * 0.5 });
	}

	switch (size) {
		case "SMALL":
			target.rect(x - r, y - r, r * 2, r * 2);
			target.stroke({ color: 0x5a6a8a, width: 1, alpha });
			break;
		case "MEDIUM":
			const o = r * 0.4;
			target.poly([
				x - r + o, y - r,
				x + r - o, y - r,
				x + r, y - r + o,
				x + r, y + r - o,
				x + r - o, y + r,
				x - r + o, y + r,
				x - r, y + r - o,
				x - r, y - r + o,
			]);
			target.stroke({ color: 0x5a6a8a, width: 1, alpha });
			break;
		case "LARGE":
			const ol = r * 0.35;
			target.poly([
				x - r + ol, y - r,
				x + r - ol, y - r,
				x + r, y - r + ol,
				x + r, y + r - ol,
				x + r - ol, y + r,
				x - r + ol, y + r,
				x - r, y + r - ol,
				x - r, y - r + ol,
			]);
			target.stroke({ color: 0x5a6a8a, width: 1.2, alpha });
			break;
	}
}

function drawMountMarkers(
	target: Graphics,
	mounts: MountSpec[] | undefined,
	isSelected: boolean
): void {
	target.clear();

	if (!mounts) return;

	const alpha = isSelected ? 0.85 : 0.5;

	for (const mount of mounts) {
		// 使用统一函数：挂载点偏移 → PixiJS 屏幕偏移
		const screenOffset = mountOffsetToScreen(mount.position ?? { x: 0, y: 0 });
		const offsetX = screenOffset.x;
		const offsetY = screenOffset.y;
		const mountSize = mount.size;
		const slotRadius = MOUNT_SLOT_SIZE[mountSize];
		const mountFacing = mount.facing ?? 0;
		const mountArc = mount.arc ?? 360;

		drawMountSlotShape(target, offsetX, offsetY, mountSize, slotRadius, alpha, mountFacing, mountArc);
	}
}

function drawWeaponMarkers(
	target: Graphics,
	ship: CombatToken,
	isSelected: boolean
): void {
	target.clear();

	if (!ship.runtime?.weapons) return;

	for (const weapon of ship.runtime.weapons) {
		drawSingleWeaponMarker(target, weapon, ship.spec.mounts, isSelected);
	}
}

function drawSingleWeaponMarker(
	target: Graphics,
	weapon: WeaponRuntime,
	mounts: MountSpec[] | undefined,
	isSelected: boolean
): void {
	const mount = mounts?.find((m) => m.id === weapon.mountId);
	if (!mount?.weapon) return;

	const spec = mount.weapon.spec;
	if (!spec) return;

	// 使用统一函数：挂载点偏移 → PixiJS 屏幕偏移
	const screenOffset = mountOffsetToScreen(mount.position ?? { x: 0, y: 0 });
	const offsetX = screenOffset.x;
	const offsetY = screenOffset.y;
	const nauticalRad = nauticalToPixiSectorRotation(mount.facing ?? 0);

	const weaponColor = DAMAGE_TYPE_COLORS[spec.damageType as keyof typeof DAMAGE_TYPE_COLORS] ?? 0x7b68ee;
	const iconSize = MOUNT_SLOT_SIZE[spec.size];
	const alpha = isSelected ? 0.95 : 0.75;
	const outlineAlpha = isSelected ? 1 : 0.8;

	drawWeaponBar(target, offsetX, offsetY, nauticalRad, iconSize, weaponColor, alpha, outlineAlpha, spec.damageType);
}

function drawWeaponBar(
	target: Graphics,
	x: number,
	y: number,
	facingRad: number,
	size: number,
	color: number,
	alpha: number,
	outlineAlpha: number,
	damageType: string
): void {
	const length = size * 1.4;
	const width = size * 0.25;

	target
		.moveTo(x + Math.cos(facingRad + Math.PI) * length * 0.3, y + Math.sin(facingRad + Math.PI) * length * 0.3)
		.lineTo(x + Math.cos(facingRad) * length, y + Math.sin(facingRad) * length)
		.stroke({ color, width: width, alpha: alpha * 0.7 });

	target.poly([
		x + Math.cos(facingRad) * length, y + Math.sin(facingRad) * length,
		x + Math.cos(facingRad + Math.PI * 0.85) * length * 0.15, y + Math.sin(facingRad + Math.PI * 0.85) * length * 0.15,
		x + Math.cos(facingRad + Math.PI) * length * 0.3, y + Math.sin(facingRad + Math.PI) * length * 0.3,
		x + Math.cos(facingRad - Math.PI * 0.85) * length * 0.15, y + Math.sin(facingRad - Math.PI * 0.85) * length * 0.15,
	]);
	target.fill({ color, alpha: alpha * 0.5 });
	target.stroke({ color, width: 1.2, alpha: outlineAlpha });

	switch (damageType) {
		case "KINETIC":
			target.circle(x + Math.cos(facingRad) * length * 0.6, y + Math.sin(facingRad) * length * 0.6, size * 0.1);
			target.fill({ color: 0xffffff, alpha: alpha * 0.6 });
			break;
		case "HIGH_EXPLOSIVE":
			target.poly([
				x + Math.cos(facingRad) * length, y + Math.sin(facingRad) * length,
				x + Math.cos(facingRad + Math.PI * 0.75) * size * 0.2, y + Math.sin(facingRad + Math.PI * 0.75) * size * 0.2,
				x + Math.cos(facingRad - Math.PI * 0.75) * size * 0.2, y + Math.sin(facingRad - Math.PI * 0.75) * size * 0.2,
			]);
			target.fill({ color, alpha: alpha * 0.8 });
			break;
		case "ENERGY":
			target.circle(x + Math.cos(facingRad) * length * 0.4, y + Math.sin(facingRad) * length * 0.4, size * 0.12);
			target.fill({ color: 0xffffff, alpha: alpha * 0.9 });
			break;
		case "FRAGMENTATION":
			for (let i = -1; i <= 1; i += 2) {
				const branchAngle = facingRad + i * Math.PI * 0.3;
				target
					.moveTo(x + Math.cos(facingRad) * length * 0.7, y + Math.sin(facingRad) * length * 0.7)
					.lineTo(x + Math.cos(branchAngle) * length * 0.9, y + Math.sin(branchAngle) * length * 0.9)
					.stroke({ color, width: width * 0.6, alpha: alpha * 0.6 });
			}
			break;
	}
}