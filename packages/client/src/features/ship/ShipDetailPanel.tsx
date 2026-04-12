/**
 * 舰船详情面板
 *
 * 显示选中舰船的完整状态信息：
 * - 基本信息（ID、阵营、舰型）
 * - 船体状态
 * - 6象限护甲状态
 * - 辐能系统状态
 * - 护盾状态
 * - 武器列表
 * - 机动参数
 */

import React, { useMemo } from 'react';
import type { ShipState, WeaponSlot } from '@vt/contracts';

// 样式定义
const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #2b4261',
    minWidth: '280px',
    maxWidth: '320px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
    borderBottom: '1px solid #2b4261',
    paddingBottom: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#cfe8ff',
  },
  factionBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: '12px',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#7aa2d4',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  row: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '4px 0',
    fontSize: '12px',
  },
  label: {
    color: '#8ba4c7',
  },
  value: {
    color: '#cfe8ff',
    fontWeight: 'bold',
  },
  barContainer: {
    width: '100%',
    height: '8px',
    backgroundColor: '#1a2d42',
    borderRadius: '4px',
    overflow: 'hidden',
    marginTop: '4px',
  },
  barFill: {
    height: '100%',
    borderRadius: '4px',
    transition: 'width 0.3s ease',
  },
  armorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gap: '4px',
    marginTop: '8px',
  },
  armorCell: {
    padding: '6px 4px',
    borderRadius: '4px',
    textAlign: 'center' as const,
    fontSize: '10px',
    fontWeight: 'bold',
    color: 'white',
    textShadow: '0 1px 2px rgba(0,0,0,0.5)',
  },
  weaponList: {
    maxHeight: '120px',
    overflow: 'auto',
  },
  weaponItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '6px 8px',
    backgroundColor: '#1a2d42',
    borderRadius: '4px',
    marginBottom: '4px',
    fontSize: '11px',
  },
  weaponIcon: {
    width: '24px',
    height: '24px',
    borderRadius: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '8px',
    fontSize: '12px',
  },
  weaponInfo: {
    flex: 1,
  },
  weaponCooldown: {
    fontSize: '10px',
    color: '#8ba4c7',
  },
  statusBadge: {
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 'bold',
    marginLeft: '8px',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#8ba4c7',
    padding: '24px',
    fontSize: '13px',
  },
};

// 阵营颜色
const factionColors = {
  player: { bg: '#1a4a7a', text: '#43c1ff' },
  dm: { bg: '#5a2a3a', text: '#ff6f8f' },
};

// 伤害类型颜色
const damageTypeColors: Record<string, string> = {
  kinetic: '#4a90d9',
  high_explosive: '#d4af37',
  energy: '#9b59b6',
  fragmentation: '#95a5a6',
};

// 伤害类型图标
const damageTypeIcons: Record<string, string> = {
  kinetic: '⚡',
  high_explosive: '💥',
  energy: '🔮',
  fragmentation: '✨',
};

// 象限名称
const quadrantNames = ['前', '前右', '后右', '后', '后左', '前左'];

// 阶段名称映射
const phaseNames: Record<string, string> = {
  DEPLOYMENT: '部署阶段',
  PLAYER_TURN: '玩家回合',
  DM_TURN: 'DM回合',
  END_PHASE: '结算阶段',
};

interface ShipDetailPanelProps {
  ship: ShipState | null;
  currentPhase?: string;
}

export const ShipDetailPanel: React.FC<ShipDetailPanelProps> = ({
  ship,
  currentPhase = 'DEPLOYMENT',
}) => {
  // 计算护甲百分比
  const armorPercentages = useMemo(() => {
    if (!ship) return [];
    return ship.armorCurrent.map((current, i) => {
      const max = ship.armorMax[i] || 1;
      return Math.round((current / max) * 100);
    });
  }, [ship]);

  // 计算辐能百分比
  const fluxPercentage = useMemo(() => {
    if (!ship || ship.fluxMax <= 0) return 0;
    return Math.round(((ship.fluxHard + ship.fluxSoft) / ship.fluxMax) * 100);
  }, [ship]);

  // 计算船体百分比
  const hullPercentage = useMemo(() => {
    if (!ship || ship.hullMax <= 0) return 0;
    return Math.round((ship.hullCurrent / ship.hullMax) * 100);
  }, [ship]);

  // 获取护甲颜色
  const getArmorColor = (percent: number): string => {
    if (percent > 75) return '#2ecc71';
    if (percent > 50) return '#f1c40f';
    if (percent > 25) return '#e67e22';
    return '#e74c3c';
  };

  // 获取辐能颜色
  const getFluxColor = (percent: number, isOverloaded: boolean): string => {
    if (isOverloaded) return '#e74c3c';
    if (percent > 80) return '#e67e22';
    if (percent > 50) return '#f1c40f';
    return '#3498db';
  };

  // 获取船体颜色
  const getHullColor = (percent: number): string => {
    if (percent > 50) return '#2ecc71';
    if (percent > 25) return '#e67e22';
    return '#e74c3c';
  };

  if (!ship) {
    return (
      <div style={styles.panel}>
        <div style={styles.emptyState}>
          <div style={{ fontSize: '24px', marginBottom: '8px' }}>🚀</div>
          选择一艘舰船查看详情
        </div>
      </div>
    );
  }

  const factionStyle = factionColors[ship.faction as keyof typeof factionColors] || factionColors.player;

  // 武器列表
  const weapons = useMemo(() => {
    const result: WeaponSlot[] = [];
    ship.weapons.forEach((weapon) => result.push(weapon));
    return result;
  }, [ship]);

  return (
    <div style={styles.panel}>
      {/* 头部 */}
      <div style={styles.header}>
        <div style={styles.title}>
          🚀 {ship.hullType || '舰船'}
        </div>
        <div style={{
          ...styles.factionBadge,
          backgroundColor: factionStyle.bg,
          color: factionStyle.text,
        }}>
          {ship.faction === 'player' ? '玩家' : '敌方'}
        </div>
      </div>

      {/* 基本信息 */}
      <div style={styles.section}>
        <div style={styles.row}>
          <span style={styles.label}>ID</span>
          <span style={styles.value}>{ship.id.slice(-8)}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>位置</span>
          <span style={styles.value}>
            ({ship.transform.x.toFixed(1)}, {ship.transform.y.toFixed(1)})
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>朝向</span>
          <span style={styles.value}>{ship.transform.heading.toFixed(1)}°</span>
        </div>
        {ship.ownerId && (
          <div style={styles.row}>
            <span style={styles.label}>控制者</span>
            <span style={styles.value}>{ship.ownerId.slice(-6)}</span>
          </div>
        )}
      </div>

      {/* 船体状态 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          ❤️ 船体
          {ship.hullCurrent <= 0 && (
            <span style={{ ...styles.statusBadge, backgroundColor: '#e74c3c', color: 'white' }}>
              摧毁
            </span>
          )}
        </div>
        <div style={styles.row}>
          <span style={styles.label}>当前 / 最大</span>
          <span style={styles.value}>
            {Math.round(ship.hullCurrent)} / {ship.hullMax}
          </span>
        </div>
        <div style={styles.barContainer}>
          <div style={{
            ...styles.barFill,
            width: `${hullPercentage}%`,
            backgroundColor: getHullColor(hullPercentage),
          }} />
        </div>
      </div>

      {/* 6象限护甲 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🛡️ 护甲 (6象限)</div>
        <div style={styles.armorGrid}>
          {armorPercentages.map((percent, i) => (
            <div
              key={i}
              style={{
                ...styles.armorCell,
                backgroundColor: getArmorColor(percent),
              }}
              title={`${quadrantNames[i]}: ${ship.armorCurrent[i]}/${ship.armorMax[i]}`}
            >
              {quadrantNames[i]}
              <br />
              {percent}%
            </div>
          ))}
        </div>
      </div>

      {/* 辐能系统 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          ⚡ 辐能
          {ship.isOverloaded && (
            <span style={{ ...styles.statusBadge, backgroundColor: '#e74c3c', color: 'white' }}>
              过载
            </span>
          )}
        </div>
        <div style={styles.row}>
          <span style={styles.label}>软辐能</span>
          <span style={{ ...styles.value, color: '#3498db' }}>
            {Math.round(ship.fluxSoft)}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>硬辐能</span>
          <span style={{ ...styles.value, color: '#e67e22' }}>
            {Math.round(ship.fluxHard)}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>容量</span>
          <span style={styles.value}>{ship.fluxMax}</span>
        </div>
        <div style={styles.barContainer}>
          <div style={{
            ...styles.barFill,
            width: `${fluxPercentage}%`,
            backgroundColor: getFluxColor(fluxPercentage, ship.isOverloaded),
          }} />
        </div>
        {ship.isOverloaded && (
          <div style={styles.row}>
            <span style={styles.label}>过载剩余</span>
            <span style={{ ...styles.value, color: '#e74c3c' }}>
              {Math.round(ship.overloadTime)}秒
            </span>
          </div>
        )}
      </div>

      {/* 护盾状态 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          🔮 护盾
          <span style={{
            ...styles.statusBadge,
            backgroundColor: ship.isShieldUp ? '#2ecc71' : '#1a2d42',
            color: ship.isShieldUp ? 'white' : '#8ba4c7',
          }}>
            {ship.isShieldUp ? '开启' : '关闭'}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>朝向</span>
          <span style={styles.value}>{ship.shieldOrientation.toFixed(1)}°</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>弧宽</span>
          <span style={styles.value}>{ship.shieldArc}°</span>
        </div>
      </div>

      {/* 武器列表 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🔫 武器 ({weapons.length})</div>
        {weapons.length > 0 ? (
          <div style={styles.weaponList}>
            {weapons.map((weapon) => (
              <div key={weapon.weaponId} style={styles.weaponItem}>
                <div style={{
                  ...styles.weaponIcon,
                  backgroundColor: damageTypeColors[weapon.type] || '#4a90d9',
                }}>
                  {damageTypeIcons[weapon.type] || '🔫'}
                </div>
                <div style={styles.weaponInfo}>
                  <div style={{ color: '#cfe8ff' }}>
                    {weapon.weaponId.slice(-6)}
                  </div>
                  <div style={styles.weaponCooldown}>
                    伤害: {weapon.damage} | 射程: {weapon.range} | 射界: {weapon.arc}°
                  </div>
                </div>
                {weapon.cooldown > 0 && (
                  <span style={{
                    ...styles.statusBadge,
                    backgroundColor: '#e67e22',
                    color: 'white',
                  }}>
                    CD {weapon.cooldown.toFixed(1)}s
                  </span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: '#8ba4c7', fontSize: '11px', textAlign: 'center' }}>
            无武器
          </div>
        )}
      </div>

      {/* 机动参数 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🚀 机动参数</div>
        <div style={styles.row}>
          <span style={styles.label}>最大速度</span>
          <span style={styles.value}>{ship.maxSpeed}</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>最大转向</span>
          <span style={styles.value}>{ship.maxTurnRate}°</span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>加速度</span>
          <span style={styles.value}>{ship.acceleration}</span>
        </div>
      </div>

      {/* 回合状态 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 本回合状态</div>
        <div style={styles.row}>
          <span style={styles.label}>已移动</span>
          <span style={{
            ...styles.value,
            color: ship.hasMoved ? '#2ecc71' : '#8ba4c7',
          }}>
            {ship.hasMoved ? '是' : '否'}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>已开火</span>
          <span style={{
            ...styles.value,
            color: ship.hasFired ? '#2ecc71' : '#8ba4c7',
          }}>
            {ship.hasFired ? '是' : '否'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default ShipDetailPanel;