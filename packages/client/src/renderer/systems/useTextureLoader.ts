import type { Texture } from "pixi.js";
import { useEffect, useSyncExternalStore, useMemo } from "react";
import { textureManager } from "./TextureManager";

export function useTextureLoader(assetIds: string[]): Map<string, Texture | null> {
	const stableIds = useMemo(() => {
		const sorted = [...new Set(assetIds)].sort();
		return sorted;
	}, [assetIds.join(",")]);

	useEffect(() => {
		if (stableIds.length > 0) {
			textureManager.load(stableIds);
		}
	}, [stableIds]);

	useSyncExternalStore(
		textureManager.subscribe.bind(textureManager),
		textureManager.getSnapshot.bind(textureManager),
	);

	return useMemo(() => {
		const map = new Map<string, Texture | null>();
		for (const id of stableIds) {
			map.set(id, textureManager.getTexture(id));
		}
		return map;
	}, [stableIds, textureManager.getSnapshot()]);
}

export type TextureCache = Map<string, Texture | null>;
