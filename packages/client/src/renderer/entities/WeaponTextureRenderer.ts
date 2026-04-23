/**
 * 武器贴图渲染 Hook
 *
 * 职责：
 * 1. 在 weaponSprites 层渲染武器贴图精灵
 * 2. 正确应用 mount.position, mount.facing, weapon.texture offset/scale
 * 3. 相对舰船位置计算（考虑舰船旋转）
 * 4. 缓存管理
 *
 * 渲染层：world.weaponSprites (zIndex 16)
 */

import { Sprite } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";
import type { CombatToken } from "@vt/data";
import type { TextureCache } from "../systems/useTextureLoader";

interface WeaponTextureCacheItem {
	sprite: Sprite;
	shipId: string;
	mountId: string;
}

export function useWeaponTextureRendering(
	layers: LayerRegistry | null,
	ships: CombatToken[],
	textureCache: TextureCache
): void {
	const cacheRef = useRef<Map<string, WeaponTextureCacheItem>>(new Map());

	useEffect(() => {
		if (!layers?.weaponSprites) return;

		const cache = cacheRef.current;
		const currentKeys = new Set<string>();

		for (const ship of ships) {
			if (!ship.runtime?.position) continue;

			const mounts = ship.spec.mounts;
			if (!mounts) continue;

			for (const mount of mounts) {
				const weapon = mount.weapon;
				if (!weapon?.spec?.texture?.assetId) continue;

				const assetId = weapon.spec.texture.assetId;
				const texture = textureCache.get(assetId);
				if (!texture) continue;

				const cacheKey = `${ship.$id}:${mount.id}`;
				currentKeys.add(cacheKey);

				const mountOffsetX = -(mount.position?.x ?? 0);
				const mountOffsetY = -(mount.position?.y ?? 0);
				const mountFacing = mount.facing ?? 0;

				const weaponOffsetX = weapon.spec.texture.offsetX ?? 0;
				const weaponOffsetY = weapon.spec.texture.offsetY ?? 0;
				const weaponScale = weapon.spec.texture.scale ?? 1;

				const headingRad = (ship.runtime.heading * Math.PI) / 180;
				const mountWorldX = ship.runtime.position.x - mountOffsetX * Math.cos(headingRad) + mountOffsetY * Math.sin(headingRad);
				const mountWorldY = ship.runtime.position.y - mountOffsetX * Math.sin(headingRad) - mountOffsetY * Math.cos(headingRad);
				
				const worldX = mountWorldX - weaponOffsetX;
				const worldY = mountWorldY - weaponOffsetY;

				const totalRotation = ((ship.runtime.heading + mountFacing) * Math.PI) / 180;

				const cached = cache.get(cacheKey);

				if (cached) {
					if (cached.sprite.texture !== texture) {
						cached.sprite.texture = texture;
					}
					cached.sprite.position.set(worldX, worldY);
					cached.sprite.rotation = totalRotation;
					cached.sprite.scale.set(weaponScale);
				} else {
					const sprite = new Sprite(texture);
					sprite.anchor.set(0.5);
					sprite.position.set(worldX, worldY);
					sprite.rotation = totalRotation;
					sprite.scale.set(weaponScale);

					layers.weaponSprites.addChild(sprite);
					cache.set(cacheKey, { sprite, shipId: ship.$id, mountId: mount.id });
				}
			}
		}

		for (const [key, item] of cache) {
			if (!currentKeys.has(key)) {
				layers.weaponSprites.removeChild(item.sprite);
				item.sprite.destroy();
				cache.delete(key);
			}
		}
	}, [layers, ships, textureCache]);

	useEffect(() => {
		return () => {
			if (!layers?.weaponSprites) return;

			for (const item of cacheRef.current.values()) {
				layers.weaponSprites.removeChild(item.sprite);
				item.sprite.destroy();
			}
			cacheRef.current.clear();
		};
	}, [layers]);
}