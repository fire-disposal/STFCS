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
			if (!assetId) continue;

			const texture = textureCache.get(assetId);
			if (!texture) continue;

			const offsetX = ship.spec.texture?.offsetX ?? 0;
			const offsetY = ship.spec.texture?.offsetY ?? 0;
			const scale = ship.spec.texture?.scale ?? 1;

			const cached = cache.get(ship.$id);

			if (cached) {
				if (cached.sprite.texture !== texture) {
					cached.sprite.texture = texture;
				}
				cached.sprite.position.set(
					ship.runtime.position.x + offsetX,
					ship.runtime.position.y + offsetY
				);
				cached.sprite.rotation = (ship.runtime.heading * Math.PI) / 180;
				cached.sprite.scale.set(scale);
			} else {
				const sprite = new Sprite(texture);
				sprite.anchor.set(0.5);
				sprite.position.set(
					ship.runtime.position.x + offsetX,
					ship.runtime.position.y + offsetY
				);
				sprite.rotation = (ship.runtime.heading * Math.PI) / 180;
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