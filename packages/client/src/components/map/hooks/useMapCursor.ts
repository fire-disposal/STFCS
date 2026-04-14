import { useCursorRendering } from "./useCursorRendering";
import type { LayerRegistry } from "./useLayerSystem";

export interface UseMapCursorProps {
	layers: LayerRegistry | null;
	mapCursor: { x: number; y: number; heading: number } | null;
}

export function useMapCursor({ layers, mapCursor }: UseMapCursorProps) {
	useCursorRendering(layers, mapCursor);
}

export default useMapCursor;
