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
				console.log(
					"[ShipTextureRenderer] Texture not loaded for:",
					assetId,
					"cache keys:",
					Array.from(textureCache.keys())
				);
				continue;
			}

			const offsetX = ship.spec.texture?.offsetX ?? 0;
			const offsetY = ship.spec.texture?.offsetY ?? 0;
			const scale = ship.spec.texture?.scale ?? 1;

			// 与 ShipRenderer 保持一致：rotation = heading * π/180
			const headingRad = (ship.runtime.heading * Math.PI) / 180;

			// 贴图偏移坐标系（同 mountOffsetToScreen 约定）：
			// offsetX 正值 = 右舷（heading=0时指向屏幕右侧 +X）
			// offsetY 正值 = 船头（heading=0时指向屏幕上方 -Y）
			// 旋转公式（与 getMountWorldPosition 一致）：
			//   worldX = shipX + offsetX*cos + offsetY*sin
			//   worldY = shipY + offsetX*sin - offsetY*cos
			// 验证 heading=0°：worldX = shipX + offsetX（正=右舷 ✓）
			//                worldY = shipY - offsetY（正=船头=向上 ✓）
			const cos = Math.cos(headingRad);
			const sin = Math.sin(headingRad);
			const worldX = ship.runtime.position.x + offsetX * cos + offsetY * sin;
			const worldY = ship.runtime.position.y + offsetX * sin - offsetY * cos;

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
