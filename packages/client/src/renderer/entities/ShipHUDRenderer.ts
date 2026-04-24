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
 * - 格式：[050/300]|||||
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

import type { CombatToken, RoomPlayerState } from "@vt/data";
import { FactionColors } from "@vt/data";
import { Text, TextStyle, Container } from "pixi.js";
import { worldToScreen } from "../core/useLayerSystem";
import { useUIStore } from "@/state/stores/uiStore";

const HP_BAR_OFFSET_Y = -60;
const LABEL_OFFSET_Y = 45;
const OWNER_LABEL_OFFSET_Y = 60;
const DEFAULT_HULL_MAX = 100;

const labelStyle = new TextStyle({
	fill: 0xcfe8ff,
	fontSize: 15,
	fontFamily: '"Fira Code", "Arial", sans-serif',
	fontWeight: "600",
	stroke: { color: 0x081423, width: 2 },
	dropShadow: {
		color: 0x081423,
		alpha: 0.5,
		blur: 1,
		distance: 1,
	},
});

/** 所有者标签样式选项（纯对象，避免 spread TextStyle 实例丢失属性） */
const ownerLabelStyleOptions = {
	fontSize: 13,
	fontFamily: '"Fira Code", "Arial", sans-serif',
	fontWeight: "600",
	stroke: { color: 0x081423, width: 2 },
	dropShadow: {
		color: 0x081423,
		alpha: 0.5,
		blur: 1,
		distance: 1,
	},
} as const;

const getHpColor = (hpPercent: number): number => {
	if (hpPercent >= 0.6) return 0x57e38d;
	if (hpPercent >= 0.3) return 0xffce66;
	return 0xff5d7e;
};

interface ShipHUDCache {
	hpBarContainer: Container;
	label: Text;
	ownerLabel: Text | null;
	lastUpdate: {
		worldX: number;
		worldY: number;
		hpPercent: number;
		currentHp: number;
		maxHp: number;
		name: string;
		displayName: string;
		ownerName: string;
		ownerColor: number;
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
	private players: Record<string, RoomPlayerState> = {};

	constructor(hudLayers: { shipBars: Container; shipNames: Container }) {
		this.hpBarLayer = hudLayers.shipBars;
		this.labelLayer = hudLayers.shipNames;
	}

	setPlayers(players: Record<string, RoomPlayerState>): void {
		this.players = players;
	}

	update(
		ships: CombatToken[],
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number },
		selectedShipId: string | null = null,
		hpPerBar: number = 20,
		defaultHullMax: number = DEFAULT_HULL_MAX
	): void {
		const currentIds = new Set(ships.map((s) => s.$id));

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

			const isSelected = ship.$id === selectedShipId;
			const cached = this.cache.get(ship.$id);
			if (!cached) {
				this.createShipHUD(ship, isSelected, camera, canvasSize, hpPerBar, defaultHullMax);
			} else {
				this.updateShipHUD(ship, isSelected, cached, camera, canvasSize, hpPerBar, defaultHullMax);
			}
		}

		this.lastCamera = { ...camera };
	}

	private createShipHUD(
		ship: CombatToken,
		isSelected: boolean,
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number },
		hpPerBar: number,
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

		const hpBarContainer = this.createHpBarContainer(ship.runtime.hull, hullMax, hpPercent, isSelected, hpPerBar);
		hpBarContainer.position.set(screenX, screenY + HP_BAR_OFFSET_Y);

		const label = new Text({
			text: this.formatLabel(ship),
			style: labelStyle,
		});
		label.anchor.set(0.5, 0);
		label.position.set(screenX, screenY + LABEL_OFFSET_Y);

		this.hpBarLayer.addChild(hpBarContainer);
		this.labelLayer.addChild(label);

		// 所有者标签（有 ownerId 时显示）
		const ownerName = this.getOwnerName(ship);
		const ownerColor = this.getOwnerColor(ship);
		let ownerLabel: Text | null = null;
		if (ownerName) {
			const ownerStyle = new TextStyle({
				...ownerLabelStyleOptions,
				fill: ownerColor,
			});
			ownerLabel = new Text({
				text: ownerName,
				style: ownerStyle,
			});
			ownerLabel.anchor.set(0.5, 0);
			ownerLabel.position.set(screenX, screenY + OWNER_LABEL_OFFSET_Y);
			this.labelLayer.addChild(ownerLabel);
		}

		this.cache.set(ship.$id, {
			hpBarContainer,
			label,
			ownerLabel,
			lastUpdate: {
				worldX: ship.runtime.position.x,
				worldY: ship.runtime.position.y,
				hpPercent,
				currentHp: ship.runtime.hull,
				maxHp: hullMax,
				name: ship.metadata?.name || ship.$id,
				displayName: this.getDisplayName(ship),
				ownerName: ownerName ?? "",
				ownerColor: ownerColor,
				selected: isSelected,
			},
		});
	}

	private updateShipHUD(
		ship: CombatToken,
		isSelected: boolean,
		cached: ShipHUDCache,
		camera: CameraSnapshot,
		canvasSize: { width: number; height: number },
		hpPerBar: number,
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
			if (cached.ownerLabel) {
				cached.ownerLabel.position.set(screenX, screenY + OWNER_LABEL_OFFSET_Y);
			}
		}

		const hpPercent = ship.runtime.hull / hullMax;
		const hpChanged = ship.runtime.hull !== last.currentHp || hullMax !== last.maxHp;
		const selectedChanged = isSelected !== last.selected;

		if (hpChanged || selectedChanged) {
			this.updateHpBarContainer(cached.hpBarContainer, ship.runtime.hull, hullMax, hpPercent, isSelected, hpPerBar);
		}

		const newName = ship.metadata?.name || ship.$id;
		const newDisplayName = this.getDisplayName(ship);
		const nameChanged = newName !== last.name;
		const displayNameChanged = newDisplayName !== last.displayName;

		if (displayNameChanged || nameChanged) {
			cached.label.text = this.formatLabel(ship);
		}

		// 更新所有者标签
		const newOwnerName = this.getOwnerName(ship);
		const newOwnerColor = this.getOwnerColor(ship);
		const ownerChanged = newOwnerName !== last.ownerName || newOwnerColor !== last.ownerColor;
		if (ownerChanged) {
			if (cached.ownerLabel) {
				this.labelLayer.removeChild(cached.ownerLabel);
				cached.ownerLabel.destroy();
				cached.ownerLabel = null;
			}
			if (newOwnerName) {
				const ownerStyle = new TextStyle({
					...ownerLabelStyleOptions,
					fill: newOwnerColor,
				});
				cached.ownerLabel = new Text({
					text: newOwnerName,
					style: ownerStyle,
				});
				cached.ownerLabel.anchor.set(0.5, 0);
				const { screenX, screenY } = worldToScreen(
					ship.runtime.position.x,
					ship.runtime.position.y,
					camera,
					canvasSize
				);
				cached.ownerLabel.position.set(screenX, screenY + OWNER_LABEL_OFFSET_Y);
				this.labelLayer.addChild(cached.ownerLabel);
			}
		}

		cached.lastUpdate = {
			worldX: ship.runtime.position.x,
			worldY: ship.runtime.position.y,
			hpPercent,
			currentHp: ship.runtime.hull,
			maxHp: hullMax,
			name: newName,
			displayName: newDisplayName,
			ownerName: newOwnerName ?? "",
			ownerColor: newOwnerColor,
			selected: isSelected,
		};
	}

	private formatLabel(ship: CombatToken): string {
		return ship.runtime?.displayName ?? ship.metadata?.name ?? ship.$id.slice(-6);
	}

	private getDisplayName(ship: CombatToken): string {
		return ship.runtime?.displayName ?? ship.metadata?.name ?? ship.$id.slice(-6);
	}

	/**
	 * 获取舰船所有者名称
	 * 从 metadata.owner 获取，如果存在则返回玩家昵称
	 */
	private getOwnerName(ship: CombatToken): string | null {
		const ownerId = ship.runtime?.ownerId ?? ship.metadata?.owner;
		if (!ownerId) return null;
		// 通过 players 映射查找玩家昵称
		const player = this.players[ownerId];
		if (player) {
			return player.nickname;
		}
		// 找不到时返回 ownerId 作为后备
		return ownerId;
	}

	/**
	 * 获取所有者标签颜色
	 * 优先使用玩家所属派系的主题色，无派系时使用舰船名称颜色
	 */
	private getOwnerColor(ship: CombatToken): number {
		const ownerId = ship.runtime?.ownerId ?? ship.metadata?.owner;
		if (ownerId) {
			const player = this.players[ownerId];
			if (player?.faction) {
				return FactionColors[player.faction as keyof typeof FactionColors] ?? 0xcfe8ff;
			}
		}
		// 无所有者或无派系时使用舰船名称颜色
		return 0xcfe8ff;
	}

	private createHpBarContainer(currentHp: number, maxHp: number, hpPercent: number, isSelected: boolean, hpPerBar: number): Container {
		const container = new Container();
		this.updateHpBarContainer(container, currentHp, maxHp, hpPercent, isSelected, hpPerBar);
		return container;
	}

	private updateHpBarContainer(container: Container, currentHp: number, maxHp: number, hpPercent: number, isSelected: boolean, hpPerBar: number): void {
		container.removeChildren();

		// 血条数量由 hpPerBar（全局可配置）和舰船 maxHitPoints 决定
		const barWidth = 10;
		const totalBars = Math.max(1, Math.ceil(maxHp / hpPerBar));
		const filledBars = Math.min(Math.ceil(currentHp / hpPerBar), totalBars);
		const emptyBars = totalBars - filledBars;

		const hpColor = getHpColor(hpPercent);
		const baseAlpha = isSelected ? 1.0 : 0.85;

		const filledStyle = new TextStyle({
			fill: hpColor,
			fontSize: 19,
			fontFamily: '"Fira Code", monospace',
			fontWeight: "500",
		});

		const emptyStyle = new TextStyle({
			fill: 0xffffff,
			fontSize: 19,
			fontFamily: '"Fira Code", monospace',
			fontWeight: "500",
		});

		const centerStyle = new TextStyle({
			fill: hpColor,
			fontSize: 19,
			fontFamily: '"Fira Code", monospace',
			fontWeight: "500",
		});

		// 整体居中：计算 [数字] + ▐▐▐▐▐ 的总宽度，整体偏移使中心对齐
		const centerText = new Text({
			text: `[${this.formatHpNumber(Math.round(currentHp), Math.round(maxHp))}/${Math.round(maxHp)}]`,
			style: centerStyle,
		});
		centerText.anchor.set(0, 0.5);
		centerText.alpha = baseAlpha;

		const totalBarWidth = (filledBars + emptyBars) * barWidth;
		const totalWidth = centerText.width + 4 + totalBarWidth;
		centerText.x = -totalWidth / 2;
		container.addChild(centerText);

		// 条从数字右侧开始排列
		let x = centerText.x + centerText.width + 4;
		for (let i = 0; i < filledBars; i++) {
			const bar = new Text({ text: "▐", style: filledStyle });
			bar.anchor.set(0, 0.5);
			bar.x = x;
			bar.alpha = baseAlpha;
			container.addChild(bar);
			x += barWidth;
		}

		for (let i = 0; i < emptyBars; i++) {
			const bar = new Text({ text: "▐", style: emptyStyle });
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
			if (cached.ownerLabel) {
				this.labelLayer.removeChild(cached.ownerLabel);
				cached.ownerLabel.destroy();
			}
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
	ships: CombatToken[],
	camera: { x: number; y: number; zoom: number; viewRotation: number },
	canvasSize: { width: number; height: number },
	selectedShipId: string | null = null,
	options: ShipHUDRenderOptions = {},
	players: Record<string, RoomPlayerState> = {}
) {
	const managerRef = useRef<ShipHUDManager | null>(null);
	const hpPerBar = useUIStore((state) => state.hpPerBar);
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

		managerRef.current.setPlayers(players);
		managerRef.current.update(ships, camera, canvasSize, selectedShipId, hpPerBar, defaultHullMax);
	}, [layers, ships, camera, canvasSize, selectedShipId, options.showHpBars, options.showLabels, defaultHullMax, hpPerBar, players]);
}