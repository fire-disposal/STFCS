/**
 * 舰船贴图渲染 Hook
 *
 * 职责：
 * 1. 在 shipSprites 层渲染舰船贴图精灵
 * 2. 正确应用 position, heading, offsetX, offsetY, scale
 * 3. 缓存管理：Map<$id, Sprite>
 *
 * 渲染层：world.shipSprites (zIndex 6)
 *
 * 贴图坐标约定：
 * - 贴图中心点对齐舰船中心
 * - offsetX：左舷为正（heading=0时指向屏幕左侧）
 * - offsetY：船头为正（heading=0时指向屏幕上方）
 * - scale：贴图缩放比例（相对于原始尺寸）
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

			// 航海角度转换：
			// - 航海坐标系：0°=船头向上，顺时针增加
			// - PixiJS rotation：正角度逆时针旋转
			// - 因此 rotation = -heading（负数让贴图顺时针旋转，匹配航海坐标系）
			const nauticalRad = (ship.runtime.heading * Math.PI) / 180;
			const pixiRotation = -nauticalRad;
			
			// 贴图位置：
			// - 贴图中心对齐舰船中心 + offset
			// - offset 是航海坐标系下的偏移，需要旋转到屏幕坐标系
			// - 屏幕坐标系：Y向下，航海坐标系：Y向上
			// - mountOffset 公式：worldX = x - offsetX*cos + offsetY*sin
			//                  worldY = y - offsetX*sin - offsetY*cos
			// - 使用正值 nauticalRad 计算 offset 旋转
			const worldX = ship.runtime.position.x - offsetX * Math.cos(nauticalRad) + offsetY * Math.sin(nauticalRad);
			const worldY = ship.runtime.position.y - offsetX * Math.sin(nauticalRad) - offsetY * Math.cos(nauticalRad);

			const cached = cache.get(ship.$id);

			if (cached) {
				if (cached.sprite.texture !== texture) {
					cached.sprite.texture = texture;
				}
				cached.sprite.position.set(worldX, worldY);
				cached.sprite.rotation = pixiRotation;
				cached.sprite.scale.set(scale);
			} else {
				console.log("[ShipTextureRenderer] Creating sprite for:", ship.$id, "at", worldX, worldY);
				const sprite = new Sprite(texture);
				sprite.anchor.set(0.5);
				sprite.position.set(worldX, worldY);
				sprite.rotation = pixiRotation;
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