/**
 * 服务器端点配置
 */

// ==================== 环境配置 ====================

const ENV = {
  // 开发环境
  DEVELOPMENT: {
    API_BASE_URL: 'http://localhost:3001',
    WS_BASE_URL: 'ws://localhost:3001',
    ASSETS_BASE_URL: 'http://localhost:3001/assets',
  },
  
  // 测试环境
  TEST: {
    API_BASE_URL: 'https://test.stfcs.example.com',
    WS_BASE_URL: 'wss://test.stfcs.example.com',
    ASSETS_BASE_URL: 'https://test.stfcs.example.com/assets',
  },
  
  // 生产环境
  PRODUCTION: {
    API_BASE_URL: 'https://stfcs.example.com',
    WS_BASE_URL: 'wss://stfcs.example.com',
    ASSETS_BASE_URL: 'https://stfcs.example.com/assets',
  },
} as const

// ==================== 当前环境 ====================

export const CURRENT_ENV = (() => {
  const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost'
  
  if (hostname.includes('localhost') || hostname.includes('127.0.0.1')) {
    return 'DEVELOPMENT' as const
  }
  
  if (hostname.includes('test.')) {
    return 'TEST' as const
  }
  
  return 'PRODUCTION' as const
})()

// ==================== 端点配置 ====================

export const ENDPOINTS = {
  // WebSocket端点
  WEBSOCKET: {
    // 主游戏WebSocket
    GAME: `${ENV[CURRENT_ENV].WS_BASE_URL}/ws`,
    
    // 聊天WebSocket
    CHAT: `${ENV[CURRENT_ENV].WS_BASE_URL}/chat`,
    
    // 通知WebSocket
    NOTIFICATIONS: `${ENV[CURRENT_ENV].WS_BASE_URL}/notifications`,
  },
  
  // REST API端点
  API: {
    // 认证相关
    AUTH: {
      LOGIN: `${ENV[CURRENT_ENV].API_BASE_URL}/api/auth/login`,
      LOGOUT: `${ENV[CURRENT_ENV].API_BASE_URL}/api/auth/logout`,
      REGISTER: `${ENV[CURRENT_ENV].API_BASE_URL}/api/auth/register`,
      REFRESH_TOKEN: `${ENV[CURRENT_ENV].API_BASE_URL}/api/auth/refresh`,
      PROFILE: `${ENV[CURRENT_ENV].API_BASE_URL}/api/auth/profile`,
    },
    
    // 房间相关
    ROOM: {
      LIST: `${ENV[CURRENT_ENV].API_BASE_URL}/api/rooms`,
      CREATE: `${ENV[CURRENT_ENV].API_BASE_URL}/api/rooms/create`,
      JOIN: (roomId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/rooms/${roomId}/join`,
      LEAVE: (roomId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/rooms/${roomId}/leave`,
      INFO: (roomId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/rooms/${roomId}`,
      PLAYERS: (roomId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/rooms/${roomId}/players`,
    },
    
    // 游戏相关
    GAME: {
      SAVE: `${ENV[CURRENT_ENV].API_BASE_URL}/api/game/save`,
      LOAD: (saveId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/game/load/${saveId}`,
      LIST_SAVES: `${ENV[CURRENT_ENV].API_BASE_URL}/api/game/saves`,
      DELETE_SAVE: (saveId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/game/saves/${saveId}`,
    },
    
    // 资产相关
    ASSETS: {
      UPLOAD: `${ENV[CURRENT_ENV].API_BASE_URL}/api/assets/upload`,
      LIST: `${ENV[CURRENT_ENV].API_BASE_URL}/api/assets`,
      GET: (assetId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/assets/${assetId}`,
      DELETE: (assetId: string) => `${ENV[CURRENT_ENV].API_BASE_URL}/api/assets/${assetId}`,
      AVATARS: `${ENV[CURRENT_ENV].API_BASE_URL}/api/assets/avatars`,
      TEXTURES: `${ENV[CURRENT_ENV].API_BASE_URL}/api/assets/textures`,
    },
    
    // 玩家相关
    PLAYER: {
      PROFILE: `${ENV[CURRENT_ENV].API_BASE_URL}/api/player/profile`,
      STATS: `${ENV[CURRENT_ENV].API_BASE_URL}/api/player/stats`,
      SETTINGS: `${ENV[CURRENT_ENV].API_BASE_URL}/api/player/settings`,
      SHIPS: `${ENV[CURRENT_ENV].API_BASE_URL}/api/player/ships`,
      WEAPONS: `${ENV[CURRENT_ENV].API_BASE_URL}/api/player/weapons`,
    },
    
    // 系统相关
    SYSTEM: {
      HEALTH: `${ENV[CURRENT_ENV].API_BASE_URL}/api/system/health`,
      VERSION: `${ENV[CURRENT_ENV].API_BASE_URL}/api/system/version`,
      STATS: `${ENV[CURRENT_ENV].API_BASE_URL}/api/system/stats`,
    },
  },
  
  // 静态资源端点
  ASSETS: {
    // 图片资源
    IMAGES: {
      AVATARS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/images/avatars`,
      TEXTURES: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/images/textures`,
      ICONS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/images/icons`,
      BACKGROUNDS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/images/backgrounds`,
    },
    
    // 声音资源
    SOUNDS: {
      EFFECTS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/sounds/effects`,
      MUSIC: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/sounds/music`,
      UI: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/sounds/ui`,
    },
    
    // 字体资源
    FONTS: {
      PRIMARY: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/fonts/primary.woff2`,
      SECONDARY: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/fonts/secondary.woff2`,
      ICONS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/fonts/icons.woff2`,
    },
    
    // 数据文件
    DATA: {
      SHIPS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/data/ships.json`,
      WEAPONS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/data/weapons.json`,
      MODS: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/data/mods.json`,
      RULES: `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/data/rules.json`,
    },
  },
} as const

// ==================== 工具函数 ====================

/**
 * 获取WebSocket URL
 */
export function getWebSocketUrl(path: string = ''): string {
  const baseUrl = ENDPOINTS.WEBSOCKET.GAME
  return path ? `${baseUrl}/${path}` : baseUrl
}

/**
 * 获取API URL
 */
export function getApiUrl(endpoint: string): string {
  return `${ENV[CURRENT_ENV].API_BASE_URL}${endpoint}`
}

/**
 * 获取资产URL
 */
export function getAssetUrl(path: string): string {
  return `${ENV[CURRENT_ENV].ASSETS_BASE_URL}/${path}`
}

/**
 * 检查端点可用性
 */
export async function checkEndpointHealth(): Promise<boolean> {
  try {
    const response = await fetch(ENDPOINTS.API.SYSTEM.HEALTH, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    })
    
    return response.ok
  } catch {
    return false
  }
}

/**
 * 获取服务器版本
 */
export async function getServerVersion(): Promise<string> {
  try {
    const response = await fetch(ENDPOINTS.API.SYSTEM.VERSION)
    const data = await response.json()
    return data.version || 'unknown'
  } catch {
    return 'unknown'
  }
}

// ==================== 环境工具 ====================

/**
 * 是否是开发环境
 */
export const IS_DEVELOPMENT = CURRENT_ENV === 'DEVELOPMENT'

/**
 * 是否是测试环境
 */
export const IS_TEST = CURRENT_ENV === 'TEST'

/**
 * 是否是生产环境
 */
export const IS_PRODUCTION = CURRENT_ENV === 'PRODUCTION'

/**
 * 获取环境名称
 */
export const ENVIRONMENT_NAME = CURRENT_ENV.toLowerCase()

// ==================== 导出类型 ====================

export type Environment = keyof typeof ENV
export type WebSocketEndpoint = keyof typeof ENDPOINTS.WEBSOCKET
export type ApiEndpoint = keyof typeof ENDPOINTS.API
export type AssetEndpoint = keyof typeof ENDPOINTS.ASSETS