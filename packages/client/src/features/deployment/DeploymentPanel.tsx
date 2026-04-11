/**
 * 部署阶段组件
 * 
 * 处理游戏开始前的舰船部署流程
 */

import React, { useState, useMemo } from 'react';
import type { ShipHullSpec } from '@vt/shared';
import { PRESET_SHIPS, getShipHullSpec, getAvailableShips } from '@vt/shared';

interface DeploymentPanelProps {
  isDM?: boolean;
  onDeployShip?: (shipSpec: ShipHullSpec, x: number, y: number, faction: 'player' | 'dm') => void;
  onReady?: () => void;
  onCancelReady?: () => void;
  isReady?: boolean;
  currentPhase?: string;
}

interface ShipCardProps {
  ship: ShipHullSpec;
  onSelect: () => void;
  isSelected: boolean;
  canDeploy: boolean;
}

const ShipSizeIcons: Record<string, string> = {
  fighter: '🛩️',
  frigate: '🚀',
  destroyer: '🚢',
  cruiser: '🛳️',
  capital: '🏢',
};

const ShipClassLabels: Record<string, string> = {
  strike: '突击',
  support: '支援',
  line: '主力',
  carrier: '航母',
  battleship: '战列',
};

const ShipCard: React.FC<ShipCardProps> = ({ ship, onSelect, isSelected, canDeploy }) => {
  return (
    <div
      style={{
        ...styles.shipCard,
        borderColor: isSelected ? '#4a9eff' : '#2b4261',
        backgroundColor: isSelected ? 'rgba(74, 158, 255, 0.1)' : 'rgba(10, 30, 50, 0.5)',
        opacity: canDeploy ? 1 : 0.5,
        cursor: canDeploy ? 'pointer' : 'not-allowed',
      }}
      onClick={canDeploy ? onSelect : undefined}
    >
      <div style={styles.shipCardHeader}>
        <span style={styles.shipIcon}>{ShipSizeIcons[ship.size]}</span>
        <div style={styles.shipCardTitle}>
          <div style={styles.shipName}>{ship.name}</div>
          <div style={styles.shipClass}>{ShipClassLabels[ship.class]}</div>
        </div>
      </div>
      
      <div style={styles.shipCardStats}>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>船体</span>
          <span style={styles.statValue}>{ship.hullPoints}</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>装甲</span>
          <span style={styles.statValue}>{ship.armorValue}</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>辐能</span>
          <span style={styles.statValue}>{ship.fluxCapacity}</span>
        </div>
        <div style={styles.statRow}>
          <span style={styles.statLabel}>速度</span>
          <span style={styles.statValue}>{ship.maxSpeed}</span>
        </div>
      </div>

      <div style={styles.shipCardFooter}>
        <span style={styles.weaponCount}>🔫 {ship.weaponMounts.length} 武器槽</span>
        {ship.hasShield && (
          <span style={styles.hasShield}>🛡️ 护盾</span>
        )}
      </div>
    </div>
  );
};

export const DeploymentPanel: React.FC<DeploymentPanelProps> = ({
  isDM = false,
  onDeployShip,
  onReady,
  onCancelReady,
  isReady = false,
  currentPhase = 'DEPLOYMENT',
}) => {
  const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
  const [deployFaction, setDeployFaction] = useState<'player' | 'dm'>('player');

  const availableShips = useMemo(() => getAvailableShips(), []);
  const selectedShip = selectedShipId ? getShipHullSpec(selectedShipId) : null;

  const handleSelectShip = (shipId: string) => {
    setSelectedShipId(shipId === selectedShipId ? null : shipId);
  };

  const handleDeploy = (x: number, y: number) => {
    if (selectedShip && onDeployShip) {
      onDeployShip(selectedShip, x, y, deployFaction);
      setSelectedShipId(null);
    }
  };

  // 部署阶段提示
  const phaseHints = {
    DEPLOYMENT: '部署阶段 - 选择舰船并点击地图部署',
    PLAYER_TURN: '玩家回合 - 部署已完成',
    DM_TURN: 'DM 回合 - 等待 DM 行动',
    END_PHASE: '结束阶段 - 准备进入下一回合',
  };

  return (
    <div style={styles.panel}>
      {/* 阶段指示器 */}
      <div style={styles.phaseHeader}>
        <div style={styles.phaseTitle}>
          📍 {phaseHints[currentPhase as keyof typeof phaseHints]}
        </div>
        {isDM && (
          <div style={styles.dmBadge}>DM 模式</div>
        )}
      </div>

      {currentPhase === 'DEPLOYMENT' ? (
        <>
          {/* 舰船选择区 */}
          <div style={styles.shipSelection}>
            <div style={styles.sectionTitle}>选择舰船</div>
            <div style={styles.shipGrid}>
              {availableShips.map(ship => (
                <ShipCard
                  key={ship.id}
                  ship={ship}
                  onSelect={() => handleSelectShip(ship.id)}
                  isSelected={selectedShipId === ship.id}
                  canDeploy={true}
                />
              ))}
            </div>
          </div>

          {/* 部署选项 */}
          {selectedShip && (
            <div style={styles.deploymentOptions}>
              <div style={styles.sectionTitle}>部署选项</div>
              
              <div style={styles.selectedShipInfo}>
                <div style={styles.selectedShipName}>
                  {ShipSizeIcons[selectedShip.size]} {selectedShip.name}
                </div>
                <div style={styles.selectedShipDesc}>{selectedShip.description}</div>
              </div>

              {isDM && (
                <div style={styles.factionSelect}>
                  <label style={styles.factionLabel}>
                    <input
                      type="radio"
                      value="player"
                      checked={deployFaction === 'player'}
                      onChange={() => setDeployFaction('player')}
                    />
                    玩家阵营
                  </label>
                  <label style={styles.factionLabel}>
                    <input
                      type="radio"
                      value="dm"
                      checked={deployFaction === 'dm'}
                      onChange={() => setDeployFaction('dm')}
                    />
                    DM 阵营
                  </label>
                </div>
              )}

              <div style={styles.deployHint}>
                💡 点击地图上的位置来部署舰船
              </div>

              <button
                style={styles.deployButton}
                onClick={() => handleDeploy(0, 0)}
              >
                部署在中心 (0, 0)
              </button>
            </div>
          )}

          {/* 准备状态 */}
          <div style={styles.readySection}>
            <button
              style={{
                ...styles.readyButton,
                backgroundColor: isReady ? '#5a2a3a' : '#1a4a7a',
                color: isReady ? '#ff6f8f' : '#4a9eff',
              }}
              onClick={isReady ? onCancelReady : onReady}
            >
              {isReady ? '❌ 取消准备' : '✅ 我已准备'}
            </button>
            <div style={styles.readyHint}>
              {isReady 
                ? '你已准备完毕，等待其他玩家' 
                : '所有玩家准备后自动进入下一阶段'}
            </div>
          </div>
        </>
      ) : (
        <div style={styles.phaseLocked}>
          <div style={styles.lockedIcon}>🔒</div>
          <div>部署阶段已结束</div>
          <div style={styles.lockedHint}>
            当前阶段：{currentPhase}
          </div>
        </div>
      )}
    </div>
  );
};

const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    border: '1px solid #2b4261',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
  },
  phaseHeader: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingBottom: '12px',
    borderBottom: '1px solid #2b4261',
  },
  phaseTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#cfe8ff',
  },
  dmBadge: {
    padding: '4px 8px',
    borderRadius: '4px',
    backgroundColor: '#7c3aed',
    color: '#fff',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: '#8ba4c7',
    marginBottom: '8px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  shipSelection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  shipGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
    gap: '8px',
    maxHeight: '300px',
    overflowY: 'auto',
    padding: '4px',
  },
  shipCard: {
    padding: '10px',
    borderRadius: '6px',
    border: '1px solid',
    transition: 'all 0.2s',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  shipCardHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  shipIcon: {
    fontSize: '20px',
  },
  shipCardTitle: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
  },
  shipName: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#cfe8ff',
  },
  shipClass: {
    fontSize: '10px',
    color: '#8ba4c7',
  },
  shipCardStats: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '4px',
    fontSize: '11px',
  },
  statRow: {
    display: 'flex',
    justifyContent: 'space-between',
    color: '#8ba4c7',
  },
  statValue: {
    color: '#cfe8ff',
    fontWeight: '500',
  },
  shipCardFooter: {
    display: 'flex',
    justifyContent: 'space-between',
    fontSize: '10px',
    color: '#8ba4c7',
    paddingTop: '6px',
    borderTop: '1px solid rgba(43, 66, 97, 0.5)',
  },
  deploymentOptions: {
    backgroundColor: 'rgba(10, 30, 50, 0.5)',
    borderRadius: '6px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  selectedShipInfo: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
  },
  selectedShipName: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#cfe8ff',
  },
  selectedShipDesc: {
    fontSize: '11px',
    color: '#8ba4c7',
  },
  factionSelect: {
    display: 'flex',
    gap: '16px',
  },
  factionLabel: {
    fontSize: '12px',
    color: '#cfe8ff',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
  },
  deployHint: {
    fontSize: '11px',
    color: '#8ba4c7',
    fontStyle: 'italic',
  },
  deployButton: {
    padding: '10px 16px',
    borderRadius: '4px',
    border: '1px solid #4a9eff',
    backgroundColor: '#1a4a7a',
    color: '#4a9eff',
    fontSize: '13px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  readySection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    alignItems: 'center',
    paddingTop: '12px',
    borderTop: '1px solid #2b4261',
  },
  readyButton: {
    padding: '12px 24px',
    borderRadius: '6px',
    border: 'none',
    fontSize: '14px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  readyHint: {
    fontSize: '11px',
    color: '#8ba4c7',
  },
  phaseLocked: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '48px 24px',
    color: '#8ba4c7',
    gap: '12px',
  },
  lockedIcon: {
    fontSize: '32px',
  },
  lockedHint: {
    fontSize: '12px',
    color: '#6b7280',
    marginTop: '8px',
  },
};

export default DeploymentPanel;
