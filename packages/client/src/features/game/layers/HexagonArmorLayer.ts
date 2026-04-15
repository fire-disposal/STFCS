/**
 * 六边形护甲图层渲染器
 *
 * 作为独立的 Pixi 图层，渲染所有舰船的六边形护甲指示器
 * 
 * 性能优化：
 * - 使用 Graphics 批量渲染，减少 Draw Call
 * - 只在护甲值变化时更新对应舰船
 * - 使用容器绑定舰船位置和角度，自动跟随
 */

import type { TokenInfo } from "@vt/types";
import { Container, Graphics, Text, TextStyle } from "pixi.js";

/**
 * 六边形护甲图层配置
 */
export interface HexagonArmorLayerConfig {
	/** 护甲颜色渐变起点（绿色） */
	colorGood?: number;
	/** 护甲颜色渐变中点（黄色） */
	colorMedium?: number;
	/** 护甲颜色渐变终点（红色） */
	colorLow?: number;
	/** 低护甲阈值（0-1） */
	thresholdLow?: number;
	/** 高护甲阈值（0-1） */
	thresholdHigh?: number;
	/** 六边形边线宽度 */
	lineWidth?: number;
	/** 六边形与舰船边缘的距离 */
	padding?: number;
	/** 是否显示数值标签 */
	showValues?: boolean;
}

const DEFAULT_CONFIG: HexagonArmorLayerConfig = {
	colorGood: 0x22c55e,
	colorMedium: 0xf59e0b,
	colorLow: 0xef4444,
	thresholdLow: 0.3,
	thresholdHigh: 0.7,
	lineWidth: 4,
	padding: 8,
	showValues: true,
};

/**
 * 单个舰船的护甲图形数据
 */
interface ShipArmorGraphics {
	container: Container;
	edges: Graphics[];
	outline: Graphics;
	labels: Text[];
	lastArmorValues: number[];
}

/**
 * 六边形护甲图层
 * 
 * 使用方法：
 * 1. 创建图层：const armorLayer = new HexagonArmorLayer();
 * 2. 添加到主容器：rootContainer.addChild(armorLayer);
 * 3. 更新图层：armorLayer.update(tokens, zoom);
 * 
 * 性能特性：
 * - 每个舰船使用独立容器，自动跟随舰船位置和角度
 * - 只在护甲值变化时更新颜色和透明度
 * - 使用 Graphics 批量绘制，减少 Draw Call
 */
export class HexagonArmorLayer extends Container {
	private config: HexagonArmorLayerConfig;
	private shipArmorMap: Map<string, ShipArmorGraphics>;
	private textStyles: Map<number, TextStyle>;

	constructor(config: HexagonArmorLayerConfig = {}) {
		super();
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.shipArmorMap = new Map();
		this.textStyles = new Map();
	}

	/**
	 * 更新图层内容
	 * @param tokens 所有 Token 数据
	 * @param zoom 当前缩放比例
	 */
	update(tokens: Record<string, TokenInfo>, zoom: number): void {
		const visibleShipIds = new Set<string>();

		// 更新或创建舰船 Token 的护甲图形
		Object.values(tokens).forEach((token) => {
			if (token.type !== "ship") return;

			const metadata = token.metadata as any;
			if (!metadata?.armor?.quadrants) return;

			visibleShipIds.add(token.id);

			// 如果已有图形，更新它
			if (this.shipArmorMap.has(token.id)) {
				const armorData = this.shipArmorMap.get(token.id)!;
				this.updateShipArmor(armorData, token, zoom);
			} else {
				// 否则创建新图形
				const armorData = this.createShipArmor(token, zoom);
				this.addChild(armorData.container);
				this.shipArmorMap.set(token.id, armorData);
			}
		});

		// 移除不存在的 Token 的护甲图形
		this.shipArmorMap.forEach((armorData, tokenId) => {
			if (!visibleShipIds.has(tokenId)) {
				this.removeChild(armorData.container);
				this.destroyShipArmor(armorData);
				this.shipArmorMap.delete(tokenId);
			}
		});
	}

	/**
	 * 创建单个舰船的护甲容器
	 */
	private createShipArmor(token: TokenInfo, zoom: number): ShipArmorGraphics {
		const container = new Container();
		
		// 绑定舰船位置和角度（关键：自动跟随）
		container.position.set(token.x, token.y);
		container.angle = token.heading;

		const metadata = token.metadata as any;
		const armorData = metadata?.armor;
		const armorOrder = [
			"FRONT_TOP",
			"RIGHT_TOP",
			"RIGHT_BOTTOM",
			"FRONT_BOTTOM",
			"LEFT_BOTTOM",
			"LEFT_TOP",
		];

		// 计算六边形顶点
		const vertices = this.calculateHexagonVertices(token, zoom);

		// 获取最大护甲值（每面）
		const maxArmorPerSide = armorData.maxPerQuadrant || (armorData.maxArmor / 6);

		// 创建 6 条边
		const edges: Graphics[] = [];
		const labels: Text[] = [];
		const armorValues: number[] = [];

		armorOrder.forEach((quadrant, index) => {
			const armorValue = armorData.quadrants[quadrant] ?? 0;
			armorValues.push(armorValue);

			const { color, alpha } = this.calculateArmorColor(armorValue, maxArmorPerSide);

			// 获取边的两个顶点
			const startVertex = vertices[index];
			const endVertex = vertices[(index + 1) % 6];

			// 创建边图形
			const edgeGraphics = new Graphics();
			edgeGraphics.setStrokeStyle({
				width: this.config.lineWidth!,
				color,
				alpha,
			});
			edgeGraphics.moveTo(startVertex.x, startVertex.y);
			edgeGraphics.lineTo(endVertex.x, endVertex.y);
			edgeGraphics.stroke();
			container.addChild(edgeGraphics);
			edges.push(edgeGraphics);

			// 创建数值标签
			if (this.config.showValues) {
				const label = this.createArmorLabel(armorValue, startVertex, endVertex, zoom);
				container.addChild(label);
				labels.push(label);
			}
		});

		// 创建六边形外框
		const outline = new Graphics();
		outline.setStrokeStyle({
			width: 1,
			color: 0xffffff,
			alpha: 0.3,
		});
		outline.moveTo(vertices[0].x, vertices[0].y);
		for (let i = 1; i < vertices.length; i++) {
			outline.lineTo(vertices[i].x, vertices[i].y);
		}
		outline.closePath();
		outline.stroke();
		container.addChild(outline);

		return {
			container,
			edges,
			outline,
			labels,
			lastArmorValues: armorValues,
		};
	}

	/**
	 * 更新单个舰船的护甲图形
	 */
	private updateShipArmor(
		armorData: ShipArmorGraphics,
		token: TokenInfo,
		zoom: number
	): void {
		// 更新位置和角度（确保跟随舰船）
		armorData.container.position.set(token.x, token.y);
		armorData.container.angle = token.heading;

		const metadata = token.metadata as any;
		const armorValues = metadata?.armor?.quadrants
			? [
					metadata.armor.quadrants.FRONT_TOP ?? 0,
					metadata.armor.quadrants.RIGHT_TOP ?? 0,
					metadata.armor.quadrants.RIGHT_BOTTOM ?? 0,
					metadata.armor.quadrants.FRONT_BOTTOM ?? 0,
					metadata.armor.quadrants.LEFT_BOTTOM ?? 0,
					metadata.armor.quadrants.LEFT_TOP ?? 0,
			  ]
			: [0, 0, 0, 0, 0, 0];

		const maxArmorPerSide = metadata?.armor?.maxPerQuadrant || (metadata?.armor?.maxArmor / 6);

		// 只在护甲值变化时更新
		let needsUpdate = false;
		for (let i = 0; i < 6; i++) {
			if (armorValues[i] !== armorData.lastArmorValues[i]) {
				needsUpdate = true;
				break;
			}
		}

		if (!needsUpdate) return;

		// 更新每条边的颜色
		armorData.edges.forEach((edgeGraphics, index) => {
			const armorValue = armorValues[index];
			const { color, alpha } = this.calculateArmorColor(armorValue, maxArmorPerSide);

			edgeGraphics.clear();
			edgeGraphics.setStrokeStyle({
				width: this.config.lineWidth!,
				color,
				alpha,
			});

			// 重新获取顶点（因为容器旋转了）
			const vertices = this.calculateHexagonVertices(token, zoom);
			const startVertex = vertices[index];
			const endVertex = vertices[(index + 1) % 6];

			edgeGraphics.moveTo(startVertex.x, startVertex.y);
			edgeGraphics.lineTo(endVertex.x, endVertex.y);
			edgeGraphics.stroke();
		});

		// 更新标签文本
		if (this.config.showValues && armorData.labels.length > 0) {
			const vertices = this.calculateHexagonVertices(token, zoom);
			armorData.labels.forEach((label, index) => {
				label.text = `${Math.round(armorValues[index])}`;
				const startVertex = vertices[index];
				const endVertex = vertices[(index + 1) % 6];
				const { x, y } = this.calculateLabelPosition(startVertex, endVertex);
				label.position.set(x, y);
			});
		}

		// 更新缓存
		armorData.lastArmorValues = armorValues;
	}

	/**
	 * 计算六边形顶点
	 */
	private calculateHexagonVertices(token: TokenInfo, zoom: number): Array<{ x: number; y: number }> {
		const tokenSize = token.size;
		const hexRadius = tokenSize * 0.5 + this.config.padding!;

		// 六边形顶点角度（从 -90 度开始，顺时针）
		const hexAngles = [
			-90, // 0: 顶部 (FRONT_TOP)
			-30, // 1: 右上 (RIGHT_TOP)
			30, // 2: 右下 (RIGHT_BOTTOM)
			90, // 3: 底部 (FRONT_BOTTOM)
			150, // 4: 左下 (LEFT_BOTTOM)
			210, // 5: 左上 (LEFT_TOP)
		];

		return hexAngles.map((angle) => {
			const rad = (angle * Math.PI) / 180;
			return {
				x: Math.cos(rad) * hexRadius,
				y: Math.sin(rad) * hexRadius,
			};
		});
	}

	/**
	 * 计算护甲颜色
	 */
	private calculateArmorColor(armorValue: number, maxArmor: number): { color: number; alpha: number } {
		if (armorValue <= 0) {
			// 护甲归零：透明灰色
			return { color: 0x888888, alpha: 0.2 };
		}

		const armorPercent = maxArmor > 0 ? armorValue / maxArmor : 0;

		if (armorPercent >= this.config.thresholdHigh!) {
			return { color: this.config.colorGood!, alpha: 0.9 };
		} else if (armorPercent >= this.config.thresholdLow!) {
			return { color: this.config.colorMedium!, alpha: 0.8 };
		} else {
			return { color: this.config.colorLow!, alpha: 0.7 };
		}
	}

	/**
	 * 计算标签位置
	 */
	private calculateLabelPosition(
		startVertex: { x: number; y: number },
		endVertex: { x: number; y: number }
	): { x: number; y: number } {
		const midX = (startVertex.x + endVertex.x) / 2;
		const midY = (startVertex.y + endVertex.y) / 2;

		// 向中心偏移
		const labelOffset = 12;
		const angleToCenter = Math.atan2(-midY, -midX);
		const labelX = midX + Math.cos(angleToCenter) * labelOffset;
		const labelY = midY + Math.sin(angleToCenter) * labelOffset;

		return { x: labelX, y: labelY };
	}

	/**
	 * 创建护甲标签
	 */
	private createArmorLabel(
		armorValue: number,
		startVertex: { x: number; y: number },
		endVertex: { x: number; y: number },
		zoom: number
	): Text {
		const { x, y } = this.calculateLabelPosition(startVertex, endVertex);

		const baseFontSize = 8;
		const style = this.getTextStyle(baseFontSize, zoom);

		const label = new Text({
			text: `${Math.round(armorValue)}`,
			style,
		});
		label.anchor.set(0.5, 0.5);
		label.position.set(x, y);

		return label;
	}

	/**
	 * 获取或创建文本样式（缓存）
	 */
	private getTextStyle(baseFontSize: number, zoom: number): TextStyle {
		const zoomKey = zoom;
		if (!this.textStyles.has(zoomKey)) {
			this.textStyles.set(zoomKey, new TextStyle({
				fontSize: baseFontSize / zoom,
				fill: 0xffffff,
				stroke: 0x000000,
				strokeThickness: 2,
				fontWeight: "bold",
			}));
		}
		return this.textStyles.get(zoomKey)!;
	}

	/**
	 * 销毁舰船护甲图形
	 */
	private destroyShipArmor(armorData: ShipArmorGraphics): void {
		armorData.edges.forEach((edge) => edge.destroy());
		armorData.outline.destroy();
		armorData.labels.forEach((label) => label.destroy());
		armorData.container.destroy({ children: true });
	}

	/**
	 * 清除图层
	 */
	clear(): void {
		this.shipArmorMap.forEach((armorData) => {
			this.destroyShipArmor(armorData);
		});
		this.shipArmorMap.clear();
		this.removeChildren();
	}
}
