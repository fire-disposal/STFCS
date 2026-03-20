/**
 * 护甲象限显示组件
 *
 * 显示舰船的6象限护甲状态
 */

import React from 'react';
import type { ArmorInstanceState, ArmorQuadrant } from '@vt/shared/types';

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
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  diagram: {
    position: 'relative' as const,
    width: '180px',
    height: '200px',
    margin: '0 auto',
  },
  quadrant: {
    position: 'absolute' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'white',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
    transition: 'all 0.2s ease',
  },
  centerIcon: {
    position: 'absolute' as const,
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '36px',
    height: '48px',
    backgroundColor: 'var(--color-surface-dark)',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '18px',
    pointerEvents: 'none' as const,
  },
  legend: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    fontSize: '10px',
    marginTop: '8px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  legendColor: {
    width: '10px',
    height: '10px',
    borderRadius: '2px',
  },
  stats: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '4px',
    marginTop: '8px',
    fontSize: '11px',
  },
  statItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '4px 8px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '4px',
  },
};

// 象限位置配置
const quadrantPositions: Record<ArmorQuadrant, {
  top: string;
  left: string;
  width: string;
  height: string;
  clipPath: string;
}> = {
  FRONT_TOP: {
    top: '0',
    left: '40px',
    width: '100px',
    height: '70px',
    clipPath: 'polygon(50% 0%, 100% 100%, 0% 100%)',
  },
  FRONT_BOTTOM: {
    top: '50px',
    left: '40px',
    width: '100px',
    height: '50px',
    clipPath: 'polygon(0% 0%, 100% 0%, 80% 100%, 20% 100%)',
  },
  LEFT_TOP: {
    top: '15px',
    left: '0',
    width: '50px',
    height: '70px',
    clipPath: 'polygon(100% 0%, 100% 100%, 0% 70%, 0% 30%)',
  },
  LEFT_BOTTOM: {
    top: '65px',
    left: '0',
    width: '50px',
    height: '70px',
    clipPath: 'polygon(100% 0%, 80% 100%, 0% 100%, 0% 0%)',
  },
  RIGHT_TOP: {
    top: '15px',
    left: '130px',
    width: '50px',
    height: '70px',
    clipPath: 'polygon(0% 0%, 100% 30%, 100% 70%, 0% 100%)',
  },
  RIGHT_BOTTOM: {
    top: '65px',
    left: '130px',
    width: '50px',
    height: '70px',
    clipPath: 'polygon(20% 0%, 100% 0%, 100% 100%, 0% 100%)',
  },
};

// 象限名称
const quadrantNames: Record<ArmorQuadrant, string> = {
  FRONT_TOP: '前上',
  FRONT_BOTTOM: '前下',
  LEFT_TOP: '左上',
  LEFT_BOTTOM: '左下',
  RIGHT_TOP: '右上',
  RIGHT_BOTTOM: '右下',
};

interface ArmorQuadrantDisplayProps {
  armor: ArmorInstanceState;
  showStats?: boolean;
  compact?: boolean;
  highlightQuadrant?: ArmorQuadrant;
  onQuadrantClick?: (quadrant: ArmorQuadrant) => void;
}

export const ArmorQuadrantDisplay: React.FC<ArmorQuadrantDisplayProps> = ({
  armor,
  showStats = true,
  compact = false,
  highlightQuadrant,
  onQuadrantClick,
}) => {
  // 获取护甲颜色
  const getArmorColor = (value: number, max: number): string => {
    const percent = value / max;
    if (percent > 0.75) return '#2ecc71';
    if (percent > 0.5) return '#f1c40f';
    if (percent > 0.25) return '#e67e22';
    return '#e74c3c';
  };

  // 计算总护甲
  const totalArmor = Object.values(armor.quadrants).reduce((a, b) => a + b, 0);
  const maxTotalArmor = armor.maxPerQuadrant * 6;
  const overallPercent = Math.round((totalArmor / maxTotalArmor) * 100);

  if (compact) {
    return (
      <div style={{ ...styles.container, flexDirection: 'row', alignItems: 'center' }}>
        <div style={{ fontSize: '24px', marginRight: '8px' }}>🛡️</div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>护甲</div>
          <div style={{ fontSize: '14px', fontWeight: 'bold' }}>{overallPercent}%</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>🛡️ 护甲状态</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {overallPercent}%
        </span>
      </div>

      {/* 护甲图 */}
      <div style={styles.diagram}>
        {Object.entries(quadrantPositions).map(([quadrant, position]) => {
          const q = quadrant as ArmorQuadrant;
          const value = armor.quadrants[q];
          const percent = Math.round((value / armor.maxPerQuadrant) * 100);
          const isHighlighted = highlightQuadrant === q;

          return (
            <div
              key={quadrant}
              style={{
                ...styles.quadrant,
                ...position,
                backgroundColor: getArmorColor(value, armor.maxPerQuadrant),
                cursor: onQuadrantClick ? 'pointer' : 'default',
                outline: isHighlighted ? '2px solid white' : 'none',
                outlineOffset: '-2px',
              }}
              onClick={() => onQuadrantClick?.(q)}
              title={`${quadrantNames[q]}: ${value}/${armor.maxPerQuadrant}`}
            >
              {percent}%
            </div>
          );
        })}

        {/* 中心图标 */}
        <div style={styles.centerIcon}>
          🚀
        </div>
      </div>

      {/* 图例 */}
      <div style={styles.legend}>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendColor, backgroundColor: '#2ecc71' }} />
          <span>&gt;75%</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendColor, backgroundColor: '#f1c40f' }} />
          <span>50%</span>
        </div>
        <div style={styles.legendItem}>
          <div style={{ ...styles.legendColor, backgroundColor: '#e74c3c' }} />
          <span>&lt;25%</span>
        </div>
      </div>

      {/* 详细统计 */}
      {showStats && (
        <div style={styles.stats}>
          {Object.entries(armor.quadrants).map(([quadrant, value]) => (
            <div key={quadrant} style={styles.statItem}>
              <span style={{ color: 'var(--color-text-secondary)' }}>
                {quadrantNames[quadrant as ArmorQuadrant]}
              </span>
              <span style={{ fontWeight: 'bold' }}>
                {value}/{armor.maxPerQuadrant}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ArmorQuadrantDisplay;