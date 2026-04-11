# 多人实体权限与阶段流转详细设计

## 现状分析与架构适配性核对

当前项目基于 `Colyseus` + `@pixi/react` + `Zustand` 的架构。

1. **状态同步 (Colyseus Schema)**: 
   高度适配。Colyseus 天生支持基于 `Schema` 的树状状态同步。引入 `PlayerState` 集合并修改 `ShipState` 是完全符合其设计哲学的。同时 Colyseus 原生提供 `allowReconnection` 方法，处理断线重连非常简单。
2. **鉴权机制 (Colyseus Room/Client)**:
   高度适配。Colyseus 的消息监听 `this.onMessage("command", (client, payload))` 会携带发送客户端的 `client` 对象，我们可以轻易获取 `client.sessionId` 来作为鉴权的唯一凭证。
3. **前端渲染渲染 (@pixi/react & Zustand)**:
   高度适配。Zustand 用于在前端侧保存当前玩家的 `sessionId`，当接收到 Colyseus 状态更新时，通过对比 `ship.ownerId === localSessionId` 即可决定是否禁止组件交互、是否渲染高亮边框。

---

## 核心数据流与生命周期设计

### 1. 实体关系映射
* **Player（玩家）**：每个连接的客户端对应一个 `PlayerState`，标识唯一特征（`sessionId`、角色、准备状态）。
* **Ship（舰船）**：游戏内的单位，新增 `ownerId`，指代 controlling Player 的 `sessionId`。
* **Room（房间）**：作为全局容器，管理当前的 `currentPhase` 和判定回合结束的锁，持有一个 `players` Map。

### 2. 生命周期与断线重连
* 玩家加入：第一次加入房间分配 DM 身份，后续分配 Player 身份。
* 脱机：玩家掉线时，不立即销毁 `PlayerState` 和重置 `Ship.ownerId`，而是保留状态，允许玩家在指定时限（如 1 小时）内携凭证重连，直接夺回原单位控制权。

### 3. 鉴定与权限隔离
* **DM (Host)**：拥有绝对权限。可以操控任意阵营舰船（无视 owner），可以随时强制进入下一阶段，可以分配实体归属权。
* **Player (Client)**：拥有受限权限。只能在 `PLAYER_TURN` 阶段操控 `ownerId === 自己 sessionId` 的舰船；且在提交“结束行动”后，在流转至下一回合前丢失操控权。

---

## 分阶段实现清单 (Milestones Checklist)

### Phase 1: 核心数据模型 (Schema) 改造
- [ ] **新增 `PlayerState`**: 在 `shared/schema/GameSchema.ts` 中定义玩家模型（包含角色、名字、准备状态、连接状态）。
- [ ] **扩展 `ShipState`**: 加入 `ownerId` (持有者的 sessionId)。
- [ ] **扩展 `GameRoomState`**: 加入 `players: MapSchema<PlayerState>`，收口所有连接用户状态。
- [ ] **导出/更新类型定义**: 确保所有新增字段被成功导出至前后端共享域。

### Phase 2: 生命周期与身份管理
- [ ] **改造 `BattleRoom.ts` 的 `onJoin`**: 第一名玩家分配 `dm`，其余分配 `player`。创建对应的 `PlayerState`。
- [ ] **改造 `onLeave` 处理断线**: 标记玩家离线，允许超时重连，重连后恢复状态。
- [ ] **客户端状态认领**: `NetworkManager.ts` 在连接成功后，记录自己当前的 `sessionId`。

### Phase 3: 鉴权与指令拦截器 (Server Command Validation)
- [ ] **更新 Payload 签名**: 服务端 `CommandDispatcher` 方法签名增加 `client: Client`。
- [ ] **实现校验纯函数**: 增加对回合、所属权、就绪状态的拦截校验。
- [ ] **全面拦截**: 在移动、开盾、开火、排散等逻辑前执行鉴权。

### Phase 4: DM 专属指令与舰船分配机制
- [ ] **新增指令 `CMD_ASSIGN_SHIP`**: 允许 DM 将 `shipId` 的控制权赋予特定的 `sessionId`。
- [ ] **执行逻辑**: 服务端更新 `ownerId`。

### Phase 5: 回合准备与自动状态机流转
- [ ] **新增指令 `CMD_TOGGLE_READY`**: 玩家发送就绪状态变更。
- [ ] **服务端阶段流转算法**: 如果所有 Player 都 Ready，自动推进至 `DM_TURN`。
- [ ] **重置状态**: 新阶段清空所有 Ready 状态。

### Phase 6: 客户端 UI 响应与屏蔽
- [ ] **识别高亮己方舰船**: 利用 `@pixi/react` 对属于自己的船高亮绘制。
- [ ] **HUD 面板按钮屏蔽**: 选中无权操作的 Token 时屏蔽交互功能。
- [ ] **回合状态栏 (Turn Bar)**: 显示当前阶段，增加【结束回合】按钮控制 Ready 状态。
- [ ] **玩家列表面板**: DM 专属面板以分配舰船控制权。
