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

**贴图偏移坐标系（同挂载点坐标系）：**
- offsetX：左舷为正（heading=0时指向屏幕左侧）
- offsetY：船头为正（heading=0时指向屏幕上方）
- scale：贴图缩放比例（相对于原始尺寸）
- 贴图中心点对齐舰船中心，加上偏移

**PixiJS rotation 转换：**
- PixiJS 正角度逆时针旋转
- 航海角度顺时针增加
- 两者恰好抵消，因此 `sprite.rotation = heading * π / 180`（正数）
- 注意：贴图设计需船头朝上（未旋转状态）

**屏幕坐标系 vs 航海坐标系：**
- 屏幕坐标系：Y向下（左上角为原点）
- 航海坐标系：Y向上（船头方向为正）
- offsetY 在屏幕上表现为负方向移动

**phase 和 activeFaction 固定对应关系：**
修改 phase 时必须同步更新 activeFaction：
- phase="DEPLOYMENT" → activeFaction=undefined
- phase="PLAYER_ACTION" → activeFaction="PLAYER"
- phase="DM_ACTION" → activeFaction="ENEMY"

### 其他约定

- Radix Select.Item 不接受空字符串 value，使用 `"__none__"` 作为特殊值
- 舰船创建时 `metadata.owner` 应自动设置为创建者 playerId
- 护盾初始化：舰船有 shield spec 时必须初始化 runtime.shield（包含 active, value, direction）
- 所有舰船创建路径（createCombatToken, edit:token create, 机库部署）都需要初始化护盾

---

## Unified Geometry Functions

**统一坐标函数模块：** `@vt/data/geometry.ts`

提供以下函数：

```typescript
// 基础角度
normalizeAngle, normalizeAngleSigned, toRadians, toDegrees

// 角度计算
angleBetween(from, to)          // 两点间航海角度（dy反转）
nauticalToMath, mathToNautical  // 航海/数学角度转换
angleDifference, calculateTurnAngle, lerpAngle

// 坐标转换
getMountWorldPosition(shipPos, heading, offset)  // 挂载点世界坐标
getMovementVector(heading, forward, strafe)       // 移动向量
applyMovement(position, heading, forward, strafe) // 应用移动

// 几何检测
distanceBetween, isAngleInArc
isPointInAnnularSector  // 点在环形扇形内（瞄准判定）
isPointInCircle, isPointInRect

// PixiJS 辅助
toPixiRotation(nauticalAngle)  // heading * PI/180
```

**使用约定：**
- 所有角度计算使用 `@vt/data` 导入
- 后端：`import { angleBetween, getMountWorldPosition } from "@vt/data"`
- 前端：`import { toPixiRotation, nauticalToMath } from "@vt/data"`

---

## Discoveries

1. **瞄准线坐标反转**：屏幕 Y 轴向下，航海坐标系 Y 轴向上，需要反转 dy
2. **回合流程简化**：移除 TURN_END 作为独立阶段，DM_ACTION 直接跳转到 PLAYER_ACTION + turn++
3. **RoomPlayerState 无 avatar 字段**：schema 只有基础字段，现已添加 avatar 字段
4. **Avatar 组件存在**：`/packages/client/src/ui/shared/Avatar.tsx` 支持 assetId 和 base64 加载
5. **PixiJS v8 无 beginHole/endHole**：需要用环形扇形绘制实现透明内圈
6. **贴图加载超时**：GamePage 需要绑定 socket response 监听器
7. **护盾初始化路径**：createCombatToken、edit:token create、机库部署三处都需要初始化护盾
8. **setToken 迁移**：MutativeStateManager.setToken 会自动为有护盾规格但无运行时护盾的舰船初始化护盾

---

## Relevant files / directories

**护盾系统：**
- `/packages/server/src/core/engine/modules/shield.ts:190-216,336-362` - toggleShield, validateShieldToggle
- `/packages/server/src/server/socketio/handlers.ts:517-546,750-776` - shield_toggle 处理, edit:token create
- `/packages/server/src/core/state/Token.ts:48-89` - createCombatToken（护盾初始化）
- `/packages/server/src/core/state/MutativeStateManager.ts:246-261` - setToken（护盾迁移）
- `/packages/client/src/ui/panels/ShieldPanel.tsx` - 护盾面板
- `/packages/client/src/ui/panels/ShipPresetPanel.tsx:88-141` - 机库部署（handleDeploy）
- `/packages/data/src/core/GameSchemas.ts:196-202,427-446` - ShieldSpecSchema, TokenRuntimeSchema

**回合系统：**
- `/packages/client/src/ui/panels/TurnBar.tsx` - 准备按钮全程显示
- `/packages/client/src/ui/panels/DMControlPanel.tsx` - 简化（移除开始/推进按钮）
- `/packages/server/src/core/state/MutativeStateManager.ts:346-370` - changePhase, resetAllPlayersReady
- `/packages/server/src/server/socketio/handlers.ts:869-902` - force_end_turn

**舰船信息：**
- `/packages/client/src/ui/panels/ShipInfoPanel.tsx` - 两行布局 + 护甲象限

**坐标系统：**
- `/packages/data/src/core/geometry.ts` - 统一几何函数模块
- `/packages/server/src/core/engine/geometry/sector.ts` - 扇形边界计算
- `/packages/server/src/core/engine/geometry/quadrant.ts` - 象限计算
- `/packages/server/src/core/engine/rules/armor.ts` - 护甲象限

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

1. 添加 targeting.test.ts 的射界测试用例
2. 考虑迁移 MagneticSnap.ts 使用 getMountWorldPosition（可选）