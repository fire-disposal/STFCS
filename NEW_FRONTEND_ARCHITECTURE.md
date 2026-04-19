# 全新前端架构设计

## 设计理念

**完全重新开始**，不考虑向后兼容，专注于：
1. **性能**：零拷贝状态管理，事件驱动渲染
2. **协议一致性**：直接使用后端自定义WebSocket协议
3. **开发效率**：简化架构，移除复杂但收益低的设计
4. **类型安全**：100%复用后端类型定义

## 核心原则

1. **无Colyseus依赖**：直接使用原生WebSocket
2. **类型驱动开发**：从 `@vt/schema-types` 和 `@vt/data` 导入所有类型
3. **不可变状态**：使用Immer进行状态管理
4. **事件驱动**：消息驱动状态更新，状态驱动UI渲染
5. **模块化**：清晰的责任分离，易于测试和维护

## 架构概览

```
┌─────────────────────────────────────────────────────────────┐
│                         UI Layer                            │
│  React Components (Pages, Panels, Overlays)                 │
└─────────────────────────────┬───────────────────────────────┘
                              │ React Hooks
┌─────────────────────────────▼───────────────────────────────┐
│                    Service Layer                            │
│  RoomService │ PlayerService │ GameService │ AssetService   │
└─────────────────────────────┬───────────────────────────────┘
                              │ Domain Models
┌─────────────────────────────▼───────────────────────────────┐
│                    Domain Layer                             │
│  GameDomain │ RoomDomain │ PlayerDomain │ ShipDomain        │
└─────────────────────────────┬───────────────────────────────┘
                              │ State Management
┌─────────────────────────────▼───────────────────────────────┐
│                 State Management Layer                       │
│  ImmutableStateStore │ StateSubscription │ StateSnapshot    │
└─────────────────────────────┬───────────────────────────────┘
                              │ Protocol Processing
┌─────────────────────────────▼───────────────────────────────┐
│                 Protocol Layer                              │
│  ProtocolPipeline │ MessageRouter │ ResponseBuilder         │
└─────────────────────────────┬───────────────────────────────┘
                              │ WebSocket
┌─────────────────────────────▼───────────────────────────────┐
│                 Network Layer                               │
│  WebSocketEngine │ ConnectionPool │ FaultToleranceEngine    │
└─────────────────────────────────────────────────────────────┘
```

## 文件树结构

```
packages/client/src/
├── core/                          # 核心架构
│   ├── network/                   # 网络层
│   │   ├── WebSocketEngine.ts     # WebSocket客户端引擎
│   │   ├── ConnectionPool.ts      # 连接池管理
│   │   ├── MessageQueue.ts        # 消息队列（离线缓冲）
│   │   └── FaultTolerance.ts      # 容错机制（重连、恢复）
│   ├── protocol/                  # 协议层
│   │   ├── ProtocolPipeline.ts    # 协议处理管道
│   │   ├── MessageDecoder.ts      # 消息解码和验证
│   │   ├── MessageRouter.ts       # 消息路由到处理器
│   │   ├── MessageHandler.ts      # 消息处理器基类
│   │   └── ResponseBuilder.ts     # 响应构建器
│   ├── state/                     # 状态管理层
│   │   ├── ImmutableStateStore.ts # 不可变状态存储
│   │   ├── StateSubscription.ts   # 细粒度状态订阅
│   │   ├── StateSnapshot.ts       # 状态快照（调试）
│   │   └── StatePatcher.ts        # 状态补丁应用
│   ├── domain/                    # 领域层
│   │   ├── GameDomain.ts          # 游戏领域模型
│   │   ├── RoomDomain.ts          # 房间管理领域
│   │   ├── PlayerDomain.ts        # 玩家管理领域
│   │   ├── ShipDomain.ts          # 舰船管理领域
│   │   ├── CombatDomain.ts        # 战斗系统领域
│   │   └── AssetDomain.ts         # 资产管理领域
│   └── render/                    # 渲染层（优化现有Pixi.js）
│       ├── RenderOptimizer.ts     # 渲染优化器
│       ├── DirtyCheckSystem.ts    # 脏检查系统
│       └── ViewportCuller.ts      # 视口裁剪
├── services/                      # 服务层（业务逻辑）
│   ├── RoomService.ts             # 房间服务
│   ├── PlayerService.ts           # 玩家服务
│   ├── GameService.ts             # 游戏服务
│   ├── AssetService.ts            # 资产服务
│   └── index.ts                   # 服务导出
├── hooks/                         # React Hooks
│   ├── useWebSocket.ts            # WebSocket连接Hook
│   ├── useGameState.ts            # 游戏状态Hook
│   ├── usePlayer.ts               # 玩家状态Hook
│   ├── useRoom.ts                 # 房间状态Hook
│   ├── useShip.ts                 # 舰船状态Hook
│   └── index.ts                   # Hooks导出
├── components/                    # 通用UI组件
│   ├── ConnectionStatus.tsx       # 连接状态指示器
│   ├── ErrorBoundary.tsx          # 错误边界组件
│   └── LoadingOverlay.tsx         # 加载覆盖层
├── pages/                         # 页面组件（重新实现）
│   ├── AuthPage/                  # 认证页面
│   │   ├── index.tsx
│   │   └── components/
│   ├── LobbyPage/                 # 大厅页面
│   │   ├── index.tsx
│   │   └── components/
│   └── GamePage/                  # 游戏页面
│       ├── index.tsx
│       ├── GameView.tsx           # 游戏主视图
│       └── components/
├── ui/                            # UI组件库（重新设计）
│   ├── buttons/                   # 按钮组件
│   ├── panels/                    # 面板组件
│   ├── overlays/                  # 覆盖层组件
│   ├── forms/                     # 表单组件
│   └── shared/                    # 共享组件
├── utils/                         # 工具函数
│   ├── protocol/                  # 协议工具
│   │   ├── messageBuilder.ts      # 消息构建工具
│   │   ├── typeGuards.ts          # 类型守卫
│   │   └── validation.ts          # 消息验证
│   ├── state/                     # 状态工具
│   │   ├── immerHelpers.ts        # Immer辅助函数
│   │   └── subscription.ts        # 订阅工具
│   └── performance/               # 性能工具
│       ├── profiler.ts            # 性能分析器
│       └── throttle.ts            # 节流防抖
├── types/                         # 类型定义（从包导入）
│   ├── protocol.ts                # 协议类型（从schema-types导入）
│   ├── state.ts                   # 状态类型
│   └── index.ts                   # 类型导出
└── config/                        # 配置
    ├── constants.ts               # 常量定义
    └── endpoints.ts               # 服务器端点配置
```

## 核心模块详细设计

### 1. WebSocketEngine (`src/core/network/WebSocketEngine.ts`)

**职责**：管理WebSocket连接，处理消息收发

**特性**：
- 自动重连（指数退避算法）
- 心跳检测（双向）
- 消息队列（离线缓冲）
- 连接状态管理
- 流量控制（防洪水）

**接口**：
```typescript
interface WebSocketEngine {
  // 连接管理
  connect(url: string): Promise<void>
  disconnect(): void
  reconnect(): Promise<void>
  
  // 消息收发
  send<T>(type: string, payload: T): Promise<void>
  onMessage(callback: (msg: WSMessage) => void): () => void
  onConnect(callback: () => void): () => void
  onDisconnect(callback: (reason: string) => void): () => void
  
  // 状态查询
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  getLatency(): number
  isConnected(): boolean
}
```

### 2. ProtocolPipeline (`src/core/protocol/ProtocolPipeline.ts`)

**职责**：处理消息编解码、验证、路由

**处理流程**：
```
Raw Message → Decoder → Validator → Router → Handler → Response
```

**模块**：
- **Decoder**：JSON解析，基础验证
- **Validator**：消息格式验证，权限检查
- **Router**：根据消息类型路由到对应Handler
- **Handler**：业务逻辑处理（房间、游戏、状态等）
- **ResponseBuilder**：构建响应消息

### 3. ImmutableStateStore (`src/core/state/ImmutableStateStore.ts`)

**职责**：不可变状态管理，零拷贝更新

**特性**：
- 基于Immer的不可变更新
- 细粒度状态订阅
- 状态快照（时间旅行调试）
- 状态合并（增量更新）
- 内存优化（共享引用）

**接口**：
```typescript
interface ImmutableStateStore<T> {
  // 状态访问
  getState(): T
  getStateSlice<K extends keyof T>(key: K): T[K]
  
  // 状态更新
  updateState(updater: (draft: Draft<T>) => void): void
  patchState(patches: Patch[]): void
  replaceState(newState: T): void
  
  // 状态订阅
  subscribe(callback: (state: T) => void): () => void
  subscribeToPath<K extends keyof T>(path: K, callback: (value: T[K]) => void): () => void
  
  // 调试
  createSnapshot(): Snapshot<T>
  restoreSnapshot(snapshot: Snapshot<T>): void
}
```

### 4. GameDomain (`src/core/domain/GameDomain.ts`)

**职责**：游戏领域模型，封装业务逻辑

**子领域**：
- **RoomDomain**：房间创建、加入、离开、管理
- **PlayerDomain**：玩家档案、设置、权限、状态
- **ShipDomain**：舰船移动、攻击、状态管理
- **CombatDomain**：战斗系统、伤害计算、效果应用
- **AssetDomain**：头像、贴图、预设管理

### 5. 服务层 (`src/services/`)

**职责**：业务逻辑服务，连接领域层和UI层

**服务**：
- **RoomService**：房间相关操作
- **PlayerService**：玩家相关操作
- **GameService**：游戏相关操作
- **AssetService**：资产相关操作

### 6. React Hooks (`src/hooks/`)

**职责**：提供React友好的API接口

**Hooks**：
- `useWebSocket()`：WebSocket连接状态
- `useGameState()`：游戏状态访问
- `usePlayer()`：玩家状态和操作
- `useRoom()`：房间状态和操作
- `useShip()`：舰船状态和操作

## 类型系统设计

### 类型来源
1. **协议类型**：从 `@vt/schema-types` 导入
2. **数据模型**：从 `@vt/data` 导入
3. **自定义类型**：在 `src/types/` 中定义

### 类型定义示例
```typescript
// src/types/protocol.ts
import type {
  WSMessage,
  MsgType,
  ConnectPayload,
  ConnectedPayload,
  // ... 其他协议类型
} from '@vt/schema-types'

// 重新导出，方便使用
export type { WSMessage, MsgType }

// 消息类型守卫
export function isConnectMessage(msg: WSMessage): msg is WSMessage<ConnectPayload> {
  return msg.type === MsgType.CONNECT
}

// 消息构建器
export function buildConnectMessage(playerName: string): WSMessage<ConnectPayload> {
  return {
    type: MsgType.CONNECT,
    payload: { clientVersion: '1.0.0', playerName }
  }
}
```

## 状态管理设计

### 状态结构
```typescript
interface AppState {
  // 连接状态
  connection: {
    status: 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
    latency: number
    serverTimeOffset: number
  }
  
  // 玩家状态
  player: {
    id: string | null
    name: string | null
    role: PlayerRole | null
    profile: PlayerProfile | null
  }
  
  // 房间状态
  room: {
    id: string | null
    name: string | null
    players: Map<string, PlayerState>
    phase: GamePhase
    turn: number
  }
  
  // 游戏状态
  game: {
    ships: Map<string, ShipRuntime>
    weapons: Map<string, WeaponRuntime>
    objects: Map<string, GameObject>
  }
  
  // UI状态
  ui: {
    selectedShipId: string | null
    cameraPosition: { x: number; y: number }
    zoom: number
    panelStates: Record<string, boolean>
  }
}
```

### 状态更新流程
```
WebSocket消息 → ProtocolPipeline → 领域处理 → StateStore更新 → UI重新渲染
```

## 性能优化策略

### 高收益优化（实施）
1. **零拷贝状态更新**：使用Immer避免深拷贝
2. **细粒度订阅**：只更新变化的UI部分
3. **消息批处理**：合并高频消息减少网络开销
4. **视口裁剪**：只渲染可见区域
5. **连接复用**：WebSocket连接池

### 简化设计（不实施）
1. **预测性渲染**：网络延迟低，不需要复杂预测
2. **多级缓存**：使用简单内存缓存
3. **复杂压缩**：使用标准gzip压缩
4. **高级同步算法**：使用简单状态同步

## 实施步骤

### 阶段1：基础架构（1周）
1. 创建项目结构和基础配置
2. 实现WebSocketEngine和基础网络层
3. 实现ProtocolPipeline和消息处理
4. 创建类型定义和工具函数

### 阶段2：状态管理（1周）
1. 实现ImmutableStateStore
2. 创建领域模型（GameDomain）
3. 实现服务层（RoomService, PlayerService）
4. 创建React Hooks

### 阶段3：UI实现（1周）
1. 重新实现AuthPage
2. 重新实现LobbyPage
3. 重新实现GamePage
4. 创建通用UI组件

### 阶段4：集成测试（1周）
1. 单元测试核心模块
2. 集成测试完整流程
3. 性能测试和优化
4. 错误处理和容错测试

## 技术栈

### 核心依赖
- **React 19**：UI框架
- **TypeScript**：类型安全
- **Immer**：不可变状态更新
- **原生WebSocket**：网络通信
- **Pixi.js**：游戏渲染（现有）

### 开发工具
- **Vite**：构建工具（现有）
- **Vitest**：测试框架（现有）
- **Biome**：代码格式化（现有）
- **TypeScript**：类型检查

### 监控和调试
- **自定义性能监控**
- **Redux DevTools集成**（可选）
- **错误报告系统**

## 成功指标

### 性能指标
- **FPS**：稳定60fps
- **网络延迟**：< 100ms
- **内存使用**：< 200MB
- **加载时间**：< 2秒

### 开发指标
- **代码行数**：减少30%
- **测试覆盖率**：> 80%
- **构建时间**：< 30秒
- **类型安全**：100%类型覆盖

### 用户体验
- **连接恢复**：< 3秒
- **操作响应**：< 100ms
- **错误率**：< 0.1%
- **用户满意度**：> 4.5/5

## 总结

这个全新架构通过直接使用后端自定义协议，移除了Colyseus中间层，实现了更高的性能和更好的开发体验。通过不可变状态管理和事件驱动架构，确保了系统的稳定性和可维护性。完全重新开始的设计让我们可以专注于高收益的优化，移除复杂但收益低的设计，最终交付一个高性能、稳定、易于维护的前端系统。