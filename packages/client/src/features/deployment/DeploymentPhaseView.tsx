/**
 * 部署阶段视图
 *
 * 使用新的房间框架：
 * - useRoomState 订阅状态
 * - useRoomOperations 调用操作
 */

import React, { useState, useCallback } from 'react';
import { useRoomState, useRoomOperations } from '@/room';
import type { RoomClient } from '@/room';
import type { OperationMap } from '@vt/shared/room';
import type { FactionId, Point } from '@vt/shared/types';

// ==================== 样式 ====================

const styles = {
  container: {
    display: 'flex',
    width: '100%',
    height: '100%',
  },
  sidebar: {
    width: '300px',
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    display: 'flex',
    flexDirection: 'column' as const,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
  },
  statusPanel: {
    width: '250px',
    backgroundColor: 'var(--color-surface)',
    borderLeft: '1px solid var(--color-border)',
    padding: '16px',
    overflow: 'auto',
  },
  title: {
    fontSize: '18px',
    fontWeight: 'bold',
    padding: '16px',
    borderBottom: '1px solid var(--color-border)',
  },
  section: {
    padding: '16px',
    borderBottom: '1px solid var(--color-border)',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '12px',
  },
  shipList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  shipCard: {
    padding: '12px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '6px',
    cursor: 'pointer',
    border: '2px solid transparent',
    transition: 'all 0.2s ease',
  },
  shipCardSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-light)',
  },
  shipName: {
    fontSize: '14px',
    fontWeight: 'bold',
  },
  shipStats: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    marginTop: '4px',
  },
  button: {
    padding: '12px 24px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    marginTop: '16px',
  },
  primaryButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text)',
  },
  disabledButton: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  statusItem: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--color-border)',
  },
  statusLabel: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
  },
  statusValue: {
    fontSize: '13px',
    fontWeight: 'bold',
  },
  readyBadge: {
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '4px',
    fontWeight: 'bold',
  },
  readyBadgeReady: {
    backgroundColor: 'var(--color-success-light)',
    color: 'var(--color-success)',
  },
  readyBadgeWaiting: {
    backgroundColor: 'var(--color-warning-light)',
    color: 'var(--color-warning)',
  },
};

// ==================== 舰船预设 ====================

const SHIP_PRESETS = [
  {
    id: 'frigate',
    name: '护卫舰',
    description: '快速、灵活',
    config: { hull: 80, armor: 60, shield: 60, flux: 80, speed: 60, turnRate: 40, size: 40 },
  },
  {
    id: 'destroyer',
    name: '驱逐舰',
    description: '平衡型',
    config: { hull: 100, armor: 100, shield: 100, flux: 100, speed: 50, turnRate: 30, size: 50 },
  },
  {
    id: 'cruiser',
    name: '巡洋舰',
    description: '重装甲、强火力',
    config: { hull: 150, armor: 150, shield: 120, flux: 120, speed: 40, turnRate: 20, size: 70 },
  },
];

// ==================== Props ====================

interface DeploymentPhaseViewProps {
  client: RoomClient<OperationMap> | null;
  currentPlayerId: string;
  onDeploymentComplete?: () => void;
}

// ==================== Component ====================

export const DeploymentPhaseView: React.FC<DeploymentPhaseViewProps> = ({
  client,
  currentPlayerId,
  onDeploymentComplete,
}) => {
  const state = useRoomState(client);
  const ops = useRoomOperations(client);

  const [selectedShip, setSelectedShip] = useState<string | null>(null);
  const [placementPosition, setPlacementPosition] = useState<Point | null>(null);
  const [placementHeading, setPlacementHeading] = useState(0);

  // 从状态中提取数据
  const meta = state?.meta;
  const players = state?.players || {};
  const tokens = state?.game?.tokens || {};

  // 当前玩家信息
  const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;
  const faction = currentPlayer?.faction;
  const isReady = currentPlayer?.isReady;

  // 已部署的舰船
  const deployedShips = Object.values(tokens).filter(
    t => t.faction === faction && t.type === 'ship'
  );

  // 处理舰船选择
  const handleShipSelect = useCallback((shipId: string) => {
    setSelectedShip(shipId);
  }, []);

  // 处理部署
  const handleDeploy = useCallback(async (position: Point, heading: number) => {
    if (!ops || !selectedShip || !faction) return;

    const ship = SHIP_PRESETS.find(s => s.id === selectedShip);
    if (!ship) return;

    try {
      const tokenId = `ship_${faction}_${Date.now()}`;
      await ops.deployShip(tokenId, position, heading, ship.config);
      setSelectedShip(null);
    } catch (error) {
      console.error('Failed to deploy ship:', error);
      alert(error instanceof Error ? error.message : '部署失败');
    }
  }, [ops, selectedShip, faction]);

  // 处理移除舰船
  const handleRemoveShip = useCallback(async (tokenId: string) => {
    if (!ops) return;

    try {
      await ops.removeShip(tokenId);
    } catch (error) {
      console.error('Failed to remove ship:', error);
      alert(error instanceof Error ? error.message : '移除失败');
    }
  }, [ops]);

  // 处理确认部署
  const handleConfirmDeployment = useCallback(async () => {
    if (!ops) return;

    try {
      await ops.confirmDeployment();
      onDeploymentComplete?.();
    } catch (error) {
      console.error('Failed to confirm deployment:', error);
      alert(error instanceof Error ? error.message : '确认失败');
    }
  }, [ops, onDeploymentComplete]);

  // 检查是否可以确认
  const canConfirm = faction && deployedShips.length > 0 && !isReady;

  // 加载状态
  if (!state) {
    return <div>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      {/* 左侧：舰船选择 */}
      <aside style={styles.sidebar}>
        <div style={styles.title}>🚀 部署舰船</div>

        <div style={styles.section}>
          <div style={styles.sectionTitle}>选择舰船类型</div>
          <div style={styles.shipList}>
            {SHIP_PRESETS.map(ship => (
              <div
                key={ship.id}
                style={{
                  ...styles.shipCard,
                  ...(selectedShip === ship.id ? styles.shipCardSelected : {}),
                }}
                onClick={() => handleShipSelect(ship.id)}
              >
                <div style={styles.shipName}>{ship.name}</div>
                <div style={styles.shipStats}>
                  {ship.description} | 船体: {ship.config.hull} | 装甲: {ship.config.armor}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 已部署舰船 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>已部署 ({deployedShips.length}/3)</div>
          <div style={styles.shipList}>
            {deployedShips.map(ship => (
              <div
                key={ship.id}
                style={styles.shipCard}
              >
                <div style={styles.shipName}>
                  舰船 {ship.id.slice(-4)}
                  <button
                    style={{ float: 'right', color: 'var(--color-danger)' }}
                    onClick={() => handleRemoveShip(ship.id)}
                  >
                    ✕
                  </button>
                </div>
                <div style={styles.shipStats}>
                  船体: {ship.hull}/{ship.maxHull} | 装甲: {ship.maxArmor}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 确认按钮 */}
        <div style={{ padding: '16px', marginTop: 'auto' }}>
          <button
            style={{
              ...styles.button,
              ...styles.primaryButton,
              ...(!canConfirm ? styles.disabledButton : {}),
            }}
            onClick={handleConfirmDeployment}
            disabled={!canConfirm}
          >
            {isReady ? '✓ 已确认' : '确认部署'}
          </button>
        </div>
      </aside>

      {/* 中央：部署区域 */}
      <main style={styles.main}>
        <div style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'var(--color-background)',
        }}>
          {selectedShip ? (
            <div style={{ textAlign: 'center' as const }}>
              <p>点击地图放置舰船</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                已选择: {SHIP_PRESETS.find(s => s.id === selectedShip)?.name}
              </p>
            </div>
          ) : (
            <div style={{ textAlign: 'center' as const }}>
              <p>请从左侧选择舰船类型</p>
              <p style={{ color: 'var(--color-text-secondary)', fontSize: '12px' }}>
                每个阵营最多部署 3 艘舰船
              </p>
            </div>
          )}
        </div>
      </main>

      {/* 右侧：状态面板 */}
      <aside style={styles.statusPanel}>
        <div style={styles.sectionTitle}>📊 部署状态</div>

        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>阵营</span>
          <span style={styles.statusValue}>{faction || '未选择'}</span>
        </div>

        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>已部署</span>
          <span style={styles.statusValue}>{deployedShips.length}/3</span>
        </div>

        <div style={styles.statusItem}>
          <span style={styles.statusLabel}>状态</span>
          <span style={{
            ...styles.readyBadge,
            ...(isReady ? styles.readyBadgeReady : styles.readyBadgeWaiting),
          }}>
            {isReady ? '已就绪' : '等待中'}
          </span>
        </div>

        {/* 其他玩家状态 */}
        <div style={{ marginTop: '24px' }}>
          <div style={styles.sectionTitle}>👥 其他玩家</div>
          {Object.values(players)
            .filter(p => !p.isDM && p.id !== currentPlayerId)
            .map(player => (
              <div key={player.id} style={styles.statusItem}>
                <span style={styles.statusLabel}>{player.name}</span>
                <span style={{
                  ...styles.readyBadge,
                  ...(player.isReady ? styles.readyBadgeReady : styles.readyBadgeWaiting),
                }}>
                  {player.isReady ? '就绪' : '等待'}
                </span>
              </div>
            ))}
        </div>
      </aside>
    </div>
  );
};

export default DeploymentPhaseView;