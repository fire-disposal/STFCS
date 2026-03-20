/**
 * Token 信息浮动窗
 *
 * 显示 Token 详细信息：
 * - 名称、类型、阵营
 * - 船体、护盾、辐能状态
 * - 装甲象限图
 * - 控制玩家
 */

import React from 'react';
import type { TokenState } from '@vt/shared/room';
import type { FactionId, ArmorQuadrant } from '@vt/shared/types';
import {
  getFactionColor,
  getHullColor,
  getFluxColor,
  getArmorColor,
  colorToHex,
} from './config';

// ==================== 样式 ====================

const styles = {
  container: {
    position: 'absolute' as const,
    backgroundColor: 'rgba(15, 18, 25, 0.95)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    borderRadius: '8px',
    padding: '12px',
    minWidth: '200px',
    maxWidth: '280px',
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
    pointerEvents: 'none' as const,
    zIndex: 1000,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '12px',
    paddingBottom: '8px',
    borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
  },
  icon: {
    fontSize: '24px',
  },
  title: {
    flex: 1,
  },
  name: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#ffffff',
  },
  type: {
    fontSize: '11px',
    color: '#888888',
    marginTop: '2px',
  },
  faction: {
    fontSize: '10px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  section: {
    marginBottom: '10px',
  },
  sectionTitle: {
    fontSize: '11px',
    color: '#888888',
    marginBottom: '6px',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  statRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '6px',
  },
  statLabel: {
    fontSize: '12px',
    color: '#aaaaaa',
  },
  statValue: {
    fontSize: '12px',
    fontWeight: 'bold',
  },
  statBar: {
    width: '100%',
    height: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: '3px',
    marginTop: '4px',
    overflow: 'hidden',
  },
  statBarFill: {
    height: '100%',
    borderRadius: '3px',
    transition: 'width 0.3s ease',
  },
  armorGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(2, 1fr)',
    gap: '4px',
    width: '100%',
    aspectRatio: '3/2',
    marginTop: '8px',
  },
  armorQuadrant: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '6px',
    borderRadius: '4px',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
  },
  armorQuadrantLabel: {
    fontSize: '9px',
    color: '#888888',
    marginBottom: '2px',
  },
  armorQuadrantValue: {
    fontSize: '11px',
    fontWeight: 'bold',
  },
  statusRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 0',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
  statusIcon: {
    fontSize: '12px',
  },
  statusText: {
    fontSize: '11px',
  },
  statusActive: {
    color: '#22c55e',
  },
  statusInactive: {
    color: '#ef4444',
  },
  controller: {
    fontSize: '11px',
    color: '#888888',
    marginTop: '8px',
    paddingTop: '8px',
    borderTop: '1px solid rgba(255, 255, 255, 0.1)',
  },
};

// ==================== 阵营名称映射 ====================

const FACTION_NAMES: Record<FactionId, string> = {
  hegemony: '霸主',
  sindrian: '辛德里亚',
  persean: '珀尔修斯',
  tri_tachyon: '三叠纪',
  pirate: '海盗',
  independent: '独立',
};

const TOKEN_TYPE_NAMES: Record<string, string> = {
  ship: '舰船',
  station: '空间站',
  asteroid: '小行星',
  debris: '残骸',
  objective: '目标',
};

const QUADRANT_NAMES: Record<ArmorQuadrant, string> = {
  LEFT_TOP: '左上',
  FRONT_TOP: '前上',
  RIGHT_TOP: '右上',
  LEFT_BOTTOM: '左下',
  FRONT_BOTTOM: '前下',
  RIGHT_BOTTOM: '右下',
};

// ==================== Props ====================

interface TokenInfoTooltipProps {
  token: TokenState;
  position: { x: number; y: number };
  controllerName?: string;
  visible?: boolean;
}

// ==================== Component ====================

export const TokenInfoTooltip: React.FC<TokenInfoTooltipProps> = ({
  token,
  position,
  controllerName,
  visible = true,
}) => {
  if (!visible) return null;

  const factionColor = getFactionColor(token.faction);
  const hullPercent = token.hull / token.maxHull;
  const shieldPercent = token.maxShield > 0 ? token.shield / token.maxShield : 0;
  const fluxPercent = token.flux / token.maxFlux;

  // 计算位置（避免超出屏幕）
  const style: React.CSSProperties = {
    ...styles.container,
    left: Math.min(position.x + 20, window.innerWidth - 300),
    top: Math.min(position.y + 20, window.innerHeight - 400),
  };

  // 获取 Token 图标
  const getTokenIcon = () => {
    switch (token.type) {
      case 'ship': return token.isEnemy ? '👾' : '🚀';
      case 'station': return '🏠';
      case 'asteroid': return '🪨';
      case 'debris': return '💫';
      case 'objective': return '🎯';
      default: return '❓';
    }
  };

  return (
    <div style={style}>
      {/* 头部 */}
      <div style={styles.header}>
        <span style={styles.icon}>{getTokenIcon()}</span>
        <div style={styles.title}>
          <div style={styles.name}>{token.name}</div>
          <div style={styles.type}>{TOKEN_TYPE_NAMES[token.type] || token.type}</div>
        </div>
        {token.faction && (
          <span style={{
            ...styles.faction,
            backgroundColor: colorToHex(factionColor.primary),
            color: '#ffffff',
          }}>
            {FACTION_NAMES[token.faction]}
          </span>
        )}
      </div>

      {/* 舰船属性 */}
      {token.type === 'ship' && (
        <>
          {/* 船体 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>船体</div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>{token.hull} / {token.maxHull}</span>
              <span style={{ ...styles.statValue, color: colorToHex(getHullColor(hullPercent)) }}>
                {Math.round(hullPercent * 100)}%
              </span>
            </div>
            <div style={styles.statBar}>
              <div style={{
                ...styles.statBarFill,
                width: `${hullPercent * 100}%`,
                backgroundColor: colorToHex(getHullColor(hullPercent)),
              }} />
            </div>
          </div>

          {/* 护盾 */}
          {token.maxShield > 0 && (
            <div style={styles.section}>
              <div style={styles.sectionTitle}>护盾</div>
              <div style={styles.statRow}>
                <span style={styles.statLabel}>{token.shield} / {token.maxShield}</span>
                <span style={{ ...styles.statValue, color: token.isShieldOn ? '#3b82f6' : '#6b7280' }}>
                  {Math.round(shieldPercent * 100)}%
                </span>
              </div>
              <div style={styles.statBar}>
                <div style={{
                  ...styles.statBarFill,
                  width: `${shieldPercent * 100}%`,
                  backgroundColor: token.isShieldOn ? '#3b82f6' : '#6b7280',
                }} />
              </div>
            </div>
          )}

          {/* 辐能 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>辐能</div>
            <div style={styles.statRow}>
              <span style={styles.statLabel}>{token.flux} / {token.maxFlux}</span>
              <span style={{ ...styles.statValue, color: colorToHex(getFluxColor(fluxPercent, token.isOverloaded)) }}>
                {Math.round(fluxPercent * 100)}%
              </span>
            </div>
            <div style={styles.statBar}>
              <div style={{
                ...styles.statBarFill,
                width: `${fluxPercent * 100}%`,
                backgroundColor: colorToHex(getFluxColor(fluxPercent, token.isOverloaded)),
              }} />
            </div>
          </div>

          {/* 装甲象限 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>装甲</div>
            <div style={styles.armorGrid}>
              {(['LEFT_TOP', 'FRONT_TOP', 'RIGHT_TOP', 'LEFT_BOTTOM', 'FRONT_BOTTOM', 'RIGHT_BOTTOM'] as ArmorQuadrant[]).map(quadrant => {
                const value = token.armor[quadrant];
                const percent = value / token.maxArmor;
                return (
                  <div key={quadrant} style={styles.armorQuadrant}>
                    <span style={styles.armorQuadrantLabel}>{QUADRANT_NAMES[quadrant]}</span>
                    <span style={{ ...styles.armorQuadrantValue, color: colorToHex(getArmorColor(percent)) }}>
                      {value}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 状态 */}
          <div style={styles.statusRow}>
            <span style={styles.statusIcon}>🛡️</span>
            <span style={{
              ...styles.statusText,
              ...(token.isShieldOn ? styles.statusActive : styles.statusInactive),
            }}>
              护盾 {token.isShieldOn ? '开启' : '关闭'}
            </span>
          </div>

          {token.isOverloaded && (
            <div style={styles.statusRow}>
              <span style={styles.statusIcon}>⚡</span>
              <span style={{ ...styles.statusText, color: '#ef4444' }}>
                过载中
              </span>
            </div>
          )}

          {token.hasActed && (
            <div style={styles.statusRow}>
              <span style={styles.statusIcon}>✓</span>
              <span style={{ ...styles.statusText, color: '#f59e0b' }}>
                本回合已行动
              </span>
            </div>
          )}
        </>
      )}

      {/* 控制玩家 */}
      {controllerName && (
        <div style={styles.controller}>
          控制者: <span style={{ color: '#ffffff' }}>{controllerName}</span>
        </div>
      )}

      {/* 坐标 */}
      <div style={{ ...styles.controller, marginTop: '4px' }}>
        坐标: ({Math.round(token.position.x)}, {Math.round(token.position.y)})
        {token.type === 'ship' && (
          <span style={{ marginLeft: '8px' }}>
            朝向: {token.heading}°
          </span>
        )}
      </div>
    </div>
  );
};

export default TokenInfoTooltip;