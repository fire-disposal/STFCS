/**
 * 贴图预加载 Hook
 *
 * 职责：
 * 1. 预加载贴图 assetId 到 PixiJS Texture 缓存
 * 2. 返回 Map<assetId, Texture | null>
 * 3. 处理加载失败情况
 */

import { Assets, Texture } from "pixi.js";
import { useEffect, useRef, useState, useCallback } from "react";
import type { AssetListItem } from "@vt/data";

export type TextureCache = Map<string, Texture | null>;

interface AssetBatchGetResult {
	assetId: string;
	info: AssetListItem | null;
	data?: string;
}

interface UseTextureLoaderOptions {
	assetIds: string[];
	fetchAssets: (assetIds: string[], includeData: boolean) => Promise<AssetBatchGetResult[]>;
}

export function useTextureLoader(options: UseTextureLoaderOptions): TextureCache {
	const { assetIds, fetchAssets } = options;
	const cacheRef = useRef<TextureCache>(new Map());
	const [, forceUpdate] = useState({});

	const loadTextures = useCallback(async (ids: string[]) => {
		if (ids.length === 0) return;

		const toLoad = ids.filter((id) => !cacheRef.current.has(id));
		if (toLoad.length === 0) return;

		console.log("[useTextureLoader] Loading textures:", toLoad);

		try {
			const results = await fetchAssets(toLoad, true);
			console.log("[useTextureLoader] Results:", results.length, results.map(r => ({ id: r.assetId, hasData: !!r.data, mimeType: r.info?.mimeType })));

			for (const result of results) {
				if (!result.data || !result.info?.mimeType) {
					console.warn("[useTextureLoader] No data or mimeType for:", result.assetId);
					cacheRef.current.set(result.assetId, null);
					continue;
				}

				try {
					const dataUrl = `data:${result.info.mimeType};base64,${result.data}`;
					console.log("[useTextureLoader] Loading texture from dataUrl, length:", result.data.length);
					const texture = await Assets.load({ src: dataUrl, alias: result.assetId });
					console.log("[useTextureLoader] Texture loaded:", result.assetId, texture ? "success" : "failed");
					cacheRef.current.set(result.assetId, texture);
				} catch (err) {
					console.error("[useTextureLoader] Failed to load texture:", result.assetId, err);
					cacheRef.current.set(result.assetId, null);
				}
			}

			for (const id of toLoad) {
				if (!results.some((r) => r.assetId === id)) {
					console.warn("[useTextureLoader] Missing result for:", id);
					cacheRef.current.set(id, null);
				}
			}

			forceUpdate({});
		} catch (error) {
			console.error("[useTextureLoader] Failed to load textures:", error);
			for (const id of toLoad) {
				cacheRef.current.set(id, null);
			}
			forceUpdate({});
		}
	}, [fetchAssets]);

	useEffect(() => {
		console.log("[useTextureLoader] assetIds changed:", assetIds);
		loadTextures(assetIds);
	}, [assetIds.join(","), loadTextures]);

	useEffect(() => {
		return () => {
			for (const [id, texture] of cacheRef.current) {
				if (texture) {
					try {
						Assets.unload(id);
					} catch {}
				}
			}
			cacheRef.current.clear();
		};
	}, []);

	return cacheRef.current;
}