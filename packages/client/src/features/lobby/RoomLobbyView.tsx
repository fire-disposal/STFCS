/**
 * 房间准备视图
 *
 * 玩家可以：
 * 1. 选择角色（DM或玩家）
 * 2. 选择阵营
 * 3. 查看其他玩家状态
 * 4. DM可以开始游戏
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAppSelector, useAppDispatch } from '@/store';
import {
  selectCurrentPlayerId,
  selectPlayers,
} from '@/store/slices/playerSlice';
import {
  selectSelectedFaction,
  selectFaction,
  selectPlayerFactions,
} from '@/store/slices/factionSlice';
import { selectIsDMMode, toggleDMMode } from '@/store/slices/uiSlice';
import type { FactionId, PlayerInfo } from '@vt/shared/types';

// 样式
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
  roleSelector: {
    display: 'flex',
    gap: '12px',
  },
  roleCard: {
    flex: 1,
    padding: '16px',
    borderRadius: '8px',
    border: '2px solid var(--color-border)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'center' as const,
  },
  roleCardSelected: {
    borderColor: 'var(--color-primary)',
    backgroundColor: 'var(--color-primary-light)',
  },
  roleCardDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  roleIcon: {
    fontSize: '32px',
    marginBottom: '8px',
  },
  roleName: {
    fontSize: '14px',
    fontWeight: 'bold',
    marginBottom: '4px',
  },
  roleDesc: {
    fontSize: '11px',
    color: 'var(--color-text-secondary)',
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

// 阵营配置
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

interface RoomLobbyViewProps {
  roomId: string;
  roomName?: string;
  ownerId: string | null;
  maxPlayers: number;
  onStartGame: () => void;
  onLeaveRoom: () => void;
  onKickPlayer?: (playerId: string) => void;
}

export const RoomLobbyView: React.FC<RoomLobbyViewProps> = ({
  roomId,
  roomName,
  ownerId,
  maxPlayers,
  onStartGame,
  onLeaveRoom,
  onKickPlayer,
}) => {
  const dispatch = useAppDispatch();
  const currentPlayerId = useAppSelector(selectCurrentPlayerId);
  const players = useAppSelector(selectPlayers);
  const playerFactions = useAppSelector(selectPlayerFactions);
  const selectedFaction = useAppSelector(selectSelectedFaction);
  const isDMMode = useAppSelector(selectIsDMMode);

  const [selectedRole, setSelectedRole] = useState<'dm' | 'player' | null>(null);
  const [isReady, setIsReady] = useState(false);

  // 当前玩家信息
  const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;
  const isOwner = currentPlayerId === ownerId;
  const hasDM = Object.values(players).some(p => p.isDMMode);

  // 已选择的阵营
  const takenFactions = new Set(
    Object.values(playerFactions)
      .filter(pf => pf.playerId !== currentPlayerId)
      .map(pf => pf.faction)
  );

  // 处理角色选择
  const handleRoleSelect = useCallback((role: 'dm' | 'player') => {
    if (role === 'dm' && hasDM && !isDMMode) {
      return; // 已有DM
    }

    setSelectedRole(role);

    if (role === 'dm') {
      dispatch(toggleDMMode(true));
    } else {
      dispatch(toggleDMMode(false));
    }
  }, [hasDM, isDMMode, dispatch]);

  // 处理阵营选择
  const handleFactionSelect = useCallback((faction: FactionId) => {
    if (takenFactions.has(faction)) return;
    dispatch(selectFaction(faction));
    setIsReady(true);
  }, [takenFactions, dispatch]);

  // 处理开始游戏
  const handleStartGame = useCallback(() => {
    // 验证条件
    if (!hasDM) {
      alert('需要一名DM才能开始游戏');
      return;
    }

    const playerCount = Object.values(players).filter(p => !p.isDMMode).length;
    if (playerCount < 2) {
      alert('至少需要2名玩家才能开始游戏');
      return;
    }

    onStartGame();
  }, [hasDM, players, onStartGame]);

  // 检查是否可以开始游戏
  const canStartGame = isDMMode && isOwner && hasDM &&
    Object.values(players).filter(p => !p.isDMMode).length >= 2;

  return (
    <div style={styles.container}>
      {/* 侧边栏 */}
      <aside style={styles.sidebar}>
        {/* 房间信息 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>🏠 {roomName || `房间 ${roomId.slice(0, 6)}`}</div>
          <div style={styles.roomInfo}>
            玩家: {Object.keys(players).length}/{maxPlayers}
          </div>
        </div>

        {/* 角色选择 */}
        <div style={styles.section}>
          <div style={styles.sectionTitle}>🎭 选择角色</div>
          <div style={styles.roleSelector}>
            <div
              style={{
                ...styles.roleCard,
                ...(selectedRole === 'dm' ? styles.roleCardSelected : {}),
                ...(hasDM && !isDMMode ? styles.roleCardDisabled : {}),
              }}
              onClick={() => handleRoleSelect('dm')}
            >
              <div style={styles.roleIcon}>🎮</div>
              <div style={styles.roleName}>DM</div>
              <div style={styles.roleDesc}>游戏主持人</div>
            </div>
            <div
              style={{
                ...styles.roleCard,
                ...(selectedRole === 'player' ? styles.roleCardSelected : {}),
              }}
              onClick={() => handleRoleSelect('player')}
            >
              <div style={styles.roleIcon}>🚀</div>
              <div style={styles.roleName}>玩家</div>
              <div style={styles.roleDesc}>指挥官</div>
            </div>
          </div>
        </div>

        {/* 阵营选择（仅玩家可见） */}
        {selectedRole === 'player' && (
          <div style={styles.section}>
            <div style={styles.sectionTitle}>🏳️ 选择阵营</div>
            <div style={styles.factionGrid}>
              {FACTIONS.map(faction => {
                const isTaken = takenFactions.has(faction.id);
                const isSelected = selectedFaction === faction.id;

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
          {isDMMode && isOwner && (
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
              const playerFaction = playerFactions[player.id];
              const isCurrentPlayer = player.id === currentPlayerId;

              return (
                <div key={player.id} style={styles.playerItem}>
                  <div style={styles.playerInfo}>
                    <span style={styles.playerName}>
                      {player.name}
                      {isCurrentPlayer && ' (你)'}
                      {player.id === ownerId && ' 👑'}
                    </span>
                    <span style={styles.playerRole}>
                      {player.isDMMode ? '🎮 DM' : '🚀 玩家'}
                    </span>
                    {playerFaction && (
                      <span style={{
                        ...styles.playerFaction,
                        backgroundColor: FACTIONS.find(f => f.id === playerFaction.faction)?.color || '#666',
                        color: 'white',
                      }}>
                        {FACTIONS.find(f => f.id === playerFaction.faction)?.name}
                      </span>
                    )}
                  </div>
                  <span style={{
                    ...styles.readyBadge,
                    ...(playerFaction || player.isDMMode ? styles.readyBadgeReady : styles.readyBadgeWaiting),
                  }}>
                    {playerFaction || player.isDMMode ? '✓ 就绪' : '○ 等待中'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 游戏指南 */}
        <div style={styles.guide}>
          <div style={styles.guideTitle}>📋 准备指南</div>
          {isDMMode ? (
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