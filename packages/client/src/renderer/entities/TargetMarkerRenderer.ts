/**
 * TargetMarkerRenderer - 目标可攻击性标记渲染
 *
 * 参考 GDD 9.2 目标舰船状态：
 * - 可攻击目标：绿色光环
 * - 不可攻击目标：灰色×标记
 * - Hovered 目标：高亮光环
 */

import type { ShipState } from "@/sync/types";
import type { TargetAttackability } from "@/sync";
import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

interface MarkerMeta {
	graphics: Graphics;
	shipId: string;
}

export interface TargetMarkerOptions {
	/** 可攻击光环颜色 */
	attackableColor?: number;
	/** 不可攻击标记颜色 */
	notAttackableColor?: number;
	/** hovered 高亮颜色 */
	hoveredColor?: number;
	/** 光环半径 */
	radius?: number;
	/** 光环线宽 */
	lineWidth?: number;
	/** 光环透明度 */
	alpha?: number;
}

interface ResolvedTargetMarkerOptions {
	attackableColor: number;
	notAttackableColor: number;
	hoveredColor: number;
	radius: number;
	lineWidth: number;
	alpha: number;
}

const DEFAULT_OPTIONS: ResolvedTargetMarkerOptions = {
	attackableColor: 0x00ff00,    // 绿色
	notAttackableColor: 0x888888, // 灰色
	hoveredColor: 0xffff00,       // 黄色（高亮）
	radius: 40,
	lineWidth: 3,
	alpha: 0.8,
};

/**
 * 目标标记渲染 Hook
 *
 * 根据 attackableTargets 数组渲染目标舰船的可攻击性标记
 */
export function useTargetMarkers(
	layers: LayerRegistry | null,
	ships: ShipState[],
	attackableTargets: TargetAttackability[],
	hoveredTargetId: string | null | undefined,
	options: TargetMarkerOptions = {}
) {
	const markerGraphicsRef = useRef<MarkerMeta[]>([]);
	const lastTargetsRef = useRef<string>("");

	const mergedOptions: ResolvedTargetMarkerOptions = {
		attackableColor: options.attackableColor ?? DEFAULT_OPTIONS.attackableColor,
		notAttackableColor: options.notAttackableColor ?? DEFAULT_OPTIONS.notAttackableColor,
		hoveredColor: options.hoveredColor ?? DEFAULT_OPTIONS.hoveredColor,
		radius: options.radius ?? DEFAULT_OPTIONS.radius,
		lineWidth: options.lineWidth ?? DEFAULT_OPTIONS.lineWidth,
		alpha: options.alpha ?? DEFAULT_OPTIONS.alpha,
	};

	useEffect(() => {
		if (!layers) return;

		// 清除旧标记
		markerGraphicsRef.current.forEach((meta) => {
			if (layers.tacticalTokens.children.includes(meta.graphics)) {
				layers.tacticalTokens.removeChild(meta.graphics);
			}
		});
		markerGraphicsRef.current = [];

		// 没有目标需要标记
		if (attackableTargets.length === 0) return;

		// 为每个目标创建标记
		attackableTargets.forEach((target) => {
			const ship = ships.find((s) => s.id === target.shipId);
			if (!ship) return;

			const graphics = new Graphics();
			const isHovered = hoveredTargetId === target.shipId;

			// 绘制标记
			drawTargetMarker(graphics, ship, target, isHovered, mergedOptions);

			// 添加到 layer（使用 tacticalTokens 作为舰船标记图层）
			layers.tacticalTokens.addChild(graphics);
			markerGraphicsRef.current.push({
				graphics,
				shipId: target.shipId,
			});
		});

		// 更新 targets 签名（用于调试）
		lastTargetsRef.current = attackableTargets.map((t) => t.shipId).join(",");
	}, [
		layers,
		ships,
		attackableTargets,
		hoveredTargetId,
		mergedOptions.attackableColor,
		mergedOptions.notAttackableColor,
		mergedOptions.hoveredColor,
		mergedOptions.radius,
		mergedOptions.lineWidth,
		mergedOptions.alpha,
	]);

	// 清理
	useEffect(() => {
		return () => {
			markerGraphicsRef.current.forEach((meta) => {
				if (layers?.tacticalTokens.children.includes(meta.graphics)) {
					layers.tacticalTokens.removeChild(meta.graphics);
				}
			});
		};
	}, [layers]);
}

/**
 * 绘制目标标记
 */
function drawTargetMarker(
	graphics: Graphics,
	ship: ShipState,
	target: TargetAttackability,
	isHovered: boolean,
	options: ResolvedTargetMarkerOptions
) {
	graphics.clear();
	graphics.position.set(ship.transform.x, ship.transform.y);

	const radius = options.radius;
	const lineWidth = options.lineWidth;
	const alpha = isHovered ? 1 : options.alpha;

	// 计算舰船大小（用于光环半径）
	const shipRadius = Math.max(ship.width || 30, ship.length || 30) / 2 + 10;
	const actualRadius = Math.max(radius, shipRadius);

	if (target.canAttack) {
		// 可攻击：绿色光环
		const color = isHovered ? options.hoveredColor : options.attackableColor;
		graphics.circle(0, 0, actualRadius);
		graphics.stroke({ color, width: lineWidth, alpha });

		// 内部填充（半透明）
		graphics.circle(0, 0, actualRadius - lineWidth / 2);
		graphics.fill({ color, alpha: 0.1 });

		// 如果 hovered，添加 pulsing 效果（由外部动画控制）
	} else {
		// 不可攻击：灰色×标记
		const color = options.notAttackableColor;

		// 绘制 × 标记
		const crossSize = actualRadius * 0.6;
		graphics.moveTo(-crossSize, -crossSize);
		graphics.lineTo(crossSize, crossSize);
		graphics.moveTo(crossSize, -crossSize);
		graphics.lineTo(-crossSize, crossSize);
		graphics.stroke({ color, width: lineWidth, alpha });

		// 绘制虚线圆圈
		graphics.circle(0, 0, actualRadius);
		graphics.stroke({ color, width: lineWidth * 0.5, alpha: alpha * 0.5 });
	}

	// 添加距离标注（如果不可攻击）
	if (!target.canAttack && target.reason) {
		// 使用 BitmapText 需要额外设置，这里用简单的 Graphics 代替
		// 实际项目中可以添加 Pixi Text
	}
}

/**
 * 更新目标标记位置（舰船移动时调用）
 */
export function updateTargetMarkerPosition(
	graphics: Graphics,
	ship: ShipState
) {
	graphics.position.set(ship.transform.x, ship.transform.y);
}

// 导出辅助函数
export { drawTargetMarker };