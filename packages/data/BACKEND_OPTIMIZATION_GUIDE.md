# 后端优化指导

## 当前结构分析

### 现有文件树
```
packages/server/src/
├── commands/           # 命令处理
│   ├── game/          # 游戏命令处理器
│   │   ├── assignHandler.ts
│   │   ├── configureHandler.ts
│   │   ├── customizeHandler.ts
│   │   ├── damageCalculator.ts
│   │   ├── fireHandler.ts
│   │   ├── fluxHandler.ts
│   │   ├── index.ts
│   │   ├── moveHandler.ts
│   │   ├── phaseHandler.ts
│   │   ├── queryHandler.ts
│   │   ├── queryTargetHandler.ts
│   │   ├── shieldHandler.ts
│   │   └── utils.ts
│   ├── system/        # 系统命令处理器
│   │   ├── index.ts
│   │   └── profileHandler.ts
│   ├── GameCommandRouter.ts  # 命令路由器
│   ├── SystemCommandHandler.ts
│   ├── index.ts
│   └── types.ts
├── dto/               # 数据传输对象
│   └── index.ts
├── http/              # HTTP路由
│   └── registerRoutes.ts
├── presets/           # 预设数据
│   └── index.ts
├── rooms/             # 房间管理
│   ├── battle/        # 战斗房间
│   │   ├── index.ts
│   │   ├── MetadataManager.ts
│   │   ├── MoveBuffer.ts
│   │   ├── PlayerManager.ts
│   │   ├── QosMonitor.ts
│   │   └── RoomConfig.ts
│   ├── BattleRoom.ts
│   ├── SaveRoom.ts
│   └── SystemRoom.ts
├── schema-generator/  # Schema生成器
│   ├── SchemaGenerator.ts
│   ├── generate.ts
│   └── index.ts
├── schema/            # Colyseus Schema定义
│   ├── FireControlSchema.ts
│   ├── GameSchema.ts
│   ├── RuntimeSlimFactory.ts
│   ├── RuntimeSlimSchema.ts
│   ├── SaveProcessor.ts
│   ├── constants.ts
│   ├── index.ts
│   └── types.ts
├── services/          # 业务服务
│   ├── PersistenceManager.ts
│   ├── PlayerService.ts
│   ├── ProfileService.ts
│   ├── RoomOwnerRegistry.ts
│   ├── SaveService.ts
│   ├── ShipJsonStateManager.ts
│   └── index.ts
├── utils/             # 工具函数
│   ├── ColyseusMessaging.ts
│   └── math.ts
├── validation/        # 数据验证
│   └── messagePayloads.ts
└── index.ts           # 主入口
```

## 问题分析

### 1. 架构问题
- **命令路由器过于臃肿**：`GameCommandRouter.ts` 313行，处理所有命令
- **服务依赖混乱**：服务间直接依赖，缺乏清晰的依赖注入
- **配置管理分散**：硬编码配置与 `@vt/data` 配置混合使用

### 2. 代码质量问题
- **缺乏统一错误处理**：错误处理分散在各个处理器
- **重复验证逻辑**：多个地方进行相似的数据验证
- **类型安全不足**：部分地方使用 `any` 类型

### 3. 性能问题
- **缺乏缓存机制**：预设数据重复加载
- **同步效率低**：全量同步，无增量更新
- **内存泄漏风险**：事件监听器未正确清理

## 优化方案

### 第一阶段：架构重构（高优先级）

#### 1.1 命令系统重构
```
commands/
├── core/              # 核心抽象
│   ├── BaseCommandHandler.ts
│   ├── CommandContext.ts
│   ├── CommandRegistry.ts
│   └── CommandValidator.ts
├── game/              # 游戏命令（按功能分组）
│   ├── movement/      # 移动相关
│   │   ├── MoveCommand.ts
│   │   └── MoveHandler.ts
│   ├── combat/        # 战斗相关
│   │   ├── FireCommand.ts
│   │   ├── ShieldCommand.ts
│   │   └── DamageCalculator.ts
│   ├── state/         # 状态管理
│   │   ├── PhaseCommand.ts
│   │   └── FluxCommand.ts
│   └── customization/ # 自定义
│       ├── CustomizeCommand.ts
│       └── ConfigureCommand.ts
├── system/            # 系统命令
│   ├── ProfileCommand.ts
│   └── RoomCommand.ts
└── CommandDispatcher.ts  # 轻量级分发器
```

#### 1.2 服务层重构
```
services/
├── core/              # 核心服务
│   ├── ConfigService.ts       # 配置管理
│   ├── CacheService.ts        # 缓存服务
│   ├── ValidationService.ts   # 验证服务
│   └── EventBus.ts            # 事件总线
├── game/              # 游戏服务
│   ├── ShipService.ts         # 舰船管理
│   ├── WeaponService.ts       # 武器管理
│   ├── CombatService.ts       # 战斗计算
│   └── MovementService.ts     # 移动计算
├── room/              # 房间服务
│   ├── RoomService.ts         # 房间管理
│   ├── PlayerService.ts       # 玩家管理
│   └── SaveService.ts         # 存档管理
└── system/            # 系统服务
    ├── ProfileService.ts      # 档案管理
    └── PresetService.ts       # 预设管理
```

### 第二阶段：代码质量提升（中优先级）

#### 2.1 统一错误处理
```typescript
// errors/
├── AppError.ts                # 基础错误类
├── ValidationError.ts         # 验证错误
├── GameLogicError.ts          # 游戏逻辑错误
├── NetworkError.ts            # 网络错误
└── ErrorHandler.ts            # 错误处理器
```

#### 2.2 类型安全增强
```typescript
// types/
├── commands/          # 命令类型
├── dto/               # DTO类型
├── events/            # 事件类型
└── validation/        # 验证类型
```

#### 2.3 配置统一管理
```typescript
// 使用 @vt/data 配置加载器
import { getGameRules, getServerConfig, GAME_CONFIG } from "@vt/data";

// 创建配置服务
class ConfigService {
  private gameRules = getGameRules();
  private serverConfig = getServerConfig();
  
  getMovementRules() {
    return this.gameRules.movement;
  }
  
  getCombatRules() {
    return this.gameRules.combat;
  }
}
```

### 第三阶段：性能优化（低优先级）

#### 3.1 缓存策略
```typescript
// 预设数据缓存
class PresetCache {
  private ships = new Map<string, ShipJSON>();
  private weapons = new Map<string, WeaponJSON>();
  
  async warmup() {
    // 预加载所有预设
  }
  
  getShip(id: string): ShipJSON | undefined {
    return this.ships.get(id);
  }
}
```

#### 3.2 增量同步
```typescript
// 增量更新机制
class DeltaSyncService {
  private lastState = new Map<string, any>();
  
  calculateDelta(current: any, previous: any): Delta {
    // 计算差异
  }
  
  applyDelta(state: any, delta: Delta): any {
    // 应用差异
  }
}
```

#### 3.3 内存管理
```typescript
// 资源清理
class ResourceManager {
  private cleanupHandlers = new Set<() => void>();
  
  registerCleanup(handler: () => void) {
    this.cleanupHandlers.add(handler);
  }
  
  cleanup() {
    this.cleanupHandlers.forEach(handler => handler());
    this.cleanupHandlers.clear();
  }
}
```

## 实施步骤

### 第1周：基础架构
1. 创建新的目录结构
2. 实现基础命令框架
3. 迁移核心服务

### 第2周：命令系统迁移
1. 拆分 `GameCommandRouter`
2. 实现新的命令处理器
3. 更新房间集成

### 第3周：服务层重构
1. 创建配置服务
2. 实现缓存服务
3. 统一错误处理

### 第4周：性能优化
1. 实现增量同步
2. 添加内存监控
3. 性能测试和调优

## 最佳实践

### 1. 依赖注入
```typescript
// 使用构造函数注入
class FireHandler {
  constructor(
    private configService: ConfigService,
    private combatService: CombatService,
    private validationService: ValidationService
  ) {}
}
```

### 2. 事件驱动
```typescript
// 使用事件总线解耦
class ShipService {
  constructor(private eventBus: EventBus) {}
  
  updateShip(ship: ShipJSON) {
    // 更新逻辑
    this.eventBus.emit('ship:updated', ship);
  }
}
```

### 3. 单元测试
```typescript
// 为每个服务编写测试
describe('CombatService', () => {
  it('should calculate damage correctly', () => {
    // 测试逻辑
  });
});
```

### 4. 监控和日志
```typescript
// 结构化日志
class Logger {
  info(message: string, meta?: any) {
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      ...meta
    }));
  }
}
```

## 迁移策略

### 1. 并行运行
- 新老系统并存
- 逐步迁移功能
- A/B 测试验证

### 2. 数据兼容
- 保持现有数据格式
- 提供迁移脚本
- 向后兼容 API

### 3. 回滚计划
- 每个步骤可回滚
- 监控关键指标
- 自动化测试验证

通过这个优化方案，后端将获得更好的可维护性、性能和扩展性，为未来的功能开发奠定坚实基础。