/**
 * DM 控制面板
 *
 * 使用新的房间框架：
 * - useRoomState 订阅状态
 * - useRoomOperations 调用操作
 */

import React, { useState, useCallback } from 'react';
import { Play, Pause, SkipForward, Users, Sword, Shield, Target, Plus, Trash2 } from 'lucide-react';
import { useRoomState, useRoomOperations } from '@/room';
import type { RoomClient } from '@/room';
import type { OperationMap } from '@vt/shared/room';
import type { FactionId, Point } from '@vt/shared/types';

// ==================== 样式 ====================

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    padding: '16px',
    backgroundColor: 'var(--color-surface)',
    borderRadius: '8px',
    border: '1px solid var(--color-border)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '8px',
  },
  title: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: 'var(--color-warning)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
  },
  section: {
    padding: '12px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
  },
  sectionTitle: {
    fontSize: '12px',
    fontWeight: 'bold',
    color: 'var(--color-text-secondary)',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderBottom: '1px solid var(--color-border)',
  },
  rowLast: {
    borderBottom: 'none',
  },
  label: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
  },
  value: {
    fontSize: '13px',
    fontWeight: 'bold',
  },
  button: {
    padding: '10px 16px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
  },
  primaryButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
  },
  warningButton: {
    backgroundColor: 'var(--color-warning)',
    color: 'white',
  },
  dangerButton: {
    backgroundColor: 'var(--color-danger)',
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
  buttonGroup: {
    display: 'flex',
    gap: '8px',
  },
  phaseIndicator: {
    fontSize: '11px',
    padding: '4px 12px',
    borderRadius: '12px',
    fontWeight: 'bold',
  },
  phasePlayer: {
    backgroundColor: 'var(--color-primary-light)',
    color: 'var(--color-primary)',
  },
  phaseDM: {
    backgroundColor: 'var(--color-warning-light)',
    color: 'var(--color-warning)',
  },
  phaseResolution: {
    backgroundColor: 'var(--color-success-light)',
    color: 'var(--color-success)',
  },
  enemyList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '4px',
    maxHeight: '150px',
    overflowY: 'auto' as const,
  },
  enemyItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-surface)',
    border: '1px solid var(--color-border)',
  },
  enemyName: {
    fontSize: '13px',
    fontWeight: 'bold',
  },
  enemyStats: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
  },
};

// ==================== Props ====================

interface DMControlPanelProps {
  client?: RoomClient<OperationMap> | null;
  currentPlayerId?: string;
  // GameView 传递的 props
  phase?: string;
  round?: number;
  turnPhase?: string;
  onAdvancePhase?: () => Promise<void>;
}

// ==================== Component ====================

const DMControlPanel: React.FC<DMControlPanelProps> = ({
  client,
  currentPlayerId,
}) => {
  const state = useRoomState(client ?? null);
  const ops = useRoomOperations(client ?? null);

  // 从状态中提取数据
  const meta = state?.meta;
  const players = state?.players || {};
  const tokens = state?.game?.tokens || {};

  const phase = meta?.phase || 'lobby';
  const round = meta?.round || 1;
  const turnPhase = meta?.turnPhase || 'player_action';

  // 敌方单位（DM 控制的）
  const enemyShips = Object.values(tokens).filter(
    t => t.type === 'ship' && t.faction === 'pirate'
  );

  // 处理推进阶段
  const handleAdvancePhase = useCallback(async () => {
    if (!ops) return;

    try {
      await ops.advancePhase();
    } catch (error) {
      console.error('Failed to advance phase:', error);
      alert(error instanceof Error ? error.message : '推进失败');
    }
  }, [ops]);

  // 处理开始游戏
  const handleStartGame = useCallback(async () => {
    if (!ops) return;

    try {
      await ops.startGame();
    } catch (error) {
      console.error('Failed to start game:', error);
      alert(error instanceof Error ? error.message : '开始游戏失败');
    }
  }, [ops]);

  // 处理开始战斗
  const handleStartBattle = useCallback(async () => {
    if (!ops) return;

    try {
      await ops.startBattle();
    } catch (error) {
      console.error('Failed to start battle:', error);
      alert(error instanceof Error ? error.message : '开始战斗失败');
    }
  }, [ops]);

  // 处理结束游戏
  const handleEndGame = useCallback(async () => {
    if (!ops) return;

    if (!confirm('确定要结束游戏吗？')) return;

    try {
      await ops.endGame();
    } catch (error) {
      console.error('Failed to end game:', error);
      alert(error instanceof Error ? error.message : '结束游戏失败');
    }
  }, [ops]);

  // 处理部署敌方单位
  const handleDeployEnemy = useCallback(async (position: Point) => {
    if (!ops) return;

    const tokenId = `enemy_${Date.now()}`;
    try {
      await ops.deployEnemy(tokenId, position, 0);
    } catch (error) {
      console.error('Failed to deploy enemy:', error);
      alert(error instanceof Error ? error.message : '部署失败');
    }
  }, [ops]);

  // 处理移除敌方单位
  const handleRemoveEnemy = useCallback(async (tokenId: string) => {
    if (!ops) return;

    try {
      await ops.removeShip(tokenId);
    } catch (error) {
      console.error('Failed to remove enemy:', error);
      alert(error instanceof Error ? error.message : '移除失败');
    }
  }, [ops]);

  // 获取阶段指示器样式
  const getPhaseStyle = () => {
    switch (turnPhase) {
      case 'player_action':
        return { ...styles.phaseIndicator, ...styles.phasePlayer };
      case 'dm_action':
        return { ...styles.phaseIndicator, ...styles.phaseDM };
      case 'resolution':
        return { ...styles.phaseIndicator, ...styles.phaseResolution };
      default:
        return styles.phaseIndicator;
    }
  };

  // 获取阶段名称
  const getPhaseName = () => {
    switch (turnPhase) {
      case 'player_action':
        return '玩家行动';
      case 'dm_action':
        return 'DM 行动';
      case 'resolution':
        return '结算阶段';
      default:
        return turnPhase;
    }
  };

  // 加载状态
  if (!state) {
    return <div style={styles.container}>加载中...</div>;
  }

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div style={styles.title}>
          <Users size={16} />
          DM 控制面板
        </div>
      </div>

      {/* 游戏状态 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>📊 游戏状态</div>
        <div style={styles.row}>
          <span style={styles.label}>阶段</span>
          <span style={styles.value}>
            {phase === 'lobby' ? '大厅' : 
             phase === 'deployment' ? '部署' : 
             phase === 'playing' ? '战斗' : '结束'}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>回合</span>
          <span style={styles.value}>{round}</span>
        </div>
        <div style={{ ...styles.row, ...styles.rowLast }}>
          <span style={styles.label}>当前阶段</span>
          <span style={getPhaseStyle()}>{getPhaseName()}</span>
        </div>
      </div>

      {/* 游戏流程控制 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>🎮 流程控制</div>
        
        {phase === 'lobby' && (
          <button
            style={{ ...styles.button, ...styles.primaryButton, width: '100%' }}
            onClick={handleStartGame}
          >
            <Play size={16} />
            开始游戏
          </button>
        )}

        {phase === 'deployment' && (
          <button
            style={{ ...styles.button, ...styles.primaryButton, width: '100%' }}
            onClick={handleStartBattle}
          >
            <Sword size={16} />
            开始战斗
          </button>
        )}

        {phase === 'playing' && (
          <div style={styles.buttonGroup}>
            <button
              style={{ ...styles.button, ...styles.warningButton, flex: 1 }}
              onClick={handleAdvancePhase}
            >
              <SkipForward size={16} />
              推进阶段
            </button>
            <button
              style={{ ...styles.button, ...styles.dangerButton, flex: 1 }}
              onClick={handleEndGame}
            >
              <Pause size={16} />
              结束游戏
            </button>
          </div>
        )}
      </div>

      {/* 敌方单位管理 */}
      {phase !== 'lobby' && (
        <div style={styles.section}>
          <div style={styles.sectionTitle}>
            <Target size={14} />
            敌方单位 ({enemyShips.length})
          </div>
          
          <div style={styles.enemyList}>
            {enemyShips.map(ship => (
              <div key={ship.id} style={styles.enemyItem}>
                <div>
                  <div style={styles.enemyName}>敌舰 {ship.id.slice(-4)}</div>
                  <div style={styles.enemyStats}>
                    船体: {ship.hull}/{ship.maxHull}
                  </div>
                </div>
                <button
                  style={{ 
                    padding: '4px 8px', 
                    borderRadius: '4px',
                    border: '1px solid var(--color-danger)',
                    backgroundColor: 'transparent',
                    color: 'var(--color-danger)',
                    cursor: 'pointer',
                  }}
                  onClick={() => handleRemoveEnemy(ship.id)}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>

          <button
            style={{ 
              ...styles.button, 
              ...styles.secondaryButton, 
              width: '100%',
              marginTop: '8px',
            }}
            onClick={() => handleDeployEnemy({ x: 400, y: 400 })}
          >
            <Plus size={16} />
            部署敌方单位
          </button>
        </div>
      )}

      {/* 玩家状态 */}
      <div style={styles.section}>
        <div style={styles.sectionTitle}>
          <Users size={14} />
          玩家状态
        </div>
        {Object.values(players)
          .filter(p => !p.isDM)
          .map(player => (
            <div key={player.id} style={styles.row}>
              <span style={styles.label}>{player.name}</span>
              <span style={{
                ...styles.value,
                color: player.isReady ? 'var(--color-success)' : 'var(--color-warning)',
              }}>
                {player.isReady ? '就绪' : '等待'}
              </span>
            </div>
          ))}
      </div>
    </div>
  );
};

export default DMControlPanel;