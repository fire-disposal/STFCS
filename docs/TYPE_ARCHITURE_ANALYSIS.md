# 类型架构方案对比分析

**版本**: 1.0
**日期**: 2026-04-16
**问题**: 前端不能直接依赖后端包（运行时原因），但业务逻辑和 WebSocket 通信需要类型确保安全性

---

## 1. 核心问题

### 1.1 当前困境

```
前端 client ──❌──> @vt/server (包含 Colyseus 运行时)
                    │
                    ├── @colyseus/schema (运行时)
                    ├── @colyseus/core (运行时)
                    └── Schema 类定义
```

**矛盾点**:
- 前端需要 Schema 类型来确保 WebSocket 消息的类型安全
- 前端不能引入 Colyseus 服务端运行时依赖
- 类型定义必须与 Schema 字段 **100% 一致**，否则运行时错误

### 1.2 类型同步的关键性

WebSocket 通信的类型不一致会导致：

| 场景 | 后端 Schema | 前端期望 | 结果 |
|------|-------------|----------|------|
| 字段名错误 | `transform.x` | `x` | `undefined` → 渲染错误 |
| 类型错误 | `string` | `number` | 类型断言失败或静默错误 |
| 字段缺失 | 新增 `isOverloaded` | 无此字段 | 状态同步缺失 |
| 枚举值错误 | `"PHASE_A"` | `"phase_a"` | 字符串匹配失败 |

**结论**: 类型定义与 Schema 字段的同步是 **安全性的核心**，不能依赖手动维护。

---

## 2. 方案对比

### 方案 A: @vt/data 扩展

**架构**:
```
@vt/data (扩展后)
  ├── 枚举定义 (现有)
  ├── 静态数据类型 (现有)
  └── Schema 接口类型 (新增，手动定义)

前端 client ──依赖──> @vt/data (类型)
后端 server ──依赖──> @vt/data (类型 + 枚举)
规则 rules   ──依赖──> @vt/data (类型)
```

**实现方式**:
```typescript
// @vt/data/src/schema-types.ts (新增)
export interface TransformType {
  x: number;
  y: number;
  heading: number;
}

export interface HullStateType {
  current: number;
  max: number;
}

export interface ShipStateType {
  id: string;
  ownerId: string;
  faction: FactionValue;
  transform: TransformType;
  hull: HullStateType;
  // ... 手动定义所有字段，与 Schema 一一对应
}
```

**优点**:
| 维度 | 评价 |
|------|------|
| 依赖简洁 | ✅ 无新包，所有包都依赖 @vt/data |
| 构建速度 | ✅ @vt/data 无依赖，构建最快 |
| 运行时安全 | ✅ 前端无服务端运行时依赖 |
| 类型复用 | ✅ @vt/rules 可使用同一类型 |

**缺点**:
| 维度 | 评价 |
|------|------|
| **类型同步** | ❌ **手动维护，高风险** |
| 维护成本 | ❌ Schema 变化需同步修改 @vt/data |
| 类型不一致风险 | ❌ 无法自动检测字段差异 |
| 开发体验 | ❌ 新增字段需两处修改 |

**风险场景**:
```typescript
// 后端 Schema 新增字段
@type("boolean") isStealth: boolean = false;  // 新增

// 前端类型未同步 → 编译通过，运行时 undefined
interface ShipStateType {
  // 缺少 isStealth → 隐蔽状态不渲染
}
```

---

### 方案 B: 创建 @vt/schema-types

**架构**:
```
@vt/schema-types (新建)
  ├── 从 @vt/server 导入 type-only
  ├── 导出 InstanceType<typeof SchemaClass>
  └── 无运行时代码

前端 client ──依赖──> @vt/schema-types (type-only)
                    └─> @vt/data (枚举)

后端 server ──依赖──> @vt/data (枚举)
                 <── 类型导出给 @vt/schema-types

@vt/schema-types ──type-only──> @vt/server
```

**实现方式**:
```typescript
// @vt/schema-types/src/index.ts
import type { ShipState, WeaponSlot, GameRoomState } from '@vt/server/schema';

// 自动推导，100% 同步
export type ShipStateType = InstanceType<typeof ShipState>;
export type WeaponSlotType = InstanceType<typeof WeaponSlot>;
export type GameRoomStateType = InstanceType<typeof GameRoomState>;

// 客户端使用
import type { ShipStateType } from '@vt/schema-types';
const ship: ShipStateType = room.state.ships.get(id);
```

**优点**:
| 维度 | 评价 |
|------|------|
| **类型同步** | ✅ **自动推导，100% 一致** |
| 类型安全性 | ✅ Schema 变化自动反映到类型 |
| 开发体验 | ✅ 新增字段只需修改 Schema |
| 编译检查 | ✅ TypeScript 自动检测不一致 |

**缺点**:
| 维度 | 评价 |
|------|------|
| 依赖复杂 | ❌ 引入新包，依赖链变长 |
| 构建顺序 | ❌ @vt/schema-types 依赖 @vt/server |
| 构建成本 | ❌ 需要 server 构建完成才能构建前端 |
| 理论运行时 | ⚠️ type-only 依赖仍需 server 存在构建产物 |

**关键问题**:
```
pnpm build 顺序:
  1. @vt/data (无依赖)
  2. @vt/rules (依赖 data)
  3. @vt/server (依赖 data, rules)
  4. @vt/schema-types (type-only 依赖 server)
  5. @vt/client (依赖 schema-types)
```

**解决方案**: 使用 TypeScript `importsNotUsedAsValues: "remove"` 确保无运行时代码引入。

---

### 方案 C: 客户端独立类型

**架构**:
```
client/src/sync/types.ts
  ├── 手动定义所有 Schema 接口
  ├── 不依赖任何包
  └── 类型与后端 Schema 手动同步

前端 client ──无依赖──> 后端类型
              └─> @vt/data (仅枚举)
```

**实现方式**:
```typescript
// client/src/sync/types.ts
// 完全独立定义，不导入 @vt/server

export interface ShipState {
  id: string;
  ownerId: string;
  transform: { x: number; y: number; heading: number };
  hull: { current: number; max: number };
  // ... 所有字段手动定义
}

// Colyseus 返回的 Schema 实例满足此接口（结构类型）
const ship: ShipState = room.state.ships.get(id);
```

**优点**:
| 维度 | 评价 |
|------|------|
| 依赖隔离 | ✅ 前端完全独立于后端 |
| 构建自由 | ✅ 前端无需等待后端构建 |
| 灵活性 | ✅ 可按前端需求裁剪类型 |

**缺点**:
| 维度 | 评价 |
|------|------|
| **类型同步** | ❌ **手动维护，最高风险** |
| 维护成本 | ❌ Schema 变化需同步修改前端 |
| 类型复用 | ❌ @vt/rules 无法使用此类型 |
| 双向同步 | ❌ 后端修改需通知前端开发者 |
| 团队协作 | ❌ 前后端开发者需紧密协调 |

---

## 3. 综合评分

| 维度 | 方案 A | 方案 B | 方案 C |
|------|--------|--------|--------|
| **类型安全性** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **维护成本** | ⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐ |
| **依赖简洁** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **构建效率** | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ |
| **团队协作** | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | ⭐⭐ |
| **总分** | 16 | 20 | 13 |

---

## 4. 推荐方案

### 最终推荐: 方案 B（创建 @vt/schema-types）

**理由**:

1. **类型安全是核心需求** - WebSocket 通信的错误代价极高
2. **自动同步零维护** - Schema 变化自动反映到类型
3. **构建顺序可控** - monorepo 工具链已支持依赖顺序
4. **开发体验最优** - 只需修改一处（Schema）

**风险缓解**:

| 风险 | 缓解措施 |
|------|----------|
| 构建顺序依赖 | turbo.json 配置 pipeline 依赖 |
| 运行时泄漏 | tsconfig `importsNotUsedAsValues: "remove"` |
| 新包管理成本 | 单文件包，极简实现 |

### 具体实现建议

```
packages/schema-types/
  ├── src/
  │   └── index.ts    # 仅 type 导出
  ├── package.json    # dependencies: {} (type-only)
  └── tsconfig.json   # importsNotUsedAsValues: "remove"
```

```json
// package.json
{
  "name": "@vt/schema-types",
  "exports": {
    ".": "./dist/index.js"
  },
  // 关键: peerDependencies 而非 dependencies
  "peerDependencies": {
    "@vt/server": "workspace:*"
  },
  "peerDependenciesMeta": {
    "@vt/server": { "optional": true }  // 前端可选
  }
}
```

```typescript
// index.ts - 纯类型导出
import type {
  ShipState,
  WeaponSlot,
  GameRoomState,
  PlayerState,
  ChatMessage,
  Transform,
  HullState,
  ArmorState,
  FluxStateSchema,
  ShieldState,
} from '@vt/server/schema';

export type ShipStateType = InstanceType<typeof ShipState>;
export type WeaponSlotType = InstanceType<typeof WeaponSlot>;
export type GameRoomStateType = InstanceType<typeof GameRoomState>;
export type PlayerStateType = InstanceType<typeof PlayerState>;
export type ChatMessageType = InstanceType<typeof ChatMessage>;
export type TransformType = InstanceType<typeof Transform>;
export type HullStateType = InstanceType<typeof HullState>;
export type ArmorStateType = InstanceType<typeof ArmorState>;
export type FluxStateType = InstanceType<typeof FluxStateSchema>;
export type ShieldStateType = InstanceType<typeof ShieldState>;

// Schema 容器类型（客户端需要）
export interface SchemaMap<T> {
  get(key: string): T | undefined;
  has(key: string): boolean;
  forEach(cb: (value: T, key: string) => void): void;
  entries(): IterableIterator<[string, T]>;
  keys(): IterableIterator<string>;
  values(): IterableIterator<T>;
  size: number;
}

export interface SchemaArray<T> {
  length: number;
  [index: number]: T;
  forEach(cb: (value: T, index: number) => void): void;
  at(index: number): T | undefined;
}
```

---

## 5. 方案 A 的增强版（如果坚持）

如果选择方案 A，建议增加 **类型校验机制**：

```typescript
// @vt/data/src/schema-types.ts

// 定义接口
export interface ShipStateType {
  id: string;
  ownerId: string;
  // ...
}

// 增加校验函数（运行时检查）
export function validateShipState(obj: unknown): ShipStateType {
  // 校验所有必需字段
  if (typeof obj !== 'object' || obj === null) throw new Error('Invalid');
  const s = obj as Record<string, unknown>;
  if (typeof s.id !== 'string') throw new Error('Missing id');
  // ... 校验所有字段
  return obj as ShipStateType;
}
```

**但这增加了运行时成本，且校验函数本身也需要维护。**

---

## 6. 决策建议

| 如果... | 选择 |
|---------|------|
| 团队小，Schema 变化少 | 方案 A（简单优先） |
| Schema 经常变化，多人协作 | 方案 B（安全优先） |
| 前后端团队完全分离 | 方案 C（隔离优先） |

**本项目情况**:
- Schema 结构复杂（舰船、武器、护甲、护盾等）
- WebSocket 通信频繁
- 业务逻辑依赖类型安全

**结论**: 建议选择 **方案 B**。

---

**文档结束**