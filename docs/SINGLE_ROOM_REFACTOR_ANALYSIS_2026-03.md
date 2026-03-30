# STFCS 极简重构方案（单房间 + 新通讯内核）

> 版本：v2（根据反馈进一步简化）  
> 时间：2026-03-30  
> 目标：先做“最基本联机互动引擎”，暂时不做玩法系统；优先清理接口、状态、历史负担，重建可承载后续业务的新通讯方法。

---

## 0. 执行结论（先说结论）

当前阶段建议把 STFCS 定义为：

**“一个服务、一个房间、一个权威状态、一个通讯主通路”的联机互动底座。**

- **P0/P1 不做玩法**（移动/战斗/回合统统后置）
- **P0/P1 只做基础联机能力**：连接、身份、在场状态、对象同步、广播、权限基础
- **玩法抽象与业务功能统一降为 P2**，等内核稳定后再逐步回填

---

## 1. 现状问题（聚焦“历史负担”）

## 1.1 接口负担：房间相关接口过度暴露

当前公开操作中仍包含房间维度（如 `room.create`、`room.list`、大量可选 `roomId`），导致每个功能都要携带额外上下文。

**问题本质**：目标是小规模快速可用，房间抽象属于“平台级能力”，现阶段收益远小于负担。

## 1.2 状态负担：按 room 组织状态导致横向膨胀

`RoomManager` / `RoomMapStore` 以 `Map<roomId, ...>` 维护 players、camera、snapshot、turn 等状态，后续每增加一个功能都要多处理 room 维度。

**问题本质**：玩法尚未稳定前，多维状态会放大测试与排障复杂度。

## 1.3 身份负担：临时 playerId 与连接会话分离不完整

客户端侧 `player_${Date.now()}` 的临时 ID 方案不适合长期联机一致性；断线重连、权限归属、状态恢复都缺少稳定锚点。

## 1.4 历史兼容负担：并行路径和“默认回退”

存在多种调用习惯并存（含默认 room 回退），造成“看起来可用，但逻辑来源不一致”的长期隐患。

---

## 2. 本次重构范围（明确做什么/不做什么）

## 2.1 做什么（P0/P1）

1. 删除多房间公开能力（API 与前端入口层面）
2. 删除玩法相关请求与状态字段（先下线，不保留半成品）
3. 建立新的最小通讯模型（见第 4 节）
4. 建立单一全局状态容器（见第 5 节）
5. 完成最基本联机互动闭环（见第 6 节）

## 2.2 不做什么（推迟到 P2）

- 回合制/三段移动/战斗伤害/DM 全局数值修正
- 舰船资产编排、部署规则、复杂权限策略
- 高级渲染反馈与玩法 UI

> 说明：玩法文档仍保留作为未来参考，但当前迭代不作为交付目标。

---

## 3. 单房间硬收敛策略

## 3.1 统一常量

- 服务端固定：`GLOBAL_ROOM_ID = "global"`
- 所有请求都不再接收 `roomId`
- 存量 `roomId` 字段标记废弃并删除

## 3.2 接口清理清单（建议一次性删除）

- `room.create`
- `room.list`
- 所有 `xxx(roomId?: string)` 风格接口中的 `roomId` 参数
- 与玩法绑定的请求：`ship.move`、`ship.toggleShield`、`ship.vent`、`turn.*`、`map.token.move.step` 等

> 原则：宁可短期“少功能”，也不要“保留半旧半新双轨接口”。

## 3.3 状态清理清单

删除或冻结以下历史状态分支：

- 每房间 camera 缓存
- 每房间 turn 状态
- 每房间地图衍生状态
- 半成品玩法字段（remainingMovement、remainingActions 等）

保留最低限度：

- 在线用户列表
- 全局对象列表（基础位置与展示属性）
- 聊天/事件流
- 服务端 revision

---

## 4. 新通讯方法设计（核心）

## 4.1 设计目标

- 单一通路、可追踪、可幂等、可扩展
- 支持“现在只做基础联机”，也能承载未来玩法扩展

## 4.2 通讯模型：Command + Patch

采用两类消息：

1. `command`（客户端 -> 服务端）
2. `patch`（服务端 -> 客户端）

### 4.2.1 command 包结构

```ts
type CommandEnvelope<T = unknown> = {
  type: "command";
  commandId: string;       // 客户端生成，幂等键
  actorId: string;         // 会话绑定后的稳定 playerId
  op: string;              // 操作名，如 presence.update
  payload: T;
  sentAt: number;
};
```

### 4.2.2 patch 包结构

```ts
type PatchEnvelope = {
  type: "patch";
  revision: number;        // 服务端全局递增
  eventId: string;
  op: string;              // 变更类型，如 object.updated
  payload: unknown;
  emittedAt: number;
};
```

### 4.2.3 ack/error 包结构

```ts
type AckEnvelope = {
  type: "ack";
  commandId: string;
  accepted: boolean;
  errorCode?: string;
  message?: string;
};
```

## 4.3 最小 op 集（P0）

### 会话类
- `session.hello`：首次进入，签发稳定 playerId/sessionToken
- `session.resume`：断线恢复
- `session.leave`：主动离开

### 互动类
- `presence.update`：玩家在线状态/光标状态/视角（仅基础）
- `chat.send`：聊天
- `object.upsert`：创建或更新基础互动对象（非玩法对象）
- `object.remove`：删除对象

### 查询类
- `state.get`：获取当前全量快照（仅用于首次同步或重同步）

## 4.4 客户端处理规则（强约束）

1. 本地不“先写正式状态”，只等待 patch 落地
2. `revision` 小于等于本地版本则丢弃
3. 收到 patch 后再更新 store
4. command 超时后可重试（同 commandId）

## 4.5 服务端处理规则（强约束）

1. 先鉴权（session/player）
2. 再校验参数
3. 通过后变更权威状态
4. 写入事件日志（最小字段）
5. 广播 patch（revision++）
6. 回 ack

---

## 5. 新状态模型（单实例）

```ts
type GlobalSessionState = {
  revision: number;
  players: Record<string, {
    id: string;
    name: string;
    online: boolean;
    role: "host" | "member";
    lastSeenAt: number;
  }>;
  objects: Record<string, {
    id: string;
    kind: "marker" | "token" | "note";
    position: { x: number; y: number };
    meta?: Record<string, unknown>;
    updatedAt: number;
  }>;
  chat: Array<{
    id: string;
    from: string;
    text: string;
    at: number;
  }>;
  sessions: Record<string, {
    playerId: string;
    expiresAt: number;
  }>;
};
```

特点：

- 无 room 维度
- 无玩法维度
- 足以支撑“多人在线 + 基础互动对象 + 聊天 + 重连恢复”

---

## 6. 最基本联机互动闭环（P1 验收）

## 6.1 用户闭环

1. 打开页面 -> `session.hello`
2. 得到 playerId/sessionToken
3. 拉 `state.get` 初始化
4. 发送 `presence.update` 与 `chat.send`
5. 新建/移动/删除基础对象（`object.upsert/remove`）
6. 断线后 `session.resume` 恢复

## 6.2 技术验收标准

- 2~8 人同时在线稳定 30 分钟
- 任意客户端刷新后 3 秒内恢复一致状态
- 对象更新最终一致，无重复对象/幽灵对象
- 所有变更有 revision，可回放最近 N 条事件

---

## 7. 历史包袱清理计划

## 7.1 清理顺序

### Step 1（先删公开入口）

- 前端隐藏/删除房间相关 UI 与调用
- 禁用玩法动作入口按钮

### Step 2（再删协议与服务接口）

- 删除 room 操作
- 删除玩法相关 op
- 删除可选 roomId 参数

### Step 3（最后删状态与存储）

- 将 RoomManager/RoomMapStore 的多 room 结构替换为单实例结构
- 删除未使用的历史 slice 与 handler

## 7.2 兼容策略

- 不做长期兼容层
- 仅允许非常短期（<=1个迭代）适配分支，之后强制删除

---

## 8. 优先级重排（满足“玩法退避至 P2”）

## P0（必须立即完成）

1. 单房间常量化 + 删除房间公开 API
2. 新通讯信封（command/patch/ack）落地
3. 会话稳定化（hello/resume）
4. 单实例全局状态容器

## P1（基础可用）

1. presence/chat/object 三类互动打通
2. revision 去重与重放
3. 断线恢复
4. 基础观测：连接数、RTT、patch 大小、错误码

## P2（后续再做）

1. 回合、移动、战斗等玩法系统
2. DM 高级主持能力
3. 视觉表现与高级编辑器能力

---

## 9. 性能与开发负担收益

## 9.1 性能收益

- 广播模型从“多房间多分支”变为“单流 patch 广播”
- 状态结构变浅，序列化和比对成本下降
- 删除玩法计算后，CPU 峰值显著降低

## 9.2 开发收益

- 接口面大幅缩小，联调成本下降
- 新人只需理解 command/patch 一条主链路
- 测试用例集中在“会话 + 同步 + 一致性”，更容易覆盖

---

## 10. 风险与约束

1. **短期功能减少会带来“可玩性下降”感知**  
   - 这是主动策略：先保“联机稳定底座”，再恢复玩法。
2. **一次性删除接口可能影响现有调用**  
   - 用清单化迁移和短期适配分支解决，不长期保留双轨。
3. **通讯重构初期可能出现客户端不适配**  
   - 严格使用版本号与 feature flag，逐步切换。

---

## 11. 对 docs 玩法参考的处理方式

`docs/mechanics/ship.md` 继续作为 P2 玩法恢复时的规则来源，当前迭代只保留“参考”角色，不进入 P0/P1 交付范围。

---

## 12. 最终执行口径

> 现在不追求“能打仗”，先追求“多人稳定在线且一致互动”。  
> 用一个最小、干净、可扩展的通讯与状态内核，先把历史负担清空，再在 P2 恢复玩法系统。

