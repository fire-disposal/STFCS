/**
 * 相机 Redux Slice
 * 统一管理本地和远程玩家相机状态
 */

import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { CameraState, PlayerCamera } from "@vt/shared/types";

interface CameraSliceState {
	// 本地玩家相机
	local: CameraState;
	// 其他玩家相机（按玩家 ID 索引）
	remote: Record<string, PlayerCamera>;
}

const defaultCamera: CameraState = {
	centerX: 2048, // 地图中心（地图大小 4096）
	centerY: 2048,
	zoom: 1,
	rotation: 0,
	minZoom: 0.5,
	maxZoom: 4,
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
			if (action.payload.centerX !== undefined) {
				state.local.centerX = action.payload.centerX;
			}
			if (action.payload.centerY !== undefined) {
				state.local.centerY = action.payload.centerY;
			}
			if (action.payload.zoom !== undefined) {
				const minZoom = state.local.minZoom ?? 0.5;
				const maxZoom = state.local.maxZoom ?? 4;
				state.local.zoom = Math.max(minZoom, Math.min(maxZoom, action.payload.zoom));
			}
			if (action.payload.rotation !== undefined) {
				state.local.rotation = action.payload.rotation;
			}
		},

		// 相对移动相机
		panCamera: (state, action: PayloadAction<{ dx: number; dy: number }>) => {
			state.local.centerX += action.payload.dx;
			state.local.centerY += action.payload.dy;
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
	resetCamera,
	updateRemoteCamera,
	removeRemoteCamera,
	clearRemoteCameras,
} = cameraSlice.actions;

export default cameraSlice.reducer;
