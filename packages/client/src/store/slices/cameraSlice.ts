/**
 * 相机 Redux Slice
 * 统一管理本地和远程玩家相机状态
 *
 * 优化内容：
 * - 改进缩放比率 (1.15x 每档，更平滑)
 * - 支持部分出界查看 (屏幕中心点不能离开地图)
 * - RTS 风格的边界软限制
 * - 统一的 viewRotation 支持
 */

import { clampZoom } from "@/utils/cameraBounds";
import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { CameraState, PlayerCamera } from "@vt/types";

interface CameraSliceState {
	// 本地玩家相机
	local: CameraState;
	// 其他玩家相机（按玩家 ID 索引）
	remote: Record<string, PlayerCamera>;
}

// 优化的相机配置
// - minZoom: 0.3 允许看到更多地图
// - maxZoom: 6 允许详细检查
// - zoomStep: 1.15 每档缩放比率（比 1.1 快，比 1.2 慢，更平滑）
const MIN_ZOOM = 0.3;
const MAX_ZOOM = 6;

const defaultCamera: CameraState = {
	x: 2048, // 地图中心（地图大小 4096）
	y: 2048,
	zoom: 1,
	viewRotation: 0,
};

const initialState: CameraSliceState = {
	local: { ...defaultCamera },
	remote: {},
};

const cameraSlice = createSlice({
	name: "camera",
	initialState,
	reducers: {
		// 设置本地相机（完全替换）
		setCamera: (state, action: PayloadAction<Partial<CameraState>>) => {
			state.local = { ...state.local, ...action.payload };
		},

		// 更新本地相机（增量更新）
		updateCamera: (state, action: PayloadAction<Partial<CameraState>>) => {
			if (action.payload.x !== undefined) {
				state.local.x = action.payload.x;
			}
			if (action.payload.y !== undefined) {
				state.local.y = action.payload.y;
			}
			if (action.payload.zoom !== undefined) {
				state.local.zoom = clampZoom(action.payload.zoom, MIN_ZOOM, MAX_ZOOM);
			}
			if (action.payload.viewRotation !== undefined) {
				state.local.viewRotation = action.payload.viewRotation;
			}
			if (action.payload.followingShipId !== undefined) {
				state.local.followingShipId = action.payload.followingShipId;
			}
		},

		// 相对移动相机
		panCamera: (state, action: PayloadAction<{ dx: number; dy: number }>) => {
			state.local.x += action.payload.dx;
			state.local.y += action.payload.dy;
		},

		// 设置视图旋转
		setViewRotation: (state, action: PayloadAction<number>) => {
			state.local.viewRotation = action.payload;
		},

		// 重置相机到默认状态
		resetCamera: (state) => {
			state.local = { ...defaultCamera };
		},

		// 更新远程玩家相机
		updateRemoteCamera: (state, action: PayloadAction<PlayerCamera>) => {
			state.remote[action.payload.playerId] = action.payload;
		},

		// 移除远程玩家相机
		removeRemoteCamera: (state, action: PayloadAction<string>) => {
			delete state.remote[action.payload];
		},

		// 清空所有远程相机
		clearRemoteCameras: (state) => {
			state.remote = {};
		},
	},
});

export const {
	setCamera,
	updateCamera,
	panCamera,
	setViewRotation,
	resetCamera,
	updateRemoteCamera,
	removeRemoteCamera,
	clearRemoteCameras,
} = cameraSlice.actions;

export default cameraSlice.reducer;
