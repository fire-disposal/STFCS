/**
 * 舰船选择器组件
 *
 * 显示可部署的舰船列表，支持按阵营筛选
 */

import React, { useMemo } from 'react';
import type { ShipDefinition, HullSize, FactionId } from '@vt/contracts';

// 样式
const styles = {
  container: {
    flex: 1,
    overflow: 'auto',
    padding: '8px',
  },
  shipList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  shipCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '1px solid transparent',
  },
  shipCardHover: {
    backgroundColor: 'var(--color-surface-hover)',
    borderColor: 'var(--color-primary)',
  },
  shipIcon: {
    width: '48px',
    height: '48px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-surface-dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    fontSize: '24px',
  },
  shipInfo: {
    flex: 1,
  },
  shipName: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  shipDetails: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
  },
  shipCost: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--color-primary)',
  },
  categoryTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--color-text-secondary)',
    padding: '8px 0',
    marginTop: '8px',
    borderBottom: '1px solid var(--color-border)',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center' as const,
    color: 'var(--color-text-secondary)',
  },
};

// 舰船尺寸图标映射
const hullSizeIcons: Record<HullSize, string> = {
  FIGHTER: '✈️',
  FRIGATE: '🚀',
  DESTROYER: '🛡️',
  CRUISER: '⚔️',
  CAPITAL: '🏛️',
};

// 舰船尺寸显示名称
const hullSizeNames: Record<HullSize, string> = {
  FIGHTER: '战机',
  FRIGATE: '护卫舰',
  DESTROYER: '驱逐舰',
  CRUISER: '巡洋舰',
  CAPITAL: '主力舰',
};

interface ShipSelectorProps {
  faction: FactionId | null;
  ships?: ShipDefinition[];
  onSelect: (ship: ShipDefinition) => void;
  selectedShipId?: string;
}

export const ShipSelector: React.FC<ShipSelectorProps> = ({
  faction,
  ships = [],
  onSelect,
  selectedShipId,
}) => {
  // 按阵营筛选舰船
  const availableShips = useMemo(() => {
    if (!faction) return ships;
    // 显示阵营专属舰船和通用舰船
    return ships.filter(ship =>
      !ship.faction || ship.faction === faction
    );
  }, [ships, faction]);

  // 按尺寸分组
  const shipsBySize = useMemo(() => {
    const groups: Record<HullSize, ShipDefinition[]> = {
      FIGHTER: [],
      FRIGATE: [],
      DESTROYER: [],
      CRUISER: [],
      CAPITAL: [],
    };

    for (const ship of availableShips) {
      // 这里需要从 hullId 获取尺寸，暂时使用默认值
      groups.FRIGATE.push(ship);
    }

    return groups;
  }, [availableShips]);

  // 处理舰船点击
  const handleShipClick = (ship: ShipDefinition) => {
    onSelect(ship);
  };

  if (!faction) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          请先选择阵营
        </div>
      </div>
    );
  }

  if (availableShips.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.emptyState}>
          该阵营暂无可部署的舰船
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.shipList}>
        {Object.entries(shipsBySize).map(([size, sizeShips]) => {
          if (sizeShips.length === 0) return null;

          return (
            <div key={size}>
              <div style={styles.categoryTitle}>
                {hullSizeNames[size as HullSize]}
              </div>
              {sizeShips.map(ship => (
                <ShipCard
                  key={ship.id}
                  ship={ship}
                  isSelected={selectedShipId === ship.id}
                  onClick={() => handleShipClick(ship)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ==================== 舰船卡片 ====================

interface ShipCardProps {
  ship: ShipDefinition;
  isSelected: boolean;
  onClick: () => void;
}

const ShipCard: React.FC<ShipCardProps> = ({ ship, isSelected, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  const cardStyle = {
    ...styles.shipCard,
    ...(isHovered || isSelected ? styles.shipCardHover : {}),
    borderColor: isSelected ? 'var(--color-primary)' : 'transparent',
    backgroundColor: isSelected
      ? 'var(--color-primary-light)'
      : isHovered
        ? 'var(--color-surface-hover)'
        : 'var(--color-background)',
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* 舰船图标 */}
      <div style={styles.shipIcon}>
        {hullSizeIcons.FRIGATE}
      </div>

      {/* 舰船信息 */}
      <div style={styles.shipInfo}>
        <div style={styles.shipName}>
          {ship.nameLocalized?.zh ?? ship.name}
        </div>
        <div style={styles.shipDetails}>
          {ship.variant && <span>变体: {ship.variant}</span>}
        </div>
      </div>

      {/* 部署点数 */}
      {ship.cost !== undefined && (
        <div style={styles.shipCost}>
          {ship.cost} DP
        </div>
      )}
    </div>
  );
};

export default ShipSelector;