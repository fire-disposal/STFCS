# 规则系统架构设计

## 一、核心设计原则

### 依赖方向（单向流动）

```
@vt/contracts → @vt/rules → server/client
     类型层        规则层        应用层
```

**禁止反向依赖**：contracts 包不依赖任何其他包，确保类型定义的纯净性。

---

## 二、包职责划分

### @vt/contracts（契约包）

| 职责 | 文件位置 | 说明 |
|-----|---------|-----|
| 枚举定义 | `definitions/enums.ts` | DamageType, Faction, WeaponState... |
| 常量定义 | `definitions/enums.ts` | DAMAGE_MODIFIERS, GAME_CONFIG, ARMOR_QUADRANTS |
| Zod Schema | `definitions/schemas.ts` | 数据验证 Schema |
| TypeScript 接口 | `definitions/interfaces.ts` | 运行时类型声明 |
| 消息协议 | `messages.ts` | ClientCommand, Payload 类型 |
| 战斗日志 | `combatLog.ts` | 日志类型定义 |

**导出规范**：
```typescript
// 正确用法
import { DamageType, GAME_CONFIG, ShipState } from "@vt/contracts";
import type { FireWeaponPayload } from "@vt/contracts";
```

**禁止导出**：
- 运行时计算函数（如护甲计算）
- 数据访问函数（如 getShipHullSpec）
- 任何包含业务逻辑的代码

---

### @vt/rules（规则包）

| 模块 | 文件位置 | 核心功能 |
|-----|---------|---------|
| **数学计算** | `math/index.ts` | distance, angleBetween, validateThreePhaseMove, SAT碰撞检测 |
| **护甲系统** | `combat/armor.ts` | getQuadrantFromAngle, applyArmorDamage, 象限索引转换 |
| **伤害计算** | `combat/damage.ts` | calculateFullDamage, 护盾/护甲/船体伤害计算 |
| **规则验证** | `validation/index.ts` | validateWeaponFire, validateMovement, validatePhaseTransition |
| **舰船数据** | `data/ShipHullSchema.ts` | PRESET_SHIPS, getShipHullSpec |
| **武器数据** | `data/WeaponSchema.ts` | PRESET_WEAPONS, getWeaponSpec |

**导出规范**：
```typescript
// 数学工具
import { distance, validateThreePhaseMove, angleBetween } from "@vt/rules";

// 伤害计算
import { calculateFullDamage, applyDamageToArmor } from "@vt/rules";

// 规则验证
import { validateWeaponFire, validateMovement } from "@vt/rules";

// 护甲系统
import { getQuadrantFromAngle, applyArmorDamage, createDefaultArmorState } from "@vt/rules";

// 数据访问
import { getShipHullSpec, PRESET_SHIPS } from "@vt/rules";

// rules 包重导出 contracts，简化导入
import { DamageType, ShipState, GAME_CONFIG } from "@vt/rules";
```

---

## 三、模块详细说明

### math 模块

```typescript
// 基础数学
toRadians(degrees) / toDegrees(radians)
distance(x1, y1, x2, y2)
angleBetween(x1, y1, x2, y2)
angleDifference(angle1, angle2)
normalizeAngle(angle)

// 向量计算（使用 gl-matrix）
getForwardVector(heading) → vec2
getRightVector(heading) → vec2
vec2（重导出 gl-matrix）

// 三阶段移动
validateThreePhaseMove(start, plan, maxSpeed, maxTurnRate) → MovementValidation
calculateThreePhaseMove(start, plan) → { x, y, heading }
calculateMovementRange(x, y, heading, maxSpeed, maxTurnRate) → points[]

// 碰撞检测（使用 SAT.js）
createShipPolygon(x, y, heading, width, length) → SAT.Polygon
checkCollision(poly1, poly2) → boolean
isPointInArc(point, center, angle, arcWidth, range) → boolean
```

### combat/armor 模块

```typescript
// 象限转换
QUADRANT_INDEX_MAP: Record<ArmorQuadrantValue, number>
INDEX_TO_QUADRANT: ArmorQuadrantValue[]
quadrantToIndex(quadrant) → number
indexToQuadrant(index) → ArmorQuadrantValue
getQuadrantFromAngle(hitAngle, targetHeading) → ArmorQuadrantValue
getQuadrantIndexFromAngle(hitAngle, targetHeading) → number

// 伤害计算
calculateArmorDamageReduction(baseDamage, armorValue, damageType) → number
applyArmorDamage(currentArmor, damage, damageType) → { armorDamage, hullDamage }

// 护甲状态
createDefaultArmorState(maxPerQuadrant) → number[]
createArmorStateWithDistribution(maxArmor, distribution) → number[]
arrayToArmorState(values) → Record<ArmorQuadrantValue, number>
armorStateToArray(state) → number[]
takeDamageOnQuadrant(armorValues, quadrantIndex, damage) → { newArmorValues, actualDamage }

// 护甲查询
getWeakestQuadrant(armorValues) → { index, value }
getStrongestQuadrant(armorValues) → { index, value }
getAverageArmorPercent(armorValues, maxPerQuadrant) → number
isArmorDepleted(armorValues) → boolean
```

### combat/damage 模块

```typescript
// 护盾伤害
calculateShieldDamage(baseDamage, damageType, fluxPerDamage) → ShieldDamageResult
checkShieldHit(shieldActive, orientation, arc, hitAngle, ignoresShields) → boolean

// 护甲/船体伤害
calculateArmorAndHullDamage(baseDamage, damageType, armor, quadrantIndex) → ArmorDamageResult

// 完整伤害流程
calculateFullDamage(baseDamage, damageType, positions, states, options) → DamageResult

// 应用伤害
applyDamageToShield(flux, damage, fluxGenerated) → { newFlux, isOverloaded }
applyDamageToArmor(armorValues, quadrantIndex, armorDamage) → number[]
applyDamageToHull(currentHull, hullDamage, maxHull) → HullDamageResult

// 武器命中检测
calculateWeaponHitChance(attacker, weapon, target) → { inRange, inArc, distance, angle }
```

### validation 模块

```typescript
// 武器开火验证
validateWeaponFire(attacker, weapon, target, attackerFlux) → WeaponFireValidation

// 护盾切换验证
validateShieldToggle(flux, isOverloaded, shieldActive, wantToActivate) → ShieldToggleValidation

// 辐能排散验证
validateFluxVent(fluxState, isOverloaded, overloadTime) → FluxVentValidation

// 移动验证
validateMovement(start, plan, shipStats, isOverloaded, hasMoved, isIncremental) → MovementValidation
validateIncrementalMovement(start, target, phase, shipStats, isOverloaded) → MovementValidation

// 阶段流转验证
validatePhaseTransition(currentPhase, allPlayersReady, isDM) → PhaseTransitionValidation

// 玩家操作验证
validatePlayerAction(currentPhase, playerRole, playerIsReady) → { valid, error }
validateShipOwnership(shipOwnerId, playerSessionId, playerRole) → { valid, error }
validateMapBoundaries(x, y, mapWidth, mapHeight) → { valid, error }
```

---

## 四、前后端使用场景

### 服务端使用

```typescript
// CommandDispatcher.ts - 使用验证器和计算模块
import {
	validateWeaponFire,
	validateMovement,
	validatePlayerAction,
	validateShipOwnership,
	calculateFullDamage,
	applyDamageToArmor,
	applyDamageToHull,
	distance,
	angleBetween,
} from "@vt/rules";

// BattleRoom.ts - 使用数据访问
import { getShipHullSpec, getWeaponSpec, GAME_CONFIG } from "@vt/rules";
```

### 客户端使用

```typescript
// mathUtils.ts - 导入基础数学，保留屏幕坐标转换
import { toRadians, toDegrees, normalizeAngle, distance, angleBetween } from "@vt/rules";
// 屏幕坐标转换（客户端特有）
export const screenToWorld = (screenX, screenY, zoom, cameraX, cameraY, viewRotation) => {...};
export const worldToScreen = (worldX, worldY, zoom, cameraX, cameraY, viewRotation) => {...};

// WeaponArcOverlay.tsx - 使用数学计算
import { distance, isPointInArc } from "@vt/rules";

// DeploymentPanel.tsx - 使用数据访问
import { getShipHullSpec, PRESET_SHIPS } from "@vt/rules";
```

---

## 五、Colyseus 状态同步

### Schema 定义位置

Colyseus Schema 定义在 `server/src/schema/` 目录，**不在 contracts 包中**。

原因：
1. Colyseus Schema 需要使用 `@colyseus/schema` 装饰器
2. Schema 是服务端专用的状态同步机制
3. 客户端通过 Colyseus SDK 自动获取类型

```typescript
// server/src/schema/ShipStateSchema.ts
import { Schema, type } from "@colyseus/schema";

export class ShipStateOptimized extends Schema {
  @type("string") id: string;
  @type(Transform) transform = new Transform();
  // ...
}
```

### 类型与 Schema 的关系

```
@vt/contracts                    server/schema
───────────────────────────────────────────────
ShipState (interface)     ←→     ShipStateOptimized (Schema)
Point (interface)         ←→     Transform (Schema)
WeaponSlot (interface)    ←→     WeaponSlotSchema (Schema)
```

客户端使用 contracts 的类型定义，服务端使用 Colyseus Schema 进行同步。

---

## 六、扩展指南

### 添加新枚举

1. 在 `contracts/definitions/enums.ts` 添加枚举定义
2. 同时添加 Zod Schema（可选）
3. 在 `contracts/definitions/index.ts` 导出
4. rules 包自动通过重导出获得

### 添加新规则

1. 在 `rules/src/` 新建模块目录（如 `rules/src/maneuver/`）
2. 从 `@vt/contracts` 导入所需类型和常量
3. 实现纯函数，不依赖外部状态
4. 在 `rules/src/index.ts` 导出

### 添加新数据

1. 在 `rules/src/data/` 新建文件（如 `EngineSchema.ts`）
2. 定义预设数据数组
3. 提供 `getEngineSpec()` 访问函数
4. 在 `rules/src/index.ts` 导出

---

## 七、常见错误及修复

### 错误：contracts 导入 rules

```typescript
// ❌ 错误 - contracts 依赖 rules
export { applyArmorDamage } from "@vt/rules";
```

**修复**：将计算函数移至 rules 包，contracts 只导出类型。

### 错误：在 contracts 中定义运行时逻辑

```typescript
// ❌ 错误 - contracts 包含业务逻辑
export function calculateDamage(...) { ... }
```

**修复**：移动到 `rules/src/combat/` 目录。

### 错误：客户端重复定义基础数学

```typescript
// ❌ 错误 - 客户端重复定义
export const toRadians = (degrees) => degrees * Math.PI / 180;
```

**修复**：从 `@vt/rules` 导入，只保留客户端特有的屏幕坐标转换。

### 错误：客户端导入服务端 Schema

```typescript
// ❌ 错误 - 客户端导入 Colyseus Schema
import { ShipStateOptimized } from "@vt/server/schema";
```

**修复**：使用 contracts 的类型定义，或通过 Colyseus SDK 获取。