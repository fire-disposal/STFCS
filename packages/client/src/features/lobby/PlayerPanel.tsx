/**
 * 玩家状态面板
 * 显示房间内玩家列表：
 * - 玩家名称和角色
 * - 连接状态和质量
 * - 准备状态
 * - 控制的舰船数量
 */

import React, { useMemo } from 'react';
import type { PlayerState, ShipState } from '@vt/contracts';

// 样式定义
const styles = {
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '0',
    padding: '16px',
    boxShadow: '0 4px 12px rgba(0, 0, 0, 0.4)',
    border: '1px solid #2b4261',
    minWidth: '280px',
    maxWidth: '320px',
  },
  header: {
    fontSize: '14px',
    fontWeight: 'bold',
    color: '#cfe8ff',
    marginBottom: '12px',
    borderBottom: '1px solid #2b4261',
    paddingBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  playerList: {
    maxHeight: '200px',
    overflow: 'auto',
  },
  playerItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px 12px',
    backgroundColor: '#1a2d42',
    borderRadius: '0',
    marginBottom: '8px',
    transition: 'all 0.2s ease',
    border: '1px solid transparent',
  },
  playerItemCurrent: {
    borderColor: '#43c1ff',
    backgroundColor: '#1a3a5a',
  },
  playerItemDM: {
    borderColor: '#ff6f8f',
  },
  playerAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: '0',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: '12px',
    fontSize: '16px',
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: '#cfe8ff',
    marginBottom: '2px',
  },
  playerRole: {
    fontSize: '11px',
    color: '#8ba4c7',
  },
  playerStatus: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'flex-end',
    gap: '4px',
  },
  statusBadge: {
    padding: '3px 8px',
    borderRadius: '0',
    fontSize: '10px',
    fontWeight: 'bold',
  },
  connectionIndicator: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
  },
  pingValue: {
    color: '#8ba4c7',
  },
  readyButton: {
    padding: '8px 16px',
    borderRadius: '0',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    width: '100%',
    marginTop: '12px',
  },
  readyButtonActive: {
    backgroundColor: '#2ecc71',
    borderColor: '#2ecc71',
    color: 'white',
  },
  emptyState: {
    textAlign: 'center' as const,
    color: '#8ba4c7',
    padding: '16px',
    fontSize: '12px',
  },
  summary: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '8px 0',
    borderTop: '1px solid #2b4261',
    marginTop: '8px',
    fontSize: '11px',
    color: '#8ba4c7',
  },
};

// 连接质量颜色
const qualityColors: Record<string, { color: string; bg: string }> = {
  excellent: { color: '#2ecc71', bg: '#1a5a3a' },
  good: { color: '#43c1ff', bg: '#1a4a7a' },
  fair: { color: '#f1c40f', bg: '#5a4a2a' },
  poor: { color: '#e67e22', bg: '#5a3a2a' },
  offline: { color: '#e74c3c', bg: '#5a2a3a' },
};

// 连接质量图标
const qualityIcons: Record<string, string> = {
  excellent: '●',
  good: '●',
  fair: '◐',
  poor: '○',
  offline: '✕',
};

interface PlayerPanelProps {
  players: PlayerState[];
  ships: ShipState[];
  currentSessionId: string;
  currentPhase: string;
  onToggleReady: (isReady: boolean) => void;
  disabled?: boolean;
}

export const PlayerPanel: React.FC<PlayerPanelProps> = ({
  players,
  ships,
  currentSessionId,
  currentPhase,
  onToggleReady,
  disabled = false,
}) => {
  // 计算每个玩家控制的舰船数量
  const playerShipCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    ships.forEach((ship) => {
      if (ship.ownerId) {
        counts[ship.ownerId] = (counts[ship.ownerId] || 0) + 1;
      }
    });
    return counts;
  }, [ships]);

  // 当前玩家
  const currentPlayer = useMemo(() => {
    return players.find((p) => p.sessionId === currentSessionId);
  }, [players, currentSessionId]);

  // 统计信息
  const stats = useMemo(() => {
    const total = players.length;
    const ready = players.filter((p) => p.isReady && p.connected).length;
    const online = players.filter((p) => p.connected).length;
    const dmCount = players.filter((p) => p.role === 'dm').length;
    return { total, ready, online, dmCount };
  }, [players]);

  // 是否可以准备
  const canReady = useMemo(() => {
    if (disabled) return false;
    if (!currentPlayer) return false;
    if (!currentPlayer.connected) return false;
    if (currentPlayer.role === 'dm') return false; // DM 不需要准备
    if (currentPhase !== 'PLAYER_TURN') return false;
    return true;
  }, [disabled, currentPlayer, currentPhase]);

  if (players.length === 0) {
    return (
      <div style={styles.panel}>
        <div style={styles.header}>👥 玩家列表</div>
        <div style={styles.emptyState}>
          房间内暂无玩家
        </div>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span>👥 玩家列表</span>
        <span style={{ fontSize: '11px', color: '#8ba4c7' }}>
          {stats.online}/{stats.total} 在线
        </span>
      </div>

      {/* 玩家列表 */}
      <div style={styles.playerList}>
        {players.map((player) => {
          const isCurrent = player.sessionId === currentSessionId;
          const isDM = player.role === 'dm';
          const shipCount = playerShipCounts[player.sessionId] || 0;
          const quality = qualityColors[player.connectionQuality] || qualityColors.offline;
          const qualityIcon = qualityIcons[player.connectionQuality] || '○';

          return (
            <div
              key={player.sessionId}
              style={{
                ...styles.playerItem,
                ...(isCurrent ? styles.playerItemCurrent : {}),
                ...(isDM ? styles.playerItemDM : {}),
              }}
            >
              {/* 头像 */}
              <div style={{
                ...styles.playerAvatar,
                backgroundColor: isDM ? '#5a2a3a' : '#1a4a7a',
                color: isDM ? '#ff6f8f' : '#43c1ff',
              }}>
                {isDM ? '👑' : '👤'}
              </div>

              {/* 信息 */}
              <div style={styles.playerInfo}>
                <div style={styles.playerName}>
                  {player.name}
                  {isCurrent && <span style={{ color: '#2ecc71', marginLeft: '4px' }}>（你）</span>}
                </div>
                <div style={styles.playerRole}>
                  {isDM ? '主持人' : '玩家'}
                  {shipCount > 0 && ` · ${shipCount} 舰船`}
                </div>
              </div>

              {/* 状态 */}
              <div style={styles.playerStatus}>
                {/* 连接状态 */}
                <div style={{
                  ...styles.statusBadge,
                  backgroundColor: quality.bg,
                  color: quality.color,
                }}>
                  {player.connected ? qualityIcon : '✕'}
                </div>

                {/* Ping */}
                {player.connected && player.pingMs >= 0 && (
                  <div style={styles.connectionIndicator}>
                    <span style={styles.pingValue}>{player.pingMs}ms</span>
                  </div>
                )}

                {/* 准备状态 */}
                {!isDM && player.connected && (
                  <div style={{
                    ...styles.statusBadge,
                    backgroundColor: player.isReady ? '#2ecc71' : '#1a2d42',
                    color: player.isReady ? 'white' : '#8ba4c7',
                  }}>
                    {player.isReady ? '✓ 准备' : '等待'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* 统计 */}
      <div style={styles.summary}>
        <span>准备: {stats.ready}/{stats.online - stats.dmCount}</span>
        <span>DM: {stats.dmCount}</span>
      </div>

      {/* 准备按钮 */}
      {currentPlayer && currentPlayer.role !== 'dm' && (
        <button
          style={{
            ...styles.readyButton,
            ...(currentPlayer.isReady ? styles.readyButtonActive : {}),
            ...(!canReady ? { opacity: 0.5, cursor: 'not-allowed' } : {}),
          }}
          onClick={() => onToggleReady(!currentPlayer.isReady)}
          disabled={!canReady}
        >
          {currentPlayer.isReady ? '✓ 已准备 - 点击取消' : '准备就绪'}
        </button>
      )}
    </div>
  );
};

export default PlayerPanel;
