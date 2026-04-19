# 前端架构设计文档

## 概述

本设计旨在创建一个高性能、稳定、直接适配后端自定义WebSocket协议的前端架构。放弃Colyseus，直接使用原生WebSocket，专注于性能和开发效率。

## 设计原则

1. **性能优先**：零拷贝状态管理，事件驱动渲染，最小化DOM操作
2. **协议一致性**：直接复用后端协议定义，减少适配层
3. **开发效率**：移除复杂但收益不明显的设计，保留高收益优化
4. **模块化**：清晰的职责分离，易于维护和扩展
5. **容错性**：智能重连，优雅降级，错误恢复

## 架构对比

### 当前架构（Colyseus）
```
UI层 → React组件 → Zustand状态 → GameClient → NetworkManager → Colyseus SDK → WebSocket
```

### 新架构（自定义协议）
```
UI层 → React组件 → ImmutableStateStore → ProtocolPipeline → WebSocketEngine → WebSocket
```

## 核心模块设计

### 1. WebSocketEngine (`src/core/network/WebSocketEngine.ts`)
高性能WebSocket客户端，负责连接管理、心跳、消息收发。

**核心特性：**
- 自动重连（指数退避）
- 心跳检测（双向）
- 连接池管理
- 消息队列（离线缓冲）
- 流量控制（防洪水）

**接口：**
```typescript
interface WebSocketEngine {
  connect(url: string): Promise<void>
  disconnect(): void
  send(type: string, payload: unknown): Promise<void>
  onMessage(callback: (msg: WSMessage) => void): void
  onConnect(callback: () => void): void
  onDisconnect(callback: (reason: string) => void): void
  getConnectionState(): 'disconnected' | 'connecting' | 'connected' | 'reconnecting'
  getLatency(): number
}
```

### 2. ProtocolPipeline (`src/core/protocol/ProtocolPipeline.ts`)
模块化协议处理器，负责消息编解码、验证、路由。

**处理链：**
```
原始消息 → 解码器 → 验证器 → 路由器 → 处理器 → 响应器
```

**模块：**
- **解码器**：JSON解析，类型验证
- **验证器**：消息格式验证，权限检查
- **路由器**：根据消息类型路由到对应处理器
- **处理器**：业务逻辑处理（房间、游戏、状态等）
- **响应器**：生成响应消息，错误处理

### 3. ImmutableStateStore (`src/core/state/ImmutableStateStore.ts`)
零拷贝状态管理，基于Immer的不可变状态更新。

**核心特性：**
- 不可变状态更新（Immer）
- 状态快照（时间旅行调试）
- 状态订阅（细粒度更新）
- 状态合并（增量更新）
- 内存优化（共享引用）

**接口：**
```typescript
interface ImmutableStateStore<T> {
  getState(): T
  updateState(updater: (draft: Draft<T>) => void): void
  patchState(patches: Patch[]): void
  subscribe(path: string, callback: (value: unknown) => void): () => void
  createSnapshot(): Snapshot<T>
  restoreSnapshot(snapshot: Snapshot<T>): void
}
```

### 4. GameDomain (`src/core/domain/GameDomain.ts`)
领域模型层，封装游戏业务逻辑。

**子模块：**
- **RoomDomain**：房间管理（创建、加入、离开）
- **PlayerDomain**：玩家管理（档案、设置、权限）
- **ShipDomain**：舰船管理（移动、攻击、状态）
- **CombatDomain**：战斗系统（伤害计算、效果应用）
- **AssetDomain**：资产管理（头像、贴图、预设）

### 5. RenderEngine (`src/core/render/RenderEngine.ts`)
事件驱动渲染引擎，负责Pixi.js渲染优化。

**核心特性：**
- 脏检查渲染（仅更新变化部分）
- 批量渲染（帧合并）
- 视口裁剪（只渲染可见区域）
- 图层管理（背景、实体、UI分离）
- 动画系统（补间动画、粒子效果）

### 6. FaultToleranceEngine (`src/core/network/FaultToleranceEngine.ts`)
容错机制，确保系统稳定性。

**功能：**
- 自动重连策略（指数退避）
- 消息重发（确认机制）
- 状态同步（断线恢复）
- 优雅降级（网络不佳时简化功能）
- 错误报告（自动收集诊断信息）

### 7. PerformanceMonitor (`src/core/monitoring/PerformanceMonitor.ts`)
性能监控，实时收集性能指标。

**监控指标：**
- FPS（帧率）
- 网络延迟
- 内存使用
- 渲染时间
- 消息处理时间
- 状态更新频率

## 文件树结构

```
packages/client/src/
├── core/                          # 核心架构层
│   ├── network/                   # 网络层
│   │   ├── WebSocketEngine.ts     # WebSocket引擎
│   │   ├── FaultToleranceEngine.ts # 容错引擎
│   │   ├── MessageQueue.ts        # 消息队列
│   │   └── ConnectionPool.ts      # 连接池
│   ├── protocol/                  # 协议层
│   │   ├── ProtocolPipeline.ts    # 协议处理管道
│   │   ├── MessageDecoder.ts      # 消息解码器
│   │   ├── MessageValidator.ts    # 消息验证器
│   │   ├── MessageRouter.ts       # 消息路由器
│   │   └── ResponseBuilder.ts     # 响应构建器
│   ├── state/                     # 状态管理层
│   │   ├── ImmutableStateStore.ts # 不可变状态存储
│   │   ├── StateSnapshot.ts       # 状态快照
│   │   ├── StateSubscription.ts   # 状态订阅
│   │   └── StatePatcher.ts        # 状态补丁
│   ├── domain/                    # 领域层
│   │   ├── GameDomain.ts          # 游戏领域模型
│   │   ├── RoomDomain.ts          # 房间领域
│   │   ├── PlayerDomain.ts        # 玩家领域
│   │   ├── ShipDomain.ts          # 舰船领域
│   │   ├── CombatDomain.ts        # 战斗领域
│   │   └── AssetDomain.ts         # 资产领域
│   ├── render/                    # 渲染层
│   │   ├── RenderEngine.ts        # 渲染引擎
│   │   ├── DirtyCheckSystem.ts    # 脏检查系统
│   │   ├── ViewportCuller.ts      # 视口裁剪
│   │   ├── LayerManager.ts        # 图层管理
│   │   └── AnimationSystem.ts     # 动画系统
│   └── monitoring/                # 监控层
│       ├── PerformanceMonitor.ts  # 性能监控
│       ├── MetricsCollector.ts    # 指标收集器
│       └── Diagnostics.ts         # 诊断工具
├── adapters/                      # 适配器层（向后兼容）
│   ├── ColyseusAdapter.ts         # Colyseus适配器
│   └── LegacyNetworkAdapter.ts    # 旧网络适配器
├── services/                      # 服务层
│   ├── RoomService.ts             # 房间服务
│   ├── PlayerService.ts           # 玩家服务
│   ├── GameService.ts             # 游戏服务
│   └── AssetService.ts            # 资产服务
├── hooks/                         # React Hooks
│   ├── useWebSocket.ts            # WebSocket连接Hook
│   ├── useGameState.ts            # 游戏状态Hook
│   ├── usePlayer.ts               # 玩家状态Hook
│   ├── useRoom.ts                 # 房间状态Hook
│   └── usePerformance.ts          # 性能监控Hook
├── components/                    # 通用组件
│   ├── ConnectionStatus.tsx       # 连接状态指示器
│   ├── PerformanceOverlay.tsx     # 性能覆盖层
│   └── ErrorBoundary.tsx          # 错误边界
├── pages/                         # 页面组件（保持不变）
│   ├── AuthPage.tsx
│   ├── LobbyPage.tsx
│   └── GamePage.tsx
├── ui/                            # UI组件（保持不变）
│   ├── panels/
│   ├── overlays/
│   └── shared/
├── utils/                         # 工具函数
│   ├── protocol/                  # 协议工具
│   │   ├── messageBuilder.ts      # 消息构建器
│   │   └── typeGuards.ts          # 类型守卫
│   └── performance/               # 性能工具
│       ├── profiler.ts            # 性能分析器
│       └── throttle.ts            # 节流函数
└── types/                         # 类型定义
    ├── protocol.ts                # 协议类型（从后端导入）
    ├── state.ts                   # 状态类型
    └── domain.ts                  # 领域类型
```

## 实施计划

### 阶段1：基础架构（1-2周）
1. 创建WebSocketEngine和基础网络层
2. 实现ProtocolPipeline和消息处理
3. 创建ImmutableStateStore状态管理
4. 建立基础类型定义和工具函数

### 阶段2：领域模型（1周）
1. 实现GameDomain和子领域
2. 创建服务层（RoomService, PlayerService等）
3. 实现React Hooks接口

### 阶段3：UI集成（1周）
1. 更新现有页面组件使用新架构
2. 创建适配器层确保向后兼容
3. 集成性能监控和错误处理

### 阶段4：优化和测试（1周）
1. 性能优化（渲染、网络、内存）
2. 容错测试（断线重连、错误恢复）
3. 压力测试（并发连接、消息频率）

## 性能优化策略

### 高收益优化（保留）
1. **零拷贝状态更新**：使用Immer避免深拷贝
2. **事件驱动渲染**：仅更新变化的UI部分
3. **消息批处理**：合并高频消息减少网络开销
4. **视口裁剪**：只渲染可见区域
5. **连接复用**：WebSocket连接池

### 移除的复杂设计（低收益）
1. **复杂的缓存策略**：使用简单LRU缓存
2. **预测性渲染**：网络延迟低，不需要复杂预测
3. **多级状态同步**：使用单级状态同步简化逻辑
4. **复杂的错误恢复策略**：使用简单重试机制
5. **高级压缩算法**：使用gzip标准压缩

## 向后兼容策略

### 适配器模式
```typescript
// 新架构使用
const gameClient = new GameClient(new WebSocketEngine())

// 旧架构兼容（过渡期）
const gameClient = new GameClient(new ColyseusAdapter(networkManager))
```

### 渐进式迁移
1. 先实现新架构，与旧架构并行运行
2. 逐步迁移页面组件到新架构
3. 最终移除Colyseus依赖

## 监控和调试

### 内置监控
- 实时性能指标显示（FPS、延迟、内存）
- 网络消息日志（开发环境）
- 状态变更跟踪（Redux DevTools集成）
- 错误报告（自动收集和上报）

### 调试工具
- 时间旅行调试（状态快照）
- 网络模拟（延迟、丢包）
- 性能分析（火焰图）
- 内存泄漏检测

## 风险评估和缓解

### 风险1：协议不一致
- **缓解**：直接从后端导入类型定义，确保100%同步

### 风险2：性能倒退
- **缓解**：分阶段实施，每阶段进行性能测试

### 风险3：开发时间过长
- **缓解**：优先实现核心功能，简化非关键特性

### 风险4：向后兼容问题
- **缓解**：使用适配器模式，支持并行运行

## 成功指标

1. **性能提升**：FPS提升30%，网络延迟降低50%
2. **内存优化**：内存使用减少40%
3. **开发效率**：新功能开发时间减少50%
4. **稳定性**：崩溃率降低90%
5. **用户体验**：连接恢复时间<3秒

## 总结

新架构通过直接适配后端自定义协议，移除了Colyseus的中间层，实现了更高的性能和更好的开发体验。通过模块化设计和清晰的职责分离，系统更易于维护和扩展。平衡了开发速度和性能优化，专注于高收益的设计决策。