/**
 * 图层 Redux Slice
 * 管理图层可见性和视图模式
 */

import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import {
	LayerId,
	ViewMode,
	LayerState,
	VIEW_MODE_CONFIGS,
	DEFAULT_LAYER_CONFIGS,
} from "@/features/game/layers/types";

// 初始化图层状态
const initialState: LayerState = {
	visibility: Object.fromEntries(
		DEFAULT_LAYER_CONFIGS.map((config) => [config.id, config.defaultVisible])
	) as Record<LayerId, boolean>,
	currentViewMode: ViewMode.TACTICAL,
	opacity: Object.fromEntries(
		DEFAULT_LAYER_CONFIGS.map((config) => [config.id, 1])
	) as Record<LayerId, number>,
};

const layerSlice = createSlice({
	name: "layers",
	initialState,
	reducers: {
		// 设置单个图层可见性
		setLayerVisible: (
			state,
			action: PayloadAction<{ layerId: LayerId; visible: boolean }>
		) => {
			const { layerId, visible } = action.payload;
			state.visibility[layerId] = visible;
			state.currentViewMode = ViewMode.CUSTOM;
		},

		// 批量设置图层可见性
		setLayersVisible: (
			state,
			action: PayloadAction<{ layerIds: LayerId[]; visible: boolean }>
		) => {
			const { layerIds, visible } = action.payload;
			layerIds.forEach((id) => {
				state.visibility[id] = visible;
			});
			state.currentViewMode = ViewMode.CUSTOM;
		},

		// 切换视图模式
		setViewMode: (state, action: PayloadAction<ViewMode>) => {
			const mode = action.payload;
			const config = VIEW_MODE_CONFIGS.find((c) => c.mode === mode);
			
			if (config) {
				state.visibility = { ...config.layerVisibility };
				state.currentViewMode = mode;
			}
		},

		// 设置图层不透明度
		setLayerOpacity: (
			state,
			action: PayloadAction<{ layerId: LayerId; opacity: number }>
		) => {
			const { layerId, opacity } = action.payload;
			state.opacity[layerId] = Math.max(0, Math.min(1, opacity));
		},

		// 重置为默认配置
		resetLayers: (state) => {
			state.visibility = Object.fromEntries(
				DEFAULT_LAYER_CONFIGS.map((config) => [config.id, config.defaultVisible])
			) as Record<LayerId, boolean>;
			state.currentViewMode = ViewMode.TACTICAL;
			state.opacity = Object.fromEntries(
				DEFAULT_LAYER_CONFIGS.map((config) => [config.id, 1])
			) as Record<LayerId, number>;
		},
	},
});

export const {
	setLayerVisible,
	setLayersVisible,
	setViewMode,
	setLayerOpacity,
	resetLayers,
} = layerSlice.actions;

export default layerSlice.reducer;
