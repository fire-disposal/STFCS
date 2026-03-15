# STFCS 设计系统使用指南

## 📐 设计系统概述

设计系统位于 `packages/client/src/styles/` 目录：

```
styles/
├── design-system.css    # 基础变量和工具类
├── components.css       # 组件样式规范
└── fonts.css           # 字体定义
```

## 🎨 CSS变量使用

### 颜色变量
```css
/* 主色调 */
color: var(--color-primary);           /* 科技蓝 */
color: var(--color-warning);           /* 警告橙 */
color: var(--color-danger);            /* 危险红 */
color: var(--color-success);           /* 成功绿 */

/* 文字色 */
color: var(--text-primary);            /* 主要文字 */
color: var(--text-secondary);          /* 次要文字 */
color: var(--text-tertiary);           /* 辅助文字 */

/* 背景色 */
background: var(--bg-primary);         /* 主背景 */
background: var(--bg-panel);           /* 面板背景 */
background: var(--bg-hud);             /* HUD背景 */
```

### 字体变量
```css
/* 字体族 */
font-family: var(--font-mono);         /* 等宽字体 - 数据/数值 */
font-family: var(--font-display);      /* 显示字体 - 标题 */
font-family: var(--font-body);         /* 正文字体 */

/* 字体大小 - 响应式 */
font-size: var(--text-xs);             /* 10-12px */
font-size: var(--text-sm);             /* 12-14px */
font-size: var(--text-base);            /* 14-16px */
font-size: var(--text-md);              /* 16-18px */
font-size: var(--text-lg);              /* 18-20px */
font-size: var(--text-xl);              /* 20-24px */
```

### 间距变量
```css
/* 间距 */
padding: var(--space-1);               /* 2-4px */
padding: var(--space-2);               /* 4-8px */
padding: var(--space-3);               /* 6-12px */
padding: var(--space-4);               /* 8-16px */
padding: var(--space-6);               /* 16-24px */
```

### 尺寸变量
```css
/* 高度 */
height: var(--height-sm);              /* 24-32px */
height: var(--height-md);              /* 32-40px */
height: var(--height-lg);              /* 40-48px */

/* 宽度 */
width: var(--width-sm);                /* 80-120px */
width: var(--width-md);                /* 120-160px */
width: var(--width-lg);                /* 160-200px */

/* 图标尺寸 */
width: var(--icon-sm);                 /* 12-16px */
width: var(--icon-md);                 /* 16-20px */
width: var(--icon-lg);                 /* 20-24px */
```

## 🧩 组件类使用

### 按钮
```tsx
// 基础按钮
<button className="btn btn-primary">主要按钮</button>
<button className="btn btn-secondary">次要按钮</button>
<button className="btn btn-danger">危险按钮</button>
<button className="btn btn-ghost">幽灵按钮</button>

// 按钮尺寸
<button className="btn btn-primary btn-sm">小按钮</button>
<button className="btn btn-primary btn-md">中按钮</button>
<button className="btn btn-primary btn-lg">大按钮</button>

// 图标按钮
<button className="btn btn-secondary btn-icon">
  <Icon size={16} />
</button>
```

### 输入框
```tsx
<input className="input" placeholder="默认输入框" />
<input className="input input-sm" placeholder="小输入框" />
<input className="input input-lg" placeholder="大输入框" />
```

### 面板
```tsx
<div className="panel">
  <div className="panel-header">
    <span className="panel-title">面板标题</span>
  </div>
  <div className="panel-content">
    内容区域
  </div>
</div>
```

### 标签页
```tsx
<div className="tabs">
  <button className="tab active">标签1</button>
  <button className="tab">标签2</button>
  <button className="tab">标签3</button>
</div>
```

### 状态条
```tsx
<div className="status-bar">
  <span className="status-bar-label">护盾</span>
  <div className="status-bar-track">
    <div className="status-bar-fill shield" style={{ width: '80%' }} />
  </div>
  <span className="status-bar-value">80%</span>
</div>
```

## 🛠️ 工具类使用

### 布局
```tsx
<div className="flex items-center gap-4">
<div className="flex flex-col justify-between">
<div className="flex-1">
```

### 文字
```tsx
<span className="text-sm text-primary">
<span className="font-mono font-bold">
<span className="tracking-wide">
```

### 间距
```tsx
<div className="p-4 m-2">
<div className="gap-3">
```

### 其他
```tsx
<div className="rounded-sm">
<div className="overflow-hidden">
<div className="cursor-pointer">
```

## 📱 响应式适配

### 高分辨率屏幕 (2K+)
设计系统会自动调整：
- 字体大小增大
- 间距增大
- 组件尺寸增大

### 自定义响应式
```css
@media (min-width: 2560px) {
  .my-component {
    font-size: var(--text-lg);
    padding: var(--space-6);
  }
}
```

## 🎯 最佳实践

### 1. 始终使用CSS变量
```css
/* ✅ 推荐 */
color: var(--color-primary);
padding: var(--space-4);

/* ❌ 避免 */
color: #4a9eff;
padding: 16px;
```

### 2. 使用clamp实现响应式
```css
/* ✅ 推荐 */
width: clamp(160px, 20vw, 200px);

/* ❌ 避免 */
width: 180px;
```

### 3. 保持圆角一致
```css
/* ✅ 推荐 */
border-radius: var(--radius-sm);  /* 2px */

/* ❌ 避免 */
border-radius: 4px;
```

### 4. 使用过渡动画
```css
/* ✅ 推荐 */
transition: var(--transition-fast);

/* ❌ 避免 */
transition: all 0.2s ease;
```

## 🔧 迁移指南

### 旧代码
```tsx
<button 
  style={{
    background: 'rgba(74, 158, 255, 0.2)',
    border: '1px solid #4a9eff',
    padding: '8px 16px',
    fontSize: '12px'
  }}
>
  按钮
</button>
```

### 新代码
```tsx
<button className="btn btn-primary btn-md">
  按钮
</button>
```

## 📊 组件大小参考

| 组件 | 小屏 | 标准 | 2K屏 | 4K屏 |
|------|------|------|------|------|
| 按钮高度 | 28px | 32px | 40px | 48px |
| 字体基础 | 14px | 16px | 18px | 20px |
| 间距单位 | 8px | 16px | 24px | 32px |
| 图标大小 | 16px | 20px | 24px | 28px |

## 🎨 颜色参考

| 用途 | 颜色值 | 变量 |
|------|--------|------|
| 主色 | #4a9eff | --color-primary |
| 警告 | #ffaa00 | --color-warning |
| 危险 | #ff4444 | --color-danger |
| 成功 | #00ff88 | --color-success |
| 主文字 | #e0e6f0 | --text-primary |
| 次文字 | #a0a8b8 | --text-secondary |

## 📝 注意事项

1. **不要硬编码数值** - 始终使用CSS变量
2. **使用clamp()** - 确保响应式适配
3. **保持圆角一致** - 使用--radius-*变量
4. **使用过渡动画** - 保持交互一致性
5. **测试高分辨率** - 在2K/4K屏幕上验证

## 🔗 相关文件

- `styles/design-system.css` - 基础变量
- `styles/components.css` - 组件样式
- `styles/fonts.css` - 字体定义
- `styles.css` - 主样式文件（已导入设计系统）
