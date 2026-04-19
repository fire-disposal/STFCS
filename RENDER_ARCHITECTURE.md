# 高性能渲染架构设计

## 设计目标

1. **保留现有UI和视觉效果**：保持用户体验一致性
2. **重新设计Pixi.js渲染系统**：解决当前性能问题
3. **构建高性能图层系统**：优化渲染性能，支持复杂场景
4. **集成新的状态管理**：与ImmutableStateStore无缝集成
5. **支持未来扩展**：易于添加新视觉效果和交互

## 当前问题分析

### 现有渲染系统问题
1. **图层管理混乱**：层级结构不够清晰
2. **性能问题**：频繁的DOM操作和状态更新
3. **状态同步延迟**：渲染与游戏状态不同步
4. **内存泄漏**：Pixi.js对象未正确清理
5. **渲染效率低**：没有充分利用Pixi.js的批处理和缓存

## 新渲染架构设计

### 整体架构
```
┌─────────────────────────────────────────────────────────────┐
│                    React UI Layer                           │
│  Pages │ Components │ Hooks                                 │
└─────────────────────┬───────────────────────────────────────┘
                      │ React状态更新
┌─────────────────────▼───────────────────────────────────────┐
│               Render Orchestrator                           │
│  协调渲染请求，管理渲染优先级，批量更新                     │
└─────────────────────┬───────────────────────────────────────┘
                      │ 渲染指令
┌─────────────────────▼───────────────────────────────────────┐
│               Render Engine (Pixi.js)                       │
│  LayerSystem │ EntitySystem │ EffectSystem │ CameraSystem   │
└─────────────────────┬───────────────────────────────────────┘
                      │ 游戏状态
┌─────────────────────▼───────────────────────────────────────┐
│               Game State (ImmutableStateStore)              │
│  不可变游戏状态，细粒度更新通知                             │
└─────────────────────────────────────────────────────────────┘
```

### 核心模块

#### 1. RenderOrchestrator (`src/core/render/RenderOrchestrator.ts`)
**职责**：协调渲染请求，管理渲染优先级

**特性**：
- 渲染请求队列（优先级排序）
- 批量渲染更新（减少重绘）
- 渲染节流（高频率更新时）
- 渲染统计和性能监控

#### 2. LayerSystem (`src/core/render/LayerSystem.ts`)
**职责**：管理渲染图层，优化渲染性能

**图层结构**：
```
Stage (PIXI.Container)
├── BackgroundLayer (zIndex: -1000)
│   ├── Starfield (视差背景)
│   └── Nebula (星云效果)
├── WorldLayer (zIndex: 0)
│   ├── GridLayer (网格)
│   ├── TerrainLayer (地形)
│   ├── ShipLayer (舰船)
│   │   ├── ShipSprites (舰船精灵)
│   │   ├── ShipIcons (舰船图标)
│   │   └── ShipEffects (舰船特效)
│   ├── WeaponLayer (武器)
│   │   ├── WeaponArcs (武器射界)
│   │   └── Projectiles (弹道)
│   ├── EffectLayer (特效)
│   │   ├── Explosions (爆炸)
│   │   ├── Particles (粒子)
│   │   └── Shields (护盾)
│   └── DebugLayer (调试)
│       ├── HitBoxes (碰撞框)
│       └── PathVisuals (路径可视化)
└── UILayer (zIndex: 1000)
    ├── HUDLayer (游戏HUD)
    │   ├── HealthBars (血条)
    │   ├── Names (名称标签)
    │   └── Indicators (状态指示器)
    ├── OverlayLayer (覆盖层)
    │   ├── Tooltips (工具提示)
    │   └── Notifications (通知)
    └── CursorLayer (光标)
        ├── WorldCursor (世界光标)
        └── SelectionBox (选择框)
```

#### 3. EntitySystem (`src/core/render/EntitySystem.ts`)
**职责**：管理游戏实体渲染，支持实体池

**特性**：
- 实体池（复用Pixi对象，减少GC）
- 脏检查系统（只更新变化的实体）
- 视口裁剪（只渲染可见实体）
- 批处理渲染（相同材质的实体批量渲染）

#### 4. EffectSystem (`src/core/render/EffectSystem.ts`)
**职责**：管理视觉效果和粒子系统

**特性**：
- 粒子池（复用粒子对象）
- 效果生命周期管理
- 性能分级（根据设备性能调整效果质量）
- 效果合并（相同效果批量处理）

#### 5. CameraSystem (`src/core/render/CameraSystem.ts`)
**职责**：管理相机和视口

**特性**：
- 平滑相机移动（缓动动画）
- 视口裁剪（只渲染可见区域）
- 多相机支持（分屏、画中画）
- 相机效果（震动、模糊、变焦）

## 文件树结构

```
packages/client/src/
├── core/
│   └── render/                    # 渲染核心
│       ├── RenderOrchestrator.ts  # 渲染协调器
│       ├── LayerSystem.ts         # 图层系统
│       ├── EntitySystem.ts        # 实体系统
│       ├── EffectSystem.ts        # 特效系统
│       ├── CameraSystem.ts        # 相机系统
│       ├── RenderPipeline.ts      # 渲染管道
│       └── RenderConfig.ts        # 渲染配置
├── render/                        # 渲染实现
│   ├── layers/                    # 图层实现
│   │   ├── BackgroundLayer.ts     # 背景层
│   │   ├── WorldLayer.ts          # 世界层
│   │   ├── ShipLayer.ts           # 舰船层
│   │   ├── WeaponLayer.ts         # 武器层
│   │   ├── EffectLayer.ts         # 特效层
│   │   ├── UILayer.ts             # UI层
│   │   └── DebugLayer.ts          # 调试层
│   ├── entities/                  # 实体渲染
│   │   ├── ShipRenderer.ts        # 舰船渲染器
│   │   ├── WeaponRenderer.ts      # 武器渲染器
│   │   ├── ProjectileRenderer.ts  # 弹道渲染器
│   │   └── EntityPool.ts          # 实体池
│   ├── effects/                   # 特效渲染
│   │   ├── ParticleSystem.ts      # 粒子系统
│   │   ├── ExplosionEffect.ts     # 爆炸特效
│   │   ├── ShieldEffect.ts        # 护盾特效
│   │   └── EffectPool.ts          # 特效池
│   ├── ui/                        # UI渲染
│   │   ├── HealthBarRenderer.ts   # 血条渲染器
│   │   ├── NameTagRenderer.ts     # 名称标签渲染器
│   │   ├── IndicatorRenderer.ts   # 指示器渲染器
│   │   └── CursorRenderer.ts      # 光标渲染器
│   └── utils/                     # 渲染工具
│       ├── TextureManager.ts      # 纹理管理器
│       ├── ShaderManager.ts       # 着色器管理器
│       ├── GeometryCache.ts       # 几何缓存
│       └── PerformanceMonitor.ts  # 性能监控
└── hooks/                         # React Hooks
    ├── useRenderEngine.ts         # 渲染引擎Hook
    ├── useLayerSystem.ts          # 图层系统Hook
    ├── useCamera.ts               # 相机Hook
    └── useRenderStats.ts          # 渲染统计Hook
```

## 性能优化策略

### 1. 实体池系统
```typescript
class EntityPool<T extends PIXI.DisplayObject> {
  private pool: T[] = []
  private active: Set<T> = new Set()
  
  acquire(): T {
    if (this.pool.length > 0) {
      const entity = this.pool.pop()!
      this.active.add(entity)
      return entity
    }
    const entity = this.createEntity()
    this.active.add(entity)
    return entity
  }
  
  release(entity: T): void {
    this.active.delete(entity)
    this.resetEntity(entity)
    this.pool.push(entity)
  }
  
  // 每帧清理
  update(): void {
    for (const entity of this.active) {
      if (!entity.parent) {
        this.release(entity)
      }
    }
  }
}
```

### 2. 脏检查系统
```typescript
class DirtyCheckSystem {
  private dirtyEntities: Set<Entity> = new Set()
  private lastUpdateTime: number = 0
  
  markDirty(entity: Entity): void {
    this.dirtyEntities.add(entity)
  }
  
  update(): void {
    const now = Date.now()
    if (now - this.lastUpdateTime < 16) return // 60fps限制
    
    for (const entity of this.dirtyEntities) {
      if (entity.needsUpdate()) {
        entity.updateRender()
      }
    }
    
    this.dirtyEntities.clear()
    this.lastUpdateTime = now
  }
}
```

### 3. 视口裁剪
```typescript
class ViewportCuller {
  private viewport: PIXI.Rectangle
  
  isVisible(entity: Entity): boolean {
    const bounds = entity.getBounds()
    return this.viewport.intersects(bounds)
  }
  
  cull(entities: Entity[]): Entity[] {
    return entities.filter(entity => this.isVisible(entity))
  }
}
```

### 4. 批处理渲染
```typescript
class BatchRenderer {
  private batches: Map<string, PIXI.Container> = new Map()
  
  addToBatch(textureId: string, sprite: PIXI.Sprite): void {
    let batch = this.batches.get(textureId)
    if (!batch) {
      batch = new PIXI.Container()
      this.batches.set(textureId, batch)
    }
    batch.addChild(sprite)
  }
  
  render(): void {
    for (const [textureId, batch] of this.batches) {
      // 批量渲染相同纹理的精灵
      this.renderBatch(batch)
    }
  }
}
```

## 状态同步设计

### 状态到渲染的映射
```typescript
class StateToRenderMapper {
  constructor(
    private stateStore: ImmutableStateStore<AppState>,
    private renderOrchestrator: RenderOrchestrator
  ) {
    // 订阅状态变化
    stateStore.subscribeToPath('game.ships', (ships) => {
      renderOrchestrator.requestRender('ships', ships)
    })
    
    stateStore.subscribeToPath('game.weapons', (weapons) => {
      renderOrchestrator.requestRender('weapons', weapons)
    })
    
    stateStore.subscribeToPath('ui.camera', (camera) => {
      renderOrchestrator.requestRender('camera', camera)
    })
  }
}
```

### 渲染优先级系统
```typescript
enum RenderPriority {
  CRITICAL = 0,    // 用户交互、动画
  HIGH = 1,        // 游戏状态更新
  NORMAL = 2,      // 视觉效果
  LOW = 3,         // 背景、装饰
  BACKGROUND = 4   // 预加载、缓存
}

class RenderOrchestrator {
  private queue: Array<{
    priority: RenderPriority
    type: string
    data: any
    timestamp: number
  }> = []
  
  requestRender(type: string, data: any, priority: RenderPriority = RenderPriority.NORMAL): void {
    this.queue.push({
      priority,
      type,
      data,
      timestamp: Date.now()
    })
    
    // 按优先级排序
    this.queue.sort((a, b) => {
      if (a.priority !== b.priority) return a.priority - b.priority
      return a.timestamp - b.timestamp
    })
  }
  
  processQueue(): void {
    const batchSize = 10 // 每帧处理的最大数量
    for (let i = 0; i < batchSize && this.queue.length > 0; i++) {
      const request = this.queue.shift()!
      this.processRequest(request)
    }
  }
}
```

## 内存管理

### 纹理管理
```typescript
class TextureManager {
  private textures: Map<string, PIXI.Texture> = new Map()
  private textureUsage: Map<string, number> = new Map()
  
  async loadTexture(url: string): Promise<PIXI.Texture> {
    if (this.textures.has(url)) {
      this.textureUsage.set(url, (this.textureUsage.get(url) || 0) + 1)
      return this.textures.get(url)!
    }
    
    const texture = await PIXI.Texture.fromURL(url)
    this.textures.set(url, texture)
    this.textureUsage.set(url, 1)
    
    return texture
  }
  
  releaseTexture(url: string): void {
    const usage = (this.textureUsage.get(url) || 1) - 1
    if (usage <= 0) {
      const texture = this.textures.get(url)
      if (texture) {
        texture.destroy()
        this.textures.delete(url)
        this.textureUsage.delete(url)
      }
    } else {
      this.textureUsage.set(url, usage)
    }
  }
  
  cleanupUnused(): void {
    for (const [url, usage] of this.textureUsage) {
      if (usage <= 0) {
        this.releaseTexture(url)
      }
    }
  }
}
```

### 几何缓存
```typescript
class GeometryCache {
  private cache: Map<string, PIXI.GraphicsGeometry> = new Map()
  
  getCircle(radius: number, color: number): PIXI.GraphicsGeometry {
    const key = `circle_${radius}_${color}`
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }
    
    const graphics = new PIXI.Graphics()
    graphics.beginFill(color)
    graphics.drawCircle(0, 0, radius)
    graphics.endFill()
    
    const geometry = graphics.geometry
    this.cache.set(key, geometry)
    
    return geometry
  }
  
  getRect(width: number, height: number, color: number): PIXI.GraphicsGeometry {
    const key = `rect_${width}_${height}_${color}`
    if (this.cache.has(key)) {
      return this.cache.get(key)!
    }
    
    const graphics = new PIXI.Graphics()
    graphics.beginFill(color)
    graphics.drawRect(-width/2, -height/2, width, height)
    graphics.endFill()
    
    const geometry = graphics.geometry
    this.cache.set(key, geometry)
    
    return geometry
  }
}
```

## 性能监控

### 渲染统计
```typescript
class RenderStats {
  private stats = {
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    entities: 0,
    batches: 0,
    memory: 0
  }
  
  private frameCount = 0
  private lastTime = 0
  
  update(): void {
    const now = Date.now()
    this.frameCount++
    
    if (now - this.lastTime >= 1000) {
      this.stats.fps = this.frameCount
      this.frameCount = 0
      this.lastTime = now
      
      // 更新其他统计
      this.updateMemoryStats()
      this.updateRenderStats()
    }
  }
  
  getStats(): RenderStatsData {
    return { ...this.stats }
  }
  
  logPerformance(): void {
    console.log(`FPS: ${this.stats.fps}, Draw Calls: ${this.stats.drawCalls}, Entities: ${this.stats.entities}`)
  }
}
```

## 实施计划

### 阶段1：基础渲染架构（1周）
1. 创建RenderOrchestrator和基础渲染管道
2. 实现LayerSystem和基础图层结构
3. 创建EntitySystem和实体池
4. 集成Pixi.js和基础渲染循环

### 阶段2：实体渲染系统（1周）
1. 实现ShipRenderer和舰船渲染
2. 实现WeaponRenderer和武器渲染
3. 创建EffectSystem和粒子系统
4. 实现CameraSystem和相机控制

### 阶段3：UI和效果集成（1周）
1. 实现UILayer和HUD渲染
2. 集成现有UI组件到新渲染系统
3. 添加视觉效果（爆炸、护盾、粒子）
4. 实现性能监控和调试工具

### 阶段4：优化和测试（1周）
1. 性能优化（实体池、批处理、视口裁剪）
2. 内存管理优化（纹理管理、几何缓存）
3. 压力测试（大量实体、复杂场景）
4. 兼容性测试（不同设备、浏览器）

## 成功指标

### 性能指标
- **FPS**：稳定60fps（复杂场景不低于30fps）
- **内存使用**：< 200MB（100艘舰船场景）
- **加载时间**：首次加载 < 2秒，场景切换 < 1秒
- **渲染延迟**：状态更新到渲染显示 < 50ms

### 质量指标
- **视觉效果**：保持或提升现有视觉效果质量
- **响应速度**：用户操作到视觉反馈 < 100ms
- **稳定性**：无内存泄漏，无崩溃
- **兼容性**：支持主流浏览器和移动设备

### 开发指标
- **代码质量**：类型安全，测试覆盖率 > 80%
- **维护性**：模块化设计，易于扩展
- **文档**：完整的API文档和示例
- **性能监控**：实时性能统计和告警

## 总结

这个新的渲染架构通过重新设计图层系统、引入实体池、优化状态同步，解决了当前渲染系统的性能问题。通过模块化设计和性能优化策略，确保了系统在高负载场景下的稳定性和流畅性。同时保持了现有UI和视觉效果的一致性，为用户提供更好的游戏体验。