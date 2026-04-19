packages/server/src/
├── core/                     # 核心（无依赖，纯逻辑）
│   ├── engine/              # 游戏引擎
│   │   ├── index.ts
│   │   ├── applyAction.ts   # 入口（最核心）
│   │   ├── context.ts       # 执行上下文
│   │
│   │   ├── modules/         # 子系统
│   │   │   ├── movement.ts
│   │   │   ├── combat.ts
│   │   │   ├── flux.ts
│   │   │   ├── shield.ts
│   │   │   ├── turn.ts
│   │   │   └── modifier.ts
│   │
│   │   ├── geometry/        # 几何模块
│   │   │   ├── distance.ts
│   │   │   ├── angle.ts
│   │   │   ├── sector.ts
│   │   │   ├── quadrant.ts
│   │   │   └── index.ts
│   │
│   │   └── rules/           # 规则实现
│   │       ├── damage.ts
│   │       ├── armor.ts
│   │       ├── weapon.ts
│   │       └── index.ts
│   │
│   ├── state/               # 状态结构（纯JSON）
│   │   ├── GameState.ts
│   │   ├── Token.ts
│   │   ├── Component.ts
│   │   └── index.ts
│   │
│   ├── actions/             # Action定义（输入）
│   │   ├── move.ts
│   │   ├── attack.ts
│   │   ├── rotate.ts
│   │   ├── endTurn.ts
│   │   └── index.ts
│   │
│   ├── events/              # Event定义（输出）
│   │   ├── damage.ts
│   │   ├── moved.ts
│   │   ├── fluxChanged.ts
│   │   ├── turnChanged.ts
│   │   └── index.ts
│   │
│   └── types/               # 仅少量核心类型
│       └── common.ts
│
├── server/                  # 网络层（WS为主）
│   ├── ws/
│   │   ├── server.ts        # WS入口
│   │   ├── connection.ts    # 连接管理
│   │   └── protocol.ts      # 消息协议
│   │
│   ├── rooms/               # 房间系统（极简）
│   │   ├── Room.ts
│   │   ├── RoomManager.ts
│   │   └── types.ts
│   │
│   ├── handlers/            # 消息处理（很薄）
│   │   ├── actionHandler.ts
│   │   ├── joinHandler.ts
│   │   └── index.ts
│   │
│   └── broadcast/           # 广播策略
│       └── broadcaster.ts
│
├── data/                    # JSON数据（核心！）
│   ├── ships/
│   ├── weapons/
│   ├── components/
│   └── modifiers/
│
├── runtime/                 # 运行时服务
│   ├── GameRuntime.ts       # 管理所有对局
│   ├── Match.ts             # 单局封装
│   └── TurnManager.ts
│
├── infra/                   # 基础设施
│   ├── logger.ts
│   ├── errors.ts
│   └── config.ts
│
└── index.ts                 # 启动入口