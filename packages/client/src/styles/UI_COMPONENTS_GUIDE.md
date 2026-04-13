# STFCS UI 组件样式使用指南

## 概述

本指南说明如何使用从大厅和登录页面提取的通用 UI 组件样式。所有新组件应优先使用 `ui-components.css` 中定义的样式类，以保持整个应用的一致性。

## 样式文件结构

```
src/styles/
├── design-system.css    # 设计系统变量（颜色、间距、字体等）
├── ui-components.css    # 通用 UI 组件样式（新增）
├── components.css       # 特定组件样式（大厅、认证等）
├── game-panels.css      # 游戏面板样式
├── game-layout.css      # 游戏布局样式
└── fonts.css            # 字体定义
```

## 核心设计原则

1. **战术终端风格**：深蓝背景、蓝色霓虹边框、发光效果
2. **一致性**：所有组件使用相同的设计语言
3. **可组合性**：基础样式类可以组合使用
4. **响应式**：所有组件支持移动端适配

## 通用组件使用

### 1. 面板容器

```tsx
// 标准面板
<div className="panel-container">
  <div className="panel-header">
    <h3 className="panel-title">📋 标题</h3>
  </div>
  <div className="panel-content">
    {/* 内容 */}
  </div>
</div>

// 密集面板
<div className="panel-container panel-container--dense">

// 宽松面板
<div className="panel-container panel-container--spacious">

// 无阴影面板
<div className="panel-container panel-container--no-shadow">
```

### 2. 按钮系统

```tsx
// 主要按钮（蓝色发光）
<button className="btn-tactical-base btn-tactical-primary">
  确认
</button>

// 次要按钮
<button className="btn-tactical-base btn-tactical-secondary">
  取消
</button>

// 危险按钮（红色发光）
<button className="btn-tactical-base btn-tactical-danger">
  删除
</button>

// 刷新按钮
<button className="btn-tactical-base btn-tactical-refresh">
  🔄 刷新
</button>

// 加入按钮
<button className="btn-tactical-base btn-tactical-join">
  进入房间
</button>

// 小尺寸
<button className="btn-tactical-base btn-tactical-primary btn-tactical-sm">

// 块级按钮
<button className="btn-tactical-base btn-tactical-primary btn-tactical-block">

// 图标按钮
<button className="btn-tactical-base btn-tactical-icon">
  <Settings size={16} />
</button>
```

### 3. 输入框

```tsx
// 标准输入框
<input 
  className="input-tactical"
  placeholder="请输入..."
/>

// 小尺寸输入框
<input 
  className="input-tactical input-tactical-sm"
  placeholder="请输入..."
/>
```

### 4. 卡片

```tsx
// 标准卡片
<div className="card-tactical">
  <div className="card-tactical-header">
    <span className="card-tactical-title">卡片标题</span>
  </div>
  <div className="card-tactical-meta">
    <span>元信息</span>
  </div>
  <div className="card-tactical-actions">
    <button>操作</button>
  </div>
</div>

// 禁用状态
<div className="card-tactical card-tactical--disabled">
```

### 5. 状态指示器

```tsx
// 状态点
<span className="status-dot status-dot--success" />
<span className="status-dot status-dot--warning" />
<span className="status-dot status-dot--danger" />
<span className="status-dot status-dot--info" />

// 状态徽章
<span className="badge-tactical badge-tactical--success">成功</span>
<span className="badge-tactical badge-tactical--warning">警告</span>
<span className="badge-tactical badge-tactical--danger">危险</span>
<span className="badge-tactical badge-tactical--info">信息</span>
```

### 6. 统计项

```tsx
<div className="stat-item">
  <span className="stat-label">活跃房间</span>
  <span className="stat-value stat-value--primary">12</span>
</div>
<div className="stat-item">
  <span className="stat-label">在线玩家</span>
  <span className="stat-value stat-value--success">48</span>
</div>
```

### 7. 资源条

```tsx
<div className="resource-bar">
  <div className="resource-bar-header">
    <span className="resource-bar-label">移动力</span>
    <span className="resource-bar-value">8 / 10</span>
  </div>
  <div className="resource-bar-container">
    <div 
      className="resource-bar-fill resource-bar-fill--movement"
      style={{ width: '80%' }}
    />
  </div>
</div>
```

### 8. 空状态

```tsx
<div className="empty-state">
  <p>暂无数据</p>
  <p className="empty-state-hint">点击刷新按钮重新加载</p>
</div>
```

### 9. 模态框

```tsx
<div className="modal-overlay-tactical" onClick={closeModal}>
  <div className="modal-tactical" onClick={(e) => e.stopPropagation()}>
    <h3 className="modal-tactical-title">标题</h3>
    {/* 内容 */}
    <div className="modal-tactical-actions">
      <button className="btn-tactical-base btn-tactical-secondary">取消</button>
      <button className="btn-tactical-base btn-tactical-primary">确认</button>
    </div>
  </div>
</div>
```

### 10. 通知

```tsx
<div className="notification-tactical notification-tactical--info">
  <div className="notification-tactical-header">
    <span className="notification-tactical-title">信息</span>
    <button>✕</button>
  </div>
  <div className="notification-tactical-message">
    这是一条通知消息
  </div>
</div>
```

### 11. 视图模式按钮组

```tsx
<div className="view-mode-group">
  <button className="view-mode-btn active">战术</button>
  <button className="view-mode-btn">导航</button>
  <button className="view-mode-btn">装饰</button>
</div>
```

### 12. 图层列表

```tsx
<div className="layer-group">
  <div className="layer-group-header">
    <span className="layer-group-name">背景层</span>
    <button className="layer-group-toggle">
      <Eye size={14} />
    </button>
  </div>
  <div className="layer-item">
    <span className="layer-item-name">网格</span>
    <button className="layer-item-toggle">
      <Eye size={14} />
    </button>
  </div>
</div>
```

### 13. Token 信息面板

```tsx
<div className="token-info-panel">
  <div className="token-info-header">
    <div className="token-icon-wrapper">
      <span className="token-icon">🚀</span>
      <div className="token-title">
        <h3>巡洋舰</h3>
        <div className="token-subtitle">
          <span>ID: abc123</span>
          <span>类型：ship</span>
        </div>
      </div>
    </div>
    <div className="token-status">
      <span className="turn-state-indicator" style={{ backgroundColor: '#4ade80' }} />
      <span className="turn-state-label">ACTIVE</span>
    </div>
  </div>
  
  <div className="info-section">
    <h4>基本信息</h4>
    <div className="info-grid">
      <div className="info-item">
        <span className="info-label">位置</span>
        <span className="info-value">100, 200</span>
      </div>
    </div>
  </div>
</div>
```

### 14. 磁吸指针效果

```tsx
// 任何按钮添加 data-magnetic 属性即可获得磁吸效果
<button 
  className="btn-tactical-base btn-tactical-primary"
  data-magnetic
>
  按钮
</button>
```

### 15. 背景网格

```tsx
<div className="lobby-container">
  <div className="grid-background" />
  {/* 其他内容 */}
</div>
```

## 颜色规范

| 类型 | 颜色值 | 用途 |
|------|--------|------|
| 主色 | `#4a9eff` | 主要操作、高亮 |
| 成功 | `#4ade80` | 成功状态、生命值 |
| 警告 | `#fbbf24` | 警告状态、护甲值 |
| 危险 | `#f87171` | 危险操作、结构值 |
| 信息 | `#8fbfd4` | 次要文本、提示 |
| 背景 | `rgba(13, 40, 71, 0.7)` | 面板背景 |

## 响应式断点

```css
/* 移动端 */
@media (max-width: 768px) {
  /* 自动适配 */
}

/* 桌面端 */
@media (min-width: 769px) {
  /* 正常布局 */
}
```

## 迁移现有组件

### 从内联样式迁移

1. 识别内联样式中的重复模式
2. 在 `ui-components.css` 中创建对应的样式类
3. 替换组件中的 `style={{}}` 为 `className`
4. 测试视觉效果是否一致

### 示例：迁移前

```tsx
<div style={{
  padding: '18px 20px',
  backgroundColor: 'rgba(13, 40, 71, 0.5)',
  border: '2px solid rgba(74, 158, 255, 0.2)',
  transition: 'all 0.2s ease',
}}>
```

### 示例：迁移后

```tsx
<div className="card-tactical">
```

## 最佳实践

1. **优先使用通用样式类**：新组件应首先查看 `ui-components.css` 是否有可用样式
2. **组合而非覆盖**：通过组合基础样式类来实现变体，而非创建新类
3. **保持命名一致**：使用 `btn-tactical-*`、`card-tactical-*` 等前缀
4. **避免硬编码颜色**：使用设计系统中定义的颜色变量
5. **测试响应式**：确保组件在不同屏幕尺寸下正常工作

## 扩展样式库

如需添加新的通用组件样式：

1. 在 `ui-components.css` 文件末尾添加
2. 使用一致的命名规范
3. 更新本使用指南
4. 通知团队成员

## 相关文件

- `design-system.css` - 设计变量定义
- `components.css` - 大厅、认证等特定组件样式
- `styles.css` - 主样式入口文件
