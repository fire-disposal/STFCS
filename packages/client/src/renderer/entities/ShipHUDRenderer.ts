/**
 * 舰船 HUD 渲染 Hook（血条/标签）
 *
 * 职责：
 * 1. 渲染舰船血条（文本样式，|符号组成）
 * 2. 渲染舰船名称标签
 * 3. 实时更新 HUD 元素位置（世界坐标 -> 屏幕坐标）
 *
 * 渲染层：hud.shipBars / hud.shipNames
 *
 * 血条设计：
 * - 格式：|||||[050/300]|||||（对称）
 * - 每20 HP 一个|（配置项 hpPerBar）
 * - 外侧|为白色半透明（空血），内侧|为有血颜色
 * - 中间数字 [current/max] 补位显示，随血量变色
 *
 * 颜色规则：
 * - 高血量 (>=60%): 绿色
 * - 中血量 (>=30%): 黄色
 * - 低血量 (<30%): 红色
 *
 * 选中状态：
 * - selected=true: 完全可见（alpha=1.0）
 * - selected=false: 半透明（alpha=0.85）
 */

import type { ShipViewModel } from "../types";
import { Text, TextStyle, Container } from "pixi.js";
import { worldToScreen } from "../core/useLayerSystem";

const HP_BAR_OFFSET_Y = -40;
const LABEL_OFFSET_Y = 25;
const DEFAULT_HULL_MAX = 100;
const DEFAULT_HP_PER_BAR = 20;
const MAX_BARS_PER_SIDE = 15;

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

const getHpColor = (hpPercent: number): number => {
	if (hpPercent >= 0.6) return 0x57e38d;
	if (hpPercent >= 0.3) return 0xffce66;
	return 0xff5d7e;
};

interface HpBarConfig {
	hpPerBar: number;
	maxBarsPerSide: number;
}

interface ShipHUDCache {
	hpBarContainer: Container;
	label: Text;
	lastUpdate: {
		worldX: number;
		worldY: number;
		hpPercent: number;
		currentHp: number;
		maxHp: number;
		name: string;
		selected: boolean;
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
	private hpBarConfig: HpBarConfig;

	constructor(
		hudLayers: { shipBars: Container; shipNames: Container },
		hpBarConfig?: Partial<HpBarConfig>
	) {
		this.hpBarLayer = hudLayers.shipBars;
		this.labelLayer = hudLayers.shipNames;
		this.hpBarConfig = {
			hpPerBar: hpBarConfig?.hpPerBar ?? DEFAULT_HP_PER_BAR,
			maxBarsPerSide: hpBarConfig?.maxBarsPerSide ?? MAX_BARS_PER_SIDE,
		};
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
				this.hpBarLayer.removeChild(cached.hpBarContainer);
				this.labelLayer.removeChild(cached.label);
				cached.hpBarContainer.destroy();
				cached.label.destroy();
				this.cache.delete(id);
			}
		}

		for (const ship of ships) {
			if (!ship.runtime?.position) continue;

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
		if (!ship.runtime?.position) return;

		const { screenX, screenY } = worldToScreen(
			ship.runtime.position.x,
			ship.runtime.position.y,
			camera,
			canvasSize
		);

		const hullMax = ship.spec.maxHitPoints ?? defaultHullMax;
		const hpPercent = ship.runtime.hull / hullMax;
		const isSelected = ship.selected ?? false;

		const hpBarContainer = this.createHpBarContainer(ship.runtime.hull, hullMax, hpPercent, isSelected);
		hpBarContainer.position.set(screenX, screenY + HP_BAR_OFFSET_Y);

		const label = new Text({
			text: this.formatLabel(ship),
			style: labelStyle,
		});
		label.anchor.set(0.5, 0);
		label.position.set(screenX, screenY + LABEL_OFFSET_Y);

		this.hpBarLayer.addChild(hpBarContainer);
		this.labelLayer.addChild(label);

		this.cache.set(ship.id, {
			hpBarContainer,
			label,
			lastUpdate: {
				worldX: ship.runtime.position.x,
				worldY: ship.runtime.position.y,
				hpPercent,
				currentHp: ship.runtime.hull,
				maxHp: hullMax,
				name: ship.metadata?.name || ship.id,
				selected: isSelected,
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
		if (!ship.runtime?.position) return;

		const last = cached.lastUpdate;
		const hullMax = ship.spec.maxHitPoints ?? defaultHullMax;

		const cameraChanged = !this.lastCamera ||
			camera.zoom !== this.lastCamera.zoom ||
			camera.viewRotation !== this.lastCamera.viewRotation ||
			camera.x !== this.lastCamera.x ||
			camera.y !== this.lastCamera.y;

		const positionChanged =
			ship.runtime.position.x !== last.worldX ||
			ship.runtime.position.y !== last.worldY;

		if (cameraChanged || positionChanged) {
			const { screenX, screenY } = worldToScreen(
				ship.runtime.position.x,
				ship.runtime.position.y,
				camera,
				canvasSize
			);
			cached.hpBarContainer.position.set(screenX, screenY + HP_BAR_OFFSET_Y);
			cached.label.position.set(screenX, screenY + LABEL_OFFSET_Y);
		}

		const hpPercent = ship.runtime.hull / hullMax;
		const isSelected = ship.selected ?? false;
		const hpChanged = ship.runtime.hull !== last.currentHp || hullMax !== last.maxHp;
		const selectedChanged = isSelected !== last.selected;

		if (hpChanged || selectedChanged) {
			this.updateHpBarContainer(cached.hpBarContainer, ship.runtime.hull, hullMax, hpPercent, isSelected);
		}

		const newName = ship.metadata?.name || ship.id;
		const nameChanged = newName !== last.name;

		if (nameChanged) {
			cached.label.text = this.formatLabel(ship);
		}

		cached.lastUpdate = {
			worldX: ship.runtime.position.x,
			worldY: ship.runtime.position.y,
			hpPercent,
			currentHp: ship.runtime.hull,
			maxHp: hullMax,
			name: newName,
			selected: isSelected,
		};
	}

	private formatLabel(ship: ShipViewModel): string {
		return ship.metadata?.name || ship.id.slice(-6);
	}

	private createHpBarContainer(currentHp: number, maxHp: number, hpPercent: number, isSelected: boolean): Container {
		const container = new Container();
		this.updateHpBarContainer(container, currentHp, maxHp, hpPercent, isSelected);
		return container;
	}

	private updateHpBarContainer(container: Container, currentHp: number, maxHp: number, hpPercent: number, isSelected: boolean): void {
		container.removeChildren().forEach((child) => child.destroy());

		const { hpPerBar, maxBarsPerSide } = this.hpBarConfig;
		const totalBars = Math.min(Math.ceil(maxHp / hpPerBar / 2), maxBarsPerSide);
		const filledBars = Math.ceil(hpPercent * totalBars);
		const emptyBars = totalBars - filledBars;

		const hpColor = getHpColor(hpPercent);
		const barWidth = 8;
		const baseAlpha = isSelected ? 1.0 : 0.85;

		const filledStyle = new TextStyle({
			fill: hpColor,
			fontSize: 12,
			fontFamily: "monospace",
			fontWeight: "700",
		});

		const emptyStyle = new TextStyle({
			fill: 0xffffff,
			fontSize: 12,
			fontFamily: "monospace",
			fontWeight: "700",
		});

		const centerStyle = new TextStyle({
			fill: hpColor,
			fontSize: 16,
			fontFamily: "monospace",
			fontWeight: "600",
		});

		const centerText = new Text({
			text: `[${this.formatHpNumber(Math.round(currentHp), Math.round(maxHp))}/${Math.round(maxHp)}]`,
			style: centerStyle,
		});
		centerText.anchor.set(0.5, 0.5);
		centerText.alpha = baseAlpha;
		container.addChild(centerText);

		const centerWidth = centerText.width + 4;

		let x = -centerWidth / 2;
		for (let i = 0; i < filledBars; i++) {
			const bar = new Text({ text: "|", style: filledStyle });
			bar.anchor.set(1, 0.5);
			bar.x = x;
			bar.alpha = baseAlpha;
			container.addChild(bar);
			x -= barWidth;
		}

		for (let i = 0; i < emptyBars; i++) {
			const bar = new Text({ text: "|", style: emptyStyle });
			bar.anchor.set(1, 0.5);
			bar.x = x;
			bar.alpha = isSelected ? 0.5 : 0.35;
			container.addChild(bar);
			x -= barWidth;
		}

		x = centerWidth / 2;
		for (let i = 0; i < filledBars; i++) {
			const bar = new Text({ text: "|", style: filledStyle });
			bar.anchor.set(0, 0.5);
			bar.x = x;
			bar.alpha = baseAlpha;
			container.addChild(bar);
			x += barWidth;
		}

		for (let i = 0; i < emptyBars; i++) {
			const bar = new Text({ text: "|", style: emptyStyle });
			bar.anchor.set(0, 0.5);
			bar.x = x;
			bar.alpha = isSelected ? 0.5 : 0.35;
			container.addChild(bar);
			x += barWidth;
		}
	}

	private formatHpNumber(current: number, max: number): string {
		const maxDigits = max.toString().length;
		return current.toString().padStart(maxDigits, "0");
	}

	clear(): void {
		for (const cached of this.cache.values()) {
			this.hpBarLayer.removeChild(cached.hpBarContainer);
			this.labelLayer.removeChild(cached.label);
			cached.hpBarContainer.destroy();
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