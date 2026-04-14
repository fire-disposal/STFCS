# 架构重构设计文档

## 问题诊断

### 原架构的扭曲之处

```
原架构问题：

contracts（声称"纯类型")
├── combatLog.ts → CombatLogManager 类 + 全局单例 ❌ 运行时逻辑
├── enums.ts → DAMAGE_MODIFIERS, GAME_CONFIG ❌ 游戏配置数据
└── 概念混淆：既做类型定义，又做运行时

rules（声称"规则计算")
├── data/ → PRESET_WEAPONS, PRESET_SHIPS ❌ 预设数据（应该在 data 包）
├── 依赖 @colyseus/schema ❌ 网络层依赖（规则层不需要）
└── 重导出 contracts * ❌ 变成超级包，边界模糊

server/schema
├── 自定义 DAMAGE_MULTIPLIERS ❌ 第三次重复定义同一数据
├── 自定义 Payload 类型 ❌ 与 contracts/messages.ts 重复
└── setTimeout 在 Schema 中 ❌ 违反 Colyseus 最佳实践

client
├── 从 contracts 导入接口 → 接收 Schema 实例 ❌ 类型不匹配
└── 使用 any 绕过类型检查 ❌ 类型安全缺失
```

---

## 新架构设计

### 包职责划分

| 包 | 职责 | 依赖 | 内容 |
|---|------|------|------|
| **@vt/types** | 纯类型定义 | 无 | 枚举、接口、Payload |
| **@vt/data** | 游戏数据 | types | 武器、舰船、配置 |
| **@vt/rules** | 规则计算 | types | 数学、伤害、验证 |
| **server/schema** | Colyseus Schema | types, rules | 实现 interfaces |
| **client** | UI 渲染 | types, rules | 消费数据 |

### 数据流向

```
types (契约：前后端共享的唯一类型来源)
  ↓
┌────┴────┬────────────┐
data      rules       server/schema
(预设)    (计算)      (网络同步：implements types)
  │         │            │
  └────┴────┴────────────┘
           ↓
        client
      (消费：正确类型)
```

---

## 新包结构

### @vt/types（纯类型）

```
packages/types/
├── src/
│   ├── enums.ts       → DamageType, WeaponState, Faction...
│   ├── interfaces.ts  → ShipState, WeaponSlot, PlayerState...
│   ├── payloads.ts    → MoveTokenPayload, FireWeaponPayload...
│   ├── movement.ts    → MovementPlan, MovementValidation
│   └── index.ts       → 导出所有类型
└── package.json       → 无运行时依赖
```

**原则**：
- 只包含 TypeScript 类型定义
- 不包含任何运行时代码
- 不包含游戏配置数据

### @vt/data（游戏数据）

```
packages/data/
├── src/
│   ├── config.ts      → DAMAGE_MODIFIERS, GAME_CONFIG
│   ├── weapons.ts     → PRESET_WEAPONS, getWeaponSpec()
│   ├── ships.ts       → PRESET_SHIPS, getShipHullSpec()
│   └── index.ts       → 导出所有数据
└── package.json       → 依赖 @vt/types
```

**原则**：
- 包含预设游戏数据
- 包含游戏配置常量
- 提供数据访问函数

### @vt/rules（规则计算）

```
packages/rules/
├── src/
│   ├── math/          → distance, angle, collision
│   ├── combat/        → damage calculation, armor
│   ├── validation/    → validateWeaponFire, validateMovement
│   └── index.ts       → 导出所有函数
└── package.json       → 依赖 @vt/types, @vt/data（不依赖 @colyseus/schema）
```

**原则**：
- 只包含纯计算函数
- 不依赖 Colyseus Schema
- 不包含预设数据

---

## Colyseus 最佳实践

### Schema 类正确设计

```typescript
// server/src/schema/ShipState.ts
import type { ShipState } from "@vt/types";  // 导入接口

export class ShipStateSchema extends Schema implements ShipState {
  @type("string") id: string = "";
  @type("number") x: number = 0;
  @type("number") y: number = 0;
  // ...实现接口字段
  
  // 辅助方法（同步操作，无 setTimeout）
  setPosition(x: number, y: number): void {
    this.x = x;
    this.y = y;
  }
}
```

### Payload 正确使用

```typescript
// server/src/rooms/BattleRoom.ts
import type { MoveTokenPayload } from "@vt/types";  // 从 types 导入

onMessage(ClientCommand.CMD_MOVE_TOKEN, (client, payload: MoveTokenPayload) => {
  // 直接使用类型
});
```

### Client 正确类型

```typescript
// client/src/hooks/useShipState.ts
import type { ShipState } from "@vt/types";
import type { ShipStateSchema } from "@vt/server/schema";

// 知道实际是 Schema 实例
export function useShipState(room: Room<GameRoomStateSchema>, shipId: string): ShipStateSchema | null {
  return room.state.ships.get(shipId);
}
```

---

## 迁移计划

1. **创建新包**：types, data（已完成）
2. **重构 rules**：移除 Colyseus 依赖，移除预设数据
3. **重构 server/schema**：Schema 实现 types 接口，移除 setTimeout
4. **重构 server/rooms**：使用 types Payload
5. **重构 client**：使用正确类型
6. **删除旧 contracts**：迁移完成后删除
7. **更新导入**：全局更新导入路径

---

## 预期收益

| 问题 | 解决方案 |
|------|---------|
| contracts 包含运行时逻辑 | types 只包含类型定义 |
| 同一数据重复定义3次 | data 包统一管理 |
| rules 依赖 Colyseus | rules 不依赖任何网络层 |
| client 类型不匹配 | Schema implements 接口 |
| setTimeout 在 Schema | 移到 Room 管理 |
| any 类型绕过检查 | 正确类型定义 |