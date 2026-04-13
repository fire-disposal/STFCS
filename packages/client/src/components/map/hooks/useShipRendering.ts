import { toRadians } from "@/utils/mathUtils";
import type { ShipState } from "@vt/contracts";
import { Faction } from "@vt/contracts";
import { Graphics, Text, TextStyle } from "pixi.js";
import { useEffect } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export interface ShipCacheItem {
	token: Graphics;
	label: Text;
	hpBar: Graphics;
	isSelected: boolean;
}

const labelStyle = new TextStyle({
	fill: 0xcfe8ff,
	fontSize: 11,
	fontFamily: "Arial",
	stroke: { color: 0x10263e, width: 2 },
});

export function renderShips(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	onSelectShip?: (shipId: string) => void,
	setMouseWorldPosition?: (x: number, y: number) => void,
	zoom?: number,
	cameraX?: number,
	cameraY?: number,
	canvasWidth?: number,
	canvasHeight?: number,
	handleClick?: (x: number, y: number) => boolean,
	storeSelectShip?: (shipId: string) => void
): void {
	if (!layers) return;

	const cache = shipCacheRef;
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
			cached.token.position.set(ship.transform.x, ship.transform.y);
			cached.token.rotation = (ship.transform.heading * Math.PI) / 180;
			cached.label.position.set(ship.transform.x, ship.transform.y - radius - 8);

			const needsStrokeUpdate = isSelected !== cached.isSelected;
			if (needsStrokeUpdate) {
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
				cached.token.position.set(ship.transform.x, ship.transform.y);
				cached.token.rotation = (ship.transform.heading * Math.PI) / 180;
			}

			const hpPercent = Math.max(
				0,
				Math.min(1, ship.hullMax > 0 ? ship.hullCurrent / ship.hullMax : 0)
			);
			cached.hpBar.clear();
			cached.hpBar.rect(-24, radius + 8, 48, 5).fill({ color: 0x000000, alpha: 0.45 });
			cached.hpBar.rect(-24, radius + 8, 48 * hpPercent, 5).fill({ color: 0x3ddb6f, alpha: 0.95 });

			cached.label.text = `${ship.id.slice(-6)}  F:${Math.round(ship.fluxHard + ship.fluxSoft)}/${Math.round(ship.fluxMax)}`;
		} else {
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

			// 添加点击吸附范围（半径 + 15px 吸附区域）
			// 使用 Rectangle 作为 hitArea
			const hitRadius = radius + 15;
			token.hitArea = {
				x: -hitRadius,
				y: -hitRadius,
				width: hitRadius * 2,
				height: hitRadius * 2,
			};

			token.on("pointertap", () => {
				// 单击即可选中
				if (ship.id !== selectedShipId) {
					storeSelectShip?.(ship.id);
					onSelectShip?.(ship.id);
				}
			});

			token.on("pointermove", (e) => {
				if (setMouseWorldPosition && canvasWidth && canvasHeight && zoom && cameraX && cameraY) {
					// e.data.global.x/y 是 PixiJS 的屏幕空间坐标（画布中心为原点）
					// 需要转换为世界坐标
					const screenX = e.data.global.x;
					const screenY = e.data.global.y;

					// 屏幕坐标转世界坐标（考虑旋转）
					// PixiJS 的 world.rotation 已经应用了视图旋转
					// global 坐标是相对于画布中心的，需要反向旋转补偿
					const dx = screenX;
					const dy = screenY;
					const theta = toRadians(-viewRotation);
					const cos = Math.cos(theta);
					const sin = Math.sin(theta);
					const rotatedX = (dx * cos - dy * sin) / zoom;
					const rotatedY = (dx * sin + dy * cos) / zoom;

					const worldX = rotatedX + cameraX;
					const worldY = rotatedY + cameraY;

					setMouseWorldPosition(worldX, worldY);
				}
			});

			const hpBar = new Graphics();
			const hpPercent = Math.max(
				0,
				Math.min(1, ship.hullMax > 0 ? ship.hullCurrent / ship.hullMax : 0)
			);
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
	}
}

const shipCacheRef: Map<string, ShipCacheItem> = new Map();

export function useShipRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	selectedShipId: string | null | undefined,
	onSelectShip?: (shipId: string) => void,
	setMouseWorldPosition?: (x: number, y: number) => void,
	zoom?: number,
	cameraX?: number,
	cameraY?: number,
	canvasWidth?: number,
	canvasHeight?: number,
	handleClick?: (x: number, y: number) => boolean,
	storeSelectShip?: (shipId: string) => void,
	viewRotation?: number
) {
	useEffect(() => {
		renderShips(
			layers,
			ships,
			selectedShipId,
			onSelectShip,
			setMouseWorldPosition,
			zoom,
			cameraX,
			cameraY,
			canvasWidth,
			canvasHeight,
			handleClick,
			storeSelectShip
		);
	}, [
		layers,
		ships,
		selectedShipId,
		onSelectShip,
		setMouseWorldPosition,
		zoom,
		cameraX,
		cameraY,
		canvasWidth,
		canvasHeight,
		handleClick,
		storeSelectShip,
	]);
}
