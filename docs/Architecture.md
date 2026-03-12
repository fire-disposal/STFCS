## 🏗️ 顶层结构
```
.
├── docs/                  # 设计文档、领域说明
├── packages/              # Monorepo 核心代码
│   ├── client/            # 前端应用 (Vue)
│   ├── server/            # 后端服务 (Fastify + tRPC)
│   └── shared/            # 前后端共享逻辑 (类型、协议、工具)
├── .gitignore
├── package.json
├── pnpm-lock.yaml
├── pnpm-workspace.yaml
└── tsconfig.base.json     # 根 TS 配置，子项目继承
```

---

## 🎨 前端 (packages/client)
```
packages/client/
├── public/                # 静态资源
├── src/
│   ├── app/               # 应用入口 (App.vue, main.ts)
│   ├── components/        # 纯 UI 组件
│   ├── features/          # 功能模块 (DDD 应用层对应前端功能)
│   │   ├── ship/          # 船只控制与渲染
│   │   ├── map/           # 地图交互
│   │   ├── battle/        # 战斗逻辑 (护盾、爆炸、粒子)
│   │   └── player/        # 玩家交互与状态
│   ├── stores/            # Pinia 状态管理
│   ├── services/          # 前端服务 (WS 客户端、API 调用)
│   ├── utils/             # 工具函数
│   └── styles/            # 全局样式
├── vite.config.ts
├── tsconfig.json
└── package.json
```

---

## ⚙️ 后端 (packages/server)
```
packages/server/
├── src/
│   ├── app/               # Fastify 应用入口
│   ├── api/               # tRPC 路由层 (协议转换)
│   ├── application/       # 应用层 (用例/服务，调用领域逻辑)
│   │   ├── ship/
│   │   ├── map/
│   │   ├── battle/
│   │   └── player/
│   ├── domain/            # 领域层 (DDD 核心)
│   │   ├── ship/          # 船只聚合根、实体、值对象
│   │   ├── map/           # 地图聚合根、实体、值对象
│   │   ├── battle/        # 战斗聚合根、事件
│   │   └── player/        # 玩家聚合根、实体
│   ├── infrastructure/    # 基础设施层 (WS 通信、数据库、外部服务)
│   ├── utils/             # 公共工具
│   └── config/            # 配置文件 (环境变量、常量)
├── tsconfig.json
└── package.json
```

---

## 🔄 共享层 (packages/shared)
```
packages/shared/
├── src/
│   ├── types/             # 公共类型定义 (PlayerInfo, ShipStatus, ExplosionData)
│   ├── schemas/           # Zod/TypeBox 校验模式 (WS 消息、API 输入输出)
│   ├── ws/                # WebSocket 消息协议定义
│   ├── utils/             # 前后端共享工具函数
│   └── constants/         # 常量 (消息类型、配置)
├── tsconfig.json
└── package.json
```

---

## 📚 DDD 思想映射
- **领域层 (Domain)**：聚合根、实体、值对象，严格独立，不依赖外部框架。
- **应用层 (Application)**：用例逻辑，协调领域对象，暴露给路由层。
- **基础设施层 (Infrastructure)**：数据库、WS 通信、外部 API。
- **接口层 (API/Client)**：tRPC 路由、前端服务调用。

---

## ✅ 优势
- **清晰分层**：前后端都遵循 DDD，避免逻辑混乱。
- **共享协议**：WS 消息和类型统一在 `shared`，保证前后端一致。
- **可扩展性**：每个领域模块 (`ship`, `map`, `battle`, `player`) 都能独立演化。
- **团队协作**：文件树结构直观，降低认知负担。

