/**
 * 设计令牌 - 统一颜色方案
 * 基于UI/UX问题清单统一视觉语言
 */
export const DesignTokens = {
  // 主品牌色
  brand: {
    primary: '#3498db',
    secondary: '#2ecc71',
    accent: '#e74c3c',
    warning: '#f39c12',
    info: '#9b59b6',
    success: '#27ae60',
    error: '#e74c3c',
    neutral: '#95a5a6'
  },

  // 舰船/作战相关色彩
  combat: {
    friend: '#44ff44',      // 友军标记
    enemy: '#ff4444',       // 敌方标记
    neutral: '#ffff44',     // 中立标记
    ally: '#4444ff',        // 盟友
    hostile: '#ff4444'      // 敌对单位
  },

  // 防护系统
  shields: {
    full: '#88FF88',        // 完整护盾
    high: '#FFFF88',        // 高护盾
    medium: '#FFAA44',      // 中等护盾
    low: '#FF4444',         // 低护盾
    energy: '#4488FF',      // 能量/效率色
    efficiency: {
      high: '#88FF88',
      normal: '#FFFF88', 
      low: '#FF4444'
    }
  },

  // fluc指示器颜色
  flux: {
    good: '#44ff44',
    warning: '#ffff44',
    danger: '#ff4444',
    overheating: '#ffaaaa'
  },

  // 舰船类别/分类颜色
  categories: {
    capital: '#4488FF',
    frigate: '#88BBFF',
    corvette: '#AACCEE',
    support: '#AACC88',
    fighter: '#FFAA44',
    station: '#CCAAFF'
  },

  // 地形和地图颜色
  map: {
    grid: '#27408B',
    fog: '#0a0a1a',
    boundary: '#4169E1',
    selection: '#FFFF00',   // 选择框
    path: '#00FFFF'
  },

  // 文本颜色
  text: {
    primary: '#e0e0e0',
    secondary: '#a0a0a0',
    disabled: '#707070',
    heading: '#ffffff',
    body: '#b0b0b0',
    contrast: '#000000'     // 黑色反差文本
  },

  // 背景颜色
  backgrounds: {
    primary: '#0a0a1a',
    secondary: '#1a1a2e',
    overlay: 'rgba(10, 10, 30, 0.9)',
    modal: 'rgba(26, 26, 46, 0.95)',
    surface: '#16213e'
  },

  // 边框和强调
  borders: {
    strong: 'rgba(100, 100, 150, 0.3)',
    weak: 'rgba(100, 100, 150, 0.1)',
    accent: '#aaccff',
    selected: '#ffff00',
    focused: '#4488ff',
    hovered: '#aaccff'
  }
} as const

// 导出类型定义
export type DesignTokensType = typeof DesignTokens