import { Container, Graphics, Text, TextStyle } from "pixi.js";

/**
 * 武器射程渲染器配置
 */
export interface WeaponRangeConfig {
	position: { x: number; y: number };
	heading: number;
	weapons: WeaponMountData[];
	showRanges: boolean;
}

/**
 * 武器挂载数据
 */
export interface WeaponMountData {
	id: string;
	name: string;
	mountType: "fixed" | "turret";
	range: number;
	arc: number;
	arcMin?: number;
	arcMax?: number;
	damage?: number;
	fluxCost?: number;
}

/**
 * 武器颜色配置
 */
const WEAPON_COLORS = {
	ballistic: 0xffaa4a, // 动能武器 - 橙色
	energy: 0x4affaa, // 能量武器 - 青色
	missile: 0xff4a4a, // 导弹 - 红色
	pd: 0xaaffff, // 点防御 - 浅蓝
} as const;

/**
 * 渲染武器射程范围
 * @param layer 武器图层
 * @param config 武器配置
 */
export function renderWeaponRanges(layer: Container, config: WeaponRangeConfig): void {
	layer.removeChildren();

	if (!config.showRanges || !config.weapons || config.weapons.length === 0) {
		return;
	}

	const container = new Container();
	container.position.set(config.position.x, config.position.y);
	container.rotation = (config.heading * Math.PI) / 180;

	config.weapons.forEach((weapon) => {
		const weaponGraphics = new Graphics();
		const color = getWeaponColor(weapon);

		// 计算武器弧度和角度限制
		let arcMin = weapon.arcMin ?? -weapon.arc / 2;
		let arcMax = weapon.arcMax ?? weapon.arc / 2;

		// 炮塔可以自定义旋转
		if (weapon.mountType === "turret") {
			// 炮塔可以 360 度旋转，这里显示最大射程
			arcMin = -180;
			arcMax = 180;
		}

		// 绘制射程扇形
		drawRangeArc(weaponGraphics, weapon.range, arcMin, arcMax, color);

		// 添加武器标签
		if (weapon.name) {
			const label = createWeaponLabel(weapon, weapon.range);
			label.position.set(
				Math.cos(((arcMin + arcMax) / 2) * (Math.PI / 180)) * weapon.range * 0.7,
				Math.sin(((arcMin + arcMax) / 2) * (Math.PI / 180)) * weapon.range * 0.7
			);
			weaponGraphics.addChild(label);
		}

		container.addChild(weaponGraphics);
	});

	layer.addChild(container);
}

/**
 * 绘制射程弧线
 */
function drawRangeArc(
	graphics: Graphics,
	range: number,
	arcMin: number,
	arcMax: number,
	color: number
): void {
	const alpha = 0.15;
	const strokeAlpha = 0.5;

	// 转换为弧度
	const startAngle = arcMin * (Math.PI / 180);
	const endAngle = arcMax * (Math.PI / 180);

	// 绘制扇形区域
	graphics.moveTo(0, 0);
	graphics.arc(0, 0, range, startAngle, endAngle);
	graphics.closePath();

	// 填充半透明颜色
	graphics.fill({ color, alpha });

	// 绘制弧线边缘
	graphics.setStrokeStyle({ width: 1, color, alpha: strokeAlpha });
	graphics.arc(0, 0, range, startAngle, endAngle);
	graphics.stroke();

	// 绘制径向边界线
	graphics.moveTo(0, 0);
	graphics.lineTo(Math.cos(startAngle) * range, Math.sin(startAngle) * range);
	graphics.stroke();

	graphics.moveTo(0, 0);
	graphics.lineTo(Math.cos(endAngle) * range, Math.sin(endAngle) * range);
	graphics.stroke();

	// 绘制距离刻度环（每 25% 一个）
	drawRangeMarkers(graphics, range, startAngle, endAngle, color, strokeAlpha);
}

/**
 * 绘制距离刻度标记
 */
function drawRangeMarkers(
	graphics: Graphics,
	range: number,
	startAngle: number,
	endAngle: number,
	color: number,
	alpha: number
): void {
	const markerIntervals = [0.25, 0.5, 0.75];

	markerIntervals.forEach((interval) => {
		const markerRange = range * interval;

		graphics.setStrokeStyle({ width: 1, color, alpha: alpha * 0.3 });
		graphics.arc(0, 0, markerRange, startAngle, endAngle);
		graphics.stroke();
	});
}

/**
 * 创建武器标签
 */
function createWeaponLabel(weapon: WeaponMountData, range: number): Container {
	const container = new Container();

	const style = new TextStyle({
		fontSize: 9,
		fill: 0xffffff,
		stroke: { color: 0x000000, width: 2 },
		fontWeight: "bold",
	});

	const labelText = `${weapon.name}\n${range}u`;
	const label = new Text({ text: labelText, style });
	label.anchor.set(0.5, 0.5);

	container.addChild(label);

	return container;
}

/**
 * 获取武器颜色
 */
function getWeaponColor(weapon: WeaponMountData): number {
	// 点防御武器优先
	if (weapon.name.toLowerCase().includes("pd") || weapon.name.toLowerCase().includes("point defense")) {
		return WEAPON_COLORS.pd;
	}

	// 根据名称推断武器类型
	const name = weapon.name.toLowerCase();
	if (name.includes("energy") || name.includes("laser") || name.includes("beam")) {
		return WEAPON_COLORS.energy;
	}
	if (name.includes("missile") || name.includes("torpedo")) {
		return WEAPON_COLORS.missile;
	}
	if (name.includes("ballistic") || name.includes("cannon") || name.includes("autocannon")) {
		return WEAPON_COLORS.ballistic;
	}

	// 默认使用动能武器颜色
	return WEAPON_COLORS.ballistic;
}

/**
 * 清除武器射程显示
 */
export function clearWeaponRanges(layer: Container): void {
	layer.removeChildren();
}

/**
 * 更新武器射程显示
 */
export function updateWeaponRanges(
	layer: Container,
	config: WeaponRangeConfig
): void {
	renderWeaponRanges(layer, config);
}
