/**
 * 统一图标组件
 * 
 * 包装 lucide-react 图标，提供一致的尺寸和颜色控制
 * - size: sm (14px), md (16px), lg (24px)
 * - color: 通过 CSS 类控制，默认继承父元素颜色
 */

import React from 'react';
import * as LucideIcons from 'lucide-react';

type IconName = keyof typeof LucideIcons;

interface GameIconProps {
  icon: IconName;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 20,
  xl: 24,
};

export const GameIcon: React.FC<GameIconProps> = ({
  icon,
  size = 'sm',
  className = '',
  style,
}) => {
  const IconComponent = LucideIcons[icon] as React.ComponentType<{ 
    className?: string; 
    style?: React.CSSProperties;
    size?: number;
  }>;
  
  if (!IconComponent) {
    return null;
  }
  
  return (
    <IconComponent 
      className={`game-icon game-icon--${size} ${className}`}
      style={style}
      size={sizeMap[size]}
    />
  );
};

export default GameIcon;

export const ICONS = {
  rocket: 'Rocket',
  shield: 'Shield',
  zap: 'Zap',
  crosshair: 'Crosshair',
  heart: 'Heart',
  gauge: 'Gauge',
  barChart: 'BarChart3',
  sparkles: 'Sparkles',
  bomb: 'Bomb',
  activity: 'Activity',
  mapPin: 'MapPin',
  compass: 'Compass',
  user: 'User',
  crown: 'Crown',
  fastForward: 'FastForward',
  settings: 'Settings',
  users: 'Users',
  logOut: 'LogOut',
  palette: 'Palette',
  check: 'Check',
  wind: 'Wind',
  grid: 'Grid3X3',
  zoomIn: 'ZoomIn',
  zoomOut: 'ZoomOut',
  rotateCcw: 'RotateCcw',
  x: 'X',
  plus: 'Plus',
  minus: 'Minus',
  edit: 'Edit',
  trash: 'Trash2',
  eye: 'Eye',
  eyeOff: 'EyeOff',
  info: 'Info',
  alertTriangle: 'AlertTriangle',
  checkCircle: 'CheckCircle',
  helpCircle: 'HelpCircle',
  target: 'Target',
  sword: 'Sword',
  move: 'Move',
  clock: 'Clock',
  chevronLeft: 'ChevronLeft',
  chevronRight: 'ChevronRight',
  chevronUp: 'ChevronUp',
  chevronDown: 'ChevronDown',
  anchor: 'Anchor',
  ship: 'Ship',
  anchorSimple: 'AnchorSimpleIcon',
} as const;