# 远行星号桌面推演系统 (STFCS) V2 架构与重构计划

本计划旨在基于“权威服务器模式(Authoritative Server)”重构当前的 Web VTT 架构。通过引入成熟的状态同步引擎和二维渲染/几何库，彻底消除“重复造轮子”的基建成本，将开发重心完全转移到《远行星号》推演规则与玩法的实现上。

---

## 一、 核心架构与技术栈“配单”

整体采用 **Pnpm Workspace (Monorepo)** 方案，分为 `client`、`server`、`shared` 三端。

### 1. 状态同步与网络层 (核心引擎)
* **库选型**: `colyseus` (服务端) + `colyseus.js` (客户端)
* **定位**: 替代原生的 WebSocket 方案和手写的 `RoomClient.ts`。
* **作用与优势**:
  * **完全免去发包/解包的痛点**：服务端定义强类型的 `Schema`，只要服务端数据变化，客户端会自动收到 `Patch` 并触发更新回调。
  * **自带网络生命周期管理**：自带房间匹配、掉线重连、会话保持。
  * **非常适合回合制**：配合 Colyseus 的指令系统，极易实现“玩家行动层”及“全网状态锁定”。

### 2. 交互视图与渲染层 (前端 Client)
* **库选型**: `React` + `@pixi/react` + `Zustand`
* **定位**: 纯数据驱动的“哑”客户端视图层。
* **作用与优势**:
  * `@pixi/react`：将 PixiJS 封装为 React 组件。所有的坐标 (`x`, `y`)、角度 (`heading`) 和模型渲染直接绑定 Colyseus 同步下来的状态树，实现**状态修改即渲染（Data-driven rendering）**。
  * `Zustand`：仅用于管理本客户端独有的 UI 状态（如：当前鼠标是否按下、选中的本地Token ID、侧边栏开关等），决不触碰全服游戏逻辑。

### 3. 核心计算与纯数学层 (前后端通用 Shared)
* **库选型**: `gl-matrix` + `sat.js`
* **定位**: 处理 2D VTT 中复杂的机动与碰撞算法。
* **作用与优势**:
  * `gl-matrix`：提供极致的高性能二维向量 (`vec2`) 与矩阵计算。处理偏航计算、切线平移、前进后退的坐标换算。
  * `sat.js` (Separating Axis Theorem)：解决最复杂的射界判定问题。能极其轻易地判定“非规则战舰边界多边形”是否处于“武器圆弧扇形/锥形”区域内。

---

## 二、 目录结构设计蓝图

```text
stfcs-v2/
├── package.json
├── pnpm-workspace.yaml
├── packages/
│   ├── shared/                # 前后端共享逻辑层
│   │   ├── src/
│   │   │   ├── schema/        # Colyseus 数据模型实体 (Ship, Weapon, RoomState)
│   │   │   ├── math/          # 封装 gl-matrix 向量计算与 sat.js 碰撞函数
│   │   │   └── constants/     # 伤害系数映射表、全局变量、消息枚举
│   ├── server/                # 权威服务端
│   │   ├── src/
│   │   │   ├── rooms/         # Colyseus 房间系统 (如 BattleRoom.ts)
│   │   │   ├── commands/      # 处理客户端请求的指令(移动、射击、开盾等验证逻辑)
│   │   │   └── mechanics/     # 纯业务逻辑函数 (护甲扣减算法、过载判定)
│   ├── client/                # React 前端
│   │   ├── src/
│   │   │   ├── components/
│   │   │   │   ├── map/       # @pixi/react 渲染的主画布与 Token 组件
│   │   │   │   ├── ui/        # HUD, 点击Token弹出的属性面板, DM 控制面板
│   │   │   ├── network/       # colyseus.js 客户端实例
│   │   │   └── store/         # Zustand 本地视图状态
```

---

## 三、 核心通讯与数据流设计 (Data Flow)

整个系统严格遵循单向数据流原则：
**用户操作 -> Client 派发 Command (Action) -> Server 验证并计算 -> 修改 Schema -> Colyseus 自动补丁广播 -> Client 响应视图更新**

### 1. 核心数据树定义 (Schema)
对应 `ship.md` 需求文档的数据模型构建：

```typescript
import { Schema, type, ArraySchema, MapSchema } from "@colyseus/schema";

// 包含具体位置与朝向的机动对象
export class Transform extends Schema {
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  @type("number") heading: number = 0; // 朝向 0-359
}

// 武器挂载点数据
export class WeaponSlot extends Schema {
  @type("string") weaponId: string;
  @type("string") type: "kinetic" | "high_explosive" | "energy" | "fragmentation";
  @type("number") cooldown: number = 0;
}

// 战舰主模型
export class ShipState extends Schema {
  @type("string") id: string;
  @type("string") faction: "player" | "dm";
  
  @type(Transform) transform = new Transform();
  
  // 装甲与血量
  @type("number") hullCurrent: number;
  @type("number") hullMax: number;
  @type(["number"]) armorCurrent = new ArraySchema<number>(0,0,0,0,0,0); // 6象限
  
  // 护盾与辐能
  @type("number") fluxMax: number;
  @type("number") fluxHard: number;
  @type("number") fluxSoft: number;
  @type("boolean") isShieldUp: boolean;
  @type("number") shieldOrientation: number; // 护盾朝向
  @type("boolean") isOverloaded: boolean;
  
  // 子系统挂载
  @type({ map: WeaponSlot }) weapons = new MapSchema<WeaponSlot>();
}

// 全局房间模型
export class GameRoomState extends Schema {
  @type("string") currentPhase: "DEPLOYMENT" | "PLAYER_TURN" | "DM_TURN" | "END_PHASE";
  @type("number") turnCount: number = 1;
  @type({ map: ShipState }) ships = new MapSchema<ShipState>();
}
```

### 2. 客户端指令表 (Client Commands Payload)

| 指令 Enum | 传递的数据 Payload | 服务端执行的验证与计算逻辑 |
| :--- | :--- | :--- |
| `CMD_MOVE_TOKEN` | `{ shipId, x, y, heading }` | 通过 `gl-matrix` 测算本次平移和旋转是否符合“最大2X、最大Y角度”规则，更新 `transform`。 |
| `CMD_TOGGLE_SHIELD` | `{ shipId, isActive, orientation }` | 校验 Token 是否过载，如未过载则变更状态，并在回合逻辑中扣除维持软辐能。 |
| `CMD_FIRE_WEAPON` | `{ attackerId, weaponId, targetId }` | 1. `sat.js` 判断射界和射出角度。<br>2. 应用装甲/护盾减免伤害公式。<br>3. 扣除对应侧的 `armorCurrent` 或增加目标的 `fluxHard`。 |
| `CMD_VENT_FLUX` | `{ shipId }` | 判定能否主动排散，若可，清除对应辐能并锁定本回合该单位操作。 |
| `CMD_NEXT_PHASE` | `{ }` | 由 DM 或当前回合所有玩家确认后推进。若进入 `END` 则执行：清空软辐能、解除所有过期过载状态。 |

---

## 四、 详细开发里程碑计划 (Milestones)

### M1 (周 1): 基础设施打通，跑通“白板”
* **核心目标**: 前后端数据互通，@pixi/react 能够响应服务端状态。
* **具体任务**:
  1. 初始化新 Monorepo，清理所有原生 WebSocket 代码。
  2. 搭建基础的 Colyseus Server，定义最初始的 `ShipState` 并创建房间。
  3. Client 端使用 `@pixi/react` 挂载 `Stage`，渲染一个代表战舰的矩形 `Sprite`。
  4. 实现基础拖拽：前端拉动方块，发送 `CMD_MOVE_TOKEN`（暂不校验机动规则），确保能实时同步到所有连接的客户端。
* **交付物**: 实时的“共享画板”基础验证模型。

### M2 (周 2-3): 实装机动规则与数学库打点
* **核心目标**: 落实《远行星号》三阶段机动算法。
* **具体任务**:
  1. 引入 `gl-matrix` 到 `shared` 包。
  2. 实现向量验证函数：测距中心点、换算前进/切线侧移向量并严格控制最大边界 $(X / 2X)$。
  3. 实现旋转限制：计算并限制每回合最大转角界限 $(Y)$。
  4. 视图层补充反馈：在 Token 被点击时，画出当前回合允许平移的“范围光环”或半透明边界辅助线。
* **交付物**: 单位只能根据设定好的机动参数进行有限制的移动和旋转。

### M3 (周 4-5): 重头戏：伤害判定与碰撞算法
* **核心目标**: 落实 6 象限独立装甲机制、护盾挡伤判定、多边形射界验证。
* **具体任务**:
  1. 引入 `sat.js`。服务端构建目标舰船的“六边形/外包围多边形”，构建武器的“扇形/楔形区域”。
  2. **射界计算**：实装客户端发送开火指令前的拦截校验，高亮处于扇形区内的目标。
  3. **护甲与破盾公式**：在服务端撰写纯函数 `calculateDamage(attackerWeapon, targetShipState)`，包含四种伤害类型的补正修饰。
  4. 扣血后自动触发状态更新，并在 UI 层实装飘字和 6 侧护甲条的衰减效果展示。
* **交付物**: 两方舰船可以互相展开攻击，护盾会顶硬辐能，破盾会根据射角精准扣除某一个六分之一象限的护甲。

### M4 (周 6): 辐能系统与阶段流转锁
* **核心目标**: 加入过载惩罚与标准推演回合制状态机。
* **具体任务**:
  1. 服务端实装辐能容量池 (`fluxSoft` / `fluxHard`) 的累计公式。
  2. 当 `Total Flux >= Max` 时，自动设置 `isOverloaded = true`。
  3. 实装回合阶段流转 (`DEPLOYMENT` -> `PLAYER_TURN` -> `DM_TURN` -> `END_PHASE`)。非自己回合的连接会被强制屏蔽输入。在 `END_PHASE` 执行排散衰减。
* **交付物**: 核心游戏循环完全闭环。

### M5 (周 7): DM 控制台与数据序列化
* **核心目标**: 完成可部署阶段的周边环境。
* **具体任务**:
  1. 从 JSON (如 `hull_frigate.json`) 将基础面板解析导入到房间的 Schema 中，创建初始化 Token。
  2. 开发专门提供给 DM 的左侧折叠面板，使得 DM 能够一键清空某单位过载、强制修正某一块护甲值（容错或剧情杀处理）。
* **交付物**: 正式可以用于与朋友跑团的 Alpha 1.0 版本。
