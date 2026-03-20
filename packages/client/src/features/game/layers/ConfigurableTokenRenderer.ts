/**
 * 配置化 Token 渲染器
 * 
 * 从 AssetRegistry 获取舰船配置，实现数据驱动的渲染
 */

import {
	Container,
	Graphics,
	Sprite,
	Texture,
} from 'pixi.js';
import type { TokenInfo } from '@vt/shared/types';
import type { HullDefinition, ShipDefinition } from '@vt/shared/config';
import { getAssetRegistry } from '@/services/AssetRegistry';

export interface ConfigurableTokenConfig {
	token: TokenInfo;
	selected?: boolean;
	zoom: number;
}

/**
 * 舰船渲染配置
 */
interface ShipRenderConfig {
	spriteKey?: string;
	spriteScale: number;
	collisionRadius: number;
	color: number;
	size: HullSize;
}

type HullSize = 'FIGHTER' | 'FRIGATE' | 'DESTROYER' | 'CRUISER' | 'CAPITAL';

/**
 * 舰船尺寸对应的颜色
 */
const HULL_SIZE_COLORS: Record<HullSize, number> = {
	FIGHTER: 0x88ff88,
	FRIGATE: 0x4a9eff,
	DESTROYER: 0xffaa4a,
	CRUISER: 0xff6a4a,
	CAPITAL: 0xaa4aff,
};

/**
 * 配置化 Token 渲染器
 */
export class ConfigurableTokenRenderer {
	private _registry = getAssetRegistry();
	
	/**
	 * 渲染 Token
	 */
	render(config: ConfigurableTokenConfig): Container {
		const { token, selected, zoom } = config;
		
		const container = new Container();
		container.position.set(token.position.x, token.position.y);
		
		// 获取渲染配置
		const renderConfig = this._getRenderConfig(token);
		
		// 尝试加载贴图
		const sprite = this._tryLoadSprite(renderConfig, token);
		if (sprite) {
			container.addChild(sprite);
		} else {
			// 回退到几何图形
			const graphics = this._renderFallback(renderConfig, token, selected);
			container.addChild(graphics);
		}
		
		// 添加选中效果
		if (selected) {
			const selection = this._renderSelection(renderConfig);
			container.addChild(selection);
		}
		
		// 添加朝向指示器
		const heading = this._renderHeadingIndicator(renderConfig, token.heading);
		container.addChild(heading);
		
		return container;
	}
	
	/**
	 * 获取渲染配置
	 */
	private _getRenderConfig(token: TokenInfo): ShipRenderConfig {
		// 尝试从元数据获取舰船定义ID
		const shipDefId = token.metadata?.shipDefinitionId as string | undefined;
		const hullDefId = token.metadata?.hullDefinitionId as string | undefined;
		
		if (shipDefId) {
			const shipDef = this._registry.getShip(shipDefId);
			if (shipDef) {
				const hullDef = this._registry.getHull(shipDef.hullId);
				if (hullDef) {
					return {
						spriteKey: hullDef.sprite,
						spriteScale: hullDef.spriteScale,
						collisionRadius: hullDef.collisionRadius,
						color: HULL_SIZE_COLORS[hullDef.size] || 0x4a9eff,
						size: hullDef.size,
					};
				}
			}
		}
		
		if (hullDefId) {
			const hullDef = this._registry.getHull(hullDefId);
			if (hullDef) {
				return {
					spriteKey: hullDef.sprite,
					spriteScale: hullDef.spriteScale,
					collisionRadius: hullDef.collisionRadius,
					color: HULL_SIZE_COLORS[hullDef.size] || 0x4a9eff,
					size: hullDef.size,
				};
			}
		}
		
		// 默认配置
		return {
			spriteScale: token.scale,
			collisionRadius: token.collisionRadius,
			color: 0x4a9eff,
			size: 'FRIGATE',
		};
	}
	
	/**
	 * 尝试加载贴图
	 */
	private _tryLoadSprite(config: ShipRenderConfig, token: TokenInfo): Sprite | null {
		if (!config.spriteKey) {
			return null;
		}
		
		const image = this._registry.getSprite(config.spriteKey);
		if (!image) {
			return null;
		}
		
		const texture = Texture.from(image);
		const sprite = new Sprite(texture);
		
		sprite.anchor.set(0.5);
		sprite.scale.set(config.spriteScale * token.scale);
		sprite.rotation = (token.heading * Math.PI) / 180;
		
		return sprite;
	}
	
	/**
	 * 渲染回退几何图形
	 */
	private _renderFallback(config: ShipRenderConfig, token: TokenInfo, selected?: boolean): Graphics {
		const graphics = new Graphics();
		const radius = config.collisionRadius * token.scale;
		
		// 根据舰船尺寸绘制不同形状
		switch (config.size) {
			case 'FIGHTER':
				// 小三角形
				graphics.moveTo(radius, 0);
				graphics.lineTo(-radius * 0.5, radius * 0.7);
				graphics.lineTo(-radius * 0.5, -radius * 0.7);
				graphics.closePath();
				break;
				
			case 'FRIGATE':
				// 菱形
				graphics.moveTo(radius, 0);
				graphics.lineTo(0, radius * 0.6);
				graphics.lineTo(-radius * 0.7, 0);
				graphics.lineTo(0, -radius * 0.6);
				graphics.closePath();
				break;
				
			case 'DESTROYER':
				// 六边形
				for (let i = 0; i < 6; i++) {
					const angle = (i * 60 - 30) * Math.PI / 180;
					const x = Math.cos(angle) * radius;
					const y = Math.sin(angle) * radius;
					if (i === 0) {
						graphics.moveTo(x, y);
					} else {
						graphics.lineTo(x, y);
					}
				}
				graphics.closePath();
				break;
				
			case 'CRUISER':
			case 'CAPITAL':
				// 八边形
				for (let i = 0; i < 8; i++) {
					const angle = (i * 45 - 22.5) * Math.PI / 180;
					const x = Math.cos(angle) * radius;
					const y = Math.sin(angle) * radius;
					if (i === 0) {
						graphics.moveTo(x, y);
					} else {
						graphics.lineTo(x, y);
					}
				}
				graphics.closePath();
				break;
		}
		
		// 填充
		graphics.fill({
			color: config.color,
			alpha: selected ? 1 : 0.8,
		});
		
		// 描边
		graphics.stroke({
			color: selected ? 0xffff00 : 0xffffff,
			width: selected ? 2 : 1,
			alpha: selected ? 1 : 0.5,
		});
		
		// 旋转
		graphics.rotation = (token.heading * Math.PI) / 180;
		
		return graphics;
	}
	
	/**
	 * 渲染选中效果
	 */
	private _renderSelection(config: ShipRenderConfig): Graphics {
		const graphics = new Graphics();
		const radius = config.collisionRadius * 1.3;
		
		graphics.circle(0, 0, radius);
		graphics.stroke({
			color: 0xffff00,
			width: 2,
			alpha: 0.8,
		});
		
		return graphics;
	}
	
	/**
	 * 渲染朝向指示器
	 */
	private _renderHeadingIndicator(config: ShipRenderConfig, heading: number): Graphics {
		const graphics = new Graphics();
		const radius = config.collisionRadius;
		
		// 三角形指示器
		const size = radius * 0.3;
		graphics.moveTo(radius + size, 0);
		graphics.lineTo(radius, -size * 0.5);
		graphics.lineTo(radius, size * 0.5);
		graphics.closePath();
		
		graphics.fill({
			color: 0x00ffff,
			alpha: 0.8,
		});
		
		graphics.rotation = (heading * Math.PI) / 180;
		
		return graphics;
	}
}

// 单例
let _instance: ConfigurableTokenRenderer | null = null;

/**
 * 获取配置化渲染器实例
 */
export function getConfigurableTokenRenderer(): ConfigurableTokenRenderer {
	if (!_instance) {
		_instance = new ConfigurableTokenRenderer();
	}
	return _instance;
}