/**
 * ShipHUDRenderer - 舰船 HUD 渲染器（血条/标签）
 */

import type { ShipViewModel } from "../types";
import { Graphics, Text, TextStyle, Container } from "pixi.js";
import { worldToScreen } from "../core/useLayerSystem";

const HP_BAR_WIDTH = 62;
const HP_BAR_HEIGHT = 8;
const HP_BAR_OFFSET_Y = -40;
const LABEL_OFFSET_Y = -25;
const DEFAULT_HULL_MAX = 100;

const labelStyle = new TextStyle({
	fill: 0xcfe8ff,
	fontSize: 12,
	fontFamily: "Arial, sans-serif",
	fontWeight: "600",
	stroke: { color: 0x081423, width: 2 },
	dropShadow: {
		color: 0x081423,
		alpha: 0.5,
		blur: 1,
		distance: 1,
	},
});

interface ShipHUDCache {
	hpBar: Graphics;
	label: Text;
	lastUpdate: {
		worldX: number;
		worldY: number;
		hpPercent: number;
		hpCurrent: number;
		name: string;
	};
}

interface CameraSnapshot {
	x: number;
	y: number;
	zoom: number;
	viewRotation: number;
}

export class ShipHUDManager {
	private cache = new Map<string, ShipHUDCache>();
	private hpBarLayer: Container;
	private labelLayer: Container;
	private lastCamera: CameraSnapshot | null = null;

	constructor(hudLayers: { shipBars: Container; shipNames: Container }) {
		this.hpBarLayer = hudLayers.shipBars;
		this.labelLayer = hudLayers.shipNames;
	}

	update(
		ships: ShipViewModel[],
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number },
		defaultHullMax: number = DEFAULT_HULL_MAX
	): void {
		const currentIds = new Set(ships.map((s) => s.id));

		for (const [id, cached] of this.cache) {
			if (!currentIds.has(id)) {
				this.hpBarLayer.removeChild(cached.hpBar);
				this.labelLayer.removeChild(cached.label);
				cached.hpBar.destroy();
				cached.label.destroy();
				this.cache.delete(id);
			}
		}

		for (const ship of ships) {
			if (!ship.position) continue;

			const cached = this.cache.get(ship.id);
			if (!cached) {
				this.createShipHUD(ship, camera, canvasSize, defaultHullMax);
			} else {
				this.updateShipHUD(ship, cached, camera, canvasSize, defaultHullMax);
			}
		}

		this.lastCamera = { ...camera };
	}

	private createShipHUD(
		ship: ShipViewModel,
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number },
		defaultHullMax: number
	): void {
		if (!ship.position) return;

		const { screenX, screenY } = worldToScreen(
			ship.position.x,
			ship.position.y,
			camera,
			canvasSize
		);

		const hullMax = ship.hullMax ?? defaultHullMax;
		const hpPercent = ship.hull / hullMax;

		const hpBar = new Graphics();
		this.drawHpBar(hpBar, hpPercent);
		hpBar.position.set(screenX, screenY + HP_BAR_OFFSET_Y);

		const label = new Text({
			text: this.formatLabel(ship, hullMax),
			style: labelStyle,
		});
		label.anchor.set(0.5, 1);
		label.position.set(screenX, screenY + LABEL_OFFSET_Y);

		this.hpBarLayer.addChild(hpBar);
		this.labelLayer.addChild(label);

		this.cache.set(ship.id, {
			hpBar,
			label,
			lastUpdate: {
				worldX: ship.position.x,
				worldY: ship.position.y,
				hpPercent,
				hpCurrent: ship.hull,
				name: ship.name || ship.id,
			},
		});
	}

	private updateShipHUD(
		ship: ShipViewModel,
		cached: ShipHUDCache,
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number },
		defaultHullMax: number
	): void {
		if (!ship.position) return;

		const last = cached.lastUpdate;
		const hullMax = ship.hullMax ?? defaultHullMax;

		const cameraChanged = !this.lastCamera ||
			camera.zoom !== this.lastCamera.zoom ||
			camera.viewRotation !== this.lastCamera.viewRotation ||
			camera.x !== this.lastCamera.x ||
			camera.y !== this.lastCamera.y;

		const positionChanged =
			ship.position.x !== last.worldX ||
			ship.position.y !== last.worldY;

		if (cameraChanged || positionChanged) {
			const { screenX, screenY } = worldToScreen(
				ship.position.x,
				ship.position.y,
				camera,
				canvasSize
			);
			cached.hpBar.position.set(screenX, screenY + HP_BAR_OFFSET_Y);
			cached.label.position.set(screenX, screenY + LABEL_OFFSET_Y);
		}

		const hpPercent = ship.hull / hullMax;
		if (hpPercent !== last.hpPercent) {
			this.drawHpBar(cached.hpBar, hpPercent);
		}

		const newName = ship.name || ship.id;
		const hpChanged = ship.hull !== last.hpCurrent;
		const nameChanged = newName !== last.name;

		if (nameChanged || hpChanged) {
			cached.label.text = this.formatLabel(ship, hullMax);
		}

		cached.lastUpdate = {
			worldX: ship.position.x,
			worldY: ship.position.y,
			hpPercent,
			hpCurrent: ship.hull,
			name: newName,
		};
	}

	private formatLabel(ship: ShipViewModel, hullMax: number): string {
		return `${ship.name || ship.id.slice(-6)}  HP:${Math.round(ship.hull)}/${Math.round(hullMax)}`;
	}

	private drawHpBar(graphics: Graphics, hpPercent: number): void {
		graphics.clear();

		const width = HP_BAR_WIDTH;
		const height = HP_BAR_HEIGHT;
		const fill = Math.max(0, Math.min(1, hpPercent)) * width;

		const color = hpPercent <= 0.3 ? 0xff5d7e : hpPercent <= 0.6 ? 0xffce66 : 0x57e38d;

		graphics
			.roundRect(-width / 2, -height / 2, width, height, 3)
			.fill({ color: 0x050c17, alpha: 0.95 });

		graphics.roundRect(-width / 2, -height / 2, fill, height, 3).fill({ color, alpha: 0.95 });

		graphics.rect(-width / 2, -height / 2, fill, Math.max(2, height * 0.28)).fill({
			color: 0xffffff,
			alpha: 0.2,
		});

		graphics.roundRect(-width / 2, -height / 2, width, height, 3).stroke({
			color: 0xb9dbff,
			alpha: 0.8,
			width: 1,
		});
	}

	clear(): void {
		for (const cached of this.cache.values()) {
			this.hpBarLayer.removeChild(cached.hpBar);
			this.labelLayer.removeChild(cached.label);
			cached.hpBar.destroy();
			cached.label.destroy();
		}
		this.cache.clear();
	}

	destroy(): void {
		this.clear();
	}
}

import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export interface ShipHUDRenderOptions {
	showHpBars?: boolean;
	showLabels?: boolean;
	hullMax?: number;
}

export function useShipHUDRendering(
	layers: LayerRegistry | null,
	ships: ShipViewModel[],
	camera: { x: number; y: number; zoom: number; viewRotation: number },
	canvasSize: { width: number; height: number },
	options: ShipHUDRenderOptions = {}
) {
	const managerRef = useRef<ShipHUDManager | null>(null);
	const defaultHullMax = options.hullMax ?? DEFAULT_HULL_MAX;

	useEffect(() => {
		if (!layers) return;

		managerRef.current = new ShipHUDManager({
			shipBars: layers.shipBars,
			shipNames: layers.shipNames,
		});

		return () => {
			managerRef.current?.destroy();
			managerRef.current = null;
		};
	}, [layers]);

	useEffect(() => {
		if (!managerRef.current || !layers) return;

		layers.shipBars.visible = options.showHpBars ?? true;
		layers.shipNames.visible = options.showLabels ?? true;

		managerRef.current.update(ships, camera, canvasSize, defaultHullMax);
	}, [layers, ships, camera, canvasSize, options.showHpBars, options.showLabels, defaultHullMax]);
}