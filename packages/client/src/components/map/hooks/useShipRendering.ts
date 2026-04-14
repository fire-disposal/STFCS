import { screenToWorld } from "@/utils/mathUtils";
import type { ShipState } from "@vt/types";
import { Faction } from "@vt/types";
import { Circle, Graphics, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

// 变化检测阈值
const POSITION_THRESHOLD = 0.5;
const HEADING_THRESHOLD = 1;
const HP_THRESHOLD = 1;
const FLUX_THRESHOLD = 1;

export interface ShipCacheItem {
	token: Graphics;
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
	const lastSelectedShipIdRef = useRef<string | null>(null);

	optionsRef.current = options;
	contextRef.current = context;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));
		const selectedShipIdStr = selectedShipId ?? null;
		const selectedShipChanged = selectedShipIdStr !== lastSelectedShipIdRef.current;
		lastSelectedShipIdRef.current = selectedShipIdStr;

		// 清理不存在的舰船
		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.ships.removeChild(item.token);
				layers.labels.removeChild(item.label);
				cache.delete(id);
			}
		}

		// 批量更新舰船
		const updates: Array<{ ship: ShipState; cached?: ShipCacheItem }> = [];
		let hasChanges = false;

		for (const ship of ships) {
			const isSelected = ship.id === selectedShipIdStr;
			const cached = cache.get(ship.id);
			const lastState = cached?.lastState;

			if (!cached) {
				// 新舰船，需要创建
				hasChanges = true;
				updates.push({ ship, cached: undefined });
			} else if (lastState) {
				// 检查变化是否超过阈值（使用新的嵌套结构）
				const dx = Math.abs(ship.transform.x - lastState.x);
				const dy = Math.abs(ship.transform.y - lastState.y);
				const dHeading = Math.abs(ship.transform.heading - lastState.heading);
				const dHp = Math.abs(ship.hull.current - lastState.hp);
				const dFlux = Math.abs(ship.flux.total - lastState.flux);
				const isSelectedChanged = isSelected !== cached.isSelected;

				// 只有显著变化才更新
				if (
					dx > POSITION_THRESHOLD ||
					dy > POSITION_THRESHOLD ||
					dHeading > HEADING_THRESHOLD ||
					dHp > HP_THRESHOLD ||
					dFlux > FLUX_THRESHOLD ||
					isSelectedChanged
				) {
					hasChanges = true;
					updates.push({ ship, cached });
				}
			} else {
				// 没有上次状态，强制更新
				hasChanges = true;
				updates.push({ ship, cached });
			}
		}

		// 执行批量更新
		if (hasChanges) {
			for (const { ship, cached } of updates) {
				const isSelected = ship.id === selectedShipIdStr;
				const color = ship.faction === Faction.PLAYER ? 0x43c1ff : 0xff6f8f;
				const radius = 20;

				if (cached) {
					updateExistingShip(cached, ship, isSelected, color, radius);
				} else {
					createNewShip(layers, cache, ship, isSelected, color, radius, optionsRef, contextRef);
				}
			}
		}
	}, [layers, ships, selectedShipId]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function updateExistingShip(
	cached: ShipCacheItem,
	ship: ShipState,
	isSelected: boolean,
	color: number,
	radius: number
) {
	// 更新位置（总是需要）
	cached.token.position.set(ship.transform.x, ship.transform.y);
	cached.token.rotation = (ship.transform.heading * Math.PI) / 180;
	cached.label.position.set(ship.transform.x, ship.transform.y - radius - 8);

	// 只在选中状态变化时重绘
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

	// 只在 HP 变化超过阈值时更新血条（使用新的 hull.percent）
	const hpPercent = ship.hull.percent / 100;
	const hpBarWidth = 48 * hpPercent;

	// 检查血条是否需要更新
	const currentHpBar = cached.hpBar.children[1] as any;
	if (!currentHpBar || Math.abs(currentHpBar.width - hpBarWidth) > HP_THRESHOLD) {
		cached.hpBar.clear();
		cached.hpBar.rect(-24, radius + 8, 48, 5).fill({ color: 0x000000, alpha: 0.45 });
		cached.hpBar.rect(-24, radius + 8, hpBarWidth, 5).fill({ color: 0x3ddb6f, alpha: 0.95 });
	}

	// 只在文本变化时更新标签（使用新的 flux.total）
	const newText = `${ship.id.slice(-6)}  F:${Math.round(ship.flux.total)}/${Math.round(ship.flux.max)}`;
	if (cached.label.text !== newText) {
		cached.label.text = newText;
	}

	// 更新上次状态
	cached.lastState = {
		x: ship.transform.x,
		y: ship.transform.y,
		heading: ship.transform.heading,
		hp: ship.hull.current,
		flux: ship.flux.total,
	};
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
		if (
			optionsRef.current.setMouseWorldPosition &&
			ctx.canvasWidth &&
			ctx.canvasHeight &&
			ctx.zoom &&
			ctx.cameraX &&
			ctx.cameraY
		) {
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

	// 使用新的 hull.percent
	const hpPercent = ship.hull.percent / 100;
	const hpBar = new Graphics();
	hpBar.rect(-24, radius + 8, 48, 5).fill({ color: 0x000000, alpha: 0.45 });
	hpBar.rect(-24, radius + 8, 48 * hpPercent, 5).fill({ color: 0x3ddb6f, alpha: 0.95 });
	token.addChild(hpBar);

	const label = new Text({
		text: `${ship.id.slice(-6)}  F:${Math.round(ship.flux.total)}/${Math.round(ship.flux.max)}`,
		style: labelStyle,
	});
	label.anchor.set(0.5, 1);
	label.position.set(ship.transform.x, ship.transform.y - radius - 8);

	layers.ships.addChild(token);
	layers.labels.addChild(label);
	cache.set(ship.id, { token, label, hpBar, isSelected });
}
