# STFCS 项目未完成点清单

> 更新日期: 2026-03-13
> 项目定位: 虚拟太空战棋桌游桌面

---

## 一、核心战斗逻辑 (Critical)

| 项目 | 文档要求 | 当前状态 | 位置 |
|------|----------|----------|------|
| Hull 结构值 | 独立生命值系统 | 与护甲总和混淆 | `ShipService.ts:228-230` |
| 伤害类型系统 | 高爆(×2穿甲/×0.5护盾)、动能(×0.5穿甲/×2护盾)、破片(×0.25)、能量(无修正) | 完全缺失 | - |
| 护甲象限命名 | `front_left, front_right, left, right, rear_left, rear_right` | 使用 `FRONT_TOP/FRONT_BOTTOM...` 不一致 | `ArmorQuadrant.ts:1-7`, `schemas/index.ts:10-17` |
| 伤害计算公式 | `D = X×Z / (Z+C)`，C取当前护甲或最大护甲×0.05较大值 | 简化公式，无穿甲强度 | `DamageCalculator.ts:163-174` |

**修复建议:**
1. 新增 `Hull` 实体，与 ArmorQuadrant 分离
2. 新增 `DamageType` 枚举及修正系数表
3. 统一护甲象限命名，更新 shared/types 和 shared/schemas
4. 重写 `DamageCalculator.calculateDamage()` 实现完整公式

---

## 二、游戏系统模块 (High)

### 2.1 回合管理系统 - 缺失

```
需实现:
- TurnManager 聚合根
- 回合计数、阶段流转(移动1→转向→移动2→战斗→结束)
- 玩家轮替队列
- 事件: TURN_START, TURN_END, PHASE_CHANGE
```

### 2.2 武器槽位大小 - 缺失

```
文档要求:
- 大/中/小尺寸槽位
- 向下兼容(大槽可装中/小武器)
```

### 2.3 手动命中判定 - 偏离

```
文档: "由用户手动设定命中与否"
当前: 代码自动判定
建议: 新增命中确认步骤，攻击时弹出确认对话框
```

### 2.4 数据持久化 - 缺失

```
需实现:
- 战局存档/读档 API
- 舰船配置保存
- 可选: SQLite/JSON 文件存储
```

---

## 三、用户交互 UI (轻量化桌游风格)

### 3.1 必要 UI 组件 (Critical)

| 组件 | 描述 | 实现方式 |
|------|------|----------|
| **主游戏界面** | 替换 Vite 默认页面 | ✅ 已实现 `features/ui/GameView.vue` |
| **房间面板** | 创建/加入房间、玩家列表 | ✅ 已实现 `features/ui/RoomPanel.vue` |
| **舰船信息卡** | 选中舰船时显示 Hull/护甲/辐能/武器 | ✅ 已实现 `features/ui/ShipInfoCard.vue` |
| **武器选择条** | 底部武器图标栏，点击显示射界 | ✅ 已实现 `features/ui/WeaponToolbar.vue` |
| **回合控制条** | 当前阶段指示 + 结束回合按钮 | ✅ 已实现 `features/ui/TurnControlBar.vue` |
| **聊天面板** | 房间内玩家交流，支持文字消息 | ✅ 已实现 `features/ui/ChatPanel.vue` |
| **画笔工具栏** | 玩家在地图上绘制标记、箭头、区域 | ✅ 已实现 `features/ui/DrawingToolbar.vue` + `DrawingOverlay.vue` |

### 3.2 辅助 UI 组件 (Medium)

| 组件 | 描述 | 状态 |
|------|------|------|
| 战斗日志 | 右侧滚动面板，显示最近操作 | ✅ 已实现 `features/ui/CombatLog.vue` |
| 快捷键提示 | 按 `?` 显示覆盖层 | 待实现 |
| 设置弹窗 | 音量、网格颜色等基础设置 | 待实现 |

### 3.3 可延后 (Low)

| 组件 | 描述 |
|------|------|
| 舰船配置导入 | JSON/YAML 导入界面 |
| 存档管理 | 保存/加载战局 |
| 观战模式 | 非玩家观看对局 |

---

## 四、前后端集成问题

| 问题 | 位置 | 状态 |
|------|------|------|
| v-motion 指令未导入 | `FluxIndicator.vue:10` | ✅ 已修复（正确导入 MotionPlugin） |
| 画布尺寸响应式 | `MapCanvas.vue:25-28`, `ShipCanvas.vue:26-29` | ✅ 已修复（ResizeObserver） |
| Store 循环引用 | `WSClient.ts:14-15` 在类内直接调用 useStore | ✅ 已重构（延迟获取 store） |

---

## 五、画笔与聊天系统 (桌游核心功能)

### 5.1 画笔系统 - ✅ 已实现

```
已实现:
- DrawingStore.ts (本地状态管理)
- DrawingToolbar.vue (工具栏 UI)
- DrawingOverlay.vue (SVG 渲染层)
- 支持画笔、直线、箭头、矩形、圆形
- 多颜色选择
- 撤销/清除功能

待实现:
- 绘制内容同步到所有玩家 (需后端配合)
```

### 5.2 聊天系统 - ✅ 已实现

```
已实现:
- ChatPanel.vue (前端组件)
- 本地消息发送/显示
- 系统消息样式

待实现:
- ChatStore.ts (消息状态持久化)
- WS 消息同步 (需后端配合)
```

---

## 六、缺失的 API 路由

| 路由 | 用途 | 状态 |
|------|------|------|
| `combat.fire` | 武器开火执行 | 缺失 |
| `combat.targets` | 获取可攻击目标列表 | 缺失 |
| `turn.start` | 开始回合 | 缺失 |
| `turn.end` | 结束回合 | 缺失 |
| `game.save` | 保存战局 | 缺失 |
| `game.load` | 加载战局 | 缺失 |
| `ship.import` | 导入舰船配置 | 缺失 |
| `chat.send` | 发送聊天消息 | 缺失 |
| `drawing.add` | 添加绘制元素 | 缺失 |
| `drawing.clear` | 清除绘制 | 缺失 |

---

## 六、UI/UX 已知问题 (摘要)

> 详细清单见 `UI_UX_Issues.md`

### 严重 (0) ✅ 全部修复
~~双 Canvas 架构导致维护困难~~ ✅ 已修复
~~v-motion 指令错误~~ ✅ 已修复
~~定时器清理嵌套~~ ✅ 已修复
~~画布尺寸硬编码~~ ✅ 已修复

### 高优先级 (6)
- 键盘快捷键无上下文检查
- Flux 动画可能引发光敏感
- 颜色方案不统一
- 选中状态反馈不足
- 相机边界逻辑错误
- 频繁创建 Canvas 元素

### 中优先级 (10)
- 网格显示无过渡动画
- 滚轮缩放无缓动
- 缺少 ARIA 标签
- 无键盘导航支持
- 无移动端适配
- 等...

---

## 七、插件系统 (Low Priority)

```
文档要求: 自定义文字记录栏位（名称及描述）
建议: 新增 IPlugin 接口，支持舰船附加自定义属性
```

---

## 优先级执行顺序

### Sprint 1 (核心修复)
1. [ ] 统一护甲象限命名
2. [ ] 新增 Hull 实体
3. [ ] 实现伤害类型系统
4. [x] 修复 v-motion 导入 ✅

### Sprint 2 (系统完善)
5. [ ] 实现 TurnManager
6. [x] 创建主游戏界面 ✅
7. [x] 实现房间面板 ✅
8. [x] 实现舰船信息卡 ✅
9. [x] 实现武器选择条 ✅

### Sprint 3 (UI 完善)
10. [x] 实现回合控制条 ✅
11. [x] 实现聊天面板 ✅
12. [x] 实现战斗日志 ✅
13. [ ] 添加缺失的 API 路由

### Sprint 4 (画笔系统)
- [x] 实现 DrawingStore ✅
- [x] 实现 DrawingToolbar ✅
- [x] 实现 DrawingOverlay ✅
- [ ] 后端 WS 同步

### Backlog
- 数据持久化
- 存档管理
- 舰船配置导入
- 移动端适配
- 可访问性改进