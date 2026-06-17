# DND 3D 曼哈顿网格战棋分支计划

## 1. 项目定位

从 STFCS（Starship Tactical Fleet Combat System）当前代码库分支出一个新的 DND 风格联机战棋项目。该分支不以继续扩展舰船战斗为目标，而是复用现有全栈 Node 联机基础设施、资产管线、房间/玩家/存档能力与 CI/CD，重写游戏领域模型、规则引擎与地图渲染层。

目标产物是一套服务端权威裁决、YAML 内容驱动、Three.js 轻量体素表现的 3D 曼哈顿网格联机战棋系统。移动、射程与 AOE 统一基于包含 Z 轴海拔差的离散 3D 曼哈顿距离，使高低地形直接参与战术决策。

## 2. 核心设计原则

1. **保留平台，替换游戏域**
   - 保留 monorepo、pnpm、Turborepo、Socket.IO、房间、玩家资料、资产、存档、日志与部署管线。
   - 替换 STFCS 舰船/武器/护盾/航海角度/射界相关模型与规则。

2. **服务端权威**
   - 客户端只提交行动意图。
   - 服务端负责校验回合、距离、路径、命中、豁免、伤害、状态与村规效果。
   - 所有骰子由服务端生成，并写入战斗日志。

3. **3D 曼哈顿距离统一规则口径**
   - `distance3D(a, b) = |a.x - b.x| + |a.y - b.y| + |a.z - b.z|`。
   - 移动、射程、AOE、技能影响范围均优先使用同一距离函数。
   - 高低差不作为表现层装饰，而是实际影响移动消耗、命中修正与战术站位。

4. **配置驱动但非脚本驱动**
   - 地图、单位、法术、状态、规则开关与“杀戮回响”通过 YAML 定义。
   - YAML 只描述数据、触发器、条件与枚举化 effect，不执行任意脚本。
   - 所有 YAML 内容进入运行时前必须通过 Zod schema 校验。

5. **轻量 Three.js 体素表现**
   - 不构建完整 Minecraft 式体素引擎。
   - 地形以离散格、InstancedMesh、半透明高亮与 billboard token 为主。
   - 优先保证联机战棋交互清晰，再逐步增强视觉效果。

## 3. 复用范围

### 3.1 高价值复用

- 根目录 pnpm / Turborepo 脚本与 CI/CD 工作流。
- `packages/client/src/network` 中的 Socket.IO 客户端连接、RPC request/response、断线重连、`sync:full` 与 `state:patch` 思路。
- `packages/server/src/server/socketio` 中的 RPC namespace 分层。
- 房间、玩家、ready、host/DM 权限、存档快照、战斗日志基础结构。
- 资产上传、图片校验、文件系统存储与 assetId 引用机制。
- React UI 框架、Zustand 状态管理、Radix UI 组件体系与 i18n 结构。

### 3.2 部分复用

- 现有舰船贴图可作为早期 DND 单位 token 的 billboard/portrait 使用。
- 现有武器贴图可作为法术/技能图标或临时特效贴图使用。
- 现有日志类型中的 `MOVE`、`ATTACK`、`ROLL`、`DESTROYED`、`SYSTEM` 可迁移；护盾、flux、舰船专用日志需要废弃或替换。
- 现有 Pixi overlay 概念可保留为交互功能参考，但渲染实现应迁移到 Three.js。

### 3.3 不建议复用

- 航海角度、舰船朝向、武器射界、护甲象限、护盾弧、flux、机库部署等 STFCS 专用规则。
- 当前 Pixi 主战场渲染管线。
- 当前二维地图 schema 与二维几何函数作为 DND 规则基础。

## 4. 目标目录规划

建议在分支中逐步形成以下结构：

```text
packages/data/src/dnd/
  schemas.ts          # DND 共享 Zod schema
  geometry3d.ts       # 3D 坐标、距离、AOE 基础函数
  dice.ts             # 骰子表达式类型与解析辅助
  content.ts          # YAML 内容包 schema
  index.ts

packages/server/src/dnd/
  content/
    YamlContentLoader.ts
    ContentRegistry.ts
  engine/
    distance.ts
    movement.ts
    pathfinding.ts
    dice.ts
    initiative.ts
    actionEconomy.ts
    targeting.ts
    aoe.ts
    combat.ts
    conditions.ts
    killEcho.ts
    applyDndAction.ts
  handlers/
    dndGame.ts
    dndEdit.ts
    dndContent.ts

packages/client/src/renderer3d/
  core/
    ThreeCanvas.tsx
    useThreeApp.ts
    useThreeCamera.ts
  systems/
    GridPicker.ts
    VoxelTerrainRenderer.ts
    PathPreviewRenderer.ts
    AoePreviewRenderer.ts
  entities/
    UnitTokenRenderer.ts
    UnitHudRenderer.ts
  effects/
    SpellEffectRenderer.ts

packages/client/src/ui/dnd/
  DndActionPanel.tsx
  DndTurnBar.tsx
  UnitInfoPanel.tsx
  SpellPanel.tsx
  ConditionPanel.tsx
  ContentBrowser.tsx

content/dnd/
  maps/
  units/
  spells/
  conditions/
  rules/
```

## 5. 共享数据模型计划

### 5.1 坐标与地图

```ts
export const Coord3DSchema = z.object({
  x: z.number().int(),
  y: z.number().int(),
  z: z.number().int(),
});

export const GridSize3DSchema = z.object({
  width: z.number().int().positive(),
  depth: z.number().int().positive(),
  height: z.number().int().positive(),
});

export const GridCellSchema = z.object({
  coord: Coord3DSchema,
  terrainId: z.string().optional(),
  blocksMovement: z.boolean().default(false),
  blocksLineOfSight: z.boolean().default(false),
  cover: z.enum(["none", "half", "three_quarters", "full"]).default("none"),
  movementCost: z.number().min(0).default(1),
  metadata: z.record(z.string(), z.unknown()).optional(),
});
```

### 5.2 单位定义与运行时

```ts
export const UnitDefSchema = z.object({
  id: z.string(),
  name: z.string(),
  size: z.enum(["tiny", "small", "medium", "large", "huge", "gargantuan"]),
  maxHp: z.number().int().min(1),
  ac: z.number().int().min(0),
  speed: z.number().int().min(0),
  stats: z.object({
    str: z.number().int(),
    dex: z.number().int(),
    con: z.number().int(),
    int: z.number().int(),
    wis: z.number().int(),
    cha: z.number().int(),
  }),
  actions: z.array(z.string()).default([]),
  tokenAssetId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export const UnitRuntimeSchema = z.object({
  id: z.string(),
  defId: z.string(),
  position: Coord3DSchema,
  hp: z.number().int().min(0),
  tempHp: z.number().int().min(0).default(0),
  conditions: z.array(z.string()).default([]),
  resources: z.record(z.string(), z.number()).default({}),
  ownerId: z.string().optional(),
  faction: z.string().optional(),
  defeated: z.boolean().default(false),
});
```

### 5.3 法术、技能与状态

第一版只支持枚举化效果，不支持 YAML 内嵌脚本。

```ts
export const DiceFormulaSchema = z.string(); // 例如 1d20+5, 2d6+3

export const EffectDefSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("damage"), amount: DiceFormulaSchema, damageType: z.string() }),
  z.object({ kind: z.literal("heal"), amount: DiceFormulaSchema }),
  z.object({ kind: z.literal("condition"), conditionId: z.string(), duration: z.number().int().optional() }),
  z.object({ kind: z.literal("resource"), resource: z.string(), amount: z.number() }),
]);
```

## 6. 规则系统计划

### 6.1 距离规则

- 射程、移动预算与 AOE 默认使用 3D 曼哈顿距离。
- 相邻格仅允许六方向正交移动：`±X`、`±Y`、`±Z`。
- 第一版不启用对角移动，以避免距离口径分裂。

### 6.2 移动消耗

建议第一版规则：

| 行为 | 消耗 |
|---|---:|
| 水平移动 1 格 | 1 |
| 上升 1 层 | 2 |
| 下降 1 层 | 1 |
| 困难地形 | 基础消耗 +1 |
| 阻挡格 | 不可进入 |
| 敌方占据格 | 不可进入 |

后续可扩展攀爬、飞行、跳跃、坠落伤害与体型占格。

### 6.3 命中与高低差

第一版建议简单实现：

- 攻击者 `z > 目标 z`：获得 `+1` 命中修正。
- 攻击者 `z < 目标 z`：获得 `-1` 命中修正。
- 高低差绝对值超过配置阈值时，可以追加 cover 或射程惩罚。
- cover 由目标格或射线经过的阻挡体决定；MVP 可先只读取目标格 cover。

### 6.4 AOE 形状

第一版支持：

1. `manhattan_sphere`：以中心点为基准，`distance3D <= radius`。
2. `cube`：轴对齐长方体范围。
3. `line`：六方向直线，可带宽度。
4. `column`：指定半径与高度的柱状区域。

### 6.5 回合与行动经济

MVP 回合模型：

```text
ROUND_START
  -> UNIT_TURN_START
  -> UNIT_ACTION
  -> UNIT_TURN_END
ROUND_END
```

单位每回合资源：

- `action: 1`
- `bonusAction: 1`
- `reaction: 1`
- `movement: unit.speed`

MVP 可以先只开放 `action` 与 `movement`，bonus/reaction 预留字段。

### 6.6 骰子系统

服务端实现：

- `rollDie(sides)`
- `rollFormula("2d6+3")`
- `rollD20({ advantage, disadvantage, modifier })`
- `rollAttack({ attacker, target, attackBonus, situationalBonus })`
- `rollSave({ target, ability, dc })`

所有骰子结果进入战斗日志，包含：

- 原始骰面；
- 修正值；
- 最终值；
- DC/AC；
- 成功/失败；
- 伤害拆分。

## 7. YAML 内容包计划

### 7.1 地图示例

```yaml
id: map.demo_ruins
name: Demo Ruins
size:
  width: 24
  depth: 24
  height: 6
cells:
  - coord: { x: 5, y: 5, z: 1 }
    terrainId: stone_platform
    movementCost: 1
    cover: half
  - coord: { x: 6, y: 5, z: 1 }
    terrainId: stone_wall
    blocksMovement: true
    blocksLineOfSight: true
    cover: full
```

### 7.2 单位示例

```yaml
id: unit.goblin
name: Goblin
size: small
maxHp: 7
ac: 15
speed: 6
stats:
  str: 8
  dex: 14
  con: 10
  int: 10
  wis: 8
  cha: 8
actions:
  - action.scimitar
  - action.shortbow
tokenAssetId: ship_texture:goblin-placeholder
```

### 7.3 法术示例

```yaml
id: spell.firebolt
name: Fire Bolt
range: 12
target:
  type: single
  requiresLineOfEffect: true
roll:
  type: spellAttack
  ability: int
effects:
  - kind: damage
    amount: 1d10
    damageType: fire
animation:
  assetId: weapon_texture:fire-placeholder
```

### 7.4 村规“杀戮回响”示例

```yaml
id: rule.kill_echo
enabled: true
trigger: on_unit_defeated
effects:
  - kind: resource
    target: killer
    resource: echo
    amount: 1
limits:
  maxEcho: 3
  oncePerTurn: true
```

## 8. 前端 Three.js 计划

### 8.1 MVP 渲染目标

- 固定斜俯视相机。
- 体素地形以 InstancedMesh 渲染。
- 单位 token 以 billboard sprite 或立牌形式渲染。
- 鼠标 raycast 选择格子与单位。
- 可移动范围高亮。
- 路径预览。
- AOE 预览。
- 行动结果通过状态 patch 更新。

### 8.2 交互状态

客户端 UI store 应保存：

- 当前选中单位。
- 当前悬停格子。
- 当前行动模式：移动、攻击、施法、测距、编辑。
- 路径预览。
- AOE 预览。
- 相机状态。

### 8.3 与旧 Pixi 管线的关系

- 不建议直接改造 `PixiCanvas`。
- 新增 `ThreeCanvas`，由 DND GamePage 使用。
- 旧 Pixi 渲染器可在分支早期保留，直到 DND 页面稳定后删除或归档。

## 9. 后端权威行动流程

客户端请求：

```ts
request("dnd:action", {
  unitId,
  actionId,
  targetUnitId,
  targetCoord,
  path,
});
```

服务端流程：

1. 校验玩家已认证且在房间内。
2. 校验当前 phase 与 active unit。
3. 校验单位归属或 DM 权限。
4. 根据 action 类型进入移动、攻击、施法或互动模块。
5. 校验距离、路径、资源、视线、目标合法性。
6. 由服务端投骰。
7. 应用伤害、治疗、状态、资源变化。
8. 触发规则插件，例如“杀戮回响”。
9. 写入 battle log。
10. 通过 state patch 广播结果。

## 10. 分阶段实施计划

### 阶段 0：分支初始化与边界冻结

目标：建立 DND 分支方向，避免与 STFCS 主线混淆。

任务：

- 创建 `dnd-tactics-prototype` 或类似分支。
- 更新 README/项目描述，标注该分支为 DND 战棋实验分支。
- 添加本计划文档。
- 确认当前构建、测试与开发命令仍可运行。

验收标准：

- 文档存在。
- 无业务代码变更或仅有命名/入口隔离变更。
- CI 仍使用原有管线。

### 阶段 1：DND 数据模型骨架

目标：在不破坏网络基础设施的前提下，引入 DND 共享 schema。

任务：

- 新增 `packages/data/src/dnd/schemas.ts`。
- 定义 `Coord3D`、`GridMap3D`、`GridCell`、`UnitDef`、`UnitRuntime`、`SpellDef`、`ConditionDef`。
- 新增 `packages/data/src/dnd/geometry3d.ts`。
- 实现 `distance3D`、`neighbors6`、`isInsideGrid`、`cellsInManhattanSphere`。
- 为 geometry 与 schema 添加单元测试。

验收标准：

- `pnpm --filter @vt/data typecheck` 通过。
- 3D 曼哈顿距离测试覆盖 X/Y/Z 差值。
- AOE 枚举测试覆盖中心、边界与越界裁剪。

### 阶段 2：YAML 内容加载器

目标：将地图、单位、法术、状态与规则配置转为校验后的内容注册表。

任务：

- 引入 YAML 解析依赖。
- 新增 `YamlContentLoader`。
- 新增 `ContentRegistry`。
- 为 `content/dnd` 添加 demo map、goblin、fighter、firebolt、kill_echo。
- 添加内容校验命令，例如 `pnpm content:validate`。

验收标准：

- 无效 YAML 会报告文件路径、字段路径与错误信息。
- demo 内容能加载为强类型 registry。
- 服务端启动时可选择加载内容包。

### 阶段 3：DND 房间状态与服务端 handler

目标：让房间能够承载 DND 3D 地图和单位状态。

任务：

- 添加 DND GameRoomState 或在现有 GameRoomState 中引入 gameMode 分支。
- 新增 `dnd:load_map`、`dnd:spawn_unit`、`dnd:start_combat`、`dnd:end_turn` handler。
- 保留 auth、room、profile、asset、save 基础 RPC。
- 新增 DND battle log 事件 payload。

验收标准：

- 玩家可创建/加入 DND 房间。
- DM 可加载 demo map。
- DM 可部署单位。
- 客户端可收到 `sync:full` 与 `state:patch`。

### 阶段 4：Three.js 地图原型

目标：完成可交互 3D 网格地图。

任务：

- 添加 Three.js 依赖。
- 新增 `ThreeCanvas`。
- 实现体素格渲染。
- 实现相机控制。
- 实现 raycast 拾取格子。
- 实现 hover/selected 高亮。

验收标准：

- demo map 可视化。
- 鼠标可选中格子。
- 高度层级清晰可见。
- 地图规模 24x24x6 运行流畅。

### 阶段 5：单位 token 与移动

目标：完成第一条核心玩法闭环：选择单位并移动。

任务：

- 实现 `UnitTokenRenderer`。
- 实现服务端 `moveUnit` 校验。
- 实现 6 邻接路径搜索。
- 实现高低差移动消耗。
- 实现客户端可移动范围与路径预览。
- 写入移动日志。

验收标准：

- 只能在当前单位回合移动。
- 不能穿过阻挡格。
- 不能超过 movement budget。
- Z 轴高低差影响移动消耗。
- 移动结果由服务端 patch 同步。

### 阶段 6：骰子、攻击与伤害

目标：完成第二条核心玩法闭环：攻击并造成伤害。

任务：

- 实现服务端 dice module。
- 支持 `1d20+X`、`NdM+K` 公式。
- 实现攻击命中 AC。
- 实现基础伤害与 HP 变化。
- 实现 defeated 状态。
- 实现攻击日志与骰子详情。

验收标准：

- 客户端不能伪造骰子。
- 命中/未命中结果可复盘。
- 单位 HP 与 defeated 状态同步。
- 日志清晰展示 d20、修正、AC、伤害骰。

### 阶段 7：法术、AOE 与状态

目标：完成配置化法术和范围效果。

任务：

- 实现 SpellDef 加载。
- 实现单体法术。
- 实现 manhattan sphere、cube、line、column AOE。
- 实现 saving throw。
- 实现 condition apply/remove。
- 实现 AOE preview。

验收标准：

- Fire Bolt 可作为单体攻击法术。
- Thunderwave 或类似法术可影响 3D 范围。
- AOE 预览与服务端实际命中格一致。
- 状态持续时间随回合推进减少。

### 阶段 8：“杀戮回响”规则插件

目标：验证村规可以通过配置开关与规则模块进入战斗流程。

任务：

- 实现 `killEcho.ts`。
- 支持 `on_unit_defeated` 触发。
- 支持 killer 获得 echo 资源。
- 支持每回合一次、最大层数等限制。
- 在 UI 显示 echo 资源。

验收标准：

- 击败单位时正确触发。
- 非击杀伤害不触发。
- 限制条件生效。
- 日志记录“杀戮回响”获得与消耗。

### 阶段 9：UI 整合与可玩 Demo

目标：形成一局可玩的最小战斗。

任务：

- DND 顶栏/回合条。
- 单位信息面板。
- 行动面板。
- 法术面板。
- 状态面板。
- 日志过滤与骰子详情。
- Demo 场景：2 名玩家、若干单位、至少 2 个法术。

验收标准：

- 两名玩家可联机完成 3 个完整回合。
- DM 可保存和读取战斗快照。
- 所有关键行动均有日志。
- 无需手动修改代码即可替换 demo YAML 内容。

### 阶段 10：清理 STFCS 遗留耦合

目标：把项目从“舰船游戏分支”清理成“DND 战棋项目”。

任务：

- 删除或归档舰船专用 UI 面板。
- 删除或隔离护盾、flux、武器射界、护甲象限等模块。
- 重命名用户可见文案。
- 更新 README、部署说明、内容包说明。
- 梳理 asset type 命名，例如 `ship_texture` 迁移到 `token_texture`。

验收标准：

- 用户界面不再出现 STFCS 舰船专用概念。
- 类型命名不再阻碍 DND 内容开发。
- CI 全量通过。

## 11. 测试计划

### 11.1 单元测试

- `distance3D`。
- 6 邻接格生成。
- AOE 格子枚举。
- 路径搜索与移动消耗。
- 骰子公式解析。
- 命中、豁免、伤害。
- 状态持续时间。
- “杀戮回响”触发限制。

### 11.2 集成测试

- 创建房间、加载地图、部署单位。
- 玩家行动请求由服务端裁决。
- 移动后同步 patch 正确。
- 攻击后 HP、日志与 defeated 状态正确。
- 存档/读档保持 DND 状态完整。

### 11.3 手动验收场景

- 两玩家联机，DM 加载 demo map。
- 玩家 A 控制 fighter，从低地移动到高地。
- 玩家 A 攻击 goblin，获得高地修正。
- goblin 使用远程攻击，受到高低差惩罚。
- 法术命中多个不同高度单位。
- 击杀触发“杀戮回响”。

## 12. 风险与缓解

| 风险 | 等级 | 缓解 |
|---|---|---|
| DND 完整规则范围过大 | 高 | 第一版只做 DND 风格战棋核心，不承诺完整 5e 兼容 |
| Three.js 交互复杂 | 中高 | 固定斜俯视相机、InstancedMesh、billboard token，先做清晰交互 |
| YAML 变成脚本语言 | 高 | effect 枚举化，禁止任意 JS，全部由 Zod 校验 |
| 旧 STFCS 类型耦合严重 | 中 | 先新增 DND 命名空间，稳定后清理旧模块 |
| AOE 预览与服务端不一致 | 中 | 客户端和服务端共享 `@vt/data/dnd/geometry3d` |
| 资产类型语义不匹配 | 中 | MVP 复用旧 asset type，后续迁移到 token/spell/map asset type |

## 13. 首个里程碑定义

首个里程碑命名为 **DND 3D Grid Vertical Slice**。

必须包含：

- Demo YAML 地图。
- Three.js 体素地图。
- 两个单位。
- 3D 曼哈顿移动。
- 服务端权威攻击与伤害。
- 一个单体法术。
- 一个 AOE 法术。
- 战斗日志。
- 存档/读档。
- “杀戮回响”触发。

不包含：

- 完整职业系统。
- 完整法术列表。
- 完整 5e 规则兼容。
- 复杂光照与遮挡。
- 复杂动画编辑器。

## 14. 建议执行顺序

1. 提交本分支计划文档。
2. 创建 DND schema 与 geometry3d 测试。
3. 添加 YAML 内容加载器。
4. 新建 Three.js 渲染原型。
5. 接入单位部署与移动。
6. 接入攻击、骰子、日志。
7. 接入法术、AOE、状态。
8. 接入“杀戮回响”。
9. 完成 Demo UI 与存档。
10. 清理 STFCS 遗留概念。

## 15. 非目标

- 不在第一版实现完整 DND 5e 规则书。
- 不在第一版实现自由脚本化 mod 系统。
- 不在第一版实现大型开放世界地图。
- 不在第一版实现复杂 3D 角色模型与骨骼动画。
- 不在第一版追求视觉特效超过规则与联机稳定性。

## 16. 总结

该分支项目技术可行，且与 STFCS 现有架构匹配度较高。最重要的架构判断是：**复用联机平台与开发管线，重写游戏规则、共享数据模型与渲染层**。只要第一阶段严格控制范围，将目标限定为“服务端权威、配置驱动、3D 曼哈顿网格的可玩战棋 vertical slice”，就能在不牺牲现有基础设施价值的前提下，逐步演进成完整的 DND 风格联机战棋系统。
