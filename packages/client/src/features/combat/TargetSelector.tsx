/**
 * 目标选择器组件
 *
 * 显示可选目标列表，支持：
 * - 按距离排序
 * - 按阵营筛选
 * - 显示目标状态
 */

import React, { useMemo } from 'react';
import type { ShipTokenV2, FactionId } from '@vt/shared/types';
import type { ArmorQuadrant } from '@vt/shared/core-types';

// 样式
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  header: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  targetList: {
    maxHeight: '300px',
    overflow: 'auto',
  },
  targetCard: {
    display: 'flex',
    alignItems: 'center',
    padding: '12px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    border: '2px solid transparent',
    marginBottom: '8px',
  },
  targetCardSelected: {
    borderColor: 'var(--color-error)',
    backgroundColor: 'var(--color-error-light)',
  },
  targetCardHover: {
    backgroundColor: 'var(--color-surface-hover)',
  },
  targetIcon: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: 'var(--color-surface-dark)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    fontSize: '20px',
  },
  targetInfo: {
    flex: 1,
  },
  targetName: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  targetDetails: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    display: 'flex',
    gap: '12px',
  },
  targetStatus: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '4px',
  },
  healthBar: {
    width: '80px',
    height: '6px',
    backgroundColor: 'var(--color-surface-dark)',
    borderRadius: '3px',
    overflow: 'hidden',
  },
  healthBarFill: {
    height: '100%',
    backgroundColor: 'var(--color-success)',
    transition: 'width 0.3s ease',
  },
  healthBarArmor: {
    height: '100%',
    backgroundColor: 'var(--color-warning)',
  },
  distance: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
  },
  emptyState: {
    padding: '24px',
    textAlign: 'center' as const,
    color: 'var(--color-text-secondary)',
  },
  filterBar: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
  },
  filterButton: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    cursor: 'pointer',
    fontSize: '12px',
    transition: 'all 0.2s ease',
  },
  filterButtonActive: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
    borderColor: 'var(--color-primary)',
  },
};

// 阵营颜色映射
const factionColors: Record<string, string> = {
  hegemony: '#4a90d9',
  sindrian: '#d4af37',
  persean: '#2ecc71',
  tri_tachyon: '#9b59b6',
  pirate: '#e74c3c',
  independent: '#95a5a6',
};

interface TargetSelectorProps {
  targets: ShipTokenV2[];
  attackerId: string;
  attackerPosition: { x: number; y: number };
  selectedTargetId?: string;
  onSelect: (targetId: string) => void;
  filterFaction?: FactionId | 'all' | 'enemy';
}

export const TargetSelector: React.FC<TargetSelectorProps> = ({
  targets,
  attackerId,
  attackerPosition,
  selectedTargetId,
  onSelect,
  filterFaction = 'enemy',
}) => {
  const [hoveredId, setHoveredId] = React.useState<string | null>(null);
  const [activeFilter, setActiveFilter] = React.useState<'all' | 'enemy' | 'ally'>(
    filterFaction === 'enemy' ? 'enemy' : filterFaction === 'all' ? 'all' : 'ally'
  );

  // 计算距离并排序
  const sortedTargets = useMemo(() => {
    return targets
      .filter(target => {
        if (target.id === attackerId) return false;
        if (activeFilter === 'enemy') return target.isEnemy;
        if (activeFilter === 'ally') return !target.isEnemy;
        return true;
      })
      .map(target => ({
        ...target,
        distance: Math.sqrt(
          Math.pow(target.position.x - attackerPosition.x, 2) +
          Math.pow(target.position.y - attackerPosition.y, 2)
        ),
      }))
      .sort((a, b) => a.distance - b.distance);
  }, [targets, attackerId, attackerPosition, activeFilter]);

  // 处理目标点击
  const handleTargetClick = (targetId: string) => {
    onSelect(targetId);
  };

  if (targets.length === 0) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>选择目标</div>
        <div style={styles.emptyState}>
          没有可选目标
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>选择目标</div>

      {/* 筛选按钮 */}
      <div style={styles.filterBar}>
        <button
          style={{
            ...styles.filterButton,
            ...(activeFilter === 'all' ? styles.filterButtonActive : {}),
          }}
          onClick={() => setActiveFilter('all')}
        >
          全部
        </button>
        <button
          style={{
            ...styles.filterButton,
            ...(activeFilter === 'enemy' ? styles.filterButtonActive : {}),
          }}
          onClick={() => setActiveFilter('enemy')}
        >
          敌方
        </button>
        <button
          style={{
            ...styles.filterButton,
            ...(activeFilter === 'ally' ? styles.filterButtonActive : {}),
          }}
          onClick={() => setActiveFilter('ally')}
        >
          友方
        </button>
      </div>

      {/* 目标列表 */}
      <div style={styles.targetList}>
        {sortedTargets.map(target => (
          <TargetCard
            key={target.id}
            target={target}
            distance={target.distance}
            isSelected={selectedTargetId === target.id}
            isHovered={hoveredId === target.id}
            onClick={() => handleTargetClick(target.id)}
            onHover={setHoveredId}
          />
        ))}
      </div>
    </div>
  );
};

// ==================== 目标卡片 ====================

interface TargetCardProps {
  target: ShipTokenV2 & { distance: number };
  distance: number;
  isSelected: boolean;
  isHovered: boolean;
  onClick: () => void;
  onHover: (id: string | null) => void;
}

const TargetCard: React.FC<TargetCardProps> = ({
  target,
  distance,
  isSelected,
  isHovered,
  onClick,
  onHover,
}) => {
  // 计算船体HP百分比
  const hullPercent = (target.hull.current / target.hull.max) * 100;

  // 计算平均护甲百分比
  const armorValues = Object.values(target.armor.quadrants);
  const avgArmor = armorValues.reduce((a, b) => a + b, 0) / armorValues.length;
  const armorPercent = (avgArmor / target.armor.maxPerQuadrant) * 100;

  const cardStyle = {
    ...styles.targetCard,
    ...(isSelected ? styles.targetCardSelected : {}),
    ...(isHovered && !isSelected ? styles.targetCardHover : {}),
  };

  return (
    <div
      style={cardStyle}
      onClick={onClick}
      onMouseEnter={() => onHover(target.id)}
      onMouseLeave={() => onHover(null)}
    >
      {/* 目标图标 */}
      <div style={{
        ...styles.targetIcon,
        backgroundColor: factionColors[target.faction ?? 'independent'],
      }}>
        🚀
      </div>

      {/* 目标信息 */}
      <div style={styles.targetInfo}>
        <div style={styles.targetName}>
          {target.shipName ?? '未命名舰船'}
        </div>
        <div style={styles.targetDetails}>
          <span>{target.hullSize}</span>
          <span>{target.isEnemy ? '敌方' : '友方'}</span>
        </div>
      </div>

      {/* 目标状态 */}
      <div style={styles.targetStatus}>
        {/* 船体血条 */}
        <div style={styles.healthBar}>
          <div style={{
            ...styles.healthBarFill,
            width: `${hullPercent}%`,
            backgroundColor: hullPercent > 50
              ? 'var(--color-success)'
              : hullPercent > 25
                ? 'var(--color-warning)'
                : 'var(--color-error)',
          }} />
        </div>

        {/* 距离 */}
        <div style={styles.distance}>
          {Math.round(distance)} 单位
        </div>
      </div>
    </div>
  );
};

export default TargetSelector;