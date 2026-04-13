/**
 * 地图游标交互 Hook
 *
 * 仅提供游标渲染，事件处理统一在 usePixiApp 中
 */

import type { CursorState } from "./useCursorRendering";
import { useCursorRendering } from "./useCursorRendering";

export interface UseCursorRenderingOptions {
	cameraX: number;
	cameraY: number;
	zoom: number;
	viewRotation: number;
}

export interface UseMapCursorProps {
	layers: any | null;
	mapCursor: CursorState | null;
	options: UseCursorRenderingOptions;
}

export interface UseMapCursorResult {
	// 空对象，仅用于触发渲染
}

export function useMapCursor({
	layers,
	mapCursor,
	options,
}: UseMapCursorProps): UseMapCursorResult {
	// 游标渲染
	useCursorRendering(layers, mapCursor, options);

	return {};
}

export default useMapCursor;
