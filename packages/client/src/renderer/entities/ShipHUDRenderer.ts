/**
 * ShipHUDRenderer - 舰船 HUD 渲染器（血条/标签）
 *
 * RTS 风格实现：
 * - 血条和标签在独立的 HUD 层，不受 world 层的 zoom/rotation 影响
 * - 固定像素大小，始终在舰船的"屏幕上方"
 * - 使用高分辨率文本渲染，确保清晰度
 *
 * 文本清晰度优化：
 * - 使用 resolution: 2 或更高（适配高 DPI 屏幕）
 * - 样式设置 dropShadow/stroke 增强可读性
 */

import type { ShipState } from "@/sync/types";
import { Faction } from "@/sync/types";
import { Graphics, Text, TextStyle, Container } from "pixi.js";
import { worldToScreen } from "../core/useLayerSystem";

/** 血条宽度（像素） */
const HP_BAR_WIDTH = 62;
/** 血条高度（像素） */
const HP_BAR_HEIGHT = 8;
/** 血条距离舰船中心的像素偏移 */
const HP_BAR_OFFSET_Y = -40;
/** 标签距离舰船中心的像素偏移 */
const LABEL_OFFSET_Y = -25;

/** 标签样式 - 清晰可读 */
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

/** 阵营颜色 */
const FACTION_COLORS: Record<string, number> = {
	[Faction.PLAYER]: 0x4fc3ff,
	[Faction.NEUTRAL]: 0xff7f9f,
};

/** HUD 元素缓存 */
interface ShipHUDCache {
	hpBar: Graphics;
	label: Text;
	/** 上一次更新的状态快照 */
	lastUpdate: {
		worldX: number;
		worldY: number;
		hpPercent: number;
		hpCurrent: number;
		hpMax: number;
		name: string;
	};
}

/** 相机状态快照 */
interface CameraSnapshot {
	x: number;
	y: number;
	zoom: number;
	viewRotation: number;
}

/**
 * 舰船 HUD 渲染管理器
 *
 * 负责管理所有舰船的血条和标签渲染
 */
export class ShipHUDManager {
	private cache = new Map<string, ShipHUDCache>();
	private hpBarLayer: Container;
	private labelLayer: Container;
	private lastCamera: CameraSnapshot | null = null;

	constructor(hudLayers: { shipBars: Container; shipNames: Container }) {
		this.hpBarLayer = hudLayers.shipBars;
		this.labelLayer = hudLayers.shipNames;
	}

	/**
	 * 更新所有舰船的 HUD 位置和内容
	 */
	update(
		ships: ShipState[],
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number }
	): void {
		const currentIds = new Set(ships.map((s) => s.id));

		// 清除不在列表中的舰船 HUD
		for (const [id, cached] of this.cache) {
			if (!currentIds.has(id)) {
				this.hpBarLayer.removeChild(cached.hpBar);
				this.labelLayer.removeChild(cached.label);
				cached.hpBar.destroy();
				cached.label.destroy();
				this.cache.delete(id);
			}
		}

		// 更新或创建每个舰船的 HUD
		for (const ship of ships) {
			const cached = this.cache.get(ship.id);

			if (!cached) {
				this.createShipHUD(ship, camera, canvasSize);
			} else {
				this.updateShipHUD(ship, cached, camera, canvasSize);
			}
		}

		// 保存相机状态快照
		this.lastCamera = { ...camera };
	}

	/**
	 * 创建舰船 HUD 元素
	 */
	private createShipHUD(
		ship: ShipState,
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number }
	): void {
		const { screenX, screenY } = worldToScreen(
			ship.transform.x,
			ship.transform.y,
			camera,
			canvasSize
		);

		// 创建血条
		const hpBar = new Graphics();
		const hpPercent = ship.hull.percent / 100;
		this.drawHpBar(hpBar, hpPercent);
		hpBar.position.set(screenX, screenY + HP_BAR_OFFSET_Y);

		// 创建标签（高分辨率）
		const label = new Text({
			text: this.formatLabel(ship),
			style: labelStyle,
		});
		label.anchor.set(0.5, 1);
		label.position.set(screenX, screenY + LABEL_OFFSET_Y);

		// 添加到 HUD 层
		this.hpBarLayer.addChild(hpBar);
		this.labelLayer.addChild(label);

		// 缓存
		this.cache.set(ship.id, {
			hpBar,
			label,
			lastUpdate: {
				worldX: ship.transform.x,
				worldY: ship.transform.y,
				hpPercent,
				hpCurrent: ship.hull.current,
				hpMax: ship.hull.max,
				name: ship.name || ship.id,
			},
		});
	}

	/**
	 * 更新舰船 HUD 元素
	 */
	private updateShipHUD(
		ship: ShipState,
		cached: ShipHUDCache,
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number }
	): void {
		const last = cached.lastUpdate;

		// 检查是否需要更新位置
		const cameraChanged = !this.lastCamera ||
			camera.zoom !== this.lastCamera.zoom ||
			camera.viewRotation !== this.lastCamera.viewRotation ||
			camera.x !== this.lastCamera.x ||
			camera.y !== this.lastCamera.y;

		const positionChanged =
			ship.transform.x !== last.worldX ||
			ship.transform.y !== last.worldY;

		if (cameraChanged || positionChanged) {
			const { screenX, screenY } = worldToScreen(
				ship.transform.x,
				ship.transform.y,
				camera,
				canvasSize
			);
			cached.hpBar.position.set(screenX, screenY + HP_BAR_OFFSET_Y);
			cached.label.position.set(screenX, screenY + LABEL_OFFSET_Y);
		}

		// 检查是否需要更新血条内容
		const hpPercent = ship.hull.percent / 100;
		if (hpPercent !== last.hpPercent) {
			this.drawHpBar(cached.hpBar, hpPercent);
		}

		// 检查是否需要更新标签内容
		const newName = ship.name || ship.id;
		const hpChanged = ship.hull.current !== last.hpCurrent || ship.hull.max !== last.hpMax;
		const nameChanged = newName !== last.name;

		if (nameChanged || hpChanged) {
			cached.label.text = this.formatLabel(ship);
		}

		// 更新缓存
		cached.lastUpdate = {
			worldX: ship.transform.x,
			worldY: ship.transform.y,
			hpPercent,
			hpCurrent: ship.hull.current,
			hpMax: ship.hull.max,
			name: newName,
		};
	}

	/**
	 * 格式化标签文本
	 */
	private formatLabel(ship: ShipState): string {
		return `${ship.name || ship.id.slice(-6)}  HP:${Math.round(ship.hull.current)}/${Math.round(ship.hull.max)}`;
	}

	/**
	 * 绘制血条（固定像素大小）
	 */
	private drawHpBar(graphics: Graphics, hpPercent: number): void {
		graphics.clear();

		const width = HP_BAR_WIDTH;
		const height = HP_BAR_HEIGHT;
		const fill = Math.max(0, Math.min(1, hpPercent)) * width;

		// 根据血量百分比选择颜色
		const color = hpPercent <= 0.3 ? 0xff5d7e : hpPercent <= 0.6 ? 0xffce66 : 0x57e38d;

		// 背景
		graphics
			.roundRect(-width / 2, -height / 2, width, height, 3)
			.fill({ color: 0x050c17, alpha: 0.95 });

		// 血量填充
		graphics.roundRect(-width / 2, -height / 2, fill, height, 3).fill({ color, alpha: 0.95 });

		// 高光
		graphics.rect(-width / 2, -height / 2, fill, Math.max(2, height * 0.28)).fill({
			color: 0xffffff,
			alpha: 0.2,
		});

		// 边框
		graphics.roundRect(-width / 2, -height / 2, width, height, 3).stroke({
			color: 0xb9dbff,
			alpha: 0.8,
			width: 1,
		});
	}

	/**
	 * 清除所有 HUD 元素
	 */
	clear(): void {
		for (const cached of this.cache.values()) {
			this.hpBarLayer.removeChild(cached.hpBar);
			this.labelLayer.removeChild(cached.label);
			cached.hpBar.destroy();
			cached.label.destroy();
		}
		this.cache.clear();
	}

	/**
	 * 销毁管理器（不销毁图层，图层由 useLayerSystem 管理）
	 */
	destroy(): void {
		this.clear();
	}
}

/**
 * React Hook: 舰船 HUD 渲染
 */
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export interface ShipHUDRenderOptions {
	/** 是否显示血条 */
	showHpBars?: boolean;
	/** 是否显示标签 */
	showLabels?: boolean;
}

export function useShipHUDRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	camera: { x: number; y: number; zoom: number; viewRotation: number },
	canvasSize: { width: number; height: number },
	options: ShipHUDRenderOptions = {}
) {
	const managerRef = useRef<ShipHUDManager | null>(null);

	// 创建 HUD 管理器
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

	// 更新 HUD 元素
	useEffect(() => {
		if (!managerRef.current || !layers) return;

		// 更新可见性
		layers.shipBars.visible = options.showHpBars ?? true;
		layers.shipNames.visible = options.showLabels ?? true;

		// 更新所有舰船 HUD
		managerRef.current.update(ships, camera, canvasSize);
	}, [layers, ships, camera, canvasSize, options.showHpBars, options.showLabels]);
}