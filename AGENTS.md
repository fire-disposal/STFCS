# STFCS Project Context

## Goal

舰船战术游戏 STFCS（Starship Tactical Fleet Combat System）

## Instructions

### 坐标系统约定

**航海角度定义（系统标准）：**
- 0° = 船头（屏幕上方）
- 90° = 右舷（屏幕右侧）
- 180° = 船尾（屏幕下方）
- 270° = 左舷（屏幕左侧）
- 顺时针增加

**挂载点偏移坐标系：**
- X轴：左舷为正（heading=0时指向屏幕左侧 -X）
- Y轴：船头为正（heading=0时指向屏幕上方 -Y）

**phase 和 activeFaction 固定对应关系：**
修改 phase 时必须同步更新 activeFaction：
- phase="DEPLOYMENT" → activeFaction=undefined
- phase="PLAYER_ACTION" → activeFaction="PLAYER"
- phase="DM_ACTION" → activeFaction="ENEMY"

### 其他约定

- Radix Select.Item 不接受空字符串 value，使用 `"__none__"` 作为特殊值
- 舰船创建时 `metadata.owner` 应自动设置为创建者 playerId

---

## Coordinate System Inversion Status (TODO)

**问题描述：** 屏幕坐标系 Y 向下，航海坐标系 Y 向上，需要反转处理。

### 当前反转状态记录

| 模块 | 文件 | 反转方式 | 状态 |
|------|------|----------|------|
| **后端 angleBetween** | `packages/server/src/core/engine/geometry/angle.ts:32` | `dy = p1.y - p2.y` | ✅ 已修复 |
| **前端瞄准线计算** | `packages/client/src/renderer/entities/WeaponArcRenderer.ts:229` | `dy = mountWorldY - targetPos.y` | ✅ 已正确 |
| **前端 angleBetween** | `packages/client/src/utils/math.ts:20-25` | `atan2(dy, dx)` - **未反转** | ⚠️ 需检查 |
| **挂载点世界坐标** | 多处 | 公式一致 | ✅ 正确 |
| **PixiJS 绘制** | `packages/client/src/renderer/entities/WeaponArcRenderer.ts` | 使用航海角度直接绘制 | ✅ 正确 |
| **damage.ts hitAngle** | `packages/server/src/core/engine/rules/damage.ts:82,114` | 使用 angleBetween | ✅ 依赖 angleBetween |

### 统一方案建议（待讨论）

**方案 A：全系统使用航海角度，angle/atan2 统一反转**
- 所有 `angleBetween` 使用 `dy = p1.y - p2.y`（航海坐标系）
- 前端绘制直接使用航海角度，无需额外转换
- 优点：概念统一，减少混乱
- 缺点：需要检查所有使用 atan2 的地方

**方案 B：底层用屏幕角度，绘制时转换**
- `angleBetween` 返回屏幕角度（atan2(dy, dx)）
- 绘制时转换为航海角度
- 优点：符合数学惯例
- 缺点：需要多处转换，容易遗漏

**当前状态：** 采用方案 A，后端已修复，前端需检查 `utils/math.ts`

---

## Discoveries

1. **瞄准线坐标反转**：屏幕 Y 轴向下，航海坐标系 Y 轴向上，需要反转 dy
2. **回合流程简化**：移除 TURN_END 作为独立阶段，DM_ACTION 直接跳转到 PLAYER_ACTION + turn++
3. **RoomPlayerState 无 avatar 字段**：schema 只有基础字段，现已添加 avatar 字段
4. **Avatar 组件存在**：`/packages/client/src/ui/shared/Avatar.tsx` 支持 assetId 和 base64 加载
5. **PixiJS v8 无 beginHole/endHole**：需要用环形扇形绘制实现透明内圈
6. **贴图加载超时**：GamePage 需要绑定 socket response 监听器

---

## Relevant files / directories

**坐标系统：**
- `/packages/server/src/core/engine/geometry/angle.ts` - angleBetween 函数
- `/packages/client/src/utils/math.ts` - 前端角度计算（待检查）
- `/packages/client/src/utils/coordinateSystem.ts` - 坐标系统工具

**回合系统：**
- `/packages/data/src/core/GameSchemas.ts:538-551` - GameRoomStateSchema
- `/packages/server/src/server/socketio/handlers.ts:869-902` - force_end_turn
- `/packages/server/src/core/state/MutativeStateManager.ts:346-359` - changePhase

**武器渲染：**
- `/packages/client/src/renderer/entities/WeaponArcRenderer.ts` - 武器弧和瞄准线
- `/packages/server/src/core/engine/rules/targeting.ts` - 后端目标计算

**顶栏 UI：**
- `/packages/client/src/ui/panels/TopBar.tsx` - 顶栏组件
- `/packages/client/src/ui/shared/Avatar.tsx` - 头像组件

**状态管理：**
- `/packages/client/src/state/stores/uiStore.ts` - UI 状态
- `/packages/client/src/pages/GamePage.tsx` - 游戏页面

---

## Next steps

1. 检查前端 `utils/math.ts` 的 angleBetween 是否需要同步修复
2. 讨论并统一坐标系统反转策略
3. 添加 targeting.test.ts 的射界测试用例