/**
 * UI 常量配置
 */

export const UI_CONFIG = {
  // 颜色配置
  COLORS: {
    // 阵营颜色（Pixi格式）
    FACTION_PIXI: {
      PLAYER_ALLIANCE: 0x4fc3ff,
      FATE_GRIP: 0xff5d7e,
    },

    // 阵营颜色（CSS格式）
    FACTION: {
      PLAYER_ALLIANCE: '#4fc3ff',
      FATE_GRIP: '#ff5d7e',
    },

    // 武器伤害类型颜色（Pixi格式）
    DAMAGE_TYPE_PIXI: {
      KINETIC: 0xffd700,
      HIGH_EXPLOSIVE: 0xff6b35,
      ENERGY: 0x7b68ee,
      FRAGMENTATION: 0x32cd32,
    } as const,

    // 武器伤害类型颜色（CSS格式）
    DAMAGE_TYPE: {
      KINETIC: '#ffd700',
      HIGH_EXPLOSIVE: '#ff6b35',
      ENERGY: '#7b68ee',
      FRAGMENTATION: '#32cd32',
    } as const,

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
