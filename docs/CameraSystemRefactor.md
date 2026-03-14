/**
 * 相机系统重构方案
 * 
 * 目标：
 * 1. 统一前后端相机数据结构
 * 2. 简化前端相机状态管理
 * 3. 清晰的职责分离
 */

// ==================== 共享类型定义 ====================

/**
 * 统一相机状态（共享包）
 * 所有相机相关数据都使用这个结构
 */
export interface CameraState {
  /** 相机中心 X 坐标（世界坐标） */
  centerX: number;
  /** 相机中心 Y 坐标（世界坐标） */
  centerY: number;
  /** 缩放级别（1 = 100%） */
  zoom: number;
  /** 旋转角度（度） */
  rotation: number;
  /** 最小缩放 */
  minZoom: number;
  /** 最大缩放 */
  maxZoom: number;
}

/**
 * 玩家相机（用于多人同步）
 * 继承基础相机状态，添加玩家信息
 */
export interface PlayerCamera extends CameraState {
  playerId: string;
  playerName: string;
  timestamp: number;
}

/**
 * 相机更新命令（用于请求/响应）
 */
export interface CameraUpdateCommand {
  centerX?: number;
  centerY?: number;
  zoom?: number;
  rotation?: number;
}

// ==================== 前端实现建议 ====================

/**
 * Redux Slice - 相机状态管理
 * 
 * 原则：
 * 1. 单一数据源 - 只在 Redux 存储相机状态
 * 2. 操作集中化 - 所有相机操作都通过 action
 */
interface CameraSliceState {
  // 本地玩家相机
  local: CameraState;
  // 其他玩家相机（按玩家 ID 索引）
  remote: Record<string, PlayerCamera>;
}

const cameraSlice = createSlice({
  name: 'camera',
  initialState: {
    local: {
      centerX: 0,
      centerY: 0,
      zoom: 1,
      rotation: 0,
      minZoom: 0.5,
      maxZoom: 4,
    },
    remote: {},
  } as CameraSliceState,
  reducers: {
    // 更新本地相机（完全替换）
    setCamera: (state, action: PayloadAction<Partial<CameraState>>) => {
      state.local = { ...state.local, ...action.payload };
    },
    
    // 相对移动相机
    panCamera: (state, action: PayloadAction<{ dx: number; dy: number }>) => {
      state.local.centerX += action.payload.dx;
      state.local.centerY += action.payload.dy;
    },
    
    // 更新远程玩家相机
    updateRemoteCamera: (state, action: PayloadAction<PlayerCamera>) => {
      state.remote[action.payload.playerId] = action.payload;
    },
    
    // 移除远程玩家相机
    removeRemoteCamera: (state, action: PayloadAction<string>) => {
      delete state.remote[action.payload];
    },
  },
});

/**
 * 相机 Hook - 统一相机操作接口
 * 
 * 使用方式：
 * const camera = useCamera();
 * camera.pan(100, 100);
 * camera.zoomIn();
 */
export function useCamera() {
  const dispatch = useAppDispatch();
  const camera = useAppSelector((state) => state.camera.local);

  // 设置相机
  const setCamera = useCallback((updates: Partial<CameraState>) => {
    dispatch(cameraActions.setCamera(updates));
  }, [dispatch]);

  // 相对移动
  const pan = useCallback((dx: number, dy: number) => {
    dispatch(cameraActions.panCamera({ dx, dy }));
  }, [dispatch]);

  // 缩放
  const zoomTo = useCallback((zoom: number) => {
    const clamped = Math.max(camera.minZoom, Math.min(camera.maxZoom, zoom));
    dispatch(cameraActions.setCamera({ zoom: clamped }));
  }, [dispatch, camera.minZoom, camera.maxZoom]);

  const zoomIn = useCallback((factor = 1.2) => {
    zoomTo(camera.zoom * factor);
  }, [zoomTo, camera.zoom]);

  const zoomOut = useCallback((factor = 1.2) => {
    zoomTo(camera.zoom / factor);
  }, [zoomTo, camera.zoom]);

  // 居中到点
  const centerOn = useCallback((x: number, y: number) => {
    dispatch(cameraActions.setCamera({ centerX: x, centerY: y }));
  }, [dispatch]);

  return {
    // 状态
    ...camera,
    
    // 方法
    setCamera,
    pan,
    zoomTo,
    zoomIn,
    zoomOut,
    centerOn,
    
    // 工具方法
    screenToWorld: useCallback((screenX: number, screenY: number) => ({
      x: screenX / camera.zoom + camera.centerX,
      y: screenY / camera.zoom + camera.centerY,
    }), [camera.zoom, camera.centerX, camera.centerY]),
    
    worldToScreen: useCallback((worldX: number, worldY: number) => ({
      x: (worldX - camera.centerX) * camera.zoom,
      y: (worldY - camera.centerY) * camera.zoom,
    }), [camera.zoom, camera.centerX, camera.centerY]),
  };
}

/**
 * Pixi 画布组件 - 只负责渲染
 * 
 * 原则：
 * 1. 不管理状态 - 所有状态来自 props
 * 2. 事件通过回调通知父组件
 */
interface GameCanvasProps {
  camera: CameraState;
  onCameraChange: (camera: Partial<CameraState>) => void;
  tokens: TokenInfo[];
  // ... 其他渲染所需数据
}

const GameCanvas: React.FC<GameCanvasProps> = ({
  camera,
  onCameraChange,
  tokens,
}) => {
  const canvasRef = useRef<HTMLDivElement>(null);
  const appRef = useRef<Application | null>(null);
  
  // 使用 camera 作为唯一数据源
  useEffect(() => {
    if (stageRef.current) {
      // 更新舞台变换
      stageRef.current.position.set(
        canvasWidth / 2 - camera.centerX * camera.zoom,
        canvasHeight / 2 - camera.centerY * camera.zoom
      );
      stageRef.current.scale.set(camera.zoom);
      stageRef.current.rotation = (camera.rotation * Math.PI) / 180;
    }
  }, [camera]);
  
  // 交互处理
  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      event.preventDefault();
      
      const zoomFactor = event.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = Math.max(camera.minZoom, Math.min(camera.maxZoom, camera.zoom * zoomFactor));
      
      // 计算新的中心点（保持鼠标位置不变）
      const rect = canvasRef.current!.getBoundingClientRect();
      const mouseX = event.clientX - rect.left;
      const mouseY = event.clientY - rect.top;
      
      const worldX = (mouseX - canvasWidth / 2) / camera.zoom + camera.centerX;
      const worldY = (mouseY - canvasHeight / 2) / camera.zoom + camera.centerY;
      
      const newCenterX = worldX - (mouseX - canvasWidth / 2) / newZoom;
      const newCenterY = worldY - (mouseY - canvasHeight / 2) / newZoom;
      
      // 通知父组件
      onCameraChange({
        centerX: newCenterX,
        centerY: newCenterY,
        zoom: newZoom,
      });
    };
    
    canvasRef.current!.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvasRef.current!.removeEventListener('wheel', handleWheel);
  }, [camera, onCameraChange]);
  
  return <div ref={canvasRef} />;
};

// ==================== 后端实现建议 ====================

/**
 * 后端相机服务
 */
class CameraService {
  /**
   * 更新玩家相机
   */
  async updatePlayerCamera(
    roomId: string,
    playerId: string,
    update: CameraUpdateCommand
  ): Promise<PlayerCamera> {
    const room = await this.roomManager.getRoom(roomId);
    const player = await this.playerManager.getPlayer(playerId);
    
    // 获取或创建玩家相机
    let camera = room.getPlayerCamera(playerId);
    if (!camera) {
      camera = {
        playerId,
        playerName: player.name,
        centerX: 0,
        centerY: 0,
        zoom: 1,
        rotation: 0,
        minZoom: 0.5,
        maxZoom: 4,
        timestamp: Date.now(),
      };
    }
    
    // 应用更新
    camera = {
      ...camera,
      ...update,
      timestamp: Date.now(),
    };
    
    // 验证
    this.validateCamera(camera);
    
    // 保存并广播
    room.updatePlayerCamera(camera);
    this.broadcastCameraUpdate(room, camera);
    
    return camera;
  }
  
  /**
   * 验证相机状态
   */
  private validateCamera(camera: CameraState): void {
    if (camera.zoom < camera.minZoom || camera.zoom > camera.maxZoom) {
      throw new Error(`Zoom must be between ${camera.minZoom} and ${camera.maxZoom}`);
    }
    if (camera.zoom <= 0) {
      throw new Error('Zoom must be positive');
    }
  }
  
  /**
   * 广播相机更新
   */
  private broadcastCameraUpdate(room: Room, camera: PlayerCamera): void {
    room.broadcast({
      type: WS_MESSAGE_TYPES.CAMERA_UPDATED,
      payload: camera,
    });
  }
}

/**
 * WebSocket 消息处理器
 */
class MessageHandler {
  async handleCameraUpdate(
    clientId: string,
    data: CameraUpdateCommand
  ): Promise<void> {
    const room = await this.get_player_room(clientId);
    if (!room) {
      throw new Error('Player not in a room');
    }
    
    await this.cameraService.updatePlayerCamera(room.id, clientId, data);
  }
}

// ==================== 使用示例 ====================

/**
 * GameView 组件 - 连接所有部分
 */
const GameView: React.FC = () => {
  const camera = useCamera();
  
  const handleCameraChange = useCallback((updates: Partial<CameraState>) => {
    camera.setCamera(updates);
  }, [camera]);
  
  return (
    <div className="game-view">
      <TopBar>
        <ZoomIndicator zoom={camera.zoom} />
      </TopBar>
      
      <GameCanvas
        camera={camera}
        onCameraChange={handleCameraChange}
        tokens={tokens}
      />
      
      <MiniMap
        camera={camera}
        tokens={tokens}
      />
    </div>
  );
};
