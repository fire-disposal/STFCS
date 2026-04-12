/**
 * 6 象限护甲可视化组件
 * 
 * 以六边形形式直观显示各象限护甲状态
 */

import React from 'react';
import type { ShipState } from '@vt/contracts';

const styles = {
  container: {
    padding: '12px',
    backgroundColor: 'rgba(10, 30, 50, 0.8)',
    borderRadius: '0',
    border: '1px solid #2b4261',
  },
  header: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#ffa500',
    marginBottom: '10px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  armorHexContainer: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '12px',
  },
  quadrantList: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '6px',
  },
  quadrantItem: {
    padding: '6px',
    backgroundColor: 'rgba(6, 16, 26, 0.6)',
    borderRadius: '0',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '3px',
  },
  quadrantName: {
    fontSize: '9px',
    color: '#8ba4c7',
  },
  quadrantValue: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#cfe8ff',
  },
  armorBar: {
    height: '4px',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    borderRadius: '0',
    overflow: 'hidden',
  },
  armorBarFill: {
    height: '100%',
    borderRadius: '0',
    transition: 'width 0.3s ease',
  },
  hint: {
    fontSize: '9px',
    color: '#6b7280',
    marginTop: '8px',
    fontStyle: 'italic',
  },
};

const QUADRANT_NAMES = ['前', '前右', '后右', '后', '后左', '前左'];
const QUADRANT_COLORS = ['#4a9eff', '#4affa5', '#a5ff4a', '#ffa54a', '#ff4aa5', '#a54aff'];

interface ArmorQuadrantDisplayProps {
  ship: ShipState | null;
}

export const ArmorQuadrantDisplay: React.FC<ArmorQuadrantDisplayProps> = ({ ship }) => {
  if (!ship) {
    return (
      <div style={styles.container}>
        <div style={styles.header}>🛡️ 装甲系统</div>
        <div style={{ color: '#8ba4c7', fontSize: '10px', textAlign: 'center' }}>
          未选择舰船
        </div>
      </div>
    );
  }

  const armorCurrent = Array.from(ship.armorCurrent);
  const armorMax = Array.from(ship.armorMax);
  const totalArmor = armorCurrent.reduce((sum, val) => sum + val, 0);
  const maxTotalArmor = armorMax.reduce((sum, val) => sum + val, 0);
  const averagePercent = maxTotalArmor > 0 ? (totalArmor / maxTotalArmor) * 100 : 0;

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <span>🛡️ 装甲系统</span>
        <span style={{ fontSize: '9px', color: '#8ba4c7' }}>
          平均 {averagePercent.toFixed(0)}%
        </span>
      </div>

      {/* 六边形可视化 */}
      <div style={styles.armorHexContainer}>
        <svg width="140" height="160" viewBox="0 0 140 160">
          {/* 六边形布局：从上顺时针编号 0-5 */}
          {/* 象限 0: 前 (顶部) */}
          <polygon
            points="70,10 100,35 70,60 40,35"
            fill={getArmorColor(armorCurrent[0], armorMax[0], 0.3)}
            stroke={QUADRANT_COLORS[0]}
            strokeWidth="2"
          />
          <text x="70" y="42" textAnchor="middle" fill="#ffffff" fontSize="10">
            {armorCurrent[0]}
          </text>

          {/* 象限 1: 前右 (右上) */}
          <polygon
            points="100,35 130,80 100,125 70,80"
            fill={getArmorColor(armorCurrent[1], armorMax[1], 0.3)}
            stroke={QUADRANT_COLORS[1]}
            strokeWidth="2"
          />
          <text x="105" y="87" textAnchor="middle" fill="#ffffff" fontSize="10">
            {armorCurrent[1]}
          </text>

          {/* 象限 2: 后右 (右下) */}
          <polygon
            points="100,125 70,150 40,125 70,100"
            fill={getArmorColor(armorCurrent[2], armorMax[2], 0.3)}
            stroke={QUADRANT_COLORS[2]}
            strokeWidth="2"
          />
          <text x="70" y="132" textAnchor="middle" fill="#ffffff" fontSize="10">
            {armorCurrent[2]}
          </text>

          {/* 象限 3: 后 (底部) */}
          <polygon
            points="40,125 70,100 100,125 70,150"
            fill={getArmorColor(armorCurrent[3], armorMax[3], 0.3)}
            stroke={QUADRANT_COLORS[3]}
            strokeWidth="2"
          />
          <text x="70" y="132" textAnchor="middle" fill="#ffffff" fontSize="10">
            {armorCurrent[3]}
          </text>

          {/* 象限 4: 后左 (左下) - 修正 */}
          <polygon
            points="40,125 10,80 40,35 70,80"
            fill={getArmorColor(armorCurrent[4], armorMax[4], 0.3)}
            stroke={QUADRANT_COLORS[4]}
            strokeWidth="2"
          />
          <text x="35" y="87" textAnchor="middle" fill="#ffffff" fontSize="10">
            {armorCurrent[4]}
          </text>

          {/* 象限 5: 前左 (左上) */}
          <polygon
            points="40,35 70,60 40,85 10,80"
            fill={getArmorColor(armorCurrent[5], armorMax[5], 0.3)}
            stroke={QUADRANT_COLORS[5]}
            strokeWidth="2"
          />
          <text x="35" y="67" textAnchor="middle" fill="#ffffff" fontSize="10">
            {armorCurrent[5]}
          </text>

          {/* 中心标注 */}
          <circle cx="70" cy="80" r="15" fill="rgba(10, 30, 50, 0.8)" stroke="#2b4261" strokeWidth="2" />
          <text x="70" y="84" textAnchor="middle" fill="#8ba4c7" fontSize="8">
            舰船
          </text>
        </svg>
      </div>

      {/* 详细列表 */}
      <div style={styles.quadrantList}>
        {QUADRANT_NAMES.map((name, index) => {
          const current = armorCurrent[index] ?? 0;
          const max = armorMax[index] ?? 0;
          const percent = max > 0 ? (current / max) * 100 : 0;

          return (
            <div key={index} style={styles.quadrantItem}>
              <div style={styles.quadrantName}>
                {name}
              </div>
              <div style={{
                ...styles.quadrantValue,
                color: percent < 30 ? '#ff6f8f' : '#cfe8ff',
              }}>
                {current} / {max}
              </div>
              <div style={styles.armorBar}>
                <div
                  style={{
                    ...styles.armorBarFill,
                    width: `${percent}%`,
                    backgroundColor: QUADRANT_COLORS[index],
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* 提示信息 */}
      <div style={styles.hint}>
        💡 护甲值影响伤害减免，优先保护高威胁方向
      </div>
    </div>
  );
};

/**
 * 根据护甲百分比获取填充颜色透明度
 */
function getArmorColor(current: number, max: number, baseAlpha: number): string {
  const percent = max > 0 ? current / max : 0;
  const alpha = baseAlpha + percent * 0.5;
  return `rgba(100, 150, 200, ${alpha})`;
}

export default ArmorQuadrantDisplay;
