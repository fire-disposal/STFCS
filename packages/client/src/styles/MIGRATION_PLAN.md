# STFCS 样式迁移计划

## 当前状态分析

### 组件样式使用统计

| 组件 | 内联样式 | `<style>` 标签 | CSS 类名 | 优先级 | 状态 |
|------|---------|---------------|---------|--------|------|
| Notification.tsx | ~~8 处~~ | ~~1 处~~ | ✅ | 高 | ✅ 已完成 |
| LayerControlPanel.tsx | ~~0 处~~ | ~~1 处~~ | ✅ | 高 | ✅ 已完成 |
| ZoomControl.tsx | ~~0 处~~ | ~~1 处~~ | ✅ | 中 | ✅ 已完成 |
| TokenInfoPanel.tsx | ~~3 处~~ | ❌ | ✅ | 中 | ✅ 已完成 |
| MagneticPointer.tsx | 6 处 (动态计算) | ❌ | 部分 | 低 | ⏳ 保留内联 |
| LobbyPanel.tsx | ~~0 处~~ | ❌ | ✅ | - | ✅ 已完成 |
| AuthPanel.tsx | ~~0 处~~ | ❌ | ✅ | - | ✅ 已完成 |

### 已迁移到 ui-components.css 的组件

- ✅ `.notification-tactical-*` 通知组件
- ✅ `.view-mode-btn` 视图模式按钮
- ✅ `.layer-group-*` 图层组
- ✅ `.layer-item-*` 图层项
- ✅ `.token-info-panel-*` Token 信息面板
- ✅ `.zoom-control-*` 缩放控制
- ✅ `.turn-state-indicator--*` 回合状态指示器

## 迁移任务清单

### 任务 1: LayerControlPanel 样式迁移 ✅

**状态**: 已完成

**操作**:
1. ✅ 将 `<style>` 中的 CSS 复制到 `ui-components.css`
2. ✅ 添加 `.view-mode-section`, `.view-mode-buttons` 等缺失类
3. ✅ 删除组件内的 `<style>` 标签
4. ✅ 测试视觉效果

### 任务 2: ZoomControl 样式迁移 ✅

**状态**: 已完成

**操作**:
1. ✅ 在 `ui-components.css` 中添加 `.zoom-control-*` 系列样式
2. ✅ 删除组件内的 `<style>` 标签
3. ✅ 添加响应式支持

### 任务 3: Notification 样式迁移 ✅

**状态**: 已完成

**操作**:
1. ✅ 补充内部元素样式到 `ui-components.css`
2. ✅ 替换组件中的 `style={}` 为 `className`
3. ✅ 将动画定义移到 CSS 文件
4. ✅ 删除 `styles` 对象

**新增样式类**:
```css
.notification-tactical-container { }
.notification-tactical { }
.notification-tactical.exiting { }
.notification-tactical--success/error/info/warning { }
.notification-tactical-header { }
.notification-tactical-icon-wrapper { }
.notification-tactical-title { }
.notification-tactical-close { }
.notification-tactical-message { }
@keyframes slideIn { }
```

### 任务 4: TokenInfoPanel 动态样式优化 ✅

**状态**: 已完成

**操作**:
1. ✅ 创建 `.turn-state-indicator--active/moved/acted/ended/waiting` 类
2. ✅ 替换颜色内联样式为类名
3. ✅ 保留宽度百分比内联样式（合理，因为动态值）

### 任务 5: MagneticPointer 样式迁移 ⏳

**状态**: 保留内联样式

**分析**: 该组件为指针跟随效果，需要动态计算位置，内联样式合理

**建议**: 保留内联样式用于动态位置，但可提取静态样式到 CSS

## 迁移时间表

| 阶段 | 任务 | 预计时间 | 状态 |
|------|------|---------|------|
| 1 | LayerControlPanel 迁移 | 15 分钟 | ✅ 已完成 |
| 2 | ZoomControl 迁移 | 10 分钟 | ✅ 已完成 |
| 3 | Notification 迁移 | 20 分钟 | ✅ 已完成 |
| 4 | TokenInfoPanel 优化 | 15 分钟 | ✅ 已完成 |
| 5 | MagneticPointer 优化 | 10 分钟 | ⏳ 保留内联 |
| 6 | 全局测试 | 30 分钟 | ⏳ 待处理 |

## 迁移检查清单

每个组件迁移后需确认：

- [x] 视觉效果与迁移前一致
- [x] 悬停状态正常工作
- [x] 禁用状态正常显示
- [x] 响应式布局正常
- [x] 动画效果正常
- [ ] 无控制台警告

## 样式一致性规则

迁移后所有组件应遵循：

1. **无内联样式**（除动态值外）✅
2. **使用通用组件库**（`ui-components.css`）✅
3. **组件特定样式** 放在 `components.css` 或独立文件 ✅
4. **动画定义** 统一放在 CSS 文件底部 ✅
5. **命名规范** 使用 BEM 或类似规范 ✅

## 下一步行动

- [x] 执行任务 1: LayerControlPanel 迁移
- [x] 执行任务 2: ZoomControl 迁移  
- [x] 执行任务 3: Notification 迁移
- [x] 执行任务 4: TokenInfoPanel 优化
- [ ] 验证所有迁移效果
- [ ] 更新 `UI_COMPONENTS_GUIDE.md` 添加新组件示例
- [ ] 运行项目测试
