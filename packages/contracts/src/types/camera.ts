/**
 * 相机系统统一类型定义
 * 前后端共享的相机相关类型
 */

/**
 * 基础相机状态
 * 所有相机相关数据都使用这个结构
 */
export interface CameraState {
	/** 相机中心 X 坐标（世界坐标） */
	centerX: number;
	/** 相机中心 Y 坐标（世界坐标） */
	centerY: number;
	/** 缩放级别（1 = 100%） */
	zoom: number;
	/** 旋转角度（度） */
	rotation: number;
	/** 最小缩放 */
	minZoom: number;
	/** 最大缩放 */
	maxZoom: number;
}

/**
 * 玩家相机（用于多人同步）
 * 继承基础相机状态，添加玩家信息
 */
export interface PlayerCamera extends CameraState {
	playerId: string;
	playerName: string;
	timestamp: number;
}

/**
 * 相机更新命令（用于请求/响应）
 * 所有字段可选，表示增量更新
 */
export interface CameraUpdateCommand {
	centerX?: number;
	centerY?: number;
	zoom?: number;
	rotation?: number;
}

/**
 * 相机配置（用于初始化）
 */
export interface CameraConfig {
	centerX: number;
	centerY: number;
	zoom: number;
	rotation: number;
	minZoom?: number;
	maxZoom?: number;
}
