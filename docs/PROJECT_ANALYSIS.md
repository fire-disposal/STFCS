# STFCS 项目问题分析与优化方案

> 文档日期：2026-04-15
> 分析范围：Colyseus 联机系统、Pixi.js 绘制与交互、整体架构

---

## 目录

1. [项目概述](#1-项目概述)
2. [关键 Bug（需立即修复）](#2-关键-bug需立即修复)
3. [Colyseus 联机问题分析](#3-colyseus-联机问题分析)
4. [Pixi.js 绘制与交互问题分析](#4-pixijs-绘制与交互问题分析)
5. [架构与工程问题](#5-架构与工程问题)
6. [功能完善路线图](#6-功能完善路线图)
7. [优先级排序与实施建议](#7-优先级排序与实施建议)

---

## 1. 项目概述

STFCS（远行星号桌面推演系统）是一个基于权威服务器模式的在线虚拟桌面。技术栈：

- **前端**：React 19 + Pixi.js + Redux Toolkit + Zustand
- **后端**：Colyseus + Express + TypeScript
- **共享包**：@vt/types（纯类型）、@vt/data（游戏数据）、@vt/rules（规则引擎）

当前架构层次清晰（types → data → rules → server/client），已完成基础重构。以下分析聚焦于已发现的具体问题及优化方案。

---

## 2. 关键 Bug（需立即修复）

### 2.1 🔴 阶段循环跳过部署阶段

**文件**：`packages/server/src/phase/PhaseManager.ts` 第 24 行

**问题**：阶段循环在到达末尾时跳转到索引 `1`（PLAYER_TURN），跳过了索引 `0`（DEPLOYMENT）。

```typescript
// ❌ 当前代码
const next = idx + 1 >= PHASES.length ? 1 : idx + 1;

// ✅ 修复方案
const next = idx + 1 >= PHASES.length ? 0 : idx + 1;
```

**影响**：END_PHASE 处理后递归调用 `advancePhase()`，永远无法回到 DEPLOYMENT 阶段。在游戏设计中，DEPLOYMENT 阶段在首轮之后通常不再需要，所以这里的 `1` 可能是故意的设计（首轮 DEPLOYMENT → 后续 PLAYER_TURN ↔ DM_TURN 循环）。**需要确认设计意图**：
- 如果 DEPLOYMENT 仅在游戏开始时使用一次，则当前逻辑合理但代码应添加注释说明
- 如果 DEPLOYMENT 应在每轮循环中出现，则必须改为 `0`

### 2.2 🔴 Phase C 移动预算使用 Phase B 变量名

**文件**：`packages/server/src/commands/CommandDispatcher.ts` 第 113-121 行

**问题**：三阶段移动系统中，Phase C（转向后平移）的预算检查和记录使用了名为 `phaseBForwardUsed` / `phaseBStrafeUsed` 的字段。

```typescript
if (phase === "PHASE_C") {
    if (Math.abs(forward) + ship.phaseBForwardUsed > maxForward) { ... }
    if (Math.abs(strafe) + ship.phaseBStrafeUsed > maxStrafe) { ... }
    ship.phaseBForwardUsed += Math.abs(forward);
    ship.phaseBStrafeUsed += Math.abs(strafe);
}
```

**分析**：在 Schema 中（ShipStateSchema.ts 第 192-193 行），只存在 `phaseBForwardUsed` 和 `phaseBStrafeUsed` 两个字段，没有 `phaseCForwardUsed`。同时 payload 中 Phase C 的移动数据也命名为 `phaseBForward` / `phaseBStrafe`。

**这不是一个运行时 Bug**（代码可以正常执行），但存在严重的**命名歧义**：
- Phase B 概念上是「转向阶段」，只使用 `turnAngle`
- `phaseBForward`/`phaseBStrafe` 实际存储的是 Phase C 的平移数据

**建议修复**：重命名以消除歧义

| 当前命名 | 建议命名 | 说明 |
|---------|---------|------|
| `phaseBForward` (payload) | `phaseCForward` | Phase C 前进 |
| `phaseBStrafe` (payload) | `phaseCStrafe` | Phase C 横移 |
| `phaseBForwardUsed` (schema) | `phaseCForwardUsed` | Phase C 已用前进预算 |
| `phaseBStrafeUsed` (schema) | `phaseCStrafeUsed` | Phase C 已用横移预算 |
| `movePhaseBX` (schema) | `movePhaseCX` | Phase C 前进值 |
| `movePhaseBStrafe` (schema) | `movePhaseCStrafe` | Phase C 横移值 |

**涉及文件**：
- `packages/server/src/schema/ShipStateSchema.ts`
- `packages/server/src/commands/CommandDispatcher.ts`
- `packages/server/src/phase/PhaseManager.ts`
- `packages/server/src/validation/messagePayloads.ts`
- `packages/types/src/movement.ts`
- 客户端所有引用移动计划的文件

### 2.3 🔴 useCurrentGameRoom 清理方法不兼容

**文件**：`packages/client/src/hooks/useCurrentGameRoom.ts` 第 44 行

**问题**：使用 `currentRoom.onLeave.remove(handleLeave)` 清理监听器，但 Colyseus SDK v4 的 `onLeave()` 不保证存在 `.remove()` 方法。

```typescript
// ❌ 当前代码
return () => {
    currentRoom.onLeave.remove(handleLeave);
};

// ✅ 修复方案 A：使用标志位
const isActive = { current: true };
currentRoom.onLeave(() => {
    if (isActive.current) handleLeave();
});
return () => {
    isActive.current = false;
};

// ✅ 修复方案 B：检查 remove 是否可用
return () => {
    if (typeof currentRoom.onLeave?.remove === "function") {
        currentRoom.onLeave.remove(handleLeave);
    }
};
```

**影响**：组件卸载后 `onLeave` 回调仍会执行，可能导致对已卸载组件的状态更新。

---

## 3. Colyseus 联机问题分析

### 3.1 房间操作竞态条件

**文件**：`packages/client/src/network/NetworkManager.ts`

**问题描述**：`createRoom()` 和 `joinRoom()` 在创建/加入新房间前，异步调用 `leaveCurrentRoomIfNeeded()` 但**不等待其完成**：

```typescript
// 第 376 行 (createRoom)
this.leaveCurrentRoomIfNeeded().catch((e) => {
    console.warn("Failed to leave previous room during create:", e);
});
// 不等待上面的异步操作，立即执行 client.create(...)
```

**风险**：
1. 旧房间的 WebSocket 连接可能尚未关闭就打开新连接，造成并发连接
2. 服务端可能同时看到同一客户端在两个房间中
3. `currentRoom` 在异步操作中可能被意外覆盖

**优化方案**：
```typescript
// 等待前一个房间完全离开后再创建新房间
await this.leaveCurrentRoomIfNeeded();
const room = await this.client.create<GameRoomState>("battle", createOptions);
```

**严重程度**：中等 — `activeRoomOperation` 锁已提供基本保护，但旧房间清理仍可能与新房间生命周期重叠。

### 3.2 重连逻辑无超时保护

**文件**：`packages/server/src/rooms/BattleRoom.ts` 第 93-103 行

**问题**：`allowReconnection(client, 60)` 提供 60 秒重连窗口，但在此期间：
- 玩家状态标记为 `connected = false` 但仍保留在玩家列表
- 如果玩家控制的舰船处于移动阶段，其他玩家必须等待
- 没有通知其他玩家该玩家已断线

**优化方案**：
```typescript
onLeave(client: Client, code?: number) {
    const player = this.state.players.get(client.sessionId);
    if (code === 1000) { /* 正常退出 */ }
    if (player) {
        player.connected = false;
        // ✅ 广播断线通知
        this.broadcast("player_disconnected", { sessionId: client.sessionId, name: player.name });
        this.allowReconnection(client, 60)
            .then(() => {
                player.connected = true;
                // ✅ 广播重连通知
                this.broadcast("player_reconnected", { sessionId: client.sessionId });
                this.syncMetadata();
            })
            .catch(() => { /* 清理 */ });
    }
}
```

### 3.3 FluxState 字段冗余同步

**文件**：`packages/server/src/schema/ShipStateSchema.ts` 第 98-139 行

**问题**：`FluxState` 同时维护两组字段：
- `hard` + `hardFlux`（始终同步赋值）
- `soft` + `softFlux`（始终同步赋值）

```typescript
addHard(n: number) {
    this.hard = Math.min(this.max, this.hard + n);
    this.hardFlux = this.hard;  // 冗余同步
}
```

**影响**：
- 每次辐能变化都会触发 Colyseus 对两组字段的 delta 编码和广播
- 增加网络带宽消耗（每次操作 4 个字段变更而非 2 个）
- 如果某处忘记同步 `hardFlux = hard`，客户端会收到不一致数据

**优化方案**：移除冗余字段，仅保留 `hard` 和 `soft`。如果客户端需要不同名称，在客户端层面做映射。

### 3.4 END_PHASE 递归调用风险

**文件**：`packages/server/src/phase/PhaseManager.ts` 第 28-30 行

**问题**：
```typescript
if (state.currentPhase === GamePhase.END_PHASE) {
    handleEndPhase(state);
    return advancePhase(state, broadcast);  // 递归调用
}
```

当 `advancePhase` 将阶段设为 END_PHASE 时，会立即执行 `handleEndPhase` 然后递归调用自身。正常情况下递归只会执行一次（下一个阶段是 PLAYER_TURN），但如果阶段配置有误（比如 PHASES 数组只有 END_PHASE），可能导致无限递归。

**优化方案**：改为迭代式处理，或添加递归深度保护：
```typescript
// 迭代式
do {
    const idx = PHASES.indexOf(state.currentPhase);
    const next = idx + 1 >= PHASES.length ? 1 : idx + 1;
    state.currentPhase = PHASES[next];
    if (state.currentPhase === GamePhase.END_PHASE) {
        handleEndPhase(state);
    }
} while (state.currentPhase === GamePhase.END_PHASE);

state.players.forEach((p) => (p.isReady = false));
broadcast("phase_change", toPhaseChangeDto(state.currentPhase, state.turnCount));
```

### 3.5 移动命令缓冲区错误处理不完善

**文件**：`packages/server/src/rooms/BattleRoom.ts` 第 110-121 行

**问题**：`flushMoveCommands` 中如果某个命令执行失败，只发送错误消息给对应客户端，但不影响其他命令。这是正确的设计，但缺少：
- 失败命令的日志记录
- 连续失败的速率限制
- 恶意客户端发送大量无效命令的防护

**优化方案**：添加速率限制和日志：
```typescript
private flushMoveCommands(): void {
    if (this.moveCommandBuffer.size === 0) return;
    const commands = Array.from(this.moveCommandBuffer.values());
    this.moveCommandBuffer.clear();
    for (const command of commands) {
        try {
            this.dispatcher.dispatchMoveToken(command.client, command.payload);
        } catch (error) {
            this.logger.warn(`Move command failed for ${command.payload.shipId}: ${(error as Error).message}`);
            command.client.send("error", toErrorDto((error as Error).message));
        }
    }
}
```

### 3.6 游戏加载无错误广播

**文件**：`packages/server/src/rooms/BattleRoom.ts` 第 193-221 行

**问题**：`loadGame` 失败时只返回 `false`，不通知客户端加载失败的原因。

**优化方案**：
```typescript
async loadGame(id: string): Promise<boolean> {
    try {
        // ... 加载逻辑
    } catch (e) {
        this.broadcast("game_load_failed", { saveId: id, reason: (e as Error).message });
        return false;
    }
}
```

---

## 4. Pixi.js 绘制与交互问题分析

### 4.1 Ship 缓存清理不完整

**文件**：`packages/client/src/components/map/hooks/useShipRendering.ts` 第 103-107 行

**问题**：组件卸载时仅清除 Map 缓存，但不从 Pixi 图层移除子对象：

```typescript
useEffect(() => {
    return () => {
        cacheRef.current.clear();  // 只清除引用，不清除 Pixi 图层中的对象
    };
}, []);
```

**影响**：卸载后 Pixi 场景树中仍保留 Container / Graphics / Text 对象，造成内存泄漏。

**优化方案**：
```typescript
useEffect(() => {
    return () => {
        const cache = cacheRef.current;
        const currentLayers = /* 获取 layers 引用 */;
        if (currentLayers) {
            for (const [, item] of cache) {
                currentLayers.tacticalTokens.removeChild(item.root);
                currentLayers.shipLabels.removeChild(item.label);
                currentLayers.shipLabels.removeChild(item.hpBar);
                item.root.destroy({ children: true });
                item.label.destroy();
                item.hpBar.destroy();
            }
        }
        cache.clear();
    };
}, []);
```

### 4.2 事件监听器未随缓存清理移除

**文件**：`packages/client/src/components/map/hooks/useShipRendering.ts` 第 193-220 行

**问题**：`createShipEntities` 为每个 ship Container 绑定 `pointertap` 和 `pointermove` 事件，但当 ship 从缓存中移除时（第 77-84 行），只调用 `removeChild`，未调用 `root.off()` 移除事件监听器。

**影响**：被移除的 Container 虽然不再在场景树中，但闭包引用仍持有 `optionsRef` 和 `contextRef`，阻止垃圾回收。

**优化方案**：在删除缓存条目时显式移除监听器：
```typescript
for (const [id, item] of cache) {
    if (!currentIds.has(id)) {
        item.root.removeAllListeners();  // 移除所有事件监听
        layers.tacticalTokens.removeChild(item.root);
        layers.shipLabels.removeChild(item.hpBar);
        layers.shipLabels.removeChild(item.label);
        item.root.destroy({ children: true });
        cache.delete(id);
    }
}
```

### 4.3 Sprite 渲染未实际实现

**文件**：`packages/client/src/features/game/layers/TokenRenderer.ts`

**问题**：Token 渲染器中检查是否有 sprite 资源，但无论是否有资源，都调用相同的几何体回退绘制函数：

```typescript
if (!hasSprite) {
    drawShipGeometryFallback(graphics, size, colors);
} else {
    drawShipGeometryFallback(graphics, size, colors);  // 同样的回退
}
```

**影响**：即使加载了 sprite 资源也无法显示，资源加载逻辑成为死代码。

**优化方案**：实现实际的 sprite 渲染分支：
```typescript
if (hasSprite && spriteTexture) {
    const sprite = new Sprite(spriteTexture);
    sprite.anchor.set(0.5, 0.5);
    sprite.width = size;
    sprite.height = size;
    container.addChild(sprite);
} else {
    drawShipGeometryFallback(graphics, size, colors);
}
```

### 4.4 星空背景每次重绘创建新 Graphics 对象

**文件**：`packages/client/src/features/game/layers/BackgroundRenderer.ts`

**问题**：`renderBackground()` 每次调用都执行 `layer.removeChildren()` 然后创建全新的 Graphics、Container 等对象。虽然使用种子随机数保证确定性，但每次重绘会：
1. 销毁旧对象（触发 GC）
2. 重新生成星星位置
3. 创建新 Graphics 并绘制

**影响**：频繁调用时会造成 GC 压力，可能导致帧率抖动。

**优化方案**：
1. **缓存渲染结果**：首次渲染后缓存，仅在配置变化时重绘
2. **使用 RenderTexture**：将星空烘焙到纹理中
```typescript
// 缓存 + 脏标记模式
private starfieldDirty = true;
private cachedStarfield: Container | null = null;

renderBackground(layer: Container, config: Config) {
    if (!this.starfieldDirty && this.cachedStarfield) return;
    // ... 执行完整渲染
    this.cachedStarfield = layer;
    this.starfieldDirty = false;
}
```

### 4.5 坐标转换方法不一致

**文件**：`packages/client/src/components/map/hooks/usePixiApp.ts`（主 hook）和 `useShipRendering.ts`

**问题**：代码中存在两种屏幕到世界坐标的转换方式：
1. Pixi 的 `world.toLocal(point)` — 基于 Pixi 变换矩阵
2. 自定义 `screenToWorld()` 函数 — 基于相机参数手动计算

两者可能产生微小差异，特别是在世界旋转 (`viewRotation`) 生效时。

**影响**：点击位置与实际世界坐标可能有偏差，在高倍率缩放和旋转下更明显。

**优化方案**：统一使用一种方法。推荐使用 Pixi 的 `world.toLocal()`，因为它自动考虑所有变换：
```typescript
// 统一入口
function getWorldPosition(worldContainer: Container, screenX: number, screenY: number) {
    const point = new Point(screenX, screenY);
    return worldContainer.toLocal(point);
}
```

### 4.6 Hit Area 尺寸过大

**文件**：`packages/client/src/components/map/hooks/useLayerSystem.ts` 第 107 行

**问题**：
```typescript
const largeSize = Math.max(canvasSize.width, canvasSize.height, 10000) * 10;
// 4K 屏幕上可达 40000×40000
```

**影响**：过大的 hitArea 可能影响 Pixi 的指针事件检测性能。

**优化方案**：根据实际地图尺寸和缩放级别动态计算合理的 hitArea 大小：
```typescript
const maxWorldSize = GAME_CONFIG.MAP_SIZE || 10000;
const visibleSize = Math.max(canvasSize.width, canvasSize.height) / zoom;
const hitSize = Math.max(visibleSize, maxWorldSize) * 1.5;
```

### 4.7 世界容器旋转未考虑定位偏移

**文件**：`packages/client/src/components/map/hooks/useLayerSystem.ts` 第 69-75 行

**问题**：
```typescript
currentLayers.world.position.set(
    canvasSize.width * 0.5 - cameraX * zoom,
    canvasSize.height * 0.5 - cameraY * zoom
);
currentLayers.world.rotation = (viewRotation * Math.PI) / 180;
```

`position` 的计算未考虑 `rotation` 的影响。Pixi 中 rotation 是围绕 pivot 点旋转的，默认 pivot 是 (0,0)。当旋转叠加到基于相机偏移的 position 上时，视觉结果会偏离预期。

**优化方案**：设置 pivot 为相机中心，或在 position 计算中补偿旋转：
```typescript
// 方案 A：设置 pivot
currentLayers.world.pivot.set(cameraX, cameraY);
currentLayers.world.position.set(canvasSize.width * 0.5, canvasSize.height * 0.5);
currentLayers.world.scale.set(zoom);
currentLayers.world.rotation = (viewRotation * Math.PI) / 180;
```

### 4.8 星空闪烁动画未实现

**文件**：`packages/client/src/features/game/rendering/StarfieldBackground.ts`

**问题**：`StarfieldGenerator` 有 `update(deltaTime)` 方法用于更新时间参数（控制闪烁动画），但该方法从未被调用。`BackgroundRenderer.ts` 中设置了 `twinkleSpeed` 等参数但从未在渲染循环中使用。

**影响**：星空静态不闪烁，缺少视觉生动感。

**优化方案**：在 ticker 回调中调用 `starfield.update(dt)` 并更新星星 alpha 值。

### 4.9 视差因子硬编码且不一致

**文件**：`packages/client/src/components/map/hooks/useLayerSystem.ts` 第 82-98 行

**问题**：
```typescript
const parallaxFactor = 0.5;
currentLayers.starfieldDeep.position.set(-cameraX * parallaxFactor * 0.3, -cameraY * parallaxFactor * 0.3);
currentLayers.starfieldMid.position.set(-cameraX * parallaxFactor * 0.5, -cameraY * parallaxFactor * 0.5);
currentLayers.starfieldNear.position.set(-cameraX * parallaxFactor * 0.8, -cameraY * parallaxFactor * 0.8);
```

魔数 `0.3`、`0.5`、`0.8` 缺乏文档说明，且星云层使用 `0.2`。

**优化方案**：提取为命名常量：
```typescript
const PARALLAX = {
    DEEP: 0.15,    // 0.5 * 0.3 - 最远层移动最慢
    MID: 0.25,     // 0.5 * 0.5
    NEAR: 0.40,    // 0.5 * 0.8
    NEBULA: 0.10,  // 0.5 * 0.2 - 星云最慢
};
```

---

## 5. 架构与工程问题

### 5.1 双状态管理系统混用

**现状**：项目同时使用 Redux Toolkit 和 Zustand 管理客户端状态。

| 管理器 | 用途 |
|-------|------|
| Redux | camera, ship, player, combat, movement, deployment, chat, gameFlow, interaction |
| Zustand | selection, ui |

**问题**：
- 状态流向不一致——部分状态从 Redux 读取，部分从 Zustand 读取
- 组件可能需要同时 `useAppSelector` 和 `useUIStore`，增加认知负担
- 两套中间件和 DevTools 配置

**优化方案**：长期来看，建议统一到一种方案。推荐保留 Zustand（更轻量，与 Pixi 结合更自然），逐步迁移 Redux slices。短期内添加文档说明各 store 的职责边界。

### 5.2 TypeScript `any` 类型泛滥

**现状**：客户端代码中存在约 59 处 `any` 类型使用，主要集中在：
- 视图组件的 props 类型
- Colyseus Room 状态类型转换
- Pixi 事件处理

**优化方案**：逐步替换为精确类型。优先处理 Colyseus 状态相关的 `any`，因为类型错误可能导致运行时 bug。

### 5.3 消息验证缺少边界检查

**文件**：`packages/server/src/validation/messagePayloads.ts`

**问题**：
- `parseMovementPlan` 不验证移动值的合理范围（如极大数值）
- `parseMoveTokenPayload` 不验证坐标是否在地图范围内
- 缺少对 NaN、Infinity 等特殊数值的过滤（`asFiniteNumber` 只过滤了非有限数值，是正确的）

**优化方案**：添加范围验证：
```typescript
function parseMovementPlan(value: unknown): MovementPlan | null {
    // ... 现有解析
    if (Math.abs(phaseAForward) > MAX_SPEED * 10) return null;  // 防止极端值
    if (Math.abs(turnAngle) > 360) return null;
    // ...
}
```

### 5.4 聊天消息无界增长

**文件**：`packages/server/src/schema/GameSchema.ts`

**问题**：`chatMessages: ArraySchema<ChatMessage>` 无上限，长时间运行的房间可能积累大量消息。

**优化方案**：添加最大消息数限制：
```typescript
const MAX_CHAT_MESSAGES = 200;
addChatMessage(msg: ChatMessage) {
    this.chatMessages.push(msg);
    while (this.chatMessages.length > MAX_CHAT_MESSAGES) {
        this.chatMessages.shift();
    }
}
```

---

## 6. 功能完善路线图

以下是将项目从当前状态推进到可用的在线虚拟桌面所需的功能开发路线：

### 阶段一：基础稳定性（1-2 周）

- [ ] 修复 PhaseManager 阶段循环 Bug（或添加设计意图注释）
- [ ] 修复 useCurrentGameRoom onLeave 清理问题
- [ ] 统一 Phase C 命名以消除歧义
- [ ] 修复 Ship 缓存清理的内存泄漏
- [ ] 修复事件监听器泄漏
- [ ] 添加断线重连的客户端通知 UI
- [ ] 修复房间操作竞态条件（等待旧房间离开后再创建新房间）

### 阶段二：核心游戏循环（2-4 周）

- [ ] 完善武器冷却和弹药系统的 UI 显示
- [ ] 实现护盾可视化（方向和弧度指示器）
- [ ] 实现武器射程弧线可视化
- [ ] 完善 DM 控制面板功能（修改属性、强制移动）
- [ ] 实现回合结束自动结算（辐能排散、过载检查、弹药装填）的 UI 反馈
- [ ] 添加战斗日志面板（实时显示伤害计算过程）
- [ ] 实现舰船部署的拖拽放置

### 阶段三：视觉增强（2-3 周）

- [ ] 实现 sprite 资源加载和渲染
- [ ] 实现星空闪烁动画
- [ ] 优化星空背景渲染（缓存/RenderTexture）
- [ ] 添加武器开火特效（粒子效果或动画）
- [ ] 添加舰船被击中/摧毁动画
- [ ] 优化 HP 条和辐能条的动画过渡
- [ ] 实现雾战（仅显示己方舰船视野范围内的信息）

### 阶段四：多人体验（2-3 周）

- [ ] 实现完整的房间大厅 UI（房间列表、创建/加入/邀请）
- [ ] 实现玩家头像和昵称显示
- [ ] 添加观战模式
- [ ] 实现 DM 权限转移
- [ ] 添加房间聊天的 UI 面板
- [ ] 实现游戏存档/读档的 UI 面板
- [ ] 添加玩家准备状态和自动阶段推进

### 阶段五：高级功能（持续）

- [ ] 舰船特殊能力系统
- [ ] 自定义舰船和武器编辑器
- [ ] 地图编辑器（放置障碍物、边界）
- [ ] 多语言支持
- [ ] 音效系统
- [ ] 性能分析和优化（大规模战场）

---

## 7. 优先级排序与实施建议

### 按紧迫度排序

| 优先级 | 类别 | 问题 | 工作量 |
|--------|------|------|--------|
| P0 | Bug | PhaseManager 阶段循环（确认设计意图后修复） | 0.5h |
| P0 | Bug | useCurrentGameRoom onLeave 清理 | 1h |
| P0 | 内存 | Ship 缓存清理 + 事件监听器 | 2h |
| P1 | 命名 | Phase C 变量重命名 | 4h（需全链路修改） |
| P1 | 网络 | 房间操作竞态条件 | 2h |
| P1 | 网络 | 断线重连客户端通知 | 2h |
| P2 | 渲染 | 统一坐标转换方法 | 3h |
| P2 | 渲染 | 世界容器旋转定位修复 | 2h |
| P2 | 性能 | 星空背景缓存 | 3h |
| P2 | 架构 | FluxState 冗余字段清理 | 2h |
| P3 | 功能 | Sprite 渲染实现 | 8h |
| P3 | 功能 | 星空闪烁动画 | 4h |
| P3 | 架构 | 聊天消息上限 | 1h |
| P3 | 架构 | 消息验证范围检查 | 2h |

### 实施建议

1. **先修 Bug**：P0 项不超过一天工作量，应立即修复
2. **再优化网络**：Colyseus 相关的竞态和清理问题影响多人游戏稳定性
3. **渲染问题分批处理**：坐标转换和内存泄漏优先于视觉效果
4. **功能开发按路线图推进**：每阶段完成后做一次多人联测
5. **持续关注性能**：在添加更多舰船和视觉效果时，定期做性能测试

---

## 附录：文件索引

| 文件路径 | 问题编号 |
|---------|---------|
| `packages/server/src/phase/PhaseManager.ts` | 2.1, 3.4 |
| `packages/server/src/commands/CommandDispatcher.ts` | 2.2 |
| `packages/server/src/schema/ShipStateSchema.ts` | 2.2, 3.3 |
| `packages/server/src/validation/messagePayloads.ts` | 2.2, 5.3 |
| `packages/server/src/rooms/BattleRoom.ts` | 3.2, 3.5, 3.6 |
| `packages/server/src/schema/GameSchema.ts` | 5.4 |
| `packages/client/src/hooks/useCurrentGameRoom.ts` | 2.3 |
| `packages/client/src/network/NetworkManager.ts` | 3.1 |
| `packages/client/src/components/map/hooks/useShipRendering.ts` | 4.1, 4.2 |
| `packages/client/src/components/map/hooks/useLayerSystem.ts` | 4.6, 4.7, 4.9 |
| `packages/client/src/components/map/hooks/usePixiApp.ts` | 4.5 |
| `packages/client/src/features/game/layers/TokenRenderer.ts` | 4.3 |
| `packages/client/src/features/game/layers/BackgroundRenderer.ts` | 4.4 |
| `packages/client/src/features/game/rendering/StarfieldBackground.ts` | 4.8 |
