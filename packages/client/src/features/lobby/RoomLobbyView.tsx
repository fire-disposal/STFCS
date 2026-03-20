/**
 * 房间准备视图
 *
 * 使用新的房间框架：
 * - useRoomState 订阅状态
 * - useRoomOperations 调用操作
 */

import React, { useCallback, useMemo } from 'react';
import { useRoomState, useRoomOperations } from '@/room';
import type { RoomClient } from '@/room';
import type { OperationMap } from '@vt/shared/room';
import type { FactionId } from '@vt/shared/types';

// ==================== 样式 ====================

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
  },
  sidebar: {
    width: '320px',
    backgroundColor: 'var(--color-surface)',
    borderRight: '1px solid var(--color-border)',
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '24px',
  },
  main: {
    flex: 1,
    padding: '24px',
    display: 'flex',
    flexDirection: 'column' as const,
  },
  section: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '8px',
    padding: '16px',
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  factionGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(2, 1fr)',
    gap: '8px',
  },
  factionCard: {
    padding: '12px',
    borderRadius: '6px',
    border: '2px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  factionCardSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-light)',
  },
  factionCardTaken: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  factionColor: {
    width: '12px',
    height: '12px',
    borderRadius: '50%',
  },
  factionName: {
    fontSize: '13px',
    fontWeight: 'bold',
  },
  playerList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  playerItem: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px',
    backgroundColor: 'var(--color-background)',
    borderRadius: '6px',
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  playerName: {
    fontSize: '14px',
    fontWeight: 'bold',
  },
  playerRole: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
    backgroundColor: 'var(--color-surface-dark)',
  },
  playerFaction: {
    fontSize: '12px',
    padding: '2px 8px',
    borderRadius: '4px',
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
  kickButton: {
    padding: '4px 8px',
    borderRadius: '4px',
    border: '1px solid var(--color-danger)',
    backgroundColor: 'transparent',
    color: 'var(--color-danger)',
    cursor: 'pointer',
    fontSize: '12px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  button: {
    padding: '12px 24px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
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
  guide: {
    backgroundColor: 'var(--color-info-light)',
    borderRadius: '8px',
    padding: '16px',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  guideTitle: {
    fontWeight: 'bold',
    marginBottom: '8px',
  },
  guideList: {
    margin: 0,
    paddingLeft: '20px',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
  },
  roomInfo: {
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
  },
};

// ==================== 阵营配置 ====================

const FACTIONS: Array<{
  id: FactionId;
  name: string;
  color: string;
  description: string;
}> = [
  { id: 'hegemony', name: '霸主', color: '#4a90d9', description: '平衡型，重装甲' },
  { id: 'sindrian', name: '辛德里亚', color: '#d4af37', description: '能量武器优势' },
  { id: 'persean', name: '珀尔修斯', color: '#2ecc71', description: '导弹优势' },
  { id: 'tri_tachyon', name: '三叠纪', color: '#9b59b6', description: '高科技' },
  { id: 'pirate', name: '海盗', color: '#e74c3c', description: '快速，低成本' },
  { id: 'independent', name: '独立', color: '#95a5a6', description: '多样化' },
];

// ==================== Props ====================

interface RoomLobbyViewProps {
  client: RoomClient<OperationMap> | null;
  currentPlayerId: string;
  onLeaveRoom: () => void;
}

// ==================== Component ====================

export const RoomLobbyView: React.FC<RoomLobbyViewProps> = ({
  client,
  currentPlayerId,
  onLeaveRoom,
}) => {
  // 订阅房间状态
  const state = useRoomState(client);
  
  // 获取操作调用器
  const ops = useRoomOperations(client);

  // 从状态中提取数据
  const meta = state?.meta;
  const players = state?.players || {};
  const ownerId = meta?.ownerId || null;
  const roomName = meta?.name || `房间 ${meta?.id?.slice(0, 6) || '未知'}`;

  // 当前玩家信息
  const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;
  const isOwner = currentPlayerId === ownerId;

  // 已选择的阵营
  const takenFactions = useMemo(() => {
    const taken = new Set<FactionId>();
    for (const player of Object.values(players)) {
      if (player.id !== currentPlayerId && player.faction) {
        taken.add(player.faction);
      }
    }
    return taken;
  }, [players, currentPlayerId]);

  // 处理阵营选择
  const handleFactionSelect = useCallback(async (faction: FactionId) => {
    if (takenFactions.has(faction)) return;
    if (!ops) return;

    try {
      await ops.selectFaction(faction);
    } catch (error) {
      console.error('Failed to select faction:', error);
      alert(error instanceof Error ? error.message : '选择阵营失败');
    }
  }, [takenFactions, ops]);

  // 处理踢人
  const handleKickPlayer = useCallback(async (targetId: string) => {
    if (!ops) return;

    try {
      await ops.kick(targetId);
    } catch (error) {
      console.error('Failed to kick player:', error);
      alert(error instanceof Error ? error.message : '踢出玩家失败');
    }
  }, [ops]);

  // 处理开始游戏
  const handleStartGame = useCallback(async () => {
    if (!ops) return;

    const playerCount = Object.keys(players).length;
    if (playerCount < 2) {
      alert('至少需要2名玩家才能开始游戏');
      return;
    }

    try {
      await ops.startGame();
    } catch (error) {
      console.error('Failed to start game:', error);
      alert(error instanceof Error ? error.message : '开始游戏失败');
    }
  }, [players, ops]);

  // 检查是否可以开始游戏
  const canStartGame = isOwner && Object.keys(players).length >= 2;

  // 加载状态
  if (!state) {
    return (
      <div style={styles.container}>
        <div style={{ ...styles.main, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div>加载中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      {/* 侧边栏 */}
      <aside style={styles.sidebar}>
        {/* 房间信息 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>🏠 {roomName}</div>
          <div style={styles.roomInfo}>
            玩家: {Object.keys(players).length}/8
          </div>
          {isOwner && (
            <div style={{ marginTop: '8px', color: 'var(--color-warning)', fontSize: '12px' }}>
              🎮 你是DM（房主）
            </div>
          )}
        </div>

        {/* 阵营选择（非DM玩家可见） */}
        {!isOwner && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>🏳️ 选择阵营</div>
            <div style={styles.factionGrid}>
              {FACTIONS.map(faction => {
                const isTaken = takenFactions.has(faction.id);
                const isSelected = currentPlayer?.faction === faction.id;

                return (
                  <div
                    key={faction.id}
                    style={{
                      ...styles.factionCard,
                      ...(isSelected ? styles.factionCardSelected : {}),
                      ...(isTaken ? styles.factionCardTaken : {}),
                    }}
                    onClick={() => !isTaken && handleFactionSelect(faction.id)}
                  >
                    <div style={{ ...styles.factionColor, backgroundColor: faction.color }} />
                    <div style={styles.factionName}>{faction.name}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 操作按钮 */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {isOwner && (
            <button
              style={{
                ...styles.button,
                ...styles.primaryButton,
                ...(!canStartGame ? styles.disabledButton : {}),
              }}
              onClick={handleStartGame}
              disabled={!canStartGame}
            >
              🚀 开始游戏
            </button>
          )}
          <button
            style={{ ...styles.button, ...styles.secondaryButton }}
            onClick={onLeaveRoom}
          >
            离开房间
          </button>
        </div>
      </aside>

      {/* 主区域 */}
      <main style={styles.main}>
        {/* 标题 */}
        <div style={styles.header}>
          <h1 style={styles.title}>房间准备</h1>
        </div>

        {/* 玩家列表 */}
        <div style={{ ...styles.section, flex: 1 }}>
          <div style={styles.sectionTitle}>👥 玩家列表</div>
          <div style={styles.playerList}>
            {Object.values(players).map(player => {
              const isCurrentPlayer = player.id === currentPlayerId;
              const isPlayerDM = player.isDM;
              const canKick = isOwner && !isCurrentPlayer;

              return (
                <div key={player.id} style={styles.playerItem}>
                  <div style={styles.playerInfo}>
                    <span style={styles.playerName}>
                      {player.name || `玩家 ${player.id.slice(0, 6)}`}
                      {isCurrentPlayer && ' (你)'}
                      {isPlayerDM && ' 👑'}
                    </span>
                    <span style={styles.playerRole}>
                      {isPlayerDM ? '🎮 DM' : '🚀 玩家'}
                    </span>
                    {player.faction && (
                      <span style={{
                        ...styles.playerFaction,
                        backgroundColor: FACTIONS.find(f => f.id === player.faction)?.color || '#666',
                        color: 'white',
                      }}>
                        {FACTIONS.find(f => f.id === player.faction)?.name}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      ...styles.readyBadge,
                      ...(player.isReady || isPlayerDM ? styles.readyBadgeReady : styles.readyBadgeWaiting),
                    }}>
                      {player.isReady || isPlayerDM ? '✓ 就绪' : '○ 等待中'}
                    </span>
                    {canKick && (
                      <button
                        style={styles.kickButton}
                        onClick={() => {
                          if (confirm(`确定要踢出玩家 ${player.name} 吗？`)) {
                            handleKickPlayer(player.id);
                          }
                        }}
                        title="踢出玩家"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 游戏指南 */}
        <div style={styles.guide}>
          <div style={styles.guideTitle}>📋 准备指南</div>
          {isOwner ? (
            <ol style={styles.guideList}>
              <li>等待玩家选择阵营</li>
              <li>确认所有玩家已就绪</li>
              <li>点击"开始游戏"进入部署阶段</li>
            </ol>
          ) : (
            <ol style={styles.guideList}>
              <li>选择你的阵营</li>
              <li>等待DM开始游戏</li>
              <li>在部署阶段放置你的舰船</li>
            </ol>
          )}
        </div>
      </main>
    </div>
  );
};

export default RoomLobbyView;