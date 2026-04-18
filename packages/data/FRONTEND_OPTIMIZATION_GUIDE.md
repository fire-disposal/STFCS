# 前端优化指导

## 当前结构分析

### 现有文件树
```
packages/client/src/
├── App.tsx                    # 主应用组件
├── main.tsx                   # 应用入口
├── vite-env.d.ts              # Vite 环境类型
├── config/                    # 配置管理
│   └── index.ts
├── locales/                   # 国际化
│   ├── index.ts
│   ├── en-US/
│   └── zh-CN/
├── network/                   # 网络层
│   └── NetworkManager.ts
├── pages/                     # 页面组件
│   ├── AuthPage.tsx
│   ├── GamePage.tsx
│   ├── LobbyPage.tsx
│   └── RoomPage.tsx
├── renderer/                  # 渲染引擎
│   ├── core/                  # 核心渲染
│   │   ├── PixiCanvas.tsx
│   │   ├── useCanvasResize.ts
│   │   ├── useLayerSystem.ts
│   │   └── usePixiApp.ts
│   ├── entities/              # 实体渲染
│   │   ├── ArmorHexagonRenderer.ts
│   │   ├── FluxIndicatorRenderer.ts
│   │   ├── MovementVisualRenderer.ts
│   │   ├── ShipHUDRenderer.ts
│   │   ├── ShipRenderer.ts
│   │   ├── ShieldArcRenderer.ts
│   │   ├── TargetMarkerRenderer.ts
│   │   └── WeaponArcRenderer.ts
│   ├── interactions/          # 交互处理
│   │   ├── InteractionHandler.ts
│   │   ├── useCanvasInteraction.ts
│   │   ├── useTokenSelection.ts
│   │   └── ZoomHandler.ts
│   ├── systems/               # 渲染系统
│   │   ├── CursorRenderer.ts
│   │   ├── GridRenderer.ts
│   │   ├── StarfieldBackground.ts
│   │   ├── StarfieldRenderer.ts
│   │   ├── useCamera.ts
│   │   └── useCameraAnimation.ts
│   └── index.ts
├── services/                  # 业务服务
│   ├── PresetCacheService.ts
│   ├── SystemService.ts
│   └── UserService.ts
├── state/                     # 状态管理
│   ├── stores/
│   │   ├── fireModeStore.ts
│   │   ├── gameStore.ts
│   │   ├── index.ts
│   │   └── uiStore.ts
│   └── hooks/                 # 自定义 hooks
├── styles/                    # 样式文件
│   ├── components.css
│   ├── design-system.css
│   ├── fonts.css
│   ├── game-panels.css
│   └── ui-components.css
├── styles.css                 # 全局样式
├── sync/                      # 数据同步
│   ├── GameClient.ts
│   ├── useCurrentGameRoom.ts
│   ├── useFireControl.ts
│   ├── useMultiplayerState.ts
│   ├── usePlayerProfile.ts
│   ├── index.ts
│   └── types.ts
├── test/                      # 测试
│   └── setup.ts
├── ui/                        # UI 组件
│   ├── overlays/              # 覆盖层
│   │   ├── ShipCustomizationModal.tsx
│   │   ├── WeaponCustomizationModal.tsx
│   │   └── ship-customization-modal.css
│   ├── panels/                # 面板组件
│   │   ├── BattleCommandPanel/
│   │   ├── CombatLogPanel.tsx
│   │   ├── CoordinateSettingsPanel.tsx
│   │   ├── CursorCoordinateInput.tsx
│   │   ├── ShipCustomizationPanel/
│   │   ├── ViewControlPanel.tsx
│   │   └── types.ts
│   └── shared/                # 共享组件
│       ├── CoordinateInput.tsx
│       ├── MagneticPointer.tsx
│       ├── Notification.tsx
│       └── notification.css
└── utils/                     # 工具函数
    ├── CombatLog.ts
    ├── coordinateSystem.ts
    └── math.ts
```

## 问题分析

### 1. 架构问题
- **状态管理分散**：Zustand store、React state、自定义 hooks 混合使用
- **组件耦合度高**：渲染引擎与业务逻辑紧密耦合
- **配置管理混乱**：硬编码配置与 `@vt/data` 配置混合

### 2. 代码质量问题
- **类型安全不足**：部分地方使用 `any` 类型
- **缺乏错误边界**：未处理渲染错误
- **性能问题**：频繁重渲染，缺乏优化

### 3. 数据流问题
- **数据同步复杂**：多层级数据传递
- **缓存策略缺失**：重复请求相同数据
- **状态更新混乱**：同步和异步状态混合

## 优化方案

### 第一阶段：架构重构（高优先级）

#### 1.1 状态管理统一
```
state/
├── core/              # 核心状态管理
│   ├── StoreProvider.tsx      # 状态提供者
│   ├── createStore.ts         # Store 工厂
│   └── storeTypes.ts          # 类型定义
├── game/              # 游戏状态
│   ├── gameStore.ts           # 游戏核心状态
│   ├── combatStore.ts         # 战斗状态
│   ├── movementStore.ts       # 移动状态
│   └── cameraStore.ts         # 相机状态
├── ui/                # UI 状态
│   ├── uiStore.ts             # UI 通用状态
│   ├── panelStore.ts          # 面板状态
│   └── notificationStore.ts   # 通知状态
├── network/           # 网络状态
│   ├── connectionStore.ts     # 连接状态
│   ├── roomStore.ts           # 房间状态
│   └── playerStore.ts         # 玩家状态
└── hooks/             # 状态 hooks
    ├── useGameState.ts
    ├── useUIState.ts
    └── useNetworkState.ts
```

#### 1.2 组件架构优化
```
components/
├── core/              # 核心组件
│   ├── AppShell.tsx           # 应用外壳
│   ├── ErrorBoundary.tsx      # 错误边界
│   └── LoadingFallback.tsx    # 加载回退
├── layout/            # 布局组件
│   ├── MainLayout.tsx         # 主布局
│   ├── GameLayout.tsx         # 游戏布局
│   └── PanelLayout.tsx        # 面板布局
├── game/              # 游戏组件
│   ├── GameCanvas.tsx         # 游戏画布
│   ├── GameControls.tsx       # 游戏控制
│   └── GameHUD.tsx            # 游戏 HUD
├── renderer/          # 渲染组件（重构）
│   ├── RenderEngine.tsx       # 渲染引擎
│   ├── entities/              # 实体组件
│   │   ├── ShipEntity.tsx
│   │   ├── WeaponEntity.tsx
│   │   └── EffectEntity.tsx
│   ├── systems/               # 渲染系统
│   │   ├── GridSystem.tsx
│   │   ├── CameraSystem.tsx
│   │   └── SelectionSystem.tsx
│   └── hooks/                 # 渲染 hooks
│       ├── useRenderer.ts
│       └── useEntityManager.ts
└── ui/                # UI 组件
    ├── panels/                # 面板
    ├── overlays/              # 覆盖层
    └── shared/                # 共享组件
```

### 第二阶段：数据流优化（中优先级）

#### 2.1 数据同步层
```
data/
├── sync/              # 数据同步
│   ├── SyncManager.ts         # 同步管理器
│   ├── DeltaSync.ts           # 增量同步
│   ├── DataValidator.ts       # 数据验证
│   └── syncHooks.ts           # 同步 hooks
├── cache/             # 数据缓存
│   ├── CacheManager.ts        # 缓存管理器
│   ├── PresetCache.ts         # 预设缓存
│   ├── PlayerCache.ts         # 玩家缓存
│   └── RoomCache.ts           # 房间缓存
├── config/            # 配置管理
│   ├── ConfigProvider.tsx     # 配置提供者
│   ├── useGameConfig.ts       # 游戏配置 hook
│   └── useServerConfig.ts     # 服务器配置 hook
└── validation/        # 数据验证
    ├── SchemaValidator.ts     # Schema 验证
    ├── DataRegistryAdapter.ts # DataRegistry 适配器
    └── validationHooks.ts     # 验证 hooks
```

#### 2.2 网络层优化
```
network/
├── core/              # 网络核心
│   ├── ConnectionManager.ts   # 连接管理
│   ├── WebSocketClient.ts     # WebSocket 客户端
│   └── ReconnectionManager.ts # 重连管理
├── services/          # 网络服务
│   ├── GameService.ts         # 游戏服务
│   ├── RoomService.ts         # 房间服务
│   ├── SystemService.ts       # 系统服务
│   └── ProfileService.ts       # 档案服务
├── commands/          # 命令系统
│   ├── CommandDispatcher.ts   # 命令分发器
│   ├── GameCommands.ts        # 游戏命令
│   ├── SystemCommands.ts      # 系统命令
│   └── CommandValidator.ts    # 命令验证
└── events/            # 事件系统
    ├── EventEmitter.ts        # 事件发射器
    ├── GameEvents.ts          # 游戏事件
    └── SystemEvents.ts        # 系统事件
```

### 第三阶段：性能优化（低优先级）

#### 3.1 渲染优化
```typescript
// 使用 React.memo 和 useMemo
const ShipEntity = React.memo(({ ship }: ShipEntityProps) => {
  const renderData = useMemo(() => {
    return calculateRenderData(ship);
  }, [ship]);
  
  return <ShipRenderer data={renderData} />;
});

// 虚拟列表
const VirtualShipList = ({ ships }: { ships: ShipJSON[] }) => {
  return (
    <VirtualList
      items={ships}
      renderItem={(ship) => <ShipListItem ship={ship} />}
      itemHeight={50}
    />
  );
};
```

#### 3.2 资源管理
```typescript
// 资源预加载
class ResourceManager {
  private textures = new Map<string, Texture>();
  private sounds = new Map<string, HTMLAudioElement>();
  
  async preload() {
    // 预加载纹理
    await this.loadTextures();
    // 预加载音效
    await this.loadSounds();
  }
  
  getTexture(id: string): Texture | undefined {
    return this.textures.get(id);
  }
}
```

#### 3.3 内存管理
```typescript
// 组件卸载清理
const useCleanup = () => {
  const cleanupRef = useRef<(() => void)[]>([]);
  
  useEffect(() => {
    return () => {
      cleanupRef.current.forEach(cleanup => cleanup());
      cleanupRef.current = [];
    };
  }, []);
  
  const addCleanup = useCallback((cleanup: () => void) => {
    cleanupRef.current.push(cleanup);
  }, []);
  
  return addCleanup;
};
```

## 实施步骤

### 第1周：基础架构
1. 创建新的目录结构
2. 实现统一状态管理
3. 创建核心组件

### 第2周：数据流重构
1. 实现数据同步层
2. 优化网络层
3. 集成 `@vt/data` 配置

### 第3周：组件迁移
1. 迁移渲染组件
2. 重构 UI 组件
3. 添加错误边界

### 第4周：性能优化
1. 实现渲染优化
2. 添加资源管理
3. 性能测试和调优

## 最佳实践

### 1. 组件设计原则
```typescript
// 单一职责
interface ShipRendererProps {
  ship: ShipJSON;
  onSelect?: (shipId: string) => void;
  isSelected?: boolean;
}

// 组合优于继承
const GameHUD = () => {
  return (
    <>
      <HealthBar />
      <WeaponPanel />
      <MovementControls />
    </>
  );
};
```

### 2. 状态管理
```typescript
// 使用 selector 避免不必要重渲染
const useSelectedShip = () => {
  return useGameStore(
    (state) => state.selectedShipId ? state.ships[state.selectedShipId] : null
  );
};

// 异步状态处理
const useAsyncData = <T,>(fetchFn: () => Promise<T>, deps: any[]) => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  
  useEffect(() => {
    fetchData();
  }, deps);
  
  return { data, loading, error };
};
```

### 3. 性能监控
```typescript
// 渲染性能监控
const useRenderPerformance = (componentName: string) => {
  const renderCount = useRef(0);
  const lastRenderTime = useRef(performance.now());
  
  useEffect(() => {
    renderCount.current++;
    const now = performance.now();
    const duration = now - lastRenderTime.current;
    
    if (duration > 16) { // 超过 60fps
      console.warn(`[${componentName}] Slow render: ${duration.toFixed(2)}ms`);
    }
    
    lastRenderTime.current = now;
  });
};
```

### 4. 错误处理
```typescript
// 错误边界组件
class GameErrorBoundary extends React.Component {
  state = { hasError: false, error: null };
  
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }
  
  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Game Error:', error, errorInfo);
    // 发送错误报告
  }
  
  render() {
    if (this.state.hasError) {
      return <ErrorFallback error={this.state.error} />;
    }
    return this.props.children;
  }
}
```

## 迁移策略

### 1. 渐进式迁移
- 新组件与旧组件并存
- 逐步替换功能模块
- 并行运行验证

### 2. 数据兼容
- 保持现有数据格式
- 提供数据转换工具
- 向后兼容 API

### 3. 测试策略
- 单元测试覆盖核心逻辑
- 集成测试验证数据流
- E2E 测试确保功能完整

### 4. 监控和回滚
- 监控关键性能指标
- 实时错误报告
- 快速回滚机制

## 技术栈建议

### 1. 状态管理
- **Zustand**：轻量级状态管理
- **React Query**：服务器状态管理
- **Immer**：不可变数据更新

### 2. 渲染优化
- **React.memo**：组件记忆化
- **useMemo/useCallback**：值/函数记忆化
- **Virtual List**：大数据列表渲染

### 3. 开发工具
- **React DevTools**：组件调试
- **Redux DevTools**：状态调试
- **Performance Profiler**：性能分析

### 4. 测试工具
- **Vitest**：单元测试
- **Testing Library**：组件测试
- **Playwright**：E2E 测试

通过这个优化方案，前端将获得更好的可维护性、性能和用户体验，为复杂游戏场景提供稳定支持。