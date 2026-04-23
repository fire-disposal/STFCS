/**
 * 舰船贴图渲染 Hook
 *
 * 职责：
 * 1. 在 shipSprites 层渲染舰船贴图精灵
 * 2. 正确应用 position, heading, offsetX, offsetY, scale
 * 3. 缓存管理：Map<$id, Sprite>
 *
 * 渲染层：world.shipSprites (zIndex 6)
 */

import { Sprite } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";
import type { CombatToken } from "@vt/data";
import type { TextureCache } from "../systems/useTextureLoader";

interface ShipTextureCacheItem {
	sprite: Sprite;
	shipId: string;
}

export function useShipTextureRendering(
	layers: LayerRegistry | null,
	ships: CombatToken[],
	textureCache: TextureCache
): void {
	const cacheRef = useRef<Map<string, ShipTextureCacheItem>>(new Map());

	useEffect(() => {
		if (!layers?.shipSprites) return;

		const cache = cacheRef.current;
		const currentIds = new Set(ships.map((s) => s.$id));

		for (const [id, item] of cache) {
			if (!currentIds.has(id)) {
				layers.shipSprites.removeChild(item.sprite);
				item.sprite.destroy();
				cache.delete(id);
			}
		}

		for (const ship of ships) {
			if (!ship.runtime?.position) continue;

			const assetId = ship.spec.texture?.assetId;
			if (!assetId) {
				console.log("[ShipTextureRenderer] No assetId for ship:", ship.$id);
				continue;
			}

			const texture = textureCache.get(assetId);
			if (!texture) {
				console.log("[ShipTextureRenderer] Texture not loaded for:", assetId, "cache keys:", Array.from(textureCache.keys()));
				continue;
			}

			const offsetX = ship.spec.texture?.offsetX ?? 0;
			const offsetY = ship.spec.texture?.offsetY ?? 0;
			const scale = ship.spec.texture?.scale ?? 1;

			// 航海角度：0°=船头向上，顺时针增加
			// PixiJS rotation：正角度逆时针旋转
			// 所以 sprite.rotation = -heading（负数使其顺时针旋转）
			const headingRad = (-ship.runtime.heading * Math.PI) / 180;
			
			// 贴图偏移坐标系（同挂载点坐标系）：
			// X轴：左舷为正（heading=0时指向屏幕左侧）
			// Y轴：船头为正（heading=0时指向屏幕上方）
			// 偏移需要根据舰船朝向旋转到世界坐标系
			const worldX = ship.runtime.position.x - offsetX * Math.cos(headingRad) + offsetY * Math.sin(headingRad);
			const worldY = ship.runtime.position.y - offsetX * Math.sin(headingRad) - offsetY * Math.cos(headingRad);

			const cached = cache.get(ship.$id);

			if (cached) {
				if (cached.sprite.texture !== texture) {
					cached.sprite.texture = texture;
				}
				cached.sprite.position.set(worldX, worldY);
				cached.sprite.rotation = headingRad;
				cached.sprite.scale.set(scale);
			} else {
				console.log("[ShipTextureRenderer] Creating sprite for:", ship.$id, "at", worldX, worldY);
				const sprite = new Sprite(texture);
				sprite.anchor.set(0.5);
				sprite.position.set(worldX, worldY);
				sprite.rotation = headingRad;
				sprite.scale.set(scale);

				layers.shipSprites.addChild(sprite);
				cache.set(ship.$id, { sprite, shipId: ship.$id });
			}
		}
	}, [layers, ships, textureCache]);

	useEffect(() => {
		return () => {
			if (!layers?.shipSprites) return;

			for (const item of cacheRef.current.values()) {
				layers.shipSprites.removeChild(item.sprite);
				item.sprite.destroy();
			}
			cacheRef.current.clear();
		};
	}, [layers]);
}