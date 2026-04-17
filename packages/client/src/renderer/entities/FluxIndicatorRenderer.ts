/**
 * 辐能/过载状态指示器渲染器
 *
 * 渲染策略：
 * - 在舰船周围显示辐能条（环形进度条风格）
 * - 辐能条颜色：蓝色（正常）→ 黄色（接近上限）→ 红色（即将过载）
 * - 过载状态时显示过载警告图标和剩余时间
 * - 排散状态时显示排散进度动画
 *
 * 设计文档要求：
 * - Token上方显示辐能值和结构值
 * - 点选Token后可查看各区域护甲状况
 */

import type { LayerRegistry } from "../core/useLayerSystem";
import type { ShipState } from "@/sync/types";
import { Faction, FluxState } from "@/sync/types";
import { Container, Graphics, Text, TextStyle } from "pixi.js";
import { useEffect, useRef } from "react";
import { useUIStore } from "@/state/stores/uiStore";

/** 辐能环半径偏移（相对于舰船） */
const FLUX_RING_RADIUS = 45;

/** 辐能环宽度 */
const FLUX_RING_WIDTH = 6;

/** 过载警告图标大小 */
const OVERLOAD_ICON_SIZE = 16;

/** 过载时间文本偏移 */
const OVERLOAD_TEXT_OFFSET_Y = 20;

/** 辐能百分比阈值 */
const FLUX_WARNING_THRESHOLD = 0.7;   // 70% - 黄色警告
const FLUX_CRITICAL_THRESHOLD = 0.9;  // 90% - 红色临界

/** 阵营颜色 */
const FACTION_COLORS: Record<string, number> = {
	[Faction.PLAYER]: 0x4fc3ff,
	[Faction.DM]: 0xff7f9f,
};

/** 辐能环颜色 */
const FLUX_COLORS = {
	NORMAL: 0x4fc3ff,      // 蓝色 - 正常
	WARNING: 0xffce66,     // 黄色 - 接近上限
	CRITICAL: 0xff5d7e,    // 红色 - 即将过载
	OVERLOADED: 0xff2d4a,  // 深红 - 过载状态
	VENTING: 0x57e38d,     // 绿色 - 排散状态
};

/** 过载时间文本样式 */
const overloadTextStyle = new TextStyle({
	fill: 0xff5d7e,
	fontSize: 10,
	fontFamily: "Arial, sans-serif",
	fontWeight: "bold",
	stroke: { color: 0x081423, width: 2 },
});

/**
 * 获取辐能环颜色
 */
function getFluxColor(fluxPercent: number, fluxState: string): number {
	if (fluxState === FluxState.OVERLOADED) return FLUX_COLORS.OVERLOADED;
	if (fluxState === FluxState.VENTING) return FLUX_COLORS.VENTING;
	if (fluxPercent >= FLUX_CRITICAL_THRESHOLD) return FLUX_COLORS.CRITICAL;
	if (fluxPercent >= FLUX_WARNING_THRESHOLD) return FLUX_COLORS.WARNING;
	return FLUX_COLORS.NORMAL;
}

/**
 * 绘制辐能环（环形进度条）
 */
function drawFluxRing(
	graphics: Graphics,
	radius: number,
	fluxPercent: number,
	fluxState: string
): void {
	graphics.clear();

	const width = FLUX_RING_WIDTH;
	const color = getFluxColor(fluxPercent, fluxState);

	// 过载状态：显示完整红色环 + 脉冲效果（通过透明度变化模拟）
	if (fluxState === FluxState.OVERLOADED) {
		// 绘制完整红色环
		graphics.arc(0, 0, radius, 0, Math.PI * 2);
		graphics.stroke({ color: FLUX_COLORS.OVERLOADED, width, alpha: 0.8 });

		// 内层闪烁环（模拟脉冲）
		graphics.arc(0, 0, radius - width / 2, 0, Math.PI * 2);
		graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.3 });
		return;
	}

	// 排散状态：显示绿色环，逐渐减少
	if (fluxState === FluxState.VENTING) {
		const ventAngle = Math.PI * 2 * (1 - fluxPercent);
		graphics.arc(0, 0, radius, 0, ventAngle);
		graphics.stroke({ color: FLUX_COLORS.VENTING, width, alpha: 0.9 });

		// 显示排散进度文本（可选）
		return;
	}

	// 正常状态：显示辐能进度环
	const fluxAngle = Math.PI * 2 * fluxPercent;

	// 背景环（灰色）
	graphics.arc(0, 0, radius, 0, Math.PI * 2);
	graphics.stroke({ color: 0x1a2a3a, width: width, alpha: 0.5 });

	// 进度环（彩色）
	graphics.arc(0, 0, radius, -Math.PI / 2, -Math.PI / 2 + fluxAngle);
	graphics.stroke({ color, width, alpha: 0.95 });

	// 高光效果
	graphics.arc(0, 0, radius + 2, -Math.PI / 2, -Math.PI / 2 + fluxAngle);
	graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.2 });
}

/**
 * 绘制过载警告图标（闪电形状）
 */
function drawOverloadWarning(graphics: Graphics, size: number): void {
	graphics.clear();

	// 闪电形状
	const halfSize = size / 2;
	graphics.poly([
		halfSize * 0.3, -halfSize,
		halfSize * 0.8, -halfSize * 0.2,
		halfSize * 0.4, -halfSize * 0.2,
		halfSize, halfSize,
		halfSize * 0.2, halfSize * 0.2,
		halfSize * 0.6, halfSize * 0.2,
		-halfSize, -halfSize * 0.3,
	]);
	graphics.fill({ color: 0xff5d7e, alpha: 0.9 });
	graphics.stroke({ color: 0xffffff, width: 1, alpha: 0.5 });
}

export interface FluxIndicatorCacheItem {
	root: Container;
	fluxRing: Graphics;
	overloadIcon: Graphics;
	overloadText: Text;
	lastState?: {
		x: number;
		y: number;
		heading: number;
		fluxPercent: number;
		fluxState: string;
		isOverloaded: boolean;
		overloadTime: number;
	};
}

export interface FluxIndicatorOptions {
	/** 是否显示辐能指示器 */
	show?: boolean;
}

export function useFluxIndicatorRendering(
	layers: LayerRegistry | null,
	ships: ShipState[],
	options: FluxIndicatorOptions = {}
) {
	const cacheRef = useRef<Map<string, FluxIndicatorCacheItem>>(new Map());
	const showFluxIndicators = useUIStore((state) => state.showFluxIndicators);
	const show = options.show ?? showFluxIndicators;

	useEffect(() => {
		if (!layers) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.id));

		// 清理已删除舰船的辐能指示器
		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.fluxIndicators.removeChild(item.root);
				cache.delete(id);
			}
		}

		// 更新或创建辐能指示器
		for (const ship of ships) {
			const cached = cache.get(ship.id);
			if (!cached) {
				createFluxIndicator(layers, cache, ship);
				continue;
			}

			if (shouldUpdateFlux(cached, ship)) {
				updateFluxIndicator(cached, ship);
			}
		}

		// 控制图层可见性
		layers.fluxIndicators.visible = show;
	}, [layers, ships, show]);

	useEffect(() => {
		return () => {
			cacheRef.current.clear();
		};
	}, []);
}

function shouldUpdateFlux(cached: FluxIndicatorCacheItem, ship: ShipState): boolean {
	if (!cached.lastState) return true;

	const last = cached.lastState;

	// 位置变化
	const dx = Math.abs(ship.transform.x - last.x);
	const dy = Math.abs(ship.transform.y - last.y);
	const dHeading = Math.abs(ship.transform.heading - last.heading);

	// 辐能状态变化
	const fluxPercent = ship.flux.percent / 100;
	const fluxChanged =
		fluxPercent !== last.fluxPercent ||
		ship.flux.state !== last.fluxState ||
		ship.isOverloaded !== last.isOverloaded ||
		ship.overloadTime !== last.overloadTime;

	return dx > 0.5 || dy > 0.5 || dHeading > 1 || fluxChanged;
}

function createFluxIndicator(
	layers: LayerRegistry,
	cache: Map<string, FluxIndicatorCacheItem>,
	ship: ShipState
): void {
	const root = new Container();
	root.position.set(ship.transform.x, ship.transform.y);
	root.rotation = (ship.transform.heading * Math.PI) / 180;

	const radius = FLUX_RING_RADIUS;

	// 辐能环
	const fluxRing = new Graphics();
	drawFluxRing(fluxRing, radius, ship.flux.percent / 100, ship.flux.state);
	root.addChild(fluxRing);

	// 过载警告图标
	const overloadIcon = new Graphics();
	if (ship.isOverloaded) {
		drawOverloadWarning(overloadIcon, OVERLOAD_ICON_SIZE);
	}
	overloadIcon.position.set(0, -radius - OVERLOAD_ICON_SIZE / 2);
	overloadIcon.visible = ship.isOverloaded;
	root.addChild(overloadIcon);

	// 过载时间文本
	const overloadText = new Text({
		text: formatOverloadTime(ship.overloadTime),
		style: overloadTextStyle,
	});
	overloadText.anchor.set(0.5, 0.5);
	overloadText.position.set(0, -radius - OVERLOAD_TEXT_OFFSET_Y);
	overloadText.visible = ship.isOverloaded && ship.overloadTime > 0;
	root.addChild(overloadText);

	layers.fluxIndicators.addChild(root);

	cache.set(ship.id, {
		root,
		fluxRing,
		overloadIcon,
		overloadText,
		lastState: {
			x: ship.transform.x,
			y: ship.transform.y,
			heading: ship.transform.heading,
			fluxPercent: ship.flux.percent / 100,
			fluxState: ship.flux.state,
			isOverloaded: ship.isOverloaded,
			overloadTime: ship.overloadTime,
		},
	});
}

function updateFluxIndicator(cached: FluxIndicatorCacheItem, ship: ShipState): void {
	cached.root.position.set(ship.transform.x, ship.transform.y);
	// 辐能环不随舰船旋转（保持固定方向，便于玩家阅读）
	// cached.root.rotation = (ship.transform.heading * Math.PI) / 180;

	const radius = FLUX_RING_RADIUS;
	const fluxPercent = ship.flux.percent / 100;

	// 更新辐能环
	drawFluxRing(cached.fluxRing, radius, fluxPercent, ship.flux.state);

	// 更新过载警告图标
	cached.overloadIcon.visible = ship.isOverloaded;
	if (ship.isOverloaded) {
		drawOverloadWarning(cached.overloadIcon, OVERLOAD_ICON_SIZE);
	}

	// 更新过载时间文本
	cached.overloadText.visible = ship.isOverloaded && ship.overloadTime > 0;
	if (ship.isOverloaded && ship.overloadTime > 0) {
		cached.overloadText.text = formatOverloadTime(ship.overloadTime);
	}

	cached.lastState = {
		x: ship.transform.x,
		y: ship.transform.y,
		heading: ship.transform.heading,
		fluxPercent,
		fluxState: ship.flux.state,
		isOverloaded: ship.isOverloaded,
		overloadTime: ship.overloadTime,
	};
}

/**
 * 格式化过载时间显示
 */
function formatOverloadTime(time: number): string {
	if (time <= 0) return "";
	const seconds = Math.ceil(time);
	return `${seconds}s`;
}