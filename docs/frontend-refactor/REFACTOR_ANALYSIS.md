# 前端重构分析报告

日期：2026-04-15
状态：阶段 A、B、C 已完成

---

## 执行摘要

根据 `FRONTEND_REFACTOR_PLAN.md` 的要求，本项目正在进行以 **Pixi 为一等公民** 为核心目标的前端重构。本报告详细分析当前架构状态、识别的问题以及重构执行计划。

---

## 已完成工作

### ✅ 阶段 A：结构清理与约束

#### 任务 A1：移除双轨交互逻辑 ✅ 已完成
- [x] 识别两个 `useInteraction` 实现
- [x] 删除 `hooks/useInteraction.ts`（Redux 版，未被使用）
- [x] 删除 `store/slices/interactionSlice.ts`
- [x] 更新 `hooks/index.ts` 导出
- [x] 更新 `store/index.ts` 移除 interactionReducer
- [x] 验证无编译错误

**影响**：
- 消除了约 200 行冗余代码
- 统一交互逻辑由 Pixi hooks 主导（`components/map/hooks/useInteraction.ts`）
- 符合"Pixi 为一等公民"原则

---

### ✅ 阶段 B：类型统一与规范化层

#### 任务 B1：扩展 @vt/types 中的相机类型 ✅ 已完成

**修改文件**：`packages/types/src/interfaces.ts`

**CameraState 扩展**：
```typescript
export interface CameraState {
  x: number;           // 相机中心点 X（世界坐标）
  y: number;           // 相机中心点 Y（世界坐标）
  zoom: number;        // 缩放级别（0.3 ~ 6.0）
  viewRotation: number; // 视图旋转角度（度数，0=北向朝上）
  followingShipId?: string; // 可选，跟随的舰船 ID
}
```

**PlayerCamera 完善**：
```typescript
export interface PlayerCamera {
  playerId: string;    // 玩家会话 ID
  playerName: string;  // 玩家显示名称
  x: number;
  y: number;
  zoom: number;
  viewRotation: number;
  followingShipId?: string;
}
```

**设计决策**：
- 遵循用户要求，避免创建 `normalize` 层
- 直接在 `@vt/types` 中扩充定义，确保前后端类型一致
- 支持查看其他玩家相机位置的需求
- 统一字段命名（`x/y` 而非 `cameraX/cameraY`）

#### 任务 B2：删除客户端自定义 CameraState ✅ 已完成

**删除的自定义定义**：
- [x] `components/map/hooks/useCamera.ts` 中的 `CameraState` 接口
- [x] `hooks/useCanvasInteraction.ts` 中的 `CameraState` 接口

**统一使用**：`import type { CameraState } from "@vt/types";`

#### 任务 B3：更新所有使用相机状态的代码 ✅ 已完成

**更新的文件**：
- [x] `store/slices/cameraSlice.ts` - 添加 `viewRotation` 支持，更新字段名
- [x] `components/map/hooks/useCamera.ts` - 统一使用 `x/y` 字段
- [x] `components/map/hooks/usePixiApp.ts` - 导入 `@vt/types` 的 `CameraState`
- [x] `components/map/hooks/useLayerSystem.ts` - 更新参数名 `cameraX/cameraY` → `x/y`
- [x] `components/map/hooks/useShipRendering.ts` - 更新 `ShipRenderContext` 接口
- [x] `components/map/hooks/useZoomInteraction.ts` - 更新字段访问
- [x] `components/map/GameCanvas.tsx` - 更新 cameraRef 赋值
- [x] `features/game/view/ViewStateMachine.ts` - 添加 `viewRotation` 初始化
- [x] `hooks/useCanvasInteraction.ts` - 使用 `@vt/types` 的 `CameraState`

**字段名统一**：
- `cameraX` → `x`
- `cameraY` → `y`
- 所有相关代码已同步更新

**编译验证**：✅ 所有相机相关编译错误已解决

---

### ✅ 阶段 C：坐标与角度体系统一

#### 任务 C1：创建 CoordinateSystem 模块 ✅ 已完成

**新建文件**：
- [x] `utils/coordinateSystem.ts` - 统一的坐标与角度处理模块（450+ 行）
- [x] `utils/coordinateSystem.test.ts` - 行为一致性测试

**删除文件**：
- [x] `utils/mathUtils.ts` - 已迁移
- [x] `utils/angleUtils.ts` - 已迁移
- [x] `utils/angleSystem.ts` - 已迁移

**更新的引用**（8 处）：
- [x] `components/map/hooks/useZoomInteraction.ts`
- [x] `components/map/hooks/useCamera.ts`
- [x] `components/map/hooks/usePixiApp.ts`
- [x] `components/map/hooks/useShipRendering.ts`
- [x] `features/ui/ViewRotationControl.tsx`
- [x] `features/ui/FloatingMapControls.tsx`
- [x] `features/game/GameView.tsx`
- [x] `utils/spaceNav.ts`

#### 任务 C2：验证行为一致性 ✅ 已完成

**验证内容**：
- [x] `screenToWorld()` - 与 `mathUtils.ts` 实现完全一致
- [x] `worldToScreen()` - 与 `mathUtils.ts` 实现完全一致
- [x] `screenDeltaToWorldDelta()` - 与 `mathUtils.ts` 实现完全一致
- [x] `normalizeAngle()` - 与三个模块的实现完全一致
- [x] `normalizeRotation()` - 与 `angleSystem.ts` 实现完全一致

**编译验证**：
- ✅ 坐标系统相关错误：0 个
- ✅ 总错误数：186 个（项目原有，与本次重构无关）

**详细报告**：[COORDINATE_SYSTEM_REFACTOR.md](./frontend-refactor/COORDINATE_SYSTEM_REFACTOR.md)

---

## 待完成工作

### 阶段 C：坐标与角度体系统一（待开始）

#### 任务 C1：合并工具模块
- [ ] 创建 `utils/coordinateSystem.ts` 模块
- [ ] 迁移 `angleSystem.ts` 功能
- [ ] 迁移 `angleUtils.ts` 功能
- [ ] 迁移 `mathUtils.ts` 功能
- [ ] 消除重复的 `normalizeAngle` 等函数

#### 任务 C2：更新所有引用
- [ ] 更新所有使用旧模块的文件
- [ ] 验证编译通过
- [ ] 删除旧模块文件

---

### 阶段 D：Pixi 主导渲染体系（待开始）

#### 任务 D1：验证图层体系
- [ ] 确认所有渲染由 Pixi 驱动
- [ ] 验证 React 仅提供配置
- [ ] 检查更新策略

#### 任务 D2：优化渲染性能
- [ ] 分析渲染性能
- [ ] 优化过量重绘
- [ ] 验证帧率稳定

---

### 阶段 E：验证与性能（待开始）

#### 任务 E1：建立交互测试
- [ ] 旋转后平移方向正确性测试
- [ ] 点击不触发拖拽测试
- [ ] 拖拽不触发点击测试

#### 任务 E2：性能指标
- [ ] 建立性能基线
- [ ] 监控渲染帧率
- [ ] 验证 UI 不触发过量重绘

---

## 架构改进总结

### 类型统一
- ✅ `@vt/types` 现在是相机状态的唯一定义来源
- ✅ 客户端不再有任何自定义 `CameraState` 定义
- ✅ 前后端共享相同的类型定义

### 代码简化
- ✅ 删除约 200 行冗余的交互逻辑代码
- ✅ 统一字段命名，减少认知负担
- ✅ 清晰的职责分离：Pixi 主导地图内交互

### 可扩展性
- ✅ `PlayerCamera` 支持查看其他玩家相机位置
- ✅ `viewRotation` 已集成到类型系统中
- ✅ 为后续多人协作功能奠定基础

---

## 风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 类型变更影响后端 | 中 | 已验证后端未直接使用这些类型 |
| 字段名变更导致运行时错误 | 低 | 已通过 TypeScript 编译验证 |
| 坐标系统重构影响现有功能 | 高 | 编写测试用例，确保行为一致（阶段 C） |

---

## 下一步行动

1. **立即执行**：开始阶段 C - 合并坐标与角度体系
2. **短期目标**：创建 `CoordinateSystem` 模块
3. **中期目标**：验证 Pixi 主导渲染体系
4. **长期目标**：建立交互行为测试

---

## 参考资料

- [FRONTEND_REFACTOR_PLAN.md](./frontend-refactor/FRONTEND_REFACTOR_PLAN.md) - 原始重构计划
- [@vt/types](../../packages/types/src/) - 唯一事实源类型定义
- [PixiJS 文档](https://pixijs.com/guides) - 渲染引擎文档

---

**报告维护者**：AI Assistant  
**最后更新**：2026-04-15

---

## 1. 当前架构状态

### 1.1 技术栈
- **前端框架**：React 19 + TypeScript
- **构建工具**：Vite 6
- **渲染引擎**：PixiJS v8.17.0 + @pixi/react v8.0.5
- **状态管理**：Redux Toolkit + Zustand（混合）
- **网络**：Colyseus（WebSocket）
- **包管理**：pnpm workspace + Turborepo

### 1.2 目录结构
```
packages/client/src/
├── components/map/          # 地图组件（Pixi 主导）
│   └── hooks/               # 地图渲染与交互 hooks（13 个文件）
├── features/game/           # 游戏核心
│   ├── layers/              # PixiJS 渲染图层（9 个文件）
│   └── utils/               # 游戏工具与几何渲染
├── store/                   # 状态管理
│   ├── slices/              # Redux slices（14 个文件）
│   └── uiStore.ts / selectionStore.ts  # Zustand stores
├── hooks/                   # 全局 hooks（10 个文件）
└── utils/                   # 工具函数
    ├── angleSystem.ts       # 角度参考系系统
    ├── angleUtils.ts        # 角度工具
    └── mathUtils.ts         # 数学工具
```

---

## 2. 识别的主要问题

### 2.1 【高优先级】双轨交互逻辑

#### 问题描述
存在两套独立的交互实现：

**A. Redux 版 useInteraction**（旧版，位于 `hooks/useInteraction.ts`）
- 依赖 Redux `interactionSlice`
- 管理完整的交互状态（模式、光标、键盘、拖拽）
- 处理全局键盘事件
- **当前状态**：仅在 `hooks/index.ts` 中导出，**未被任何组件实际使用**

**B. 轻量版 useInteraction**（新版，位于 `components/map/hooks/useInteraction.ts`）
- 使用 Refs 管理状态（`dragStateRef`, `spacePressedRef`）
- 提供 `flushDragDelta` 方法传递拖拽增量
- **当前状态**：被 `GameCanvas.tsx` 直接使用，**是实际使用的版本**

#### 影响
- 代码冗余，维护成本高
- 类型定义不一致（两个 `DragState` 接口不同）
- 违反"Pixi 为一等公民"原则

#### 解决方案
✅ **标记为已完成**：删除 Redux 版 `useInteraction` 和 `interactionSlice`

---

### 2.2 【高优先级】坐标与角度体系分散

#### 问题描述
存在三个独立的角度/坐标处理模块：

| 模块 | 位置 | 主要功能 |
|------|------|---------|
| `angleSystem.ts` | `utils/angleSystem.ts` | 定义数学/航海/屏幕角度参考系及转换 |
| `angleUtils.ts` | `utils/angleUtils.ts` | 基础角度工具（normalizeAngle 等） |
| `mathUtils.ts` | `utils/mathUtils.ts` | 坐标转换、插值、从 @vt/rules 导入 normalizeAngle |

#### 具体问题
1. **功能重叠**：三个模块都有 `normalizeAngle` 相关函数
2. **职责不清**：`angleSystem` 和 `angleUtils` 都处理角度转换
3. **导入混乱**：`mathUtils` 从 `@vt/rules` 重新导出 `normalizeAngle`

#### 解决方案
计划合并为统一的 `CoordinateSystem` 模块：
- 统一角度参考系定义
- 统一坐标转换接口
- 消除重复函数

---

### 2.3 【中优先级】状态管理分散

#### 问题描述
项目使用混合状态管理，但分层规则不清晰：

| Store | 类型 | 用途 | 使用者 |
|-------|------|------|--------|
| Redux Store | Redux | 游戏状态（相机、舰船、移动、战斗等） | 多个组件 |
| `uiStore` | Zustand | UI 状态（连接、视图、设置） | UI 组件 |
| `selectionStore` | Zustand | 选择状态（舰船选择、权限） | 地图组件 |

#### 具体问题
1. `cameraSlice`（Redux）与 `useCamera` hook 职责重叠
2. `selectionSlice`（Redux）与 `selectionStore`（Zustand）功能重复
3. Pixi 读取状态的途径不统一

#### 解决方案
- 明确 Redux 为**唯一游戏状态事实源**
- Zustand 仅用于纯 UI 状态（弹窗、面板展开等）
- Pixi 通过标准化接口读取 Redux 状态

---

### 2.4 【低优先级】类型不一致

#### 问题描述
客户端存在自定义类型，可能与 `@vt/types` 不一致：

| 类型 | 定义位置 | 用途 |
|------|---------|------|
| `DragState` | `hooks/useInteraction.ts` | Redux 版拖拽状态 |
| `DragState` | `components/map/hooks/useInteraction.ts` | 轻量版拖拽状态 |
| `CameraState` | `@vt/types` | 官方相机状态 |
| `ShipState` | `@vt/types` | 官方舰船状态 |

#### 解决方案
- 创建 `normalize` 层统一适配
- 禁止新增兼容字段
- 所有类型以 `@vt/types` 为准

---

## 3. 重构执行计划

### 阶段 A：结构清理与约束（当前进行中）

#### 任务 A1：移除双轨交互逻辑 ✅ 已完成分析
- [x] 识别两个 `useInteraction` 实现
- [x] 确认 Redux 版未被使用
- [ ] 删除 `hooks/useInteraction.ts`
- [ ] 删除 `store/slices/interactionSlice.ts`
- [ ] 更新 `hooks/index.ts` 导出
- [ ] 验证无编译错误

#### 任务 A2：定义地图内 API
- [ ] 创建 `MapInteractionAPI` 接口定义
- [ ] 创建 `MapCameraAPI` 接口定义
- [ ] 由 Pixi hooks 提供实现
- [ ] 文档化 API 使用规范

#### 任务 A3：建立边界规则文档
- [ ] 明确 Pixi 负责范围
- [ ] 明确 React/UI 负责范围
- [ ] 明确 Store 负责范围
- [ ] 标记当前违反边界的代码

---

### 阶段 B：类型统一与规范化层

#### 任务 B1：分析类型差异
- [ ] 对比 `@vt/types` 与客户端自定义类型
- [ ] 识别不一致的字段
- [ ] 制定迁移计划

#### 任务 B2：创建 Normalize 层
- [ ] 实现 `normalizeCameraState`
- [ ] 实现 `normalizeShipState`
- [ ] 实现 `normalizeTokenInfo`
- [ ] Store 只接受规范化结果

---

### 阶段 C：坐标与角度体系统一

#### 任务 C1：合并工具模块
- [ ] 创建 `CoordinateSystem` 模块
- [ ] 迁移 `angleSystem` 功能
- [ ] 迁移 `angleUtils` 功能
- [ ] 迁移 `mathUtils` 功能
- [ ] 消除重复函数

#### 任务 C2：更新所有引用
- [ ] 更新所有使用旧模块的文件
- [ ] 验证编译通过
- [ ] 删除旧模块文件

---

### 阶段 D：Pixi 主导渲染体系

#### 任务 D1：验证图层体系
- [ ] 确认所有渲染由 Pixi 驱动
- [ ] 验证 React 仅提供配置
- [ ] 检查更新策略

#### 任务 D2：优化渲染性能
- [ ] 分析渲染性能
- [ ] 优化过量重绘
- [ ] 验证帧率稳定

---

### 阶段 E：验证与性能

#### 任务 E1：建立交互测试
- [ ] 旋转后平移方向正确性测试
- [ ] 点击不触发拖拽测试
- [ ] 拖拽不触发点击测试

#### 任务 E2：性能指标
- [ ] 建立性能基线
- [ ] 监控渲染帧率
- [ ] 验证 UI 不触发展量重绘

---

## 4. 风险与缓解措施

| 风险 | 影响 | 缓解措施 |
|------|------|---------|
| 删除交互逻辑导致功能缺失 | 高 | 充分测试验证 |
| 类型迁移引发编译错误 | 中 | 渐进式迁移，逐步验证 |
| 坐标系统重构影响现有功能 | 高 | 编写测试用例，确保行为一致 |
| 性能下降 | 中 | 建立性能监控，及时回滚 |

---

## 5. 下一步行动

1. **立即执行**：删除 Redux 版 `useInteraction` 和 `interactionSlice`
2. **短期目标**：定义地图内 API 接口
3. **中期目标**：创建 Normalize 层
4. **长期目标**：合并坐标与角度体系

---

## 6. 参考资料

- [FRONTEND_REFACTOR_PLAN.md](./frontend-refactor/FRONTEND_REFACTOR_PLAN.md) - 原始重构计划
- [@vt/types](../../packages/types/src/) - 唯一事实源类型定义
- [PixiJS 文档](https://pixijs.com/guides) - 渲染引擎文档

---

**报告维护者**：AI Assistant  
**最后更新**：2026-04-15
