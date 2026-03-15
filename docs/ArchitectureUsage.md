# 新架构使用指南

## 🎯 架构目标

1. **减少开发负担** - 自动化重复工作
2. **类型安全** - 编译时检查 + 运行时验证
3. **单一来源** - 避免重复定义
4. **易于扩展** - 清晰的职责分离

---

## 📁 核心架构

### 1. 统一类型来源

```
packages/shared/src/
├── core-types.ts         ← 所有类型的唯一来源
│   ├── Schema 定义
│   └── 从 Schema 推导类型
│
├── types/index.ts        ← 统一导出（向后兼容）
├── protocol/messages.ts  ← 消息协议
└── events/EventBus.ts    ← 事件总线
```

### 2. 添加新类型

**只需在 `core-types.ts` 中定义一次：**

```typescript
// core-types.ts

// 1. 定义 Schema
export const NewEntitySchema = z.object({
  id: z.string(),
  name: z.string().min(1),
  createdAt: z.number(),
});

// 2. 推导类型（自动保持同步）
export type NewEntity = z.infer<typeof NewEntitySchema>;
```

**在其他文件中使用：**

```typescript
// 导入类型
import type { NewEntity } from '../core-types';

// 导入 Schema（用于验证）
import { NewEntitySchema } from '../core-types';

// ❌ 不要重复定义
// interface NewEntity { ... }  // 错误！
```

### 3. 定义消息类型

```typescript
// protocol/messages.ts
import { NewEntitySchema } from '../core-types';

export const EntityMessages = {
  ENTITY_CREATED: {
    type: 'ENTITY_CREATED' as const,
    schema: NewEntitySchema,  // 直接使用现有 Schema
    broadcast: true,
  },
};
```

### 4. 发布领域事件

```typescript
// 服务端应用服务
import { EventBus } from '@vt/shared/events';

export class EntityService {
  constructor(private eventBus: EventBus) {}

  async createEntity(data: CreateEntityData) {
    // ... 业务逻辑
    
    // 发布事件（自动转换为 WS 消息并广播）
    await this.eventBus.publish({
      type: 'ENTITY_CREATED',
      id: entity.id,
      name: entity.name,
      createdAt: Date.now(),
    }, { roomId });
  }
}
```

### 5. 客户端自动状态同步

```typescript
// 客户端 WebSocketService 已集成 StateSync
// WS 消息自动同步到 Redux store

// 无需手动处理
this.ws.on('ENTITY_CREATED', (payload) => {
  store.dispatch(addEntity(payload));  // ❌ 不需要手动分发
});

// StateSync 会自动处理
```

---

## 🔧 开发工作流

### 添加新功能

#### 1. 定义类型 (core-types.ts)
```typescript
export const FeatureSchema = z.object({
  id: z.string(),
  // ...
});
export type Feature = z.infer<typeof FeatureSchema>;
```

#### 2. 定义消息 (protocol/messages.ts)
```typescript
export const FeatureMessages = {
  FEATURE_EVENT: {
    type: 'FEATURE_EVENT' as const,
    schema: FeatureSchema,
    broadcast: true,
  },
};
```

#### 3. 服务端发布事件
```typescript
await eventBus.publish({
  type: 'FEATURE_EVENT',
  // ...
}, { roomId });
```

#### 4. 客户端自动同步
```typescript
// StateSync 自动处理
// 如需自定义，在 StateSync 中添加处理器
```

---

## 📊 状态管理

### 客户端 Redux Store

```
store/
├── slices/
│   ├── cameraSlice.ts      ← 相机状态
│   ├── mapSlice.ts         ← 地图/Token 状态
│   ├── selectionSlice.ts   ← 选中状态
│   ├── interactionSlice.ts ← 交互状态
│   └── ...
└── sync/
    └── StateSync.ts        ← 自动 WS → Redux 同步
```

### StateSync 处理的消息

```typescript
// 已自动处理的消息类型
- PLAYER_JOINED, PLAYER_LEFT
- TOKEN_PLACED, TOKEN_MOVED
- OBJECT_SELECTED, OBJECT_DESELECTED
- SELECTION_UPDATE
- TOKEN_DRAG_START, TOKEN_DRAGGING, TOKEN_DRAG_END
- SHIP_MOVED, SHIP_STATUS_UPDATE
- EXPLOSION, DAMAGE_DEALT
- CAMERA_UPDATED
- ROOM_UPDATE
```

### 添加自定义同步

```typescript
// StateSync.ts
private handleDefault(message: WSMessage, dispatch: AppDispatch) {
  switch (message.type) {
    case 'NEW_FEATURE': {
      dispatch(addFeature(message.payload));
      break;
    }
  }
}
```

---

## 🎨 图层系统

### 图层结构

```
LayerRegistry (zIndex 从低到高)
├── 0. background
├── 1. grid
├── 2. tokens
├── 3. shields
├── 4. weapons
├── 5. statusBars
├── 6. overlay
├── 7. effects
├── 8. otherPlayersCameras
└── 9. selections  ← 选中状态在最上层
```

### 添加新图层

```typescript
// 1. LayerManager.ts
export interface LayerRegistry {
  // ...
  newLayer: Container;
}

// 2. 设置 zIndex
export const LAYER_CONFIG = {
  newLayer: { zIndex: 10, name: 'New Layer' },
};

// 3. types.ts 添加 LayerId
export enum LayerId {
  NEW_LAYER = 'newLayer',
}

// 4. GameCanvas.tsx 渲染
renderNewLayer(layers.newLayer, config);
```

### 图层可见性控制

```typescript
// LayerControlPanel 自动显示所有图层
// 无需手动添加，使用 useLayerManager hook

const layerManager = useLayerManager();
layerManager.setLayerVisibility(LayerId.NEW_LAYER, false);
```

---

## 🚀 最佳实践

### ✅ 推荐

```typescript
// 1. 从统一来源导入类型
import type { PlayerInfo, TokenInfo } from '@vt/shared/core-types';

// 2. 使用事件总线发布事件
await eventBus.publish(event, context);

// 3. 使用 StateSync 自动同步
// 无需手动 dispatch

// 4. 使用图层管理器
const { setLayerVisibility } = useLayerManager();
```

### ❌ 避免

```typescript
// 1. 重复定义类型
interface PlayerInfo { ... }  // ❌ 从 core-types 导入

// 2. 直接操作 DOM/Pixi
canvas.innerHTML = ''  // ❌ 使用 PixiJS API

// 3. 手动同步状态
ws.on('TOKEN_MOVED', (p) => {
  dispatch(updateToken(p));  // ❌ StateSync 已处理
});

// 4. 硬编码图层顺序
layer.zIndex = 5;  // ❌ 使用 LAYER_CONFIG
```

---

## 📝 检查清单

### 提交前检查

- [ ] 新类型是否在 `core-types.ts` 中定义？
- [ ] 是否从 schema 推导类型？
- [ ] 是否避免了重复定义？
- [ ] 事件是否通过 EventBus 发布？
- [ ] 客户端状态同步是否已配置？
- [ ] 图层是否使用统一配置？

### 代码审查要点

- [ ] 类型安全性
- [ ] 职责分离
- [ ] 可测试性
- [ ] 性能影响
- [ ] 向后兼容性

---

## 🔍 故障排查

### 类型错误

```bash
# 检查 shared 包
pnpm exec tsc --noEmit -p packages/shared/tsconfig.json

# 检查 client 包
pnpm exec tsc --noEmit -p packages/client/tsconfig.json

# 检查 server 包
pnpm exec tsc --noEmit -p packages/server/tsconfig.json
```

### 运行时错误

```typescript
// 启用 StateSync 日志
const stateSync = createStateSync({ enableLogging: true });

// 检查事件总线
eventBus.subscribeAll((event) => {
  console.log('Event published:', event);
});
```

---

## 📚 相关文档

- [TypeUnification.md](./TypeUnification.md) - 类型统一化指南
- [ArchitectureOptimization.md](./ArchitectureOptimization.md) - 架构优化方案
- [OptimizationProgress.md](./OptimizationProgress.md) - 优化进度

---

## 🎯 未来规划

### P1 - 中优先级
- [ ] 完成 MessageHandler 事件总线集成
- [ ] 应用服务层发布领域事件
- [ ] 完善类型定义

### P2 - 低优先级
- [ ] 添加集成测试
- [ ] 性能优化
- [ ] 文档完善
