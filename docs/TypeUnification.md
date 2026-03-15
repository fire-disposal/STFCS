# 类型统一化指南

## 🎯 原则

### 1. 唯一来源 (Single Source of Truth)
所有核心类型必须从 `core-types.ts` 导出，禁止重复定义。

### 2. 从 Schema 推导类型
所有 TypeScript 类型应从 Zod schema 推导，避免手写重复类型。

### 3. 清晰的职责分离
```
core-types.ts       → 基础类型和 schema 定义
types/index.ts      → 统一导出（向后兼容）
protocol/messages.ts → 消息级别 schema
schemas/index.ts    → 验证 schema（可选，用于复杂验证）
```

## 📁 文件结构

```
packages/shared/src/
├── core-types.ts         ← 唯一来源
│   ├── PointSchema
│   ├── PlayerInfoSchema
│   ├── ShipStatusSchema
│   ├── TokenInfoSchema
│   └── ... (所有基础 schema)
│
├── types/
│   └── index.ts          ← 从 core-types 导出
│       export type { PlayerInfo, ShipStatus, ... } from '../core-types';
│
├── protocol/
│   └── messages.ts       ← 消息 schema
│       import { PlayerInfoSchema } from '../core-types';
│       export const PlayerMessages = { ... };
│
└── schemas/
    └── index.ts          ← 复杂验证 schema（可选）
```

## ✅ 正确的做法

### 1. 定义新类型
在 `core-types.ts` 中添加：
```typescript
// Schema 定义
export const NewTypeSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// 类型推导
export type NewType = z.infer<typeof NewTypeSchema>;
```

### 2. 使用现有类型
```typescript
// ✅ 正确：从 core-types 导入
import { PlayerInfoSchema, TokenInfoSchema } from '../core-types';

// ✅ 正确：从 types 导入类型
import type { PlayerInfo, TokenInfo } from '../types';

// ❌ 错误：重复定义
interface PlayerInfo {
  id: string;
  name: string;
  // ...
}
```

### 3. 定义消息 schema
```typescript
// protocol/messages.ts
import { PlayerInfoSchema } from '../core-types';

export const PlayerMessages = {
  PLAYER_JOINED: {
    type: 'PLAYER_JOINED' as const,
    schema: PlayerInfoSchema, // 直接使用现有 schema
    broadcast: true,
  },
};
```

## ❌ 错误示例

### 重复定义类型
```typescript
// ❌ 错误：在多个文件中定义相同类型
// types/index.ts
export interface PlayerInfo {
  id: string;
  name: string;
}

// protocol/messages.ts
const PlayerInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// ✅ 正确：统一在 core-types.ts 定义
```

### 手写类型而非推导
```typescript
// ❌ 错误：手写重复类型
export interface PlayerInfo {
  id: string;
  name: string;
}

// ✅ 正确：从 schema 推导
export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;
```

## 🔄 迁移指南

### 从旧代码迁移

1. **识别重复类型**
   ```bash
   grep -r "export interface PlayerInfo" packages/shared/src/
   grep -r "export type TokenInfo" packages/shared/src/
   ```

2. **移动到 core-types.ts**
   ```typescript
   // core-types.ts
   export const PlayerInfoSchema = z.object({ ... });
   export type PlayerInfo = z.infer<typeof PlayerInfoSchema>;
   ```

3. **更新导入**
   ```typescript
   // 原文件
   export interface PlayerInfo { ... }  // 删除
   
   // 改为导出
   export type { PlayerInfo } from '../core-types';
   ```

## 📊 类型清单

### 核心类型 (core-types.ts)

| 类型 | Schema | 用途 |
|------|--------|------|
| Point | PointSchema | 坐标点 |
| PlayerInfo | PlayerInfoSchema | 玩家信息 |
| ShipStatus | ShipStatusSchema | 舰船状态 |
| TokenInfo | TokenInfoSchema | Token 信息 |
| CameraState | CameraStateSchema | 相机状态 |
| CombatResult | CombatResultSchema | 战斗结果 |
| ExplosionData | ExplosionDataSchema | 爆炸数据 |
| WeaponSpec | WeaponSpecSchema | 武器规格 |
| TurnState | TurnStateSchema | 回合状态 |

### 消息类型 (protocol/messages.ts)

| 消息组 | 包含 |
|--------|------|
| PlayerMessages | PLAYER_JOINED, PLAYER_LEFT, DM_TOGGLE, ... |
| TokenMessages | TOKEN_PLACED, TOKEN_MOVED, OBJECT_SELECTED, ... |
| CameraMessages | CAMERA_UPDATED |
| ShipMessages | SHIP_MOVED, SHIP_STATUS_UPDATE, ... |
| CombatMessages | EXPLOSION, WEAPON_FIRED, DAMAGE_DEALT |

## 🔍 检查清单

在提交代码前检查：

- [ ] 新类型是否在 `core-types.ts` 中定义？
- [ ] 是否从 schema 推导类型而非手写？
- [ ] 是否避免了重复定义？
- [ ] 导入路径是否正确？
- [ ] 是否保持了向后兼容？

## 📈 收益

### 代码质量
- ✅ 消除 200+ 行重复代码
- ✅ 类型修改只需在一处进行
- ✅ 减少类型不一致的错误

### 开发效率
- ✅ 查找类型定义更快速
- ✅ 添加新类型更简单
- ✅ 代码审查更清晰

### 类型安全
- ✅ 运行时验证 + 编译时检查
- ✅ Schema 和类型保持同步
- ✅ 减少手动维护错误
