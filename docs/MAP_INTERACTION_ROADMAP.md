# STFCS 分阶段交互实现路径 MAP（基于玩法参考）

> 依据：`docs/mechanics/ship.md` 与 `docs/PROJECT_STATUS.md` 的规则目标和当前实现状态。  
> 目标：用最短路径把“可联机操作 Token”升级为“可完整跑一局的规则闭环”。

---

## 0. MAP 定义

这里的 **MAP** 指 **Milestone Action Path（里程碑行动路径）**，不是地图对象本身：

- **M（Milestone）**：每阶段必须达到的可验收里程碑。
- **A（Action）**：该阶段的具体实现动作（前端交互、服务端裁定、同步协议、数据留痕）。
- **P（Path）**：阶段间依赖与推进顺序，确保每次迭代都可上线/可验证。

核心原则：
1. **先闭环后扩展**（先能打完一局，再做高级体验）。
2. **服务端权威**（客户端只做输入与反馈）。
3. **单路径同步**（一个动作只有一种提交和广播路径）。

---

## 1. 目标闭环（最小可玩 Match Loop）

`房间准备 -> DM部署与玩家入场 -> 回合开始 -> 三段移动 -> 单次攻击 -> 伤害结算 -> 回合切换 -> 持续叙事`

每一步都要求：
- 有清晰的用户交互入口；
- 有服务端校验；
- 有广播事件；
- 有客户端状态回写与错误反馈。

---

## 2. Phase-MAP（分阶段路径）

## Phase 0（1 周）——联机 Token 操作稳定化（已具备基础）

### Milestone
- 玩家能在联机房间中稳定拖拽自己的 Token，并看到所有人一致结果。

### Action
1. 固化 Token 提交链路：`drag end -> request(map.token.move) -> server validate -> TOKEN_MOVED`。
2. 所有权校验：owner 可移动，DM 可覆盖。
3. 错误闭环：非法移动回滚本地位置 + UI toast。
4. 状态源统一：地图 Token 状态以 room snapshot 为准。
5. 引入 DM 部署动作：`request(map.token.deploy)` 仅在 deployment phase 生效。

### Path 输出
- 可演示“多人拖拽同图一致同步”。

---

## Phase 1（1-2 周）——三阶段移动交互（玩法核心）

> 对应规则：阶段A平移 -> 转向 -> 阶段B平移。

### Milestone
- 单位在自己行动时可完整执行三段移动并被服务器裁定。
- DM 可以推进阶段（deployment -> planning -> movement -> action -> resolution）。

### Action

#### 前端交互
1. 增加 `MovementWizard`（三步面板）：
   - Step A：前后/横移输入（可拖拽或数字输入）；
   - Step B：转向角输入（滑杆或旋钮）；
   - Step C：再次平移。
2. 地图层增加“预览轨迹线 + 非法提示色”。
3. 每一步显示剩余机动预算（X/Y）。

#### 服务端规则
1. 新增 `ship.move.step`（stepIndex=1|2|3）请求。
2. 每步校验：
   - 是否当前行动单位；
   - 是否在 movement phase；
   - 是否超过 `speed/maneuverability`；
   - 是否越权控制。
3. 三步结束后生成 `SHIP_MOVED_FINALIZED`，并写入回合动作日志。

#### 同步协议
- `MOVE_STEP_PREVIEW`（仅发起者本地可见，可选）
- `SHIP_MOVE_STEP_APPLIED`（房间广播）
- `SHIP_MOVED_FINALIZED`（房间广播 + 记录）

### Path 输出
- 从“自由拖拽”过渡到“规则化移动”。

---

## Phase 2（2 周）——攻击与伤害最小闭环

### Milestone
- 可完成“选择武器 -> 选择目标 -> 结算 -> 更新盾/甲/船体/辐能”。

### Action

#### 前端交互
1. Token 选中后展示武器列表与射界扇形。
2. 目标悬停显示命中信息（射程内/角度内）。
3. 攻击确认弹层展示预计消耗（flux）与风险。

#### 服务端结算
1. `combat.attack.resolve` 原子接口：
   - 输入：sourceTokenId, weaponId, targetTokenId；
   - 输出：命中结果、盾吸收、甲减伤、船体伤害、flux变化。
2. 按玩法参考实现伤害类型修正（KIN/HE/FRAG/NRG）。
3. 产出结构化战斗日志（用于仲裁/回放）。

#### 同步协议
- `WEAPON_FIRED`
- `DAMAGE_DEALT`
- `SHIP_STATUS_UPDATED`

### Path 输出
- 实现“可打一轮”的战斗闭环。

---

## Phase 3（1-2 周）——回合状态机接管全流程

### Milestone
- 回合推进由服务端统一管理，客户端不能本地越权推进。

### Action
1. 统一回合状态机：`planning -> movement -> action -> resolution`。
2. 行动权限门禁：非当前单位所有操作返回 `TURN_DENIED`。
3. 增加 `end_turn` 与超时托管逻辑。
4. 回合快照广播：`TURN_STATE_SNAPSHOT`。

### Path 输出
- “可玩”升级为“可连续对局”。

---

## Phase 4（2 周）——地图与存储系统升级（面向可运营）

### Milestone
- 地图配置和对局状态可持久化、可恢复、可复盘。

### Action

#### 存储分层
1. `RoomMapStore` 保持运行时缓存层（内存）。
2. 新增 `MapRepository` 抽象（可接 SQLite/Postgres/Redis）。
3. Snapshot 分级：
   - `map_template`（静态地图模板）；
   - `match_snapshot`（对局实时状态）；
   - `event_log`（事件流）。

#### 地图设定（符合当前游戏设定）
1. 预置地图模板：
   - `frontier_skirmish`（新手战斗图）
   - `asteroid_lane`（障碍带）
   - `station_siege`（据点争夺）
2. 每个模板定义：出生点、目标点、环境效果参数。

#### 运营能力
1. 房间重连恢复（按 match_snapshot）。
2. 争议回放（按 event_log 重建关键帧）。

### Path 输出
- 从“会话工具”升级为“可运营战局系统”。

---

## 3. 交互设计细化（关键机制）

## 3.1 Token 操作 UX 基线
- 单击选中，双击聚焦。
- 拖拽时显示 ghost 影子 + 距离标尺。
- 非法操作即时提示（红框+原因文案）。
- 释放后进入“待确认态”（可撤销，3 秒超时自动提交可选）。

## 3.2 回合期 UI 门禁
- 非当前单位：按钮置灰并提示“等待回合”。
- movement 阶段只显示移动相关交互。
- action 阶段只显示武器与防御相关交互。

## 3.3 日志与可解释性
- 每次动作在右侧日志输出：谁 -> 对谁 -> 做了什么 -> 结果。
- 所有失败动作记录错误码，便于排障。

---

## 4. 数据结构建议（最小增量）

```ts
interface MatchSnapshot {
  roomId: string;
  matchId: string;
  phase: 'planning' | 'movement' | 'action' | 'resolution';
  currentUnitId: string | null;
  tokens: Record<string, TokenState>;
  updatedAt: number;
}

interface EventLogRecord {
  eventId: string;
  roomId: string;
  matchId: string;
  seq: number;
  type: string;
  payload: unknown;
  createdAt: number;
}
```

说明：
- `MatchSnapshot` 用于快速恢复；
- `EventLogRecord` 用于回放与仲裁；
- 两者必须能相互校验（snapshot 可由事件流重建）。

---

## 5. 验收指标（每阶段都要可量化）

### 功能指标
- P0：多人房间 Token 移动一致率 100%。
- P1：三段移动规则校验正确率 > 95%。
- P2：攻击结算与规则预期一致率 > 95%。
- P3：连续 30 分钟对局无状态分叉。

### 稳定性指标
- 断线 30 秒内可恢复至最新快照。
- 重复消息不导致状态回滚（按 seq 去重）。

### 体验指标
- 关键动作响应（本地反馈）< 150ms。
- 服务端确认广播 < 500ms（局域网/标准开发环境）。

---

## 6. 本周可执行清单（建议）

1. 完成 Phase 1 的 `MovementWizard` 原型（UI + 假数据预算）。
2. 定义 `ship.move.step` 协议与错误码表。
3. 增加移动轨迹预览层与非法提示颜色规范。
4. 把回合门禁接入按钮层（先做前端守卫，再做服务端强校验）。
5. 补一份“玩法规则 -> 接口字段”映射表，防止术语漂移。

---

## 7. 结论

这份 MAP 的关键不是“功能列表更长”，而是保证每阶段都形成 **可上线、可验证、可回滚** 的小闭环。  
按该路径推进，项目能在短周期内从“能操作 Token”稳步升级到“能完整打一局且可复盘”。
