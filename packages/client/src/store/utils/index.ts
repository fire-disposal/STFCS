import type { RootState } from "@/store";
import type { AppDispatch } from "@/store";
import { loadMapSnapshot } from "@/store/slices/mapSlice";
import type { MapSnapshot } from "@vt/shared/types";
import { PROTOCOL_VERSION } from "@vt/shared/core-types";

/**
 * 从当前 Redux 状态构建可持久化地图快照。
 */
export function createMapSnapshot(state: RootState): MapSnapshot {
	return {
		version: PROTOCOL_VERSION,
		savedAt: Date.now(),
		map: {
			id: state.map.config.id,
			width: state.map.config.width,
			height: state.map.config.height,
			name: state.map.config.name,
		},
		tokens: Object.values(state.map.tokens),
		starMap: {
			stars: state.map.starMap.stars,
			systems: state.map.starMap.systems,
		},
	};
}

/**
 * 反序列化并恢复地图快照。
 */
export function restoreMapSnapshot(dispatch: AppDispatch, snapshot: MapSnapshot): void {
	dispatch(loadMapSnapshot(snapshot));
}
