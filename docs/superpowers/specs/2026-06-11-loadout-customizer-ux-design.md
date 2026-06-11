# 舰船/武器工坊 UX 改善设计

**日期:** 2026-06-11
**范围:** `LoadoutCustomizerDialog.tsx` 及相关组件
**原则:** 功能不变，仅改善交互体验和代码质量

---

## 现状

`LoadoutCustomizerDialog.tsx`（1,759 行）是舰船/武器自定义的核心组件，从大厅页面打开。

**当前布局：**
```
┌─────────────────────────────────────────────────────┐
│ 舰船 / 武器工坊                              [X]   │
│ [舰船] [武器]                                       │
├──────────┬──────────────────┬────────────────────────┤
│ 舰船存档  │ 舰船预览         │ 属性编辑 [表单][JSON] │
│ [+ 新增]  │ MiniShipPreview  │  基本信息             │
│           │                  │  舰船规格             │
│ > 舰船A ✓ │ 贴图             │  防御属性             │
│   舰船B   │  [选择图片]      │  机动属性             │
│   舰船C   │  位置调整滑块    │  护盾系统             │
│           │  ColorKeyPicker  │                       │
│           │                  │  [保存]               │
│           │ 挂点管理         ├────────────────────────┤
│           │  列表 | 编辑区   │ 预设模板              │
│           │                  │  预设A  [+]           │
│           │                  │  预设B  [+]           │
└──────────┴──────────────────┴────────────────────────┘
```

武器 tab 布局结构类似，左侧武器列表 + 右侧双列（预览/贴图 + 属性编辑/预设模板）。

---

## 痛点与改动

### 0. 布局复查与稳定化

**问题:** 后续多项小修改可能引起意料外的布局崩溃。

**做法:**
- 审查当前 CSS 文件（`ship-customization-modal.css`、`weapon-customization-modal.css`）中的硬编码尺寸、`max-height`、`overflow` 规则
- 为 Dialog 主容器和三列 Grid 设置明确的 `min-height`、`max-height`、`overflow` 约束
- 确认 `maxWidth="1200px"` 在常见屏幕尺寸（1920/1440/1366）下的表现
- 为关键布局区域添加 CSS 类名（当前大量内联 style），便于后续维护

**涉及文件:**
- `ship-customization-modal.css` — 补充布局约束类
- `LoadoutCustomizerDialog.tsx` — 将关键内联 style 迁移为 CSS 类

### 1. 删除确认对话框

**问题:** 舰船/武器点击垃圾桶图标后直接删除，无防误操作。挂点删除反而有 `window.confirm`。

**做法:**
- 舰船/武器删除前弹出 `window.confirm` 确认（与挂点删除行为一致）
- 格式: `确定删除舰船 "XXX"？`  / `确定删除武器 "XXX"？`

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — `deleteShip` 调用处 (L666)、`deleteWeapon` 调用处 (L1336)

### 2. 脏数据检测

**问题:** 编辑舰船/武器属性后，直接点击列表中另一项，当前修改被静默丢弃。

**做法:**
- 维护 `isDirty` 状态：`JSON.stringify(draft) !== JSON.stringify(builds中对应项)`
- 切换选中项时，若 `isDirty === true`，弹出 `window.confirm`：`当前修改未保存，是否放弃？`
- 用户选择"确定"则切换；选择"取消"则留在当前项
- 保存按钮在有未保存变更时切换为 `color="green"` 高亮提示

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — 新增 `isDirty` 计算、切换拦截逻辑

### 3. 武器标签可删除

**问题:** 武器标签只能通过 Select 添加，无法移除。

**做法:**
- 将每个 `<Badge>` 改为带关闭按钮的 Badge（点击 x 移除该 tag）
- 添加标签的 Select 中过滤掉已选标签

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — 标签渲染区域（L1700-1714；L1452 处在废弃代码块内，会在步骤 1 中随废弃代码一并删除）

### 4. 清理废弃代码

**问题:** 武器 tab 左侧有一个 `<Card style={{ display: "none" }}>` 的完整武器编辑表单（L1352-1469），与右侧"属性编辑"完全重复。

**做法:**
- 删除 `display: none` 的废弃 Card 及其全部内容

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — L1352-1469

### 5. Slider 主题适配

**问题:** 贴图位置/缩放、挂点位置/朝向/射界使用原生 `<input type="range">`，在 Radix 暗色主题下视觉突兀。

**做法:**
- 为原生 range input 添加 CSS 暗色主题样式（通过 `appearance` 重置 + 自定义 thumb/track 颜色）
- 不引入新组件，仅用 CSS 统一视觉

**涉及文件:**
- `ship-customization-modal.css` — 新增 `.customizer-range` 类及其 `::-webkit-slider-*` / `::-moz-range-*` 样式
- `LoadoutCustomizerDialog.tsx` — 为所有 range input 添加 `className="customizer-range"`

### 6. 列表搜索

**问题:** 舰船/武器列表无搜索功能，物品多时难以查找。

**做法:**
- 在"舰船存档"/"武器存档"标题与列表之间添加 `<TextField.Root>` 搜索框
- 按名称模糊匹配过滤列表显示
- 搜索为纯前端过滤，不影响后端

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — 新增 `shipSearch` / `weaponSearch` 状态 + 过滤逻辑

### 7. 贴图上传流程简化

**问题:** 选择文件 → 调色/偏移 → 确认上传，操作分散且"确认上传"按钮不醒目。

**做法:**
- 选择文件后自动显示一个醒目的"上传并应用"按钮（绿色 solid，放大）
- 调色/偏移调整期间预览实时更新（现有行为，保持不变）
- "上传并应用"按钮放在贴图预览区域正下方，而非与"选择图片"同行

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — 重新排列贴图区域按钮布局

### 8. 预设模板增强

**问题:** 预设列表只显示名称和 + 号，缺少关键规格。

**做法:**
- 舰船预设：显示 `名称 · 大小/类型 · HP · 挂点数`
- 武器预设：显示 `名称 · 尺寸/伤害类型 · 伤害 · 射程`
- 使用一致的列表项样式（与存档列表对齐）

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — 预设模板渲染区域

### 9. Ctrl+S 快捷键

**问题:** 保存只能用鼠标点击。

**做法:**
- Dialog 打开时注册 `keydown` 监听器
- `Ctrl+S` / `Cmd+S`：根据当前 activeTopTab 调用 `saveShip()` 或 `saveWeapon()`
- `preventDefault` 阻止浏览器默认保存行为
- Dialog 关闭时移除监听器

**涉及文件:**
- `LoadoutCustomizerDialog.tsx` — 新增 useEffect 键盘监听

---

## 不改动

- 整体布局结构（左列表 + 右双列编辑）
- 功能逻辑（CRUD、预设复制、贴图上传、抠图）
- 网络协议（`customize:token`、`customize:weapon`、`preset:*`）
- 数据模型（InventoryToken、WeaponJSON schema）
- MiniShipPreview / MiniWeaponPreview 组件内部
- ColorKeyPickerPanel 组件内部

---

## 实施顺序

```
0. 布局复查与稳定化（基础保障）
1. 清理废弃代码（减少噪音）
2. 删除确认对话框（最高优先安全改善）
3. 脏数据检测（防止数据丢失）
4. 标签可删除（补全缺失交互）
5. Slider 主题适配（视觉统一）
6. 列表搜索（可用性提升）
7. 贴图上传流程简化（交互优化）
8. 预设模板增强（信息密度）
9. Ctrl+S 快捷键（效率提升）
```

每步完成后可独立验证，不依赖后续步骤。
