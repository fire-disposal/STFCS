# UI/UX 问题清单

> 基于代码审查和项目需求分析
> 生成日期: 2025-03-12

---

## 📋 项目背景

**STFCS** 是一个战术太空战棋游戏项目，采用 Vue + PixiJS/Konva + TypeScript 技术栈，使用 DDD（领域驱动设计）架构。项目包含舰船管理、地图交互、战斗系统等核心功能。

**核心技术栈:**
- 前端: Vue 3 + Pinia + Motion Vue + PixiJS 8.17 + Konva 10.2
- 后端: Fastify + tRPC
- 架构: Monorepo (pnpm workspace)

---

## 🔴 严重问题 (Critical)

### 1. [架构] 双重 Canvas 架构导致维护困难
**位置:** `packages/client/src/features/ship/ShipCanvas.vue:3-4`

**问题描述:**
同时叠加使用 PixiJS 和 Konva 两个渲染库，造成：
- 内存占用翻倍
- 事件处理混乱（需要 pointer-events: none 规避）
- 渲染同步困难
- 学习曲线陡峭

**影响:** 长期维护成本极高，新成员难以快速上手

**建议:** 根据文档规范统一技术选型：
- PixiJS 负责: 粒子效果、护盾渲染、爆炸动画
- Konva 负责: 路径绘制、标记、UI 交互
- 移除混合使用场景

---

### 2. [功能] v-motion 指令使用错误
**位置:** `packages/client/src/features/ship/FluxIndicator.vue:10`

**问题描述:**
使用了 `@vueuse/motion` 的 `v-motion` 指令，但未在组件中导入，且未配置 Motion 插件。

**代码:**
```vue
<div
  v-motion
  class="flux-bar-fill"
  :initial="{ width: '0%' }"
  :enter="{ width: `${fluxPercent}%` }"
/>
```

**影响:** 组件可能无法正常工作，Flux 条动画失效

**建议:**
```typescript
import { vMotion } from '@vueuse/motion'
// 或在 main.ts 全局注册
```

---

### 3. [交互] 定时器清理逻辑位置错误
**位置:** `packages/client/src/features/map/MapCanvas.vue:211-217`

**问题描述:**
`onBeforeUnmount` 被定义在 `onMounted` 内部，如果组件多次挂载/卸载，会导致：
- 多个定时器同时运行
- 事件监听器重复添加/移除

**代码:**
```typescript
onMounted(async () => {
  // ... 初始化代码
  const syncInterval = setInterval(syncCamera, 100)
  
  onBeforeUnmount(() => {  // ❌ 嵌套在 onMounted 内部
    clearInterval(syncInterval)
  })
})
```

**影响:** 内存泄漏，性能下降

**建议:** 将清理逻辑移到顶层或使用 `try-finally`

---

### 4. [响应式] 画布尺寸硬编码
**位置:**
- `MapCanvas.vue:26-27`
- `ShipCanvas.vue:29-30`

**问题描述:**
```typescript
width: 1920,
height: 1080
```

画布使用固定 1920x1080 分辨率，无法适应：
- 不同屏幕尺寸（笔记本、4K 显示器）
- 窗口大小变化
- 移动端设备

**影响:** 在小屏幕上内容被裁剪，在大屏幕上显示过小

**建议:**
```typescript
// 监听容器尺寸变化
const resizeObserver = new ResizeObserver((entries) => {
  for (const entry of entries) {
    const { width, height } = entry.contentRect
    app.renderer.resize(width, height)
  }
})
```

---

## 🟠 高优先级问题 (High)

### 5. [交互] 键盘事件缺乏上下文感知
**位置:** `MapCanvas.vue:172-184`

**问题描述:**
全局监听键盘快捷键，未检查用户是否在输入框中：

```typescript
function handleKeyDown(e: KeyboardEvent): void {
  if (e.code === 'KeyG') {
    mapStore.toggleGrid()  // 用户在输入框按 G 也会触发
  }
}
```

**影响:** 用户在表单输入时可能意外触发游戏功能

**建议:**
```typescript
if (e.target instanceof HTMLInputElement || 
    e.target instanceof HTMLTextAreaElement) {
  return
}
```

---

### 6. [视觉] Flux 指示器动画过于激进
**位置:** `FluxIndicator.vue:108-119`

**问题描述:**
过载状态的脉冲动画使用 `0.5s` 无限循环：

```css
animation: pulse-red 0.5s ease-in-out infinite;
```

**影响:**
- 可能引发视觉疲劳
- 对光敏感用户（癫痫风险）
- 分散注意力

**建议:**
- 降低动画频率（1.5s - 2s）
- 提供设置选项关闭动画
- 使用更微妙的效果（边框发光代替整体闪烁）

---

### 7. [视觉] 颜色方案不统一
**位置:** 多个文件

**问题描述:**
缺乏统一的设计系统，颜色使用混乱：

| 组件 | 绿色值 |
|------|--------|
| FluxIndicator | `#44ff44` |
| TokenLayer | `#4A9EFF` |
| ShieldOverlay | `#88FF88` |

**影响:** 视觉语言不一致，品牌形象模糊

**建议:** 创建 `design-tokens.ts` 统一配色方案

---

### 8. [交互] 选中状态缺乏视觉反馈
**位置:** `TokenLayer.ts:206-224`

**问题描述:**
- 仅使用简单黄色边框表示选中
- 缺乏动画过渡
- 未区分友军/敌军/中立

**建议:**
- 添加缩放动画（scale 1.0 -> 1.1）
- 使用不同颜色边框（绿色-友军、红色-敌人、黄色-中立）
- 添加发光效果

---

### 9. [交互] 相机边界逻辑错误
**位置:** `CameraController.ts:120-129`

**问题描述:**
边界计算逻辑：
```typescript
const maxX = -(bounds.width * this.camera.zoom - this.container.width) / this.camera.zoom
this.camera.x = Math.max(bounds.x - maxX / 2, Math.min(maxX / 2, x))
```

**影响:** 在特定缩放级别下相机可能无法到达地图边缘

**建议:** 重新计算边界约束逻辑

---

### 10. [性能] 频繁创建 Canvas 元素
**位置:** 多个文件（ShipToken.ts, TokenLayer.ts, DamageNumbers.ts 等）

**问题描述:**
大量使用 `document.createElement('canvas')` 创建临时纹理，未复用 canvas 上下文。

**影响:** 内存碎片，垃圾回收压力

**建议:** 使用 Canvas Pool 模式或 OffscreenCanvas

---

## 🟡 中优先级问题 (Medium)

### 11. [视觉] 网格显示/隐藏无过渡
**位置:** `TerrainLayer.ts:127-130`

**问题描述:**
网格切换是瞬间变化，缺乏视觉过渡。

**建议:** 添加淡入淡出动画（opacity 过渡）

---

### 12. [交互] 滚轮缩放缺乏平滑过渡
**位置:** `CameraController.ts:90-102`

**问题描述:**
使用固定增量 `0.1` 缩放，无缓动效果。

**建议:** 使用插值实现平滑缩放动画

---

### 13. [视觉] 默认占位纹理问题
**位置:** `ShipToken.ts:22-25`

**问题描述:**
使用 1x1 透明 PNG 作为默认纹理，加载失败时舰船完全不可见。

**建议:** 使用占位符图形或颜色块

---

### 14. [交互] 伤害数字位置固定偏移
**位置:** `DamageNumbers.ts:29`

**问题描述:**
`yOffset: -50` 固定值，在不同缩放级别下显示效果不佳。

**建议:** 根据相机缩放动态调整偏移量

---

### 15. [可访问性] 缺少 ARIA 标签
**位置:** 所有交互组件

**问题描述:**
- 无 `aria-label`
- 无 `role` 属性
- 屏幕阅读器无法识别

**建议:** 为所有交互元素添加适当的 ARIA 属性

---

### 16. [可访问性] 完全缺乏键盘导航
**位置:** 全局

**问题描述:**
除几个快捷键外，不支持 Tab 键导航。

**影响:** 残障用户无法使用

**建议:**
- 实现 Tab 顺序
- 添加焦点指示器
- 支持 Enter/Space 激活

---

### 17. [视觉] 颜色对比度不足
**位置:** `FluxIndicator.vue:106-108`

**问题描述:**
过载状态使用 `rgba(255, 68, 68, 0.5)`，对比度可能不满足 WCAG 标准。

**建议:** 使用颜色对比度检查工具验证

---

### 18. [交互] 缺少操作确认
**位置:** 全局

**问题描述:**
- 相机重置（按 0 键）无确认
- 放置模式无明确状态指示
- 武器选择缺乏视觉反馈

**建议:**
- 添加 Toast 提示
- 使用 Snackbar 显示状态变化
- 实现撤销功能

---

### 19. [响应式] 无移动端适配
**位置:** 全局

**问题描述:**
- 仅支持鼠标交互
- 未处理触摸事件
- UI 元素尺寸未针对触摸优化

**建议:**
- 添加触摸事件处理（pan, pinch）
- 增大触摸目标（最小 44x44px）
- 支持手势操作

---

### 20. [性能] 全局事件未节流
**位置:** `CameraController.ts:52-56`

**问题描述:**
滚轮事件直接处理，快速滚动时可能导致性能问题。

**建议:**
```typescript
import { throttle } from 'lodash-es'

this.container.on('wheel', throttle(this.onWheel.bind(this), 16))
```

---

## 🟢 低优先级问题 (Low)

### 21. [代码质量] 类型断言过多
**位置:** 多个文件

**问题描述:**
频繁使用 `as any` 和类型断言，违背 TypeScript 严格模式原则。

**建议:** 使用类型守卫和更精确的类型定义

---

### 22. [代码质量] 魔法数字
**位置:** 多个文件

**问题描述:**
代码中存在大量未命名的数值常量。

**建议:** 提取为命名常量

---

### 23. [文档] 缺少组件使用文档
**位置:** 全局

**问题描述:**
复杂组件（如 ShipCanvas, MapCanvas）缺少使用说明和 Props 文档。

**建议:** 使用 JSDoc 注释或 Storybook

---

### 24. [测试] 缺少视觉回归测试
**位置:** 全局

**问题描述:**
复杂渲染效果（护盾、爆炸、Flux 条）未进行自动化测试。

**建议:** 使用 Storybook + Chromatic 或 Playwright 截图测试

---

### 25. [TypeScript] PixiJS Graphics API 使用错误
**位置:** `FiringArcOverlay.ts:105-109`

**问题描述:**
使用了不存在的 `setLineDash` 方法：
```typescript
graphics.setLineDash([5, 5])
// ...
graphics.setLineDash([])
```

**影响:** TypeScript 编译错误

**建议:** PixiJS v8 使用 `setStrokeStyle` 配置虚线

---

### 26. [TypeScript] 接口重复定义冲突
**位置:** `CameraController.ts:2, 207-213`

**问题描述:**
导入的 `IMapCamera` 与本地定义冲突。

**建议:** 统一使用 `types.ts` 中的定义，删除本地定义

---

### 27. [TypeScript] 事件类型不匹配
**位置:** `CameraController.ts:56, 93`

**问题描述:**
```typescript
// wheel 事件处理器使用了错误的类型
private onWheel(e: FederatedPointerEvent): void {
  // e.deltaY 不存在于 FederatedPointerEvent
}
```

**建议:** 使用 `FederatedWheelEvent` 类型

---

### 28. [TypeScript] 未使用的变量
**位置:** 多个文件

**问题描述:**
- `TokenLayer.ts:147`: `createSelection` 未使用
- `DamageNumbers.ts:143, 177, 189`: 多个未使用变量
- `FiringArcOverlay.ts`: 多个未使用参数

**建议:** 清理未使用代码或使用 ESLint 规则

---

### 29. [TypeScript] hitArea 类型不匹配
**位置:** `CameraController.ts:50`, `TokenLayer.ts:33`

**问题描述:**
```typescript
this.container.hitArea = this.container.getBounds()
// Bounds 类型不满足 IHitArea 接口
```

**建议:** 使用 Rectangle 创建正确的 hitArea

---

### 30. [TypeScript] 可选属性未处理
**位置:** `TerrainLayer.ts:38`

**问题描述:**
```typescript
this.showGrid = this.options.showGrid !== false
// options 类型定义中缺少 showGrid 属性
```

**建议:** 更新 `TerrainLayerOptions` 接口

---

## 📊 更新后问题统计

| 优先级 | 数量 | 占比 |
|--------|------|------|
| 🔴 Critical | 4 | 12.5% |
| 🟠 High | 6 | 18.75% |
| 🟡 Medium | 10 | 31.25% |
| 🟢 Low | 12 | 37.5% |
| **总计** | **32** | **100%** |

---

## 🎯 修复建议优先级

### Sprint 1 (立即)
1. 修复 v-motion 导入问题
2. 修复定时器清理逻辑
3. 实现响应式画布尺寸
4. 修复 TypeScript 类型错误 (FiringArcOverlay, CameraController)

### Sprint 2 (本周)
5. 添加键盘事件上下文检查
6. 统一颜色方案
7. 优化 Flux 指示器动画
8. 清理未使用的变量和函数

### Sprint 3 (本月)
9. 重构双重 Canvas 架构
10. 修复相机边界逻辑
11. 优化 Canvas 创建性能
12. 增强选中状态视觉反馈
13. 修复 hitArea 类型问题

### Backlog
- 移动端适配
- 可访问性改进
- 视觉回归测试
- 组件文档
- 代码质量提升（ESLint 规则）

---

## 📝 备注

- 本清单基于 2025-03-12 的代码审查
- 部分问题可能影响游戏核心体验，建议优先处理
- 建议定期（每月）更新此清单
