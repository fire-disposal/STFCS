# 前端问题诊断与修复方案（Pixi + Colyseus）

日期：2026-04-15

## 1. 目标与范围

- **目标**：使前端严格匹配当前 @vt/types 定义，消除 CI/CD 编译错误；修正地图拖拽的阻力/回弹；将摄像机旋转中心改为屏幕中心；确保 Pixi 与 Colyseus 交互方案符合最佳实践。
- **范围**：客户端 types 使用、store 状态、渲染与交互（Pixi）、网络同步（Colyseus）。
- **非范围**：后端 schema 结构与服务逻辑的改动（除非确认类型源需要回填）。

## 2. 现状诊断摘要

### 2.1 类型断层
- 客户端使用的字段在 @vt/types 中不存在或命名不一致：
  - `CameraState` 仅有 `x/y/zoom/followingShipId`，但 client 使用 `centerX/centerY/minZoom/maxZoom/rotation`。
  - `TokenTypeValue` 为 `"SHIP" | "STATION" | "ASTEROID"`，但 client 代码使用小写字符串。
  - `WeaponSlot`、`ShipState`、`TokenInfo`、`PlayerCamera` 等缺少字段或结构不一致。
- 结果：大量 TS 报错，集中在 store、hooks、渲染层。

### 2.2 交互缺陷
- **拖拽平移**出现阻力/回弹：通常源于惯性/阻尼或边界回弹逻辑未按需求关闭。
- **旋转中心**错误：当前围绕世界坐标中心旋转，要求改为“屏幕中心（视口中心）”。

#### 相关实现梳理（平移/旋转）
- 平移输入入口：
   - GameView 内的 `handleMapPan`（当前按屏幕增量直推，无视图旋转补正）。
   - Pixi 事件中 `usePixiApp` → `useInteraction`（收集屏幕增量，不做旋转补偿）。
- 旋转中心：
   - `useLayerSystem` 使用 `world.pivot = camera` + `position = 屏幕中心` 实现绕屏幕中心旋转。
- 结论：**拖拽平移应保持“无旋转补偿”**，以避免体感上的阻力/回弹。

### 2.3 运行时数据流
- Colyseus Schema -> 网络层 -> Store -> Pixi 渲染链路存在结构漂移。

## 3. 全局修复策略

### 3.1 单一类型来源（Source of Truth）
- @vt/types 为唯一事实来源。
- **禁止**在 client 中临时定义与 @vt/types 冲突的结构。

### 3.2 规范化数据入口
新增“数据规范化/适配层”，集中处理字段缺失、命名变换、默认值填充。
- 目的：避免全局散点修补，形成可控迁移路径。
- 位置建议：`packages/client/src/adapters/` 或 `packages/client/src/utils/normalize/`。

### 3.3 Pixi 与 Colyseus 最佳实践
- **Colyseus**：保持 Schema 类与 @vt/types 同步，客户端只消费“只读快照”或“规范化数据”。
- **Pixi**：渲染层应尽量纯渲染，避免在渲染逻辑中直接访问原始 Schema 数据；使用规范化模型 + 缓存。

## 4. 详细实施计划（分阶段）

### 阶段 A：类型对齐与诊断表（高优先级）
1. 建立“字段对齐清单”（表格）：
   - 字段名、来源（@vt/types / client）、是否缺失、替代字段、迁移方式（直接改名/适配/删除）。
2. 定位受影响模块：
   - `hooks/`（交互与相机）
   - `store/slices/`（状态结构）
   - `features/game/`（渲染层）
   - `services/AssetRegistry.ts`（静态资源/数据模型）

产出：
- 类型差异表（新增文档，包含风险与优先级）。

### 阶段 B：建立规范化层（高优先级）
1. 新增 `normalize` 入口：
   - `normalizeCameraState()`
   - `normalizeTokenInfo()`
   - `normalizeShipState()`
   - `normalizeWeaponSlot()`
2. 所有 store 与渲染只使用规范化后的结构。

### 阶段 C：Store 与 Hook 重构（高优先级）
1. `cameraSlice`：
   - 统一 `CameraState` 语义（使用 `x/y/zoom` 作为相机中心）。
   - 通过规范化层提供 `centerX/centerY` 兼容或直接替换。
2. `mapSlice`/`shipSlice`/`gameFlowSlice`：
   - 删除小写 TokenType 字符串比较，改为 `TokenType` 常量。
   - 修正 `PlayerCamera`、`TokenInfo` 等字段来源。
3. `useCamera`/`useInteraction`：
   - 使用统一 `CameraState`。

### 阶段 D：渲染层重构（高优先级）
1. `TokenRenderer`/`GeometryRenderer`/`WeaponGeometryRenderer`：
   - 统一导入 `@vt/types` 中的常量与类型。
   - 修正 `DamageType` / `ShieldType` / `ArmorQuadrant` 等类型引用方式。
2. 渲染参数由规范化层提供。

### 阶段 E：交互修复（中优先级）
1. **拖拽平移**：
   - 禁用惯性与阻尼；实现“按像素直接移动”。
   - 仅在明确需求下启用惯性参数。
2. **旋转中心**：
   - 以视口中心作为 pivot；旋转时将屏幕中心投射到世界坐标并作为旋转中心。

### 阶段 F：验证与性能（中优先级）
1. 单元级与局部可视化验证：
   - camera 旋转中心准确性（边缘物体旋转路径）。
   - 拖拽稳定性，无回弹。
2. 性能评估：
   - 规范化层不得引入帧级大规模复制；应在状态更新时执行。

## 5. Pixi 实现要点（建议方案）

- **相机矩阵**：
  - 使用 `container.pivot` + `container.position` 处理旋转与缩放。
  - 将 pivot 设置为“视口中心映射到世界坐标”。
- **拖拽平移**：
  - 直接增量更新 `camera.x/y`，避免惯性与缓动。
- **缩放**：
  - 缩放以屏幕中心为中心，保持视觉稳定。

## 6. Colyseus 实现要点（建议方案）

- **Schema 数据只读**：客户端不要直接修改 Schema 结构。
- **快照规范化**：每次更新时生成规范化模型，供渲染与 UI 使用。
- **差异更新**：尽量利用 Colyseus 的 patch 事件触发增量更新，避免全量复制。

## 7. 产出清单

- [ ] 类型差异表（新文档）
- [ ] 规范化层实现
- [ ] Store/Hook 重构
- [ ] 渲染层重构
- [ ] 拖拽与旋转修复
- [ ] CI 通过验证记录

## 8. 风险与缓解

- **风险**：类型差异过大导致改动面过宽。
  - **缓解**：分阶段迁移 + 适配层过渡。
- **风险**：渲染层与交互耦合严重。
  - **缓解**：规范化层与状态集中化。

---

下一步建议：先生成“字段对齐清单”，再进入规范化层实现。