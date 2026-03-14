/**
 * 图层管理 Hook
 * 提供图层可见性和视图模式管理功能
 */

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
	setLayerVisible,
	setLayersVisible,
	setViewMode,
	setLayerOpacity,
	resetLayers,
} from "@/store/slices/layerSlice";
import {
	LayerId,
	ViewMode,
	LayerGroupId,
	DEFAULT_LAYER_CONFIGS,
	DEFAULT_LAYER_GROUPS,
	VIEW_MODE_CONFIGS,
} from "@/features/game/layers/types";

export interface LayerInfo {
	id: LayerId;
	name: string;
	groupId: LayerGroupId;
	visible: boolean;
	opacity: number;
}

export interface LayerGroupInfo {
	id: LayerGroupId;
	name: string;
	layerIds: LayerId[];
	allVisible: boolean;
	someVisible: boolean;
}

export function useLayerManager() {
	const dispatch = useAppDispatch();
	const visibility = useAppSelector((state) => state.layers.visibility);
	const opacity = useAppSelector((state) => state.layers.opacity);
	const currentViewMode = useAppSelector((state) => state.layers.currentViewMode);

	// 获取单个图层信息
	const getLayer = useCallback(
		(layerId: LayerId): LayerInfo => {
			const config = DEFAULT_LAYER_CONFIGS.find((c) => c.id === layerId);
			return {
				id: layerId,
				name: config?.name || layerId,
				groupId: config?.groupId || LayerGroupId.OBJECTS,
				visible: visibility[layerId] === true,
				opacity: opacity[layerId] ?? 1,
			};
		},
		[visibility, opacity]
	);

	// 获取所有图层信息
	const getAllLayers = useCallback((): LayerInfo[] => {
		return DEFAULT_LAYER_CONFIGS.map((config) => ({
			id: config.id,
			name: config.name,
			groupId: config.groupId,
			visible: visibility[config.id] ?? config.defaultVisible,
			opacity: opacity[config.id] ?? 1,
		}));
	}, [visibility, opacity]);

	// 获取图层组信息
	const getGroup = useCallback(
		(groupId: LayerGroupId): LayerGroupInfo => {
			const groupConfig = DEFAULT_LAYER_GROUPS.find((g) => g.id === groupId);
			const layerIds = groupConfig?.layerIds || [];
			const visibleCount = layerIds.filter((id) => visibility[id] === true).length;

			return {
				id: groupId,
				name: groupConfig?.name || groupId,
				layerIds,
				allVisible: visibleCount === layerIds.length,
				someVisible: visibleCount > 0 && visibleCount < layerIds.length,
			};
		},
		[visibility]
	);

	// 获取所有图层组信息
	const getAllGroups = useCallback((): LayerGroupInfo[] => {
		return DEFAULT_LAYER_GROUPS.map((groupConfig) => {
			const visibleCount = groupConfig.layerIds.filter((id) => visibility[id])
				.length;
			return {
				id: groupConfig.id,
				name: groupConfig.name,
				layerIds: groupConfig.layerIds,
				allVisible: visibleCount === groupConfig.layerIds.length,
				someVisible: visibleCount > 0 && visibleCount < groupConfig.layerIds.length,
			};
		});
	}, [visibility]);

	// 设置图层可见性
	const setLayerVisibility = useCallback(
		(layerId: LayerId, visible: boolean) => {
			dispatch(setLayerVisible({ layerId, visible }));
		},
		[dispatch]
	);

	// 设置图层组可见性
	const setGroupVisibility = useCallback(
		(groupId: LayerGroupId, visible: boolean) => {
			const group = DEFAULT_LAYER_GROUPS.find((g) => g.id === groupId);
			if (group) {
				dispatch(setLayersVisible({ layerIds: group.layerIds, visible }));
			}
		},
		[dispatch]
	);

	// 切换视图模式
	const switchViewMode = useCallback(
		(mode: ViewMode) => {
			dispatch(setViewMode(mode));
		},
		[dispatch]
	);

	// 设置图层不透明度
	const changeLayerOpacity = useCallback(
		(layerId: LayerId, opacityValue: number) => {
			dispatch(setLayerOpacity({ layerId, opacity: opacityValue }));
		},
		[dispatch]
	);

	// 重置图层配置
	const resetLayerConfig = useCallback(() => {
		dispatch(resetLayers());
	}, [dispatch]);

	// 获取当前视图模式配置
	const getCurrentViewModeConfig = useCallback(() => {
		return VIEW_MODE_CONFIGS.find((c) => c.mode === currentViewMode);
	}, [currentViewMode]);

	return {
		// 状态
		currentViewMode,
		
		// 获取信息
		getLayer,
		getAllLayers,
		getGroup,
		getAllGroups,
		getCurrentViewModeConfig,
		
		// 操作方法
		setLayerVisibility,
		setGroupVisibility,
		switchViewMode,
		changeLayerOpacity,
		resetLayerConfig,
	};
}
