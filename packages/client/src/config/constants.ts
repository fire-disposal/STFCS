/**
 * 应用常量配置
 */

// ==================== 网络配置 ====================

export const NETWORK_CONFIG = {
  // WebSocket配置
  WEBSOCKET: {
    // 重连配置
    MAX_RECONNECT_ATTEMPTS: 10,
    RECONNECT_BASE_DELAY: 1000, // 1秒
    RECONNECT_MAX_DELAY: 30000, // 30秒
    
    // 心跳配置
    HEARTBEAT_INTERVAL: 30000, // 30秒
    HEARTBEAT_TIMEOUT: 10000, // 10秒
    
    // 消息队列
    MAX_QUEUE_SIZE: 1000,
    
    // 连接超时
    CONNECT_TIMEOUT: 10000, // 10秒
  },
  
  // 协议版本
  PROTOCOL_VERSION: '1.0.0',
  
  // 消息类型
  MESSAGE_TYPES: {
    // 连接/会话
    CONNECT: 'connect',
    CONNECTED: 'connected',
    HEARTBEAT: 'heartbeat',
    HEARTBEAT_ACK: 'heartbeat_ack',
    DISCONNECT: 'disconnect',
    
    // 房间管理
    ROOM_LIST: 'room:list',
    ROOM_LIST_RESULT: 'room:list_result',
    ROOM_CREATE: 'room:create',
    ROOM_CREATED: 'room:created',
    ROOM_JOIN: 'room:join',
    ROOM_JOINED: 'room:joined',
    ROOM_LEAVE: 'room:leave',
    ROOM_LEFT: 'room:left',
    
    // 游戏命令
    GAME_MOVE: 'game:move',
    GAME_ROTATE: 'game:rotate',
    GAME_ATTACK: 'game:attack',
    GAME_TOGGLE_SHIELD: 'game:toggle_shield',
    GAME_VENT_FLUX: 'game:vent_flux',
    GAME_END_TURN: 'game:end_turn',
    GAME_COMMAND_RESULT: 'game:command_result',
    
    // 状态同步
    STATE_FULL: 'state:full',
    STATE_DELTA: 'state:delta',
    EVENT: 'event',
    
    // 错误
    ERROR: 'error',
  } as const,
} as const

// ==================== 游戏配置 ====================

export const GAME_CONFIG = {
  // 地图配置
  MAP: {
    DEFAULT_WIDTH: 10000,
    DEFAULT_HEIGHT: 10000,
    GRID_SIZE: 100,
  },
  
  // 相机配置
  CAMERA: {
    MIN_ZOOM: 0.1,
    MAX_ZOOM: 5,
    DEFAULT_ZOOM: 1,
    ZOOM_SPEED: 0.1,
    PAN_SPEED: 1,
  },
  
  // 舰船配置
  SHIP: {
    DEFAULT_SPEED: 100,
    ROTATION_SPEED: 90, // 度/秒
    SELECTION_RADIUS: 50,
  },
  
  // 武器配置
  WEAPON: {
    DEFAULT_RANGE: 1000,
    DEFAULT_DAMAGE: 10,
    COOLDOWN_TIME: 1000, // 毫秒
  },
} as const

// ==================== UI配置 ====================

export const UI_CONFIG = {
  // 颜色配置
  COLORS: {
    // 阵营颜色
    FACTION: {
      PLAYER: '#4CAF50', // 绿色
      ENEMY: '#F44336',  // 红色
      NEUTRAL: '#9E9E9E', // 灰色
    },
    
    // UI颜色
    UI: {
      PRIMARY: '#2196F3',
      SECONDARY: '#FF9800',
      SUCCESS: '#4CAF50',
      ERROR: '#F44336',
      WARNING: '#FFC107',
      INFO: '#00BCD4',
    },
    
    // 状态颜色
    STATUS: {
      HEALTH: '#4CAF50',
      SHIELD: '#2196F3',
      FLUX: '#FF9800',
      OVERLOAD: '#F44336',
    },
  },
  
  // 字体配置
  FONTS: {
    FAMILY: 'Arial, sans-serif',
    SIZES: {
      SMALL: '12px',
      MEDIUM: '14px',
      LARGE: '16px',
      XLARGE: '20px',
    },
  },
  
  // 动画配置
  ANIMATIONS: {
    DURATION: {
      FAST: 150,
      NORMAL: 300,
      SLOW: 500,
    },
    EASING: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  
  // 布局配置
  LAYOUT: {
    // 面板宽度
    PANELS: {
      LEFT: 300,
      RIGHT: 300,
      BOTTOM: 200,
    },
    
    // 间距
    SPACING: {
      SMALL: '8px',
      MEDIUM: '16px',
      LARGE: '24px',
    },
  },
} as const

// ==================== 性能配置 ====================

export const PERFORMANCE_CONFIG = {
  // 渲染配置
  RENDER: {
    MAX_FPS: 60,
    TARGET_FPS: 60,
    FRAME_TIME: 16.67, // 1000 / 60
    
    // 实体限制
    MAX_ENTITIES: 1000,
    MAX_PARTICLES: 10000,
    
    // 批处理大小
    BATCH_SIZE: 100,
  },
  
  // 状态管理配置
  STATE: {
    // 状态快照
    MAX_SNAPSHOTS: 50,
    SNAPSHOT_INTERVAL: 1000, // 毫秒
    
    // 订阅优化
    DEBOUNCE_TIME: 16, // 约60fps
  },
  
  // 内存配置
  MEMORY: {
    // 纹理缓存
    MAX_TEXTURE_CACHE: 50,
    TEXTURE_CACHE_TIMEOUT: 300000, // 5分钟
    
    // 几何缓存
    MAX_GEOMETRY_CACHE: 100,
    
    // 对象池
    MAX_POOL_SIZE: 1000,
  },
} as const

// ==================== 开发配置 ====================

export const DEVELOPMENT_CONFIG = {
  // 调试模式
  DEBUG: {
    ENABLED: process.env.NODE_ENV === 'development',
    
    // 调试功能
    FEATURES: {
      SHOW_FPS: true,
      SHOW_STATS: true,
      SHOW_HITBOXES: false,
      SHOW_DEBUG_INFO: false,
      ENABLE_CONSOLE_LOGS: true,
    },
    
    // 性能监控
    PERFORMANCE: {
      ENABLE_PROFILING: true,
      PROFILE_INTERVAL: 1000, // 毫秒
      LOG_THRESHOLDS: {
        FPS: 30,
        MEMORY: 500, // MB
        LATENCY: 100, // 毫秒
      },
    },
  },
  
  // 模拟配置
  SIMULATION: {
    // 网络模拟
    NETWORK: {
      ENABLED: false,
      LATENCY: 0, // 毫秒
      JITTER: 0, // 毫秒
      PACKET_LOSS: 0, // 百分比
    },
    
    // 性能测试
    STRESS_TEST: {
      ENABLED: false,
      ENTITY_COUNT: 100,
      UPDATE_FREQUENCY: 60, // Hz
    },
  },
} as const

// ==================== 导出类型 ====================

export type MessageType = typeof NETWORK_CONFIG.MESSAGE_TYPES[keyof typeof NETWORK_CONFIG.MESSAGE_TYPES]
export type FactionColor = keyof typeof UI_CONFIG.COLORS.FACTION
export type UIColor = keyof typeof UI_CONFIG.COLORS.UI
export type StatusColor = keyof typeof UI_CONFIG.COLORS.STATUS