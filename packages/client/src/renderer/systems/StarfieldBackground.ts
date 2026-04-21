/**
 * 星空银河背景生成器
 * 
 * 生成多层视差星空背景，包括：
 * - 深层星空（远处恒星）
 * - 中层星空（中等距离恒星）
 * - 浅层星空（近处恒星，移动最快）
 * - 银河光带（可选的银河效果）
 */

import { Graphics } from 'pixi.js';

/**
 * 恒星数据
 */
export interface Star {
  x: number;
  y: number;
  z: number; // 深度层级 (0-1, 0 最远，1 最近)
  alpha: number;
  size: number;
  color: number;
  twinkleSpeed?: number; // 闪烁速度
  twinkleOffset?: number; // 闪烁相位
}

/**
 * 星云数据
 */
export interface Nebula {
  x: number;
  y: number;
  radius: number;
  color: number;
  alpha: number;
  z: number; // 深度
}

/**
 * 星空配置
 */
export interface StarfieldConfig {
  // 各层恒星数量
  deepStars: number;
  midStars: number;
  nearStars: number;

  // 星空范围
  range: number;

  // 视差强度 (0-1)
  parallaxStrength: number;

  // 是否启用银河效果
  enableNebula: boolean;

  // 银河配置
  nebulaCount: number;
  nebulaOpacity: number;
}

/**
 * 默认配置
 */
const DEFAULT_CONFIG: StarfieldConfig = {
  deepStars: 800,
  midStars: 200,
  nearStars: 50,
  range: 8000,
  parallaxStrength: 0.5,
  enableNebula: true,
  nebulaCount: 3,
  nebulaOpacity: 0.15,
};

/**
 * 恒星颜色调色板
 */
const STAR_COLORS = [
  0xffffff, // 白色
  0xfff0e0, // 暖白
  0xffd9c8, // 橙红
  0xffe4c4, // 橙黄
  0xd4f0ff, // 蓝白
  0xc4d4ff, // 蓝色
];

/**
 * 银河颜色调色板
 */
const NEBULA_COLORS = [
  0x4a3a7a, // 紫色
  0x2a4a7a, // 深蓝
  0x3a5a8a, // 蓝色
  0x5a3a6a, // 紫红
];

/**
 * 生成单个恒星
 */
function generateStar(z: number, range: number): Star {
  const angle = Math.random() * Math.PI * 2;
  const radius = Math.random() * range;

  // 深度越近，恒星越大越亮
  const sizeBase = 0.5 + z * 1.5;
  const alphaBase = 0.3 + z * 0.5;

  return {
    x: Math.cos(angle) * radius,
    y: Math.sin(angle) * radius,
    z,
    alpha: alphaBase + Math.random() * 0.3,
    size: sizeBase + Math.random() * sizeBase,
    color: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    twinkleSpeed: 0.5 + Math.random() * 2,
    twinkleOffset: Math.random() * Math.PI * 2,
  };
}

/**
 * 生成星云
 */
function generateNebula(range: number): Nebula {
  const angle = Math.random() * Math.PI * 2;
  const radius = 500 + Math.random() * 1500;

  return {
    x: Math.cos(angle) * radius * 0.5,
    y: Math.sin(angle) * radius * 0.5,
    radius: 300 + Math.random() * 500,
    color: NEBULA_COLORS[Math.floor(Math.random() * NEBULA_COLORS.length)],
    alpha: 0.05 + Math.random() * 0.1,
    z: 0.2 + Math.random() * 0.3,
  };
}

/**
 * 星空背景生成器类
 */
export class StarfieldGenerator {
  private config: StarfieldConfig;
  private deepStars: Star[] = [];
  private midStars: Star[] = [];
  private nearStars: Star[] = [];
  private nebulas: Nebula[] = [];
  private time: number = 0;

  constructor(config: Partial<StarfieldConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.generate();
  }

  /**
   * 生成所有星空元素
   */
  generate(): void {
    const { deepStars, midStars, nearStars, range, nebulaCount } = this.config;

    // 生成各层恒星
    this.deepStars = Array.from({ length: deepStars }, () =>
      generateStar(0.1 + Math.random() * 0.2, range)
    );

    this.midStars = Array.from({ length: midStars }, () =>
      generateStar(0.3 + Math.random() * 0.3, range)
    );

    this.nearStars = Array.from({ length: nearStars }, () =>
      generateStar(0.6 + Math.random() * 0.3, range)
    );

    // 生成星云
    this.nebulas = Array.from({ length: nebulaCount }, () =>
      generateNebula(range)
    );
  }

  /**
   * 更新闪烁动画
   */
  update(deltaTime: number = 0.016): void {
    this.time += deltaTime;
  }

  /**
   * 计算视差偏移
   */
  getParallaxOffset(cameraX: number, cameraY: number, z: number): { x: number; y: number } {
    const { parallaxStrength } = this.config;
    const factor = (1 - z) * parallaxStrength;
    return {
      x: cameraX * factor,
      y: cameraY * factor,
    };
  }

  /**
   * 绘制深层星空
   * 注意：视差效果已在容器层级通过 useLayerSystem.updateWorldTransforms 实现
   */
  drawDeepStars(graphics: Graphics, cameraX: number, cameraY: number): void {
    for (const star of this.deepStars) {
      // 闪烁效果
      const twinkle = star.twinkleSpeed
        ? Math.sin(this.time * star.twinkleSpeed! + star.twinkleOffset!) * 0.2 + 0.8
        : 1;

      graphics.circle(star.x, star.y, star.size);
      graphics.fill({ color: star.color, alpha: star.alpha * twinkle });
    }
  }

  /**
   * 绘制中层星空
   * 注意：视差效果已在容器层级通过 useLayerSystem.updateWorldTransforms 实现
   */
  drawMidStars(graphics: Graphics, cameraX: number, cameraY: number): void {
    for (const star of this.midStars) {
      const twinkle = star.twinkleSpeed
        ? Math.sin(this.time * star.twinkleSpeed! + star.twinkleOffset!) * 0.3 + 0.7
        : 1;

      graphics.circle(star.x, star.y, star.size);
      graphics.fill({ color: star.color, alpha: star.alpha * twinkle });
    }
  }

  /**
   * 绘制浅层星空
   * 注意：视差效果已在容器层级通过 useLayerSystem.updateWorldTransforms 实现
   */
  drawNearStars(graphics: Graphics, cameraX: number, cameraY: number): void {
    for (const star of this.nearStars) {
      const twinkle = star.twinkleSpeed
        ? Math.sin(this.time * star.twinkleSpeed! * 2 + star.twinkleOffset!) * 0.4 + 0.6
        : 1;

      graphics.circle(star.x, star.y, star.size * 1.2);
      graphics.fill({ color: star.color, alpha: star.alpha * twinkle });
    }
  }

  /**
   * 绘制银河星云
   * 注意：视差效果已在容器层级通过 useLayerSystem.updateWorldTransforms 实现
   */
  drawNebula(graphics: Graphics, cameraX: number, cameraY: number): void {
    if (!this.config.enableNebula) return;

    const time = this.time * 0.1; // 缓慢移动

    for (const nebula of this.nebulas) {
      // 星云缓慢漂移（保留自然漂移效果，但移除视差偏移）
      const x = nebula.x + Math.sin(time + nebula.radius) * 50;
      const y = nebula.y + Math.cos(time + nebula.radius) * 50;

      // 绘制多层渐变星云效果
      const layers = 5;
      for (let i = 0; i < layers; i++) {
        const layerRadius = nebula.radius * (1 - i / layers);
        const layerAlpha = nebula.alpha * this.config.nebulaOpacity * (1 - i / layers);

        graphics.circle(x, y, layerRadius);
        graphics.fill({
          color: nebula.color,
          alpha: layerAlpha
        });
      }
    }
  }

  /**
   * 绘制完整星空背景
   */
  draw(
    graphics: Graphics,
    cameraX: number,
    cameraY: number,
    layers: ('deep' | 'mid' | 'near' | 'nebula')[] = ['deep', 'mid', 'near', 'nebula']
  ): void {
    graphics.clear();

    // 按深度顺序绘制：星云 -> 深层 -> 中层 -> 浅层
    if (layers.includes('nebula')) {
      this.drawNebula(graphics, cameraX, cameraY);
    }

    if (layers.includes('deep')) {
      this.drawDeepStars(graphics, cameraX, cameraY);
    }

    if (layers.includes('mid')) {
      this.drawMidStars(graphics, cameraX, cameraY);
    }

    if (layers.includes('near')) {
      this.drawNearStars(graphics, cameraX, cameraY);
    }
  }
}

/**
 * 创建优化的星空背景（使用批处理）
 */
export function createOptimizedStarfield(
  config: Partial<StarfieldConfig> = {}
): {
  generator: StarfieldGenerator;
  deepGraphics: Graphics;
  midGraphics: Graphics;
  nearGraphics: Graphics;
  nebulaGraphics: Graphics;
} {
  const generator = new StarfieldGenerator(config);

  return {
    generator,
    deepGraphics: new Graphics(),
    midGraphics: new Graphics(),
    nearGraphics: new Graphics(),
    nebulaGraphics: new Graphics(),
  };
}
