import { Assets, Texture } from "pixi.js";
import { useCallback, useRef } from "react";
import type { AssetListItem } from "@vt/data";

interface AssetBatchGetResult {
	assetId: string;
	info: AssetListItem | null;
	data?: string;
}

interface PreloadProgress {
	total: number;
	loaded: number;
	failed: number;
	currentAssetId: string | null;
}

export function useAssetPreloader(
	fetchAssets: (assetIds: string[], includeData: boolean) => Promise<AssetBatchGetResult[]>
) {
	const cacheRef = useRef<Map<string, Texture | null>>(new Map());
	const progressRef = useRef<PreloadProgress>({ total: 0, loaded: 0, failed: 0, currentAssetId: null });

	const preloadAssets = useCallback(async (assetIds: string[]): Promise<Map<string, Texture | null>> => {
		if (assetIds.length === 0) return cacheRef.current;

		const toLoad = assetIds.filter(id => !cacheRef.current.has(id));
		if (toLoad.length === 0) return cacheRef.current;

		progressRef.current = { total: toLoad.length, loaded: 0, failed: 0, currentAssetId: null };

		console.log("[useAssetPreloader] Preloading assets:", toLoad.length);

		try {
			const results = await fetchAssets(toLoad, true);

			for (const result of results) {
				progressRef.current.currentAssetId = result.assetId;

				if (!result.data || !result.info?.mimeType) {
					console.warn("[useAssetPreloader] No data for:", result.assetId);
					cacheRef.current.set(result.assetId, null);
					progressRef.current.failed++;
					continue;
				}

				try {
					const dataUrl = `data:${result.info.mimeType};base64,${result.data}`;
					const texture = await Assets.load({ src: dataUrl, alias: result.assetId });
					cacheRef.current.set(result.assetId, texture);
					progressRef.current.loaded++;
				} catch (err) {
					console.error("[useAssetPreloader] Failed:", result.assetId, err);
					cacheRef.current.set(result.assetId, null);
					progressRef.current.failed++;
				}
			}

			for (const id of toLoad) {
				if (!results.some(r => r.assetId === id)) {
					cacheRef.current.set(id, null);
					progressRef.current.failed++;
				}
			}

			console.log("[useAssetPreloader] Complete:", {
				loaded: progressRef.current.loaded,
				failed: progressRef.current.failed,
				total: progressRef.current.total
			});
		} catch (error) {
			console.error("[useAssetPreloader] Batch failed:", error);
			for (const id of toLoad) {
				cacheRef.current.set(id, null);
			}
		}

		return cacheRef.current;
	}, [fetchAssets]);

	const getTexture = useCallback((assetId: string): Texture | null => {
		return cacheRef.current.get(assetId) ?? null;
	}, []);

	const hasTexture = useCallback((assetId: string): boolean => {
		return cacheRef.current.has(assetId);
	}, []);

	const clearCache = useCallback(() => {
		for (const [id, texture] of cacheRef.current) {
			if (texture) {
				try {
					Assets.unload(id);
				} catch {}
			}
		}
		cacheRef.current.clear();
	}, []);

	return {
		preloadAssets,
		getTexture,
		hasTexture,
		clearCache,
		getProgress: () => progressRef.current,
		getCache: () => cacheRef.current,
	};
}