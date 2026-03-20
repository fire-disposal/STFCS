/**
 * 坐标和角度指示器
 *
 * 显示：
 * - 鼠标位置坐标
 * - 选中 Token 的朝向
 * - 网格坐标
 */

import React from 'react';
import type { Point } from '@vt/shared/types';

// ==================== 样式 ====================

const styles = {
  container: {
    position: 'absolute' as const,
    bottom: '16px',
    left: '16px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
    pointerEvents: 'none' as const,
  },
  card: {
    backgroundColor: 'rgba(15, 18, 25, 0.9)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '6px',
    padding: '8px 12px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  icon: {
    fontSize: '14px',
  },
  label: {
    fontSize: '11px',
    color: '#888888',
    minWidth: '50px',
  },
  value: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#ffffff',
    fontFamily: 'monospace',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  separator: {
    width: '1px',
    height: '16px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
};

// ==================== Props ====================

interface CoordinateIndicatorProps {
  /** 鼠标位置（世界坐标） */
  mousePosition?: Point;
  /** 相机位置 */
  cameraPosition?: Point;
  /** 缩放级别 */
  zoom?: number;
  /** 选中 Token 的朝向 */
  selectedTokenHeading?: number;
  /** 是否显示网格坐标 */
  showGridCoordinates?: boolean;
  /** 网格大小 */
  gridSize?: number;
}

// ==================== Component ====================

export const CoordinateIndicator: React.FC<CoordinateIndicatorProps> = ({
  mousePosition,
  cameraPosition,
  zoom = 1,
  selectedTokenHeading,
  showGridCoordinates = true,
  gridSize = 50,
}) => {
  // 计算网格坐标
  const gridCoords = mousePosition && showGridCoordinates ? {
    x: Math.floor(mousePosition.x / gridSize),
    y: Math.floor(mousePosition.y / gridSize),
  } : null;

  return (
    <div style={styles.container}>
      {/* 鼠标坐标 */}
      {mousePosition && (
        <div style={styles.card}>
          <span style={styles.icon}>🎯</span>
          <span style={styles.label}>鼠标</span>
          <span style={styles.value}>
            ({Math.round(mousePosition.x)}, {Math.round(mousePosition.y)})
          </span>
          {gridCoords && (
            <>
              <div style={styles.separator} />
              <span style={styles.label}>网格</span>
              <span style={styles.value}>
                [{gridCoords.x}, {gridCoords.y}]
              </span>
            </>
          )}
        </div>
      )}

      {/* 相机信息 */}
      {cameraPosition && (
        <div style={styles.card}>
          <span style={styles.icon}>📷</span>
          <span style={styles.label}>相机</span>
          <span style={styles.value}>
            ({Math.round(cameraPosition.x)}, {Math.round(cameraPosition.y)})
          </span>
          <div style={styles.separator} />
          <span style={styles.label}>缩放</span>
          <span style={styles.value}>
            {(zoom * 100).toFixed(0)}%
          </span>
        </div>
      )}

      {/* 选中 Token 朝向 */}
      {selectedTokenHeading !== undefined && (
        <div style={styles.card}>
          <span style={styles.icon}>🧭</span>
          <span style={styles.label}>朝向</span>
          <span style={styles.value}>
            {selectedTokenHeading}°
          </span>
          <span style={{ fontSize: '11px', color: '#888888' }}>
            ({getDirectionName(selectedTokenHeading)})
          </span>
        </div>
      )}
    </div>
  );
};

// ==================== 辅助函数 ====================

/** 获取方向名称 */
function getDirectionName(heading: number): string {
  // 标准化到 0-360
  const normalized = ((heading % 360) + 360) % 360;

  if (normalized >= 337.5 || normalized < 22.5) return '北';
  if (normalized >= 22.5 && normalized < 67.5) return '东北';
  if (normalized >= 67.5 && normalized < 112.5) return '东';
  if (normalized >= 112.5 && normalized < 157.5) return '东南';
  if (normalized >= 157.5 && normalized < 202.5) return '南';
  if (normalized >= 202.5 && normalized < 247.5) return '西南';
  if (normalized >= 247.5 && normalized < 292.5) return '西';
  if (normalized >= 292.5 && normalized < 337.5) return '西北';
  return '';
}

export default CoordinateIndicator;