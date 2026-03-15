# 架构优化分析报告

## 📊 当前架构状态

### 顶层结构
```
packages/
├── client/          # 前端应用 (Vue/React + PixiJS + Redux)
├── server/          # 后端服务 (Node.js + DDD 分层)
└── shared/          # 共享类型和协议
```

---

## 🔍 发现的问题

### 1. 通讯类型传递未标准化

#### 问题描述
当前 WebSocket 消息类型定义分散，存在以下问题：

**问题 1.1: 消息类型定义冗余**
```typescript
// shared/ws/index.ts - 定义了 50+ 个消息接口
export interface PlayerJoinedMessage { ... }
export interface ShipMovedMessage { ... }
export interface TokenMovedMessage { ... }
// ... 大量重复的消息接口定义
```

**问题 1.2: 前后端消息处理不一致**
- 前端：`websocket.ts` 中手动注册每个消息类型的处理器
- 后端：`MessageHandler.ts` 中使用 switch-case 处理消息
- 缺乏统一的类型推导和验证机制

**问题 1.3: 领域事件与 WS 消息混用**
```typescript
// domain/ship/events.ts - 领域事件
export interface ShipMovedEvent {
  type: 'SHIP_MOVED';
  shipId: string;
  // ...
}

// shared/ws/index.ts - WS 消息
export interface ShipMovedMessage {
  type: 'SHIP_MOVED';
  payload: ShipMovement;
  // ...
}
```
两套事件系统结构相似但不统一，导致转换逻辑分散。

---

### 2. 多层视图机制缺乏统一管理

#### 问题描述
当前视图管理分散在多个层面：

**问题 2.1: 图层管理分散**
```typescript
// LayerManager.ts - PixiJS 图层
export interface LayerRegistry {
  background: Container;
  tokens: Container;
  selections: Container; // zIndex: 9
}

// layerSlice.ts - Redux 状态
interface LayerState {
  visibility: Record<LayerId, boolean>;
  currentViewMode: ViewMode;
}

// GameCanvas.tsx - 手动同步
const showSelections = layerVisibility[LayerId.SELECTIONS] ?? true;
if (showSelections) {
  renderSelectionLayer(layers.selections, ...);
}
```

**问题 2.2: 视图模式配置重复**
```typescript
// types.ts - 视图模式配置
export const VIEW_MODE_CONFIGS = [
  {
    mode: ViewMode.TACTICAL,
    layerVisibility: {
      [LayerId.SELECTIONS]: true,
      // ...
    }
  }
];

// GameCanvas.tsx - 手动检查
const showSelections = layerVisibility[LayerId.SELECTIONS] ?? true;
```

**问题 2.3: 缺少视图更新协调机制**
- 相机变化 → 需要更新哪些图层？
- Token 更新 → 需要重绘哪些图层？
- 当前依赖手动 `useEffect` 和 `renderAllLayers`

---

### 3. 状态管理冗余

#### 问题描述
Redux store 中存在大量重复状态：

**问题 3.1: 跨 Slice 重复**
```typescript
// mapSlice.ts
tokens: Record<string, TokenInfo>;
selectedTokenId: string | null;
otherPlayersCameras: Record<string, PlayerCamera>;

// selectionSlice.ts
selectedTokenId: string | null;
selections: Record<string, SelectionRecord>;

// shipSlice.ts
ships: Record<string, ShipStatus>;
selectedShipId: string | null;
```

**问题 3.2: 服务端状态与客户端状态混用**
```typescript
// mapSlice.ts - Token 数据（部分来自服务器，部分本地）
tokens: {
  ship_1: {
    id: "ship_1",
    position: { x: 1000, y: 1000 },
    // ... 游戏状态
  }
}

// interactionSlice.ts - 纯本地 UI 状态
mode: "idle" | "hoverToken" | "dragToken";
cursor: "default" | "grab" | "grabbing";
```

**问题 3.3: 缺少状态同步机制**
```typescript
// websocket.ts - 手动分发
this.on(WS_MESSAGE_TYPES.SHIP_MOVED, (payload) => {
  const data = payload as ShipMovedPayload;
  console.log("Ship moved:", data);
  // ❌ 没有自动更新 Redux store
});
```

---

### 4. 业务逻辑分层不清晰

#### 问题描述
DDD 分层在实际使用中存在模糊：

**问题 4.1: Application 层直接依赖 Infrastructure**
```typescript
// SelectionService.ts (Application 层)
export class SelectionService extends BaseService {
  private _wsServer?: IWSServer; // ❌ 直接依赖基础设施
  
  broadcastSelectionUpdate(roomId: string): void {
    if (!this._wsServer) return;
    this._wsServer.broadcast({ ... });
  }
}
```

**问题 4.2: Domain 层事件定义不完整**
```typescript
// domain/ship/events.ts
export interface ShipMovedEvent {
  type: 'SHIP_MOVED';
  shipId: string;
  // ❌ 缺少 roomId 等上下文信息
}

// application/ship/ShipService.ts
// ❌ 需要在应用层补充上下文
```

**问题 4.3: 领域服务职责过重**
```typescript
// ShipService.ts 包含：
- 舰船移动逻辑
- 护盾管理
- Flux 系统
- WebSocket 广播
// 单一职责原则被违反
```

---

## ✅ 优化方案

### 方案 1: 统一通讯协议层

#### 1.1 创建消息协议定义语言 (Message Protocol DSL)

```typescript
// shared/protocol/messages.ts

// 定义消息目录
export const MessageDirectory = {
  // 玩家相关
  PLAYER_JOINED: defineMessage('PLAYER_JOINED', {
    payload: z.object({ id: z.string(), name: z.string() }),
    broadcast: true,
  }),
  
  // Token 相关
  TOKEN_SELECTED: defineMessage('TOKEN_SELECTED', {
    payload: z.object({
      tokenId: z.string(),
      playerId: z.string(),
      isDMMode: z.boolean(),
    }),
    broadcast: true,
  }),
  
  // 请求 - 响应
  SELECT_TOKEN: defineRequest('SELECT_TOKEN', {
    request: z.object({ tokenId: z.string() }),
    response: z.object({ success: z.boolean() }),
  }),
} as const;

// 类型推导
export type MessageMap = InferMessageMap<typeof MessageDirectory>;
export type WSMessage = InferWSMessage<typeof MessageDirectory>;
```

#### 1.2 统一事件总线

```typescript
// shared/events/EventBus.ts

// 定义领域事件
export const DomainEvents = {
  SHIP_MOVED: defineEvent('SHIP_MOVED', {
    schema: z.object({
      shipId: z.string(),
      previousPosition: PointSchema,
      newPosition: PointSchema,
      phase: z.number(),
    }),
    toWSMessage: (event, roomId) => ({
      type: WS_MESSAGE_TYPES.SHIP_MOVED,
      payload: { ...event, roomId },
    }),
  }),
};

// 类型安全的事件总线
export interface IEventBus {
  publish<T extends DomainEventType>(
    event: DomainEvent<T>,
    context: EventContext
  ): Promise<void>;
  
  subscribe<T extends DomainEventType>(
    type: T,
    handler: (event: DomainEvent<T>) => void
  ): Unsubscribe;
}
```

#### 1.3 自动化消息处理

```typescript
// client/services/MessageDispatcher.ts

export class MessageDispatcher {
  constructor(
    private ws: WebSocketService,
    private store: AppStore,
    private eventBus: EventBus
  ) {
    this.registerHandlers();
  }
  
  private registerHandlers() {
    // 自动注册所有消息处理器
    Object.entries(MessageDirectory).forEach(([type, config]) => {
      this.ws.on(type as WSMessageType, (payload) => {
        const validated = config.schema.parse(payload);
        this.handleMessage(type, validated);
      });
    });
  }
  
  private handleMessage(type: string, payload: any) {
    // 自动分发到 Redux 或事件总线
    if (payload.broadcast) {
      this.eventBus.publish(type, payload);
    }
  }
}
```

---

### 方案 2: 统一视图管理框架

#### 2.1 视图状态机

```typescript
// client/features/view/ViewManager.ts

export interface ViewState {
  // 当前视图模式
  mode: ViewMode;
  
  // 图层状态（只读，从配置推导）
  layers: {
    [K in LayerId]: LayerState;
  };
  
  // 相机状态
  camera: CameraState;
  
  // 视口状态
  viewport: {
    width: number;
    height: number;
    devicePixelRatio: number;
  };
}

// 视图更新策略
export interface ViewUpdateStrategy {
  // 完全重绘
  full: () => void;
  
  // 增量更新
  delta: (changes: ViewChange[]) => void;
  
  // 仅相机相关
  cameraOnly: (camera: CameraState) => void;
  
  // 仅特定图层
  layerOnly: (layerId: LayerId) => void;
}
```

#### 2.2 图层依赖图

```typescript
// client/features/view/LayerGraph.ts

// 定义图层依赖关系
export const LayerDependencies: LayerDependencyGraph = {
  [LayerId.SELECTIONS]: {
    dependsOn: [LayerId.OBJECTS_TOKENS], // 依赖 Token 图层
    updateTrigger: ['selection', 'camera'], // 触发更新的状态
    zIndex: 9,
  },
  [LayerId.OBJECTS_TOKENS]: {
    dependsOn: [],
    updateTrigger: ['map.tokens', 'camera'],
    zIndex: 2,
  },
  [LayerId.BACKGROUND_STARS]: {
    dependsOn: [],
    updateTrigger: ['camera'], // 只在相机变化时更新
    zIndex: 0,
  },
};

// 智能更新调度
export class LayerUpdateScheduler {
  scheduleUpdate(changes: StateChange[]): ViewUpdatePlan {
    const affectedLayers = new Set<LayerId>();
    
    changes.forEach(change => {
      // 查找所有受影响的图层
      Object.entries(LayerDependencies).forEach(([layerId, config]) => {
        if (config.updateTrigger.includes(change.slice)) {
          affectedLayers.add(layerId as LayerId);
        }
      });
    });
    
    return this.createUpdatePlan(affectedLayers);
  }
}
```

#### 2.3 视图渲染管道

```typescript
// client/features/view/RenderPipeline.ts

export interface RenderPass {
  name: string;
  layers: LayerId[];
  condition?: (state: ViewState) => boolean;
}

export class RenderPipeline {
  private passes: RenderPass[] = [
    {
      name: 'background',
      layers: [
        LayerId.BACKGROUND_STARS,
        LayerId.BACKGROUND_NEBULA,
        LayerId.BACKGROUND_GRID,
      ],
    },
    {
      name: 'objects',
      layers: [
        LayerId.OBJECTS_TOKENS,
        LayerId.OBJECTS_SHIELDS,
        LayerId.OBJECTS_WEAPON_RANGES,
      ],
    },
    {
      name: 'selections',
      layers: [LayerId.SELECTIONS],
      condition: (state) => 
        state.layers[LayerId.SELECTIONS].visible &&
        Object.keys(state.selections).length > 0,
    },
  ];
  
  render(state: ViewState): void {
    this.passes.forEach(pass => {
      if (pass.condition?.(state) !== false) {
        this.renderPass(pass, state);
      }
    });
  }
}
```

---

### 方案 3: 状态管理重构

#### 3.1 状态分层

```typescript
// client/store/rootState.ts

export interface RootState {
  // 领域状态（来自服务器，只读）
  domain: {
    players: EntityState<PlayerInfo>;
    tokens: EntityState<TokenInfo>;
    ships: EntityState<ShipStatus>;
    selections: EntityState<SelectionRecord>;
  };
  
  // UI 状态（本地）
  ui: {
    camera: CameraState;
    interaction: InteractionState;
    layers: LayerState;
    panels: PanelState;
  };
  
  // 缓存状态（本地计算）
  cache: {
    tokenPositions: Record<string, WorldPosition>;
    visibleTokens: string[];
  };
}
```

#### 3.2 状态同步器

```typescript
// client/store/sync/StateSync.ts

export class StateSync {
  constructor(
    private ws: WebSocketService,
    private store: AppStore,
    private eventBus: EventBus
  ) {
    this.setupSync();
  }
  
  private setupSync() {
    // 自动同步领域状态
    this.ws.on(WS_MESSAGE_TYPES.SELECTION_UPDATE, (payload) => {
      this.store.dispatch(selectionSlice.actions.setSelections(payload.selections));
    });
    
    this.ws.on(WS_MESSAGE_TYPES.TOKEN_MOVED, (payload) => {
      this.store.dispatch(mapSlice.actions.updateToken({
        id: payload.tokenId,
        updates: {
          position: payload.newPosition,
          heading: payload.newHeading,
        },
      }));
    });
  }
}
```

---

### 方案 4: DDD 分层优化

#### 4.1 清晰的依赖注入

```typescript
// server/app/main.ts

// 定义依赖容器
export interface AppContainer {
  // Domain (无依赖)
  shipFactory: ShipFactory;
  mapFactory: MapFactory;
  
  // Application (依赖 Domain)
  shipService: ShipService;
  selectionService: SelectionService;
  
  // Infrastructure (抽象接口)
  eventBus: IEventBus;
  wsServer: IWSServer;
  roomManager: IRoomManager;
}

// 服务不再直接依赖基础设施
export class SelectionService {
  constructor(
    private eventBus: IEventBus, // ✅ 依赖抽象
    private roomManager: IRoomManager
  ) {}
  
  async selectObject(request: SelectObjectRequest) {
    // ... 业务逻辑
    
    // 通过事件总线发布
    await this.eventBus.publish({
      type: 'OBJECT_SELECTED',
      ...data,
    });
  }
}
```

#### 4.2 事件驱动架构

```typescript
// server/domain/ship/Ship.ts

export class Ship extends AggregateRoot {
  move(movement: MovementCommand): void {
    // ... 领域逻辑
    
    // 发布领域事件
    this.apply(new ShipMovedEvent({
      shipId: this.id,
      previousPosition: this.position,
      newPosition: movement.newPosition,
      phase: movement.phase,
    }));
  }
}

// server/infrastructure/events/EventTranslator.ts

// 领域事件 → WS 消息 转换器
export class EventTranslator {
  translate<T extends DomainEvent>(
    event: T,
    context: EventContext
  ): WSMessage | null {
    switch (event.type) {
      case 'SHIP_MOVED':
        return {
          type: WS_MESSAGE_TYPES.SHIP_MOVED,
          payload: {
            shipId: event.shipId,
            phase: event.phase,
            // ...
          },
        };
    }
  }
}
```

---

## 📋 实施优先级

### P0 - 高优先级（核心问题）
1. **统一通讯协议层** - 解决类型安全和验证问题
2. **状态同步机制** - 解决数据一致性问题

### P1 - 中优先级（架构优化）
3. **DDD 分层优化** - 解决依赖混乱问题
4. **事件驱动架构** - 解耦领域层和基础设施

### P2 - 低优先级（体验优化）
5. **统一视图管理框架** - 解决图层管理复杂问题
6. **渲染管道优化** - 提升性能

---

## 🎯 预期收益

| 优化项 | 当前问题 | 优化后收益 |
|--------|----------|------------|
| 通讯协议 | 50+ 手动定义接口 | 统一 DSL，类型自动推导 |
| 视图管理 | 手动同步多个图层 | 自动依赖追踪，智能更新 |
| 状态管理 | 跨 Slice 重复 | 清晰分层，自动同步 |
| DDD 分层 | 依赖混乱 | 清晰边界，可测试性强 |

---

## 📝 下一步行动

1. **创建 `shared/protocol/` 目录** - 定义统一消息协议
2. **实现 `client/store/sync/` 模块** - 状态自动同步
3. **重构 `server/infrastructure/events/`** - 统一事件总线
4. **创建 `client/features/view/` 框架** - 统一视图管理
