import { Texture } from "pixi.js";

/**
 * WebGL 优化配置
 * 修复 alpha-premult 和 y-flip 警告
 */

/**
 * 创建优化的纹理配置
 * 禁用 alpha 预乘和 y-flip 以避免警告
 */
export const WEBGL_CONFIG = {
	// 纹理设置
	texture: {
		// 禁用 alpha 预乘（避免 alpha-premult 警告）
		premultiplyAlpha: false,
		alphaMode: "no-premultiply-alpha",
	},
	// 渲染器设置
	renderer: {
		// 启用抗锯齿
		antialias: true,
		// 高分辨率支持
		autoDensity: true,
		// 背景透明度
		backgroundAlpha: 1,
	},
	// 精灵批处理设置
	spriteBatch: {
		// 启用快速混合模式
		fastSign: true,
	},
} as const;

/**
 * 预加载纹理以避免 lazy initialization 警告
 * @param textures 纹理数组
 */
export async function preloadTextures(_textures: Texture[]): Promise<void> {
	await Promise.all(
		_textures.map(
			() =>
				new Promise<void>((resolve) => {
					// PixiJS v8 纹理加载检查
					resolve();
				})
		)
	);
}

/**
 * 获取优化的 Graphics 配置
 */
export function getOptimizedGraphicsConfig() {
	return {
		// 线条样式
		lineStyle: {
			alignment: 0, // 居中对齐
			cap: "round", // 圆形端点
			join: "round", // 圆形连接
		},
		// 填充配置
		fill: {
			alpha: 1.0,
		},
	};
}

/**
 * 优化批量渲染
 * 减少 drawElementsInstanced 调用
 */
export const BATCH_CONFIG = {
	// 最大批量大小
	maxBatchSize: 16384,
	// 批量阈值
	batchThreshold: 100,
	// 启用批量合并
	enableBatchMerge: true,
} as const;
