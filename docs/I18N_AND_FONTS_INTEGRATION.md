# STFCS 前端 i18n 国际化与字体集成方案

## 📋 项目分析

### 当前技术栈
- **框架**: React 18.3.1
- **构建工具**: Vite 6.2.0
- **状态管理**: Redux Toolkit + Zustand
- **路由**: React Router DOM 6.28.0
- **UI 库**: Framer Motion, Lucide React
- **渲染**: PixiJS 8.17.0 (游戏画布)

### 集成目标
1. **i18n 国际化**: 支持中文 (zh-CN) 和英文 (en-US)
2. **字体方案**: 
   - 中文：思源黑体 (Source Han Sans CN)
   - 英文：Fira Code (等宽字体，适合代码/技术界面)

---

## 📦 步骤一：安装依赖

### 1.1 安装 i18n 库 (react-i18next)

```bash
cd packages/client
pnpm add i18next react-i18next i18next-browser-languagedetector
```

### 1.2 安装字体相关工具

```bash
# 安装字体加载器（可选，用于动态加载）
pnpm add webfontloader
```

---

## 📁 步骤二：创建项目结构

### 2.1 目录结构

```
packages/client/
├── public/
│   └── fonts/
│       ├── SourceHanSansCN/
│       │   ├── SourceHanSansCN-Regular.woff2
│       │   ├── SourceHanSansCN-Bold.woff2
│       │   └── ...
│       └── FiraCode/
│           ├── FiraCode-Regular.woff2
│           ├── FiraCode-Bold.woff2
│           └── ...
├── src/
│   ├── locales/
│   │   ├── index.ts              # i18n 配置入口
│   │   ├── zh-CN/
│   │   │   ├── translation.json  # 中文翻译
│   │   │   └── index.ts
│   │   └── en-US/
│   │       ├── translation.json  # 英文翻译
│   │       └── index.ts
│   ├── hooks/
│   │   └── useTranslation.ts     # 自定义翻译 Hook（可选）
│   ├── components/
│   │   └── ui/
│   │       └── LanguageSwitcher.tsx  # 语言切换器
│   └── styles/
│       └── fonts.css             # 字体样式定义
```

---

## 🌐 步骤三：配置 i18n

### 3.1 创建 i18n 配置文件

**`src/locales/index.ts`**:

```typescript
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

import zhCN from './zh-CN/translation.json';
import enUS from './en-US/translation.json';

export const resources = {
  'zh-CN': {
    translation: zhCN,
  },
  'en-US': {
    translation: enUS,
  },
} as const;

i18n
  // 检测用户语言
  .use(LanguageDetector)
  // 注入 react-i18next 实例
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: 'en-US',
    debug: import.meta.env.DEV,
    
    // 语言检测配置
    detection: {
      order: ['localStorage', 'navigator', 'htmlTag'],
      caches: ['localStorage'],
    },
    
    // 插值配置
    interpolation: {
      escapeValue: false, // React 已默认转义
    },
    
    // 平滑的语言切换
    react: {
      useSuspense: false,
    },
  });

export default i18n;

// 类型定义
export type AppLanguage = 'zh-CN' | 'en-US';
export const SUPPORTED_LANGUAGES: { value: AppLanguage; label: string }[] = [
  { value: 'zh-CN', label: '简体中文' },
  { value: 'en-US', label: 'English' },
];
```

### 3.2 创建中文翻译文件

**`src/locales/zh-CN/translation.json`**:

```json
{
  "app": {
    "title": "STFCS - 太空舰队战术战斗系统",
    "loading": "加载中..."
  },
  "connection": {
    "title": "加入 STFCS 游戏",
    "description": "输入您的玩家名称加入太空舰队战术战斗模拟。",
    "playerName": "玩家名称",
    "unableToConnect": "无法连接到服务器",
    "connectionStatusText": "无法连接到 {{url}}。请检查服务器是否正在运行。",
    "formHelp": "最多 32 个字符。在房间中必须唯一。",
    "submit": {
      "joining": "正在加入...",
      "reconnecting": "正在重新连接...",
      "joinGame": "加入游戏",
      "retryConnection": "重试连接"
    },
    "error": {
      "nameRequired": "请输入玩家名称",
      "nameTooLong": "玩家名称不能超过 32 个字符",
      "failedToJoin": "加入失败：{{error}}",
      "failedToReconnect": "重新连接失败：{{error}}"
    }
  },
  "connectionInfo": {
    "title": "服务器信息",
    "autoConnect": "自动连接到：{{url}}",
    "serverRunning": "服务器运行在 localhost:3001",
    "uniqueName": "玩家名称在每个房间中必须唯一",
    "changeRooms": "加入后可以切换房间"
  },
  "game": {
    "title": "游戏",
    "disconnect": "断开连接",
    "settings": "设置",
    "language": "语言"
  },
  "ui": {
    "cancel": "取消",
    "confirm": "确认",
    "save": "保存",
    "close": "关闭",
    "back": "返回",
    "next": "下一步",
    "previous": "上一步"
  },
  "token": {
    "info": "Token 信息",
    "noSelection": "未选择 Token",
    "clickToSelect": "点击舰船、空间站或小行星进行选择",
    "basicInfo": "基本信息",
    "position": "位置",
    "heading": "朝向",
    "size": "大小",
    "scale": "缩放",
    "layer": "层级",
    "collision": "碰撞半径",
    "turnStatus": "回合状态",
    "movementPoints": "移动点数",
    "actionPoints": "行动点数",
    "metadata": "元数据",
    "actions": "操作",
    "rotateLeft": "向左旋转 (-15°)",
    "rotateRight": "向右旋转 (+15°)",
    "markMoved": "标记为已移动",
    "markActed": "标记行动已使用",
    "endTurn": "结束此 Token 回合"
  },
  "ship": {
    "hull": "船体",
    "flux": "辐能",
    "shield": "护盾",
    "armor": "装甲",
    "weapons": "武器"
  }
}
```

### 3.3 创建英文翻译文件

**`src/locales/en-US/translation.json`**:

```json
{
  "app": {
    "title": "STFCS - Tactical Space Fleet Combat System",
    "loading": "Loading..."
  },
  "connection": {
    "title": "Join STFCS Game",
    "description": "Enter your player name to join the tactical space fleet combat simulation.",
    "playerName": "Player Name",
    "unableToConnect": "Unable to connect to server",
    "connectionStatusText": "Unable to connect to {{url}}. Please check if the server is running.",
    "formHelp": "Maximum 32 characters. Must be unique in the room.",
    "submit": {
      "joining": "Joining...",
      "reconnecting": "Reconnecting...",
      "joinGame": "Join Game",
      "retryConnection": "Retry Connection"
    },
    "error": {
      "nameRequired": "Please enter your player name",
      "nameTooLong": "Player name must be 32 characters or less",
      "failedToJoin": "Failed to join: {{error}}",
      "failedToReconnect": "Failed to reconnect: {{error}}"
    }
  },
  "connectionInfo": {
    "title": "Server Information",
    "autoConnect": "Auto-connected to: {{url}}",
    "serverRunning": "Server running on localhost:3001",
    "uniqueName": "Player names must be unique in each room",
    "changeRooms": "You can change rooms after joining"
  },
  "game": {
    "title": "Game",
    "disconnect": "Disconnect",
    "settings": "Settings",
    "language": "Language"
  },
  "ui": {
    "cancel": "Cancel",
    "confirm": "Confirm",
    "save": "Save",
    "close": "Close",
    "back": "Back",
    "next": "Next",
    "previous": "Previous"
  },
  "token": {
    "info": "Token Info",
    "noSelection": "No token selected",
    "clickToSelect": "Click on a ship, station, or asteroid to select it",
    "basicInfo": "Basic Information",
    "position": "Position",
    "heading": "Heading",
    "size": "Size",
    "scale": "Scale",
    "layer": "Layer",
    "collision": "Collision Radius",
    "turnStatus": "Turn Status",
    "movementPoints": "Movement Points",
    "actionPoints": "Action Points",
    "metadata": "Metadata",
    "actions": "Actions",
    "rotateLeft": "Rotate Left (-15°)",
    "rotateRight": "Rotate Right (+15°)",
    "markMoved": "Mark as Moved",
    "markActed": "Mark Action Used",
    "endTurn": "End Turn for This Token"
  },
  "ship": {
    "hull": "Hull",
    "flux": "Flux",
    "shield": "Shield",
    "armor": "Armor",
    "weapons": "Weapons"
  }
}
```

---

## 🔤 步骤四：配置服务器字体

### 4.1 下载字体文件

#### 思源黑体 (Source Han Sans CN)
- **下载地址**: https://github.com/adobe-fonts/source-han-sans
- **推荐格式**: WOFF2 (现代浏览器，最佳压缩)
- **所需字重**: Regular (400), Medium (500), Bold (700)

#### Fira Code
- **下载地址**: https://github.com/tonsky/FiraCode
- **推荐格式**: WOFF2
- **所需字重**: Regular (400), Medium (500), Bold (700)

### 4.2 放置字体文件

将下载的字体文件放入 `public/fonts/` 目录：

```
public/fonts/
├── source-han-sans/
│   ├── SourceHanSansCN-Regular.woff2
│   ├── SourceHanSansCN-Medium.woff2
│   └── SourceHanSansCN-Bold.woff2
└── fira-code/
    ├── FiraCode-Regular.woff2
    ├── FiraCode-Medium.woff2
    └── FiraCode-Bold.woff2
```

### 4.3 创建字体样式文件

**`src/styles/fonts.css`**:

```css
/* ============================================
   思源黑体 (Source Han Sans CN) - 中文字体
   ============================================ */
@font-face {
  font-family: 'Source Han Sans CN';
  src: url('/fonts/source-han-sans/SourceHanSansCN-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap; /* 关键优化：避免 FOIT */
  unicode-range: U+4E00-9FFF, U+3400-4DBF, U+20000-2A6DF, U+2A700-2B73F, U+2B740-2B81F, U+2B820-2CEAF, U+F900-FAFF, U+2F800-2FA1F;
}

@font-face {
  font-family: 'Source Han Sans CN';
  src: url('/fonts/source-han-sans/SourceHanSansCN-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
  unicode-range: U+4E00-9FFF, U+3400-4DBF, U+20000-2A6DF, U+2A700-2B73F, U+2B740-2B81F, U+2B820-2CEAF, U+F900-FAFF, U+2F800-2FA1F;
}

@font-face {
  font-family: 'Source Han Sans CN';
  src: url('/fonts/source-han-sans/SourceHanSansCN-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  unicode-range: U+4E00-9FFF, U+3400-4DBF, U+20000-2A6DF, U+2A700-2B73F, U+2B740-2B81F, U+2B820-2CEAF, U+F900-FAFF, U+2F800-2FA1F;
}

/* ============================================
   Fira Code - 英文等宽字体（代码/技术文本）
   ============================================ */
@font-face {
  font-family: 'Fira Code';
  src: url('/fonts/fira-code/FiraCode-Regular.woff2') format('woff2');
  font-weight: 400;
  font-style: normal;
  font-display: swap;
  font-feature-settings: "calt" 1; /* 启用连字 */
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Fira Code';
  src: url('/fonts/fira-code/FiraCode-Medium.woff2') format('woff2');
  font-weight: 500;
  font-style: normal;
  font-display: swap;
  font-feature-settings: "calt" 1;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

@font-face {
  font-family: 'Fira Code';
  src: url('/fonts/fira-code/FiraCode-Bold.woff2') format('woff2');
  font-weight: 700;
  font-style: normal;
  font-display: swap;
  font-feature-settings: "calt" 1;
  unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
}

/* ============================================
   字体工具类
   ============================================ */

/* 默认字体栈：根据语言自动切换 */
:root {
  --font-sans-cn: 'Source Han Sans CN', 'Noto Sans SC', 'PingFang SC', 'Microsoft YaHei', sans-serif;
  --font-mono-en: 'Fira Code', 'Consolas', 'Monaco', 'Courier New', monospace;
}

/* 中文优先的字体栈 */
.font-cn {
  font-family: var(--font-sans-cn);
}

/* 英文/代码字体栈 */
.font-mono {
  font-family: var(--font-mono-en);
  font-feature-settings: "calt" 1; /* 启用连字 */
}

/* 根据语言属性自动切换 */
html[lang="zh-CN"] {
  font-family: var(--font-sans-cn);
}

html[lang="en-US"] {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', sans-serif;
}

/* 代码块始终使用 Fira Code */
code, pre, .code-block {
  font-family: var(--font-mono-en) !important;
}
```

---

## 🔧 步骤五：集成到应用

### 5.1 在 main.tsx 中初始化 i18n

**`src/main.tsx`**:

```typescript
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { Provider } from "react-redux";
import { BrowserRouter } from "react-router-dom";

import { store } from "@/store";
import App from "./App";
import "./locales"; // 导入 i18n 配置
import "./styles.css"; // 包含 fonts.css

// ... 其余代码不变
```

### 5.2 更新全局样式

**`src/styles.css`** (在文件顶部添加):

```css
@import './fonts.css';

/* 全局字体设置 */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

html,
body,
#root {
  width: 100%;
  height: 100%;
  overflow: hidden;
  /* 根据语言动态切换字体 */
  font-family: var(--font-sans-cn);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #0a0a1a;
  color: #c0c0d0;
}

/* 代码相关元素使用 Fira Code */
code {
  font-family: var(--font-mono-en) !important;
  font-feature-settings: "calt" 1;
}
```

---

## 🎨 步骤六：创建语言切换器组件

**`src/components/ui/LanguageSwitcher.tsx`**:

```typescript
import React from 'react';
import { useTranslation } from 'react-i18next';
import { Globe } from 'lucide-react';
import { motion } from 'framer-motion';

export const LanguageSwitcher: React.FC = () => {
  const { i18n } = useTranslation();

  const currentLanguage = i18n.language;

  const languages = [
    { code: 'zh-CN', label: '简体中文', flag: '🇨🇳' },
    { code: 'en-US', label: 'English', flag: '🇺🇸' },
  ];

  const changeLanguage = (lng: string) => {
    i18n.changeLanguage(lng);
    // 同时更新 HTML lang 属性
    document.documentElement.lang = lng;
  };

  return (
    <div className="language-switcher">
      <Globe size={18} />
      <select
        value={currentLanguage}
        onChange={(e) => changeLanguage(e.target.value)}
        className="language-select"
      >
        {languages.map((lang) => (
          <option key={lang.code} value={lang.code}>
            {lang.flag} {lang.label}
          </option>
        ))}
      </select>
    </div>
  );
};
```

**添加样式**:

```css
.language-switcher {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 8px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.language-switcher svg {
  color: #aaccff;
}

.language-select {
  background: transparent;
  border: none;
  color: #c0c0d0;
  font-size: 14px;
  cursor: pointer;
  outline: none;
}

.language-select option {
  background: #1a1a3e;
  color: #c0c0d0;
}
```

---

## 📝 步骤七：更新现有组件使用 i18n

### 7.1 更新 App.tsx

```typescript
import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next"; // 添加
import { LanguageSwitcher } from "@/components/ui/LanguageSwitcher"; // 添加

// ... 其他导入

const PlayerNameView: React.FC<{
  isConnecting: boolean;
  isConnected: boolean;
  onJoin: (playerName: string) => Promise<void>;
  onReconnect: () => Promise<void>;
}> = ({ isConnecting, isConnected, onJoin, onReconnect }) => {
  const { t } = useTranslation(); // 添加
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isConnected) {
      try {
        setError("");
        await onReconnect();
        return;
      } catch (err) {
        setError(t('connection.error.failedToReconnect', { 
          error: err instanceof Error ? err.message : String(err) 
        }));
        return;
      }
    }

    if (!name.trim()) {
      setError(t('connection.error.nameRequired'));
      return;
    }
    if (name.length > 32) {
      setError(t('connection.error.nameTooLong'));
      return;
    }
    setError("");
    try {
      await onJoin(name);
    } catch (err) {
      setError(t('connection.error.failedToJoin', { 
        error: err instanceof Error ? err.message : String(err) 
      }));
    }
  };

  return (
    <div className="connection-view">
      <div className="connection-card">
        <h2>{t('connection.title')}</h2>
        <p className="connection-description">
          {t('connection.description')}
        </p>

        <form onSubmit={handleSubmit} className="connection-form">
          <div className="form-group">
            <label htmlFor="playerName">
              {isConnected ? t('connection.playerName') : t('connection.unableToConnect')}
            </label>
            {isConnected ? (
              <input
                id="playerName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter your name"
                disabled={isConnecting}
                className="form-input"
                maxLength={32}
                autoFocus
              />
            ) : (
              <div className="connection-status-text">
                {t('connection.connectionStatusText', { url: DEFAULT_WS_URL })}
              </div>
            )}
            {isConnected ? (
              <small className="form-help">{t('connection.formHelp')}</small>
            ) : null}
            {error && <div className="form-error">{error}</div>}
          </div>

          <div className="form-actions">
            <button
              type="submit"
              disabled={isConnecting || (isConnected && !name.trim())}
              className="connect-button"
            >
              {isConnecting ? (
                <>
                  <span className="spinner"></span>
                  {isConnected ? t('connection.submit.joining') : t('connection.submit.reconnecting')}
                </>
              ) : isConnected ? (
                t('connection.submit.joinGame')
              ) : (
                t('connection.submit.retryConnection')
              )}
            </button>
          </div>
        </form>

        <div className="connection-info">
          <h3>{t('connectionInfo.title')}</h3>
          <ul>
            <li>{t('connectionInfo.autoConnect', { url: DEFAULT_WS_URL })}</li>
            <li>{t('connectionInfo.serverRunning')}</li>
            <li>{t('connectionInfo.uniqueName')}</li>
            <li>{t('connectionInfo.changeRooms')}</li>
          </ul>
        </div>

        {/* 添加语言切换器 */}
        <div className="language-switcher-container">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
};

// ... 其余代码
```

---

## ⚡ 步骤八：性能优化

### 8.1 字体加载优化

**`vite.config.ts`** - 添加字体预加载：

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-i18n': ['i18next', 'react-i18next'],
        },
      },
    },
  },
  // 预加载关键资源
  server: {
    warmup: {
      clientFiles: [
        './src/locales/**/*',
        './src/styles/fonts.css',
      ],
    },
  },
});
```

### 8.2 字体子集化（可选，减少体积）

使用工具如 [fonttools](https://github.com/fonttools/fonttools) 创建中文字体子集：

```bash
# 仅保留常用汉字（约 3500 个）
pyftsubset SourceHanSansCN-Regular.woff2 \
  --unicodes=U+4E00-9FFF \
  --output-file=SourceHanSansCN-Regular.subset.woff2
```

---

## 🧪 步骤九：测试

### 9.1 单元测试

创建 i18n 测试工具：

**`src/locales/__tests__/i18n.test.ts`**:

```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import i18n from '../index';

describe('i18n', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('en-US');
  });

  it('should change language to zh-CN', async () => {
    await i18n.changeLanguage('zh-CN');
    expect(i18n.language).toBe('zh-CN');
  });

  it('should translate basic keys', () => {
    expect(i18n.t('app.title')).toBeDefined();
  });
});
```

### 9.2 视觉回归测试

- 测试中英文切换后 UI 布局
- 验证字体正确加载
- 检查文本溢出问题

---

## 📊 完成检查清单

- [ ] 安装 i18next 和相关依赖
- [ ] 创建 locales 目录结构和翻译文件
- [ ] 配置 i18n 初始化
- [ ] 下载并放置字体文件
- [ ] 创建 fonts.css 字体样式
- [ ] 在 main.tsx 中导入 i18n 配置
- [ ] 创建 LanguageSwitcher 组件
- [ ] 更新现有组件使用 t() 函数
- [ ] 添加字体预加载优化
- [ ] 测试语言切换功能
- [ ] 验证字体加载性能

---

## 🔗 相关资源

- [react-i18next 文档](https://react.i18next.com/)
- [思源黑体 GitHub](https://github.com/adobe-fonts/source-han-sans)
- [Fira Code GitHub](https://github.com/tonsky/FiraCode)
- [字体性能优化最佳实践](https://web.dev/optimize-webfont-loading/)
