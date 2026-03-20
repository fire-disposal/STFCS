/**
 * 部署区域显示组件
 *
 * 在画布上显示部署区域：
 * - 区域边界
 * - 区域颜色
 * - 区域标签
 */

import React, { useMemo } from 'react';
import type { DeploymentZone, DeployedShip } from './DeploymentManager';
import type { FactionId } from '@vt/shared/types';

// 样式
const styles = {
  container: {
    position: 'absolute' as const,
    pointerEvents: 'none' as const,
  },
  zoneOverlay: {
    position: 'absolute' as const,
    border: '2px dashed',
    borderRadius: '8px',
    opacity: 0.3,
    transition: 'all 0.3s ease',
  },
  zoneLabel: {
    position: 'absolute' as const,
    top: '-24px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '4px 12px',
    borderRadius: '4px',
    fontSize: '12px',
    fontWeight: 'bold',
    whiteSpace: 'nowrap' as const,
    textShadow: '0 1px 2px rgba(0, 0, 0, 0.5)',
  },
  shipCount: {
    position: 'absolute' as const,
    bottom: '-20px',
    left: '50%',
    transform: 'translateX(-50%)',
    padding: '2px 8px',
    borderRadius: '4px',
    fontSize: '10px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    color: 'white',
  },
};

// 阵营颜色
const factionColors: Record<string, { primary: string; secondary: string }> = {
  hegemony: { primary: '#4a90d9', secondary: 'rgba(74, 144, 217, 0.2)' },
  sindrian: { primary: '#d4af37', secondary: 'rgba(212, 175, 55, 0.2)' },
  persean: { primary: '#2ecc71', secondary: 'rgba(46, 204, 113, 0.2)' },
  tri_tachyon: { primary: '#9b59b6', secondary: 'rgba(155, 89, 182, 0.2)' },
  pirate: { primary: '#e74c3c', secondary: 'rgba(231, 76, 60, 0.2)' },
  independent: { primary: '#95a5a6', secondary: 'rgba(149, 165, 166, 0.2)' },
};

// 阵营名称
const factionNames: Record<string, string> = {
  hegemony: '霸主',
  sindrian: '辛德里亚',
  persean: '珀尔修斯',
  tri_tachyon: '三叠纪',
  pirate: '海盗',
  independent: '独立',
};

interface DeploymentZoneDisplayProps {
  zones: DeploymentZone[];
  deployedShips: DeployedShip[];
  currentFaction: FactionId | null;
  zoom: number;
  offset: { x: number; y: number };
  showLabels?: boolean;
  showShipCount?: boolean;
}

export const DeploymentZoneDisplay: React.FC<DeploymentZoneDisplayProps> = ({
  zones,
  deployedShips,
  currentFaction,
  zoom,
  offset,
  showLabels = true,
  showShipCount = true,
}) => {
  // 计算每个区域的舰船数量
  const shipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const ship of deployedShips) {
      counts[ship.factionId] = (counts[ship.factionId] || 0) + 1;
    }
    return counts;
  }, [deployedShips]);

  // 渲染单个区域
  const renderZone = (zone: DeploymentZone) => {
    const colors = factionColors[zone.factionId] || factionColors.independent;
    const isCurrentFaction = zone.factionId === currentFaction;
    const shipCount = shipCounts[zone.factionId] || 0;

    // 计算屏幕坐标
    const screenX = zone.bounds.minX * zoom + offset.x;
    const screenY = zone.bounds.minY * zoom + offset.y;
    const width = (zone.bounds.maxX - zone.bounds.minX) * zoom;
    const height = (zone.bounds.maxY - zone.bounds.minY) * zoom;

    return (
      <div
        key={zone.factionId}
        style={{
          ...styles.zoneOverlay,
          left: screenX,
          top: screenY,
          width,
          height,
          borderColor: colors.primary,
          backgroundColor: colors.secondary,
          opacity: isCurrentFaction ? 0.5 : 0.3,
          boxShadow: isCurrentFaction ? `0 0 20px ${colors.primary}40` : 'none',
        }}
      >
        {/* 区域标签 */}
        {showLabels && (
          <div
            style={{
              ...styles.zoneLabel,
              backgroundColor: colors.primary,
              color: 'white',
            }}
          >
            {factionNames[zone.factionId] || zone.factionId}
            {zone.label && ` - ${zone.label}`}
          </div>
        )}

        {/* 舰船数量 */}
        {showShipCount && (
          <div style={styles.shipCount}>
            {shipCount} 艘舰船
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={styles.container}>
      {zones.map(renderZone)}
    </div>
  );
};

/**
 * 部署区域渲染器（用于PixiJS）
 */
export class DeploymentZoneRenderer {
  private graphics: PIXI.Graphics | null = null;

  /**
   * 绘制部署区域
   */
  drawZones(
    graphics: PIXI.Graphics,
    zones: DeploymentZone[],
    currentFaction: FactionId | null
  ): void {
    graphics.clear();

    for (const zone of zones) {
      const colors = factionColors[zone.factionId] || factionColors.independent;
      const isCurrentFaction = zone.factionId === currentFaction;

      const { minX, maxX, minY, maxY } = zone.bounds;
      const width = maxX - minX;
      const height = maxY - minY;

      // 绘制填充
      graphics.rect(minX, minY, width, height);
      graphics.fill({
        color: parseInt(colors.primary.replace('#', ''), 16),
        alpha: isCurrentFaction ? 0.2 : 0.1,
      });

      // 绘制边框
      graphics.rect(minX, minY, width, height);
      graphics.stroke({
        color: parseInt(colors.primary.replace('#', ''), 16),
        width: isCurrentFaction ? 3 : 2,
        alpha: isCurrentFaction ? 0.8 : 0.5,
      });

      // 如果是当前阵营，添加发光效果
      if (isCurrentFaction) {
        graphics.rect(minX - 2, minY - 2, width + 4, height + 4);
        graphics.stroke({
          color: parseInt(colors.primary.replace('#', ''), 16),
          width: 1,
          alpha: 0.3,
        });
      }
    }
  }

  /**
   * 清除绘制
   */
  clear(graphics: PIXI.Graphics): void {
    graphics.clear();
  }
}

export default DeploymentZoneDisplay;