import { Assets, Texture } from "pixi.js";
import { useEffect, useRef, useState, useCallback } from "react";
import type { AssetListItem } from "@vt/data";

interface AssetBatchGetResult {
	assetId: string;
	info: AssetListItem | null;
	data?: string;
}

interface UseTextureLoaderOptions {
	assetIds: string[];
	fetchAssets: (assetIds: string[], includeData: boolean) => Promise<AssetBatchGetResult[]>;
}

interface CacheEntry {
	status: "pending" | "loaded" | "failed";
	texture: Texture | null;
	retryCount: number;
	lastAttemptAt: number;
}

const MAX_RETRIES = 3;
const RETRY_DELAY = 2000;

export function useTextureLoader(options: UseTextureLoaderOptions): Map<string, Texture | null> {
	const { assetIds, fetchAssets } = options;
	const cacheRef = useRef<Map<string, CacheEntry>>(new Map());
	const loadingRef = useRef<Set<string>>(new Set());
	const [, forceUpdate] = useState({});

	const shouldRetry = useCallback((entry: CacheEntry | undefined): boolean => {
		if (!entry) return true;
		if (entry.status === "loaded") return false;
		if (entry.status === "pending") return false;
		if (entry.retryCount >= MAX_RETRIES) return false;
		return Date.now() - entry.lastAttemptAt >= RETRY_DELAY;
	}, []);

	const loadTextures = useCallback(async (ids: string[]) => {
		if (ids.length === 0) return;

		const toLoad = ids.filter((id) => {
			if (loadingRef.current.has(id)) return false;
			return shouldRetry(cacheRef.current.get(id));
		});

		if (toLoad.length === 0) return;

		console.log("[useTextureLoader] Loading textures:", toLoad);

		for (const id of toLoad) {
			loadingRef.current.add(id);
			const existing = cacheRef.current.get(id);
			cacheRef.current.set(id, {
				status: "pending",
				texture: null,
				retryCount: existing?.retryCount ?? 0,
				lastAttemptAt: Date.now(),
			});
		}

		try {
			const results = await fetchAssets(toLoad, true);

			for (const result of results) {
				loadingRef.current.delete(result.assetId);

				if (!result.data || !result.info?.mimeType) {
					console.warn("[useTextureLoader] No data for:", result.assetId);
					const existing = cacheRef.current.get(result.assetId);
					cacheRef.current.set(result.assetId, {
						status: "failed",
						texture: null,
						retryCount: (existing?.retryCount ?? 0) + 1,
						lastAttemptAt: Date.now(),
					});
					continue;
				}

				try {
					const dataUrl = `data:${result.info.mimeType};base64,${result.data}`;
					const texture = await Assets.load({ src: dataUrl, alias: result.assetId });
					cacheRef.current.set(result.assetId, {
						status: "loaded",
						texture,
						retryCount: 0,
						lastAttemptAt: Date.now(),
					});
				} catch (err) {
					console.error("[useTextureLoader] Texture load failed:", result.assetId, err);
					const existing = cacheRef.current.get(result.assetId);
					cacheRef.current.set(result.assetId, {
						status: "failed",
						texture: null,
						retryCount: (existing?.retryCount ?? 0) + 1,
						lastAttemptAt: Date.now(),
					});
				}
			}

			for (const id of toLoad) {
				if (!results.some((r) => r.assetId === id)) {
					loadingRef.current.delete(id);
					const existing = cacheRef.current.get(id);
					cacheRef.current.set(id, {
						status: "failed",
						texture: null,
						retryCount: (existing?.retryCount ?? 0) + 1,
						lastAttemptAt: Date.now(),
					});
				}
			}

			forceUpdate({});
		} catch (error) {
			console.error("[useTextureLoader] Batch request failed:", error);
			for (const id of toLoad) {
				loadingRef.current.delete(id);
				const existing = cacheRef.current.get(id);
				cacheRef.current.set(id, {
					status: "failed",
					texture: null,
					retryCount: (existing?.retryCount ?? 0) + 1,
					lastAttemptAt: Date.now(),
				});
			}
			forceUpdate({});
		}
	}, [fetchAssets, shouldRetry]);

	useEffect(() => {
		loadTextures(assetIds);
	}, [assetIds.join(","), loadTextures]);

	useEffect(() => {
		return () => {
			for (const [id, entry] of cacheRef.current) {
				if (entry.texture) {
					try {
						Assets.unload(id);
					} catch {}
				}
			}
			cacheRef.current.clear();
			loadingRef.current.clear();
		};
	}, []);

	const resultCache = new Map<string, Texture | null>();
	for (const [id, entry] of cacheRef.current) {
		resultCache.set(id, entry.texture);
	}
	return resultCache;
}

export type TextureCache = Map<string, Texture | null>;