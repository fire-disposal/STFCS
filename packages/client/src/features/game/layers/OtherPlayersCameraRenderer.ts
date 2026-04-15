/**
 * 其他玩家相机渲染器
 * 在地图上显示其他玩家的相机位置和视野范围
 */

import { ScalableText } from "@/features/game/utils/TextRenderer";
import type { PlayerCamera } from "@vt/types";
import { Container, Graphics } from "pixi.js";

/**
 * 相机指示器配置
 */
export interface CameraIndicatorConfig {
	/** 相机边框颜色 */
	borderColor?: number;
	/** 相机边框透明度 */
	borderAlpha?: number;
	/** 相机边框线宽 */
	borderWidth?: number;
	/** 玩家名称显示 */
	showPlayerName?: boolean;
	/** 玩家名称字体大小 */
	nameFontSize?: number;
	/** 视野范围显示 */
	showViewFrustum?: boolean;
	/** 视野范围颜色 */
	frustumColor?: number;
	/** 视野范围透明度 */
	frustumAlpha?: number;
}

const DEFAULT_CONFIG: CameraIndicatorConfig = {
	borderColor: 0x00ff88,
	borderAlpha: 0.6,
	borderWidth: 2,
	showPlayerName: true,
	nameFontSize: 10,
	showViewFrustum: true,
	frustumColor: 0x00ff88,
	frustumAlpha: 0.1,
};

/**
 * 渲染单个玩家相机指示器
 */
export function renderCameraIndicator(
	camera: PlayerCamera,
	viewportSize: { width: number; height: number },
	config: CameraIndicatorConfig = {}
): Container {
	const container = new Container();
	const finalConfig = { ...DEFAULT_CONFIG, ...config };

	const { x, y, zoom } = camera;

	// 计算视野范围（世界坐标）
	const viewWidth = viewportSize.width / zoom;
	const viewHeight = viewportSize.height / zoom;
	const left = x - viewWidth / 2;
	const right = x + viewWidth / 2;
	const top = y - viewHeight / 2;
	const bottom = y + viewHeight / 2;

	// 绘制视野范围（半透明矩形）
	if (finalConfig.showViewFrustum) {
		const frustum = new Graphics();
		frustum.rect(left, top, viewWidth, viewHeight);
		frustum.fill({ color: finalConfig.frustumColor!, alpha: finalConfig.frustumAlpha! });
		container.addChild(frustum);
	}

	// 绘制边框
	const border = new Graphics();
	border.setStrokeStyle({
		width: finalConfig.borderWidth!,
		color: finalConfig.borderColor!,
		alpha: finalConfig.borderAlpha!,
	});
	border.rect(left, top, viewWidth, viewHeight);
	border.stroke();
	container.addChild(border);

	// 绘制四个角的标记（增强可见性）
	const cornerSize = 20;
	const corners = new Graphics();
	corners.setStrokeStyle({
		width: finalConfig.borderWidth! + 1,
		color: finalConfig.borderColor!,
		alpha: 1,
	});

	// 左上角
	corners.moveTo(left, top + cornerSize);
	corners.lineTo(left, top);
	corners.lineTo(left + cornerSize, top);

	// 右上角
	corners.moveTo(right - cornerSize, top);
	corners.lineTo(right, top);
	corners.lineTo(right, top + cornerSize);

	// 左下角
	corners.moveTo(left, bottom - cornerSize);
	corners.lineTo(left, bottom);
	corners.lineTo(left + cornerSize, bottom);

	// 右下角
	corners.moveTo(right - cornerSize, bottom);
	corners.lineTo(right, bottom);
	corners.lineTo(right, bottom - cornerSize);

	corners.stroke();
	container.addChild(corners);

	// 添加玩家名称标签
	if (finalConfig.showPlayerName) {
		const nameLabel = new ScalableText(camera.ownerId ?? camera.id, {
			baseFontSize: finalConfig.nameFontSize!,
			keepSize: true,
			styleOptions: {
				fill: finalConfig.borderColor!,
				stroke: { color: 0x000000, width: 2 },
				fontWeight: "bold",
			},
		});
		nameLabel.anchor.set(0.5, 0);
		nameLabel.position.set(x, top - 10);
		container.addChild(nameLabel);
	}

	// 添加缩放级别指示（小字）
	const zoomLabel = new ScalableText(`${Math.round(zoom * 100)}%`, {
		baseFontSize: 8,
		keepSize: true,
		styleOptions: {
			fill: { color: 0xffffff, alpha: 0.7 },
			stroke: { color: 0x000000, width: 2 },
		},
	});
	zoomLabel.anchor.set(1, 0);
	zoomLabel.position.set(right, top - 10);
	container.addChild(zoomLabel);

	return container;
}

/**
 * 渲染所有其他玩家相机
 */
export function renderAllOtherPlayersCameras(
	layer: Container,
	cameras: Record<string, PlayerCamera>,
	viewportSize: { width: number; height: number },
	currentPlayerId: string | null,
	config: CameraIndicatorConfig = {}
): void {
	layer.removeChildren();

	// 过滤掉当前玩家的相机
	const otherCameras = Object.values(cameras).filter((cam) => cam.ownerId !== currentPlayerId);

	otherCameras.forEach((camera) => {
		const indicator = renderCameraIndicator(camera, viewportSize, config);
		layer.addChild(indicator);
	});
}

/**
 * 更新单个相机指示器
 */
export function updateCameraIndicator(
	container: Container,
	camera: PlayerCamera,
	viewportSize: { width: number; height: number },
	config: CameraIndicatorConfig = {}
): void {
	// 简单实现：移除所有子节点并重新渲染
	container.removeChildren();
	const indicator = renderCameraIndicator(camera, viewportSize, config);
	container.addChild(indicator);
}
