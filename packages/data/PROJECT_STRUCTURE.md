# STFCS 项目结构文档

## 项目概述
STFCS (Space Tactical Fleet Combat System) 是一个基于 WebSocket 的多人联机在线虚拟桌面游戏，采用前后端分离架构。

## 整体架构
```
STFCS/
├── packages/           # 多包工作区
│   ├── client/        # 前端应用
│   ├── server/        # 后端服务器
│   ├── data/          # 数据模型和配置
│   └── schema-types/  # Colyseus Schema 类型
├── .kilo/             # Kilo CLI 配置
├── AGENTS.md          # 代理配置
├── kilo.json          # Kilo 项目配置
├── package.json       # 根包配置
└── pnpm-workspace.yaml # PNPM 工作区配置
```

## 数据包 (@vt/data) - 权威数据结构

### 当前结构
```
packages/data/
├── src/
│   ├── core/                  # 核心类型定义
│   │   ├── CommonJsonTypes.ts    # 通用类型
│   │   ├── DataRegistry.ts       # 数据注册器
│   │   ├── RuntimeEnums.ts       # 运行时枚举
│   │   ├── ShipJsonTypes.ts      # 舰船类型
│   │   └── WeaponJsonTypes.ts    # 武器类型
│   ├── configs/               # 配置管理
│   │   ├── configs/           # 配置文件目录
│   │   │   ├── game-rules.json
│   │   │   └── server-config.json
│   │   └── index.ts           # 配置加载器
│   ├── schemas/               # JSON Schema 定义
│   │   ├── ship.schema.json
│   │   └── weapon.schema.json
│   └── index.ts               # 主导出
├── examples/                  # 使用示例
├── dist/                      # 构建输出
├── package.json
├── tsconfig.json
├── TODO.md                    # 重构任务清单
├── BACKEND_OPTIMIZATION_GUIDE.md  # 后端优化指导
├── FRONTEND_OPTIMIZATION_GUIDE.md # 前端优化指导
└── PROJECT_STRUCTURE.md       # 本文档
```

### 核心职责
1. **类型定义**：提供 `ShipJSON`、`WeaponJSON` 等权威类型
2. **配置管理**：统一游戏规则和服务器配置
3. **数据验证**：通过 `DataRegistry` 验证数据完整性
4. **运行时常量**：提供游戏枚举和常量

## 后端包 (@vt/server) - 游戏服务器

### 当前结构
```
packages/server/src/
├── commands/           # 命令处理系统
│   ├── game/          # 游戏命令处理器
│   │   ├── assignHandler.ts      # 分配舰船
│   │   ├── configureHandler.ts   # 配置武器
│   │   ├── customizeHandler.ts   # 自定义舰船
│   │   ├── damageCalculator.ts   # 伤害计算
│   │   ├── fireHandler.ts        # 开火处理
│   │   ├── fluxHandler.ts        # 通量处理
│   │   ├── index.ts              # 游戏命令导出
│   │   ├── moveHandler.ts        # 移动处理
│   │   ├── phaseHandler.ts       # 阶段处理
│   │   ├── queryHandler.ts       # 查询处理
│   │   ├── queryTargetHandler.ts # 目标查询
│   │   ├── shieldHandler.ts      # 护盾处理
│   │   └── utils.ts              # 工具函数
│   ├── system/        # 系统命令处理器
│   │   ├── index.ts              # 系统命令导出
│   │   └── profileHandler.ts     # 档案处理
│   ├── GameCommandRouter.ts      # 游戏命令路由器（313行，需要拆分）
│   ├── SystemCommandHandler.ts   # 系统命令处理器
│   ├── index.ts                  # 命令系统导出
│   └── types.ts                  # 命令类型定义
├── dto/               # 数据传输对象
│   └── index.ts                  # DTO 导出
├── http/              # HTTP 路由
│   └── registerRoutes.ts         # 路由注册
├── presets/           # 预设数据管理
│   └── index.ts                  # 预设加载器
├── rooms/             # 房间管理系统
│   ├── battle/        # 战斗房间实现
│   │   ├── index.ts              # 战斗房间导出
│   │   ├── MetadataManager.ts    # 元数据管理
│   │   ├── MoveBuffer.ts         # 移动缓冲区
│   │   ├── PlayerManager.ts      # 玩家管理
│   │   ├── QosMonitor.ts         # 网络质量监控
│   │   └── RoomConfig.ts         # 房间配置
│   ├── BattleRoom.ts             # 战斗房间主类
│   ├── SaveRoom.ts               # 存档房间
│   └── SystemRoom.ts             # 系统房间
├── schema-generator/  # Schema 生成工具
│   ├── SchemaGenerator.ts        # Schema 生成器
│   ├── generate.ts               # 生成脚本
│   └── index.ts                  # 生成器导出
├── schema/            # Colyseus Schema 定义
│   ├── FireControlSchema.ts      # 火控 Schema
│   ├── GameSchema.ts             # 游戏 Schema
│   ├── RuntimeSlimFactory.ts     # 运行时工厂
│   ├── RuntimeSlimSchema.ts      # 运行时 Schema
│   ├── SaveProcessor.ts          # 存档处理器
│   ├── constants.ts              # Schema 常量
│   ├── index.ts                  # Schema 导出
│   └── types.ts                  # Schema 类型
├── services/          # 业务服务层
│   ├── PersistenceManager.ts     # 持久化管理
│   ├── PlayerService.ts          # 玩家服务
│   ├── ProfileService.ts         # 档案服务
│   ├── RoomOwnerRegistry.ts      # 房主注册表
│   ├── SaveService.ts            # 存档服务
│   ├── ShipJsonStateManager.ts   # ShipJSON 状态管理
│   └── index.ts                  # 服务导出
├── utils/             # 工具函数
│   ├── ColyseusMessaging.ts      # Colyseus 消息工具
│   └── math.ts                   # 数学工具
├── validation/        # 数据验证
│   └── messagePayloads.ts        # 消息负载验证
└── index.ts           # 服务器主入口
```

### 核心职责
1. **游戏逻辑**：处理所有游戏规则和计算
2. **房间管理**：管理游戏房间和玩家连接
3. **数据同步**：通过 Colyseus 同步游戏状态
4. **持久化**：管理游戏存档和玩家数据

## 前端包 (client) - 游戏客户端

### 当前结构
```
packages/client/src/
├── App.tsx                    # 主应用组件（327行）
├── main.tsx                   # 应用入口
├── vite-env.d.ts              # Vite 环境类型
├── config/                    # 配置管理
│   └── index.ts              # 客户端配置
├── locales/                   # 国际化
│   ├── index.ts              # 国际化配置
│   ├── en-US/                # 英文翻译
│   │   └── translation.json
│   └── zh-CN/                # 中文翻译
│       └── translation.json
├── network/                   # 网络层
│   └── NetworkManager.ts     # 网络管理器
├── pages/                     # 页面组件
│   ├── AuthPage.tsx          # 认证页面
│   ├── GamePage.tsx          # 游戏页面
│   ├── LobbyPage.tsx         # 大厅页面
│   └── RoomPage.tsx          # 房间页面
├── renderer/                  # 渲染引擎（需要重构）
│   ├── core/                  # 核心渲染
│   │   ├── PixiCanvas.tsx    # Pixi 画布组件
│   │   ├── useCanvasResize.ts # 画布大小调整
│   │   ├── useLayerSystem.ts  # 图层系统
│   │   └── usePixiApp.ts      # Pixi 应用管理
│   ├── entities/              # 实体渲染（547行 ShipRenderer.ts）
│   │   ├── ArmorHexagonRenderer.ts    # 装甲六边形渲染
│   │   ├── FluxIndicatorRenderer.ts   # 通量指示器
│   │   ├── MovementVisualRenderer.ts  # 移动可视化
│   │   ├── ShipHUDRenderer.ts         # 舰船 HUD
│   │   ├── ShipRenderer.ts            # 舰船渲染
│   │   ├── ShieldArcRenderer.ts       # 护盾弧渲染
│   │   ├── TargetMarkerRenderer.ts    # 目标标记
│   │   └── WeaponArcRenderer.ts       # 武器弧渲染
│   ├── interactions/          # 交互处理
│   │   ├── InteractionHandler.ts      # 交互处理器
│   │   ├── useCanvasInteraction.ts    # 画布交互
│   │   ├── useTokenSelection.ts       # 令牌选择
│   │   └── ZoomHandler.ts             # 缩放处理
│   ├── systems/               # 渲染系统
│   │   ├── CursorRenderer.ts          # 光标渲染
│   │   ├── GridRenderer.ts            # 网格渲染
│   │   ├── StarfieldBackground.ts     # 星空背景
│   │   ├── StarfieldRenderer.ts       # 星空渲染器
│   │   ├── useCamera.ts               # 相机控制
│   │   └── useCameraAnimation.ts      # 相机动画
│   └── index.ts              # 渲染器导出
├── services/                  # 业务服务
│   ├── PresetCacheService.ts # 预设缓存服务
│   ├── SystemService.ts      # 系统服务（362行）
│   └── UserService.ts        # 用户服务
├── state/                     # 状态管理
│   ├── stores/               # Zustand stores
│   │   ├── fireModeStore.ts  # 开火模式 store
│   │   ├── gameStore.ts      # 游戏状态 store（184行）
│   │   ├── index.ts          # store 导出
│   │   └── uiStore.ts        # UI 状态 store
│   └── hooks/                # 自定义 hooks（待完善）
├── styles/                    # 样式文件
│   ├── components.css        # 组件样式
│   ├── design-system.css     # 设计系统
│   ├── fonts.css             # 字体样式
│   ├── game-panels.css       # 游戏面板样式
│   └── ui-components.css     # UI 组件样式
├── styles.css                 # 全局样式
├── sync/                      # 数据同步层
│   ├── GameClient.ts         # 游戏客户端
│   ├── useCurrentGameRoom.ts # 当前房间 hook
│   ├── useFireControl.ts     # 火控 hook
│   ├── useMultiplayerState.ts # 多人状态 hook
│   ├── usePlayerProfile.ts   # 玩家档案 hook
│   ├── index.ts              # 同步层导出
│   └── types.ts              # 同步类型定义（108行）
├── test/                      # 测试
│   └── setup.ts              # 测试设置
├── ui/                        # UI 组件库
│   ├── overlays/              # 覆盖层组件
│   │   ├── ShipCustomizationModal.tsx     # 舰船自定义模态框
│   │   ├── WeaponCustomizationModal.tsx   # 武器自定义模态框
│   │   └── ship-customization-modal.css   # 模态框样式
│   ├── panels/                # 面板组件
│   │   ├── BattleCommandPanel/            # 战斗命令面板
│   │   │   └── types.ts
│   │   ├── CombatLogPanel.tsx             # 战斗日志面板
│   │   ├── CoordinateSettingsPanel.tsx    # 坐标设置面板
│   │   ├── CursorCoordinateInput.tsx      # 光标坐标输入
│   │   ├── ShipCustomizationPanel/        # 舰船自定义面板
│   │   │   └── index.css
│   │   ├── ViewControlPanel.tsx           # 视图控制面板
│   │   └── types.ts                       # 面板类型
│   └── shared/                # 共享组件
│       ├── CoordinateInput.tsx            # 坐标输入组件
│       ├── MagneticPointer.tsx            # 磁性指针
│       ├── Notification.tsx               # 通知组件
│       └── notification.css               # 通知样式
└── utils/                     # 工具函数
    ├── CombatLog.ts           # 战斗日志
    ├── coordinateSystem.ts    # 坐标系转换
    └── math.ts               # 数学工具
```

### 核心职责
1. **用户界面**：提供游戏交互界面
2. **游戏渲染**：使用 Pixi.js 渲染游戏场景
3. **状态管理**：管理客户端游戏状态
4. **网络通信**：与服务器进行 WebSocket 通信

## Schema 类型包 (@vt/schema-types)

### 结构
```
packages/schema-types/
├── src/
│   └── index.ts      # 自动生成的 Schema 类型
├── dist/
├── package.json
└── tsconfig.json
```

### 核心职责
1. **类型安全**：为 Colyseus Schema 提供 TypeScript 类型
2. **代码生成**：自动从 Schema 定义生成类型
3. **前后端共享**：确保前后端类型一致性

## 依赖关系

### 包间依赖
```
client
  ├── @vt/data          # 数据模型和配置
  └── @vt/schema-types  # Schema 类型

server
  ├── @vt/data          # 数据模型和配置
  └── @vt/schema-types  # Schema 类型

data
  └── (无外部依赖)      # 独立的数据定义包

schema-types
  └── @vt/data          # 基于数据包生成类型
```

### 外部依赖
- **Colyseus**：实时多人游戏框架
- **Pixi.js**：2D 渲染引擎
- **React**：UI 框架
- **TypeScript**：类型安全
- **Zustand**：状态管理
- **Vite**：构建工具

## 开发工作流

### 1. 开发环境
```bash
# 安装依赖
pnpm install

# 启动开发服务器
pnpm dev

# 构建所有包
pnpm build

# 运行测试
pnpm test

# 代码检查
pnpm lint
pnpm typecheck
```

### 2. 代码生成
```bash
# 生成 Schema 类型
cd packages/schema-types
pnpm generate

# 构建数据包
cd packages/data
pnpm build
```

### 3. 部署流程
```bash
# 构建所有包
pnpm build

# 启动服务器
cd packages/server
pnpm start
```

## 架构原则

### 1. 单一数据源
- 所有权威数据定义在 `@vt/data` 包中
- 前后端共享相同的类型定义
- 配置集中管理，避免硬编码

### 2. 关注点分离
- **数据层**：`@vt/data` 负责数据定义和验证
- **业务逻辑**：服务器处理游戏规则
- **表现层**：客户端负责渲染和交互
- **网络层**：Colyseus 负责状态同步

### 3. 类型安全
- 全栈 TypeScript
- 自动生成的 Schema 类型
- 严格的类型检查

### 4. 可扩展性
- 模块化架构
- 清晰的接口定义
- 易于添加新功能

## 重构优先级

### 高优先级（立即执行）
1. **统一配置管理**：前后端使用 `@vt/data` 配置
2. **命令系统拆分**：重构臃肿的 `GameCommandRouter`
3. **状态管理优化**：统一前端状态管理

### 中优先级（短期目标）
1. **渲染引擎重构**：优化渲染性能
2. **错误处理统一**：添加错误边界和监控
3. **缓存策略实现**：减少重复请求

### 低优先级（长期目标）
1. **性能优化**：渲染和网络优化
2. **监控系统**：添加性能监控
3. **测试覆盖**：提高测试覆盖率

## 文档清单

### 已创建文档
1. `TODO.md` - 前后端重构任务清单
2. `BACKEND_OPTIMIZATION_GUIDE.md` - 后端优化指导
3. `FRONTEND_OPTIMIZATION_GUIDE.md` - 前端优化指导
4. `PROJECT_STRUCTURE.md` - 项目结构文档（本文档）

### 待创建文档
1. `API_DOCUMENTATION.md` - API 接口文档
2. `DEVELOPMENT_GUIDE.md` - 开发指南
3. `DEPLOYMENT_GUIDE.md` - 部署指南
4. `TESTING_STRATEGY.md` - 测试策略

## 联系方式

- **项目仓库**：https://github.com/your-org/STFCS
- **问题跟踪**：使用 GitHub Issues
- **文档更新**：提交 Pull Request

---

*最后更新：2026-04-18*
*版本：1.0.0*