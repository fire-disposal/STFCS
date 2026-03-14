/**
 * 动态文本渲染工具
 * 解决文本在缩放时模糊的问题
 */

import { Text, TextStyle, type TextStyleOptions } from "pixi.js";

/**
 * 文本缩放配置
 */
export interface ScalableTextOptions {
	/** 基础字体大小（在 zoom=1 时显示的大小） */
	baseFontSize: number;
	/** 最小字体大小 */
	minFontSize?: number;
	/** 最大字体大小 */
	maxFontSize?: number;
	/** 是否保持字体大小不变（不随缩放变化） */
	keepSize?: boolean;
	/** 分辨率倍数（默认为设备像素比） */
	resolution?: number;
	/** 文本样式选项 */
	styleOptions?: Omit<TextStyleOptions, "fontSize">;
}

/**
 * 可缩放文本类
 * 根据相机缩放动态调整文本分辨率和大小
 */
export class ScalableText extends Text {
	private baseFontSize: number;
	private minFontSize: number;
	private maxFontSize: number;
	private keepSize: boolean;
	private baseResolution: number;
	private currentZoom: number = 1;

	constructor(text: string, options: ScalableTextOptions) {
		const {
			baseFontSize,
			minFontSize = 8,
			maxFontSize = 72,
			keepSize = false,
			resolution,
			styleOptions,
		} = options;

		const style = new TextStyle({
			...styleOptions,
			fontSize: baseFontSize,
		});

		super(text, style);

		this.baseFontSize = baseFontSize;
		this.minFontSize = minFontSize;
		this.maxFontSize = maxFontSize;
		this.keepSize = keepSize;
		this.baseResolution = resolution ?? (typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1);

		// 设置初始分辨率
		this.updateResolution();
	}

	/**
	 * 更新文本以适配相机缩放
	 * @param zoom 当前相机缩放
	 */
	updateForZoom(zoom: number): void {
		this.currentZoom = zoom;

		if (this.keepSize) {
			// 保持屏幕大小不变：字体大小 / zoom = 常数
			const scaledSize = this.baseFontSize / zoom;
			const clampedSize = Math.max(this.minFontSize, Math.min(this.maxFontSize, scaledSize));
			
			if (this.style.fontSize !== clampedSize) {
				this.style.fontSize = clampedSize;
			}
		} else {
			// 保持世界空间大小不变：字体大小固定
			if (this.style.fontSize !== this.baseFontSize) {
				this.style.fontSize = this.baseFontSize;
			}
		}

		this.updateResolution();
	}

	/**
	 * 更新文本分辨率
	 * 在缩放较大时使用更高分辨率避免模糊
	 */
	private updateResolution(): void {
		// 缩放越大，需要的分辨率越高
		const targetResolution = this.baseResolution * Math.min(2, Math.max(0.5, this.currentZoom));
		
		if (this.resolution !== targetResolution) {
			this.resolution = targetResolution;
		}
	}

	/**
	 * 强制更新文本
	 */
	forceUpdate(): void {
		this.onViewUpdate();
	}
}

/**
 * 创建优化后的文本样式
 */
export function createOptimalTextStyle(options: {
	fontSize: number;
	fill?: number;
	stroke?: { color: number; width: number };
	fontWeight?: string;
	fontFamily?: string;
	align?: "left" | "center" | "right";
}): TextStyle {
	const {
		fontSize,
		fill = 0xffffff,
		stroke,
		fontWeight = "400",
		fontFamily = "'Segoe UI', 'Roboto', sans-serif",
		align = "center",
	} = options;

	return new TextStyle({
		fontSize,
		fill,
		stroke: stroke ? { ...stroke, width: stroke.width * 2 } : undefined,
		fontWeight: fontWeight as any,
		fontFamily,
		align,
	});
}

/**
 * 批量更新文本组
 */
export function updateTextGroup(
	texts: ScalableText[],
	zoom: number
): void {
	texts.forEach((text) => {
		text.updateForZoom(zoom);
	});
}

/**
 * 文本池 - 重用文本对象减少创建开销
 */
export class TextPool {
	private pool: ScalableText[] = [];
	private inUse: Set<ScalableText> = new Set();

	constructor(
		private baseOptions: ScalableTextOptions,
		initialSize: number = 20
	) {
		for (let i = 0; i < initialSize; i++) {
			this.pool.push(new ScalableText("", baseOptions));
		}
	}

	/**
	 * 从池中获取文本
	 */
	get(text: string, options?: Partial<ScalableTextOptions>): ScalableText {
		let textObj: ScalableText;

		if (this.pool.length > 0) {
			textObj = this.pool.pop()!;
		} else {
			textObj = new ScalableText("", { ...this.baseOptions, ...options });
		}

		textObj.text = text;
		if (options) {
			if (options.baseFontSize !== undefined) {
				(textObj as any).baseFontSize = options.baseFontSize;
			}
		}

		this.inUse.add(textObj);
		return textObj;
	}

	/**
	 * 释放文本回池
	 */
	release(text: ScalableText): void {
		if (this.inUse.has(text)) {
			this.inUse.delete(text);
			text.text = "";
			this.pool.push(text);
		}
	}

	/**
	 * 释放所有文本
	 */
	releaseAll(): void {
		this.inUse.forEach((text) => {
			text.text = "";
			this.pool.push(text);
		});
		this.inUse.clear();
	}

	/**
	 * 更新池中所有文本的缩放
	 */
	updateForZoom(zoom: number): void {
		this.inUse.forEach((text) => {
			text.updateForZoom(zoom);
		});
	}
}
