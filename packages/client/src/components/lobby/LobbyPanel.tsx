/**
 * 游戏大厅组件 - 战术终端风格
 *
 * 与登录页面风格统一：深蓝背景、蓝色霓虹边框、发光效果
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { RoomInfo } from '@/network/NetworkManager';

const styles = {
  container: {
    minHeight: '100vh' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: '#00050a',
    color: '#cfe8ff',
    padding: '24px',
    position: 'relative' as const,
    overflow: 'hidden',
  },
  grid: {
    position: 'absolute' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundImage: `
      linear-gradient(rgba(100, 200, 255, 0.05) 1px, transparent 1px),
      linear-gradient(90deg, rgba(100, 200, 255, 0.05) 1px, transparent 1px)
    `,
    backgroundSize: '50px 50px',
    pointerEvents: 'none' as const,
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '24px',
    paddingBottom: '16px',
    borderBottom: '2px solid rgba(74, 158, 255, 0.4)',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#4a9eff',
    letterSpacing: '4px',
    textShadow: '0 0 10px rgba(74, 158, 255, 0.5)',
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  playerName: {
    fontSize: '15px',
    color: '#8fbfd4',
    fontWeight: '600',
  },
  logoutButton: {
    padding: '10px 18px',
    border: '2px solid rgba(248, 113, 113, 0.4)',
    background: 'rgba(248, 113, 113, 0.1)',
    color: '#f87171',
    fontSize: '13px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
  },
  content: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gap: '24px',
    maxWidth: '1200px',
    margin: '0 auto',
    width: '100%',
  },
  main: {
    backgroundColor: 'rgba(13, 40, 71, 0.7)',
    border: '2px solid rgba(74, 158, 255, 0.3)',
    padding: '28px',
    boxShadow: '0 0 30px rgba(74, 158, 255, 0.2)',
  },
  sidebar: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  section: {
    backgroundColor: 'rgba(13, 40, 71, 0.6)',
    border: '2px solid rgba(74, 158, 255, 0.3)',
    padding: '24px',
  },
  sectionTitle: {
    fontSize: '15px',
    fontWeight: 'bold',
    color: '#8fbfd4',
    marginBottom: '18px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    letterSpacing: '2px',
  },
  roomList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '14px',
    maxHeight: '400px',
    overflowY: 'auto' as const,
  },
  roomCard: {
    padding: '18px 20px',
    backgroundColor: 'rgba(13, 40, 71, 0.5)',
    border: '2px solid rgba(74, 158, 255, 0.2)',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  roomCardHover: {
    border: '2px solid #4a9eff',
    backgroundColor: 'rgba(13, 40, 71, 0.8)',
    boxShadow: '0 0 20px rgba(74, 158, 255, 0.3)',
  },
  roomName: {
    fontSize: '16px',
    fontWeight: 'bold',
    color: '#ffffff',
    marginBottom: '10px',
  },
  roomMeta: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: '#6cb4cc',
  },
  roomStatus: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  statusDot: {
    width: '8px',
    height: '8px',
    backgroundColor: '#4ade80',
    boxShadow: '0 0 8px rgba(74, 222, 128, 0.6)',
  },
  button: {
    width: '100%',
    padding: '16px',
    border: '2px solid #4a9eff',
    background: 'rgba(74, 158, 255, 0.15)',
    color: '#ffffff',
    fontSize: '15px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    letterSpacing: '3px',
    boxShadow: '0 0 20px rgba(74, 158, 255, 0.2)',
  },
  buttonHover: {
    background: 'rgba(74, 158, 255, 0.25)',
    boxShadow: '0 0 30px rgba(74, 158, 255, 0.5)',
  },
  buttonDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
    border: '2px solid #2a3a4a',
    color: '#3a4a5a',
  },
  refreshButton: {
    padding: '10px 16px',
    border: '2px solid rgba(74, 158, 255, 0.4)',
    background: 'rgba(74, 158, 255, 0.1)',
    color: '#6cb4cc',
    fontSize: '12px',
    fontWeight: '700',
    cursor: 'pointer',
    transition: 'all 0.3s ease',
    letterSpacing: '1px',
  },
  emptyState: {
    padding: '48px',
    textAlign: 'center' as const,
    color: '#4a6f85',
    fontSize: '14px',
    backgroundColor: 'rgba(13, 40, 71, 0.3)',
    border: '2px dashed rgba(74, 158, 255, 0.2)',
  },
  stat: {
    display: 'flex',
    justifyContent: 'space-between',
    padding: '12px 0',
    borderBottom: '2px solid rgba(74, 158, 255, 0.2)',
    fontSize: '13px',
    color: '#6cb4cc',
  },
  error: {
    padding: '14px',
    background: 'rgba(248, 113, 113, 0.15)',
    border: '2px solid #f87171',
    color: '#fca5a5',
    fontSize: '14px',
    marginBottom: '24px',
    fontWeight: '500',
  },
};

interface LobbyPanelProps {
  playerName: string;
  currentShortId: number | null;
  currentRoomId: string | null;
  rooms: RoomInfo[];
  isLoading: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onRefresh: () => void;
  onLogout: () => void;
}

export const LobbyPanel: React.FC<LobbyPanelProps> = ({
  playerName,
  currentShortId,
  currentRoomId,
  rooms,
  isLoading,
  onCreateRoom,
  onJoinRoom,
  onDeleteRoom,
  onRefresh,
  onLogout,
}) => {
  const [hoveredRoomId, setHoveredRoomId] = useState<string | null>(null);

  const stats = useMemo(() => {
    const totalPlayers = rooms.reduce((sum, r) => sum + r.clients, 0);
    const totalRooms = rooms.length;
    const fullRooms = rooms.filter(r => r.clients >= r.maxClients).length;
    return { totalPlayers, totalRooms, fullRooms };
  }, [rooms]);

  const isOwnRoom = useCallback((room: RoomInfo) => {
    if (currentShortId === null) {
      return false;
    }

    return room.ownerShortId === currentShortId;
  }, [currentShortId]);

  const handleJoinRoom = useCallback((room: RoomInfo) => {
    if (currentRoomId === room.id) {
      return;
    }

    onJoinRoom(room.id);
  }, [currentRoomId, onJoinRoom]);

  const handleDeleteRoom = useCallback((room: RoomInfo) => {
    if (!isOwnRoom(room)) {
      return;
    }

    const confirmed = window.confirm(`确定要删除房间「${room.name}」吗？此操作不可撤销。`);
    if (!confirmed) {
      return;
    }

    onDeleteRoom(room.id);
  }, [isOwnRoom, onDeleteRoom]);

  return (
    <div style={styles.container}>
      {/* 背景网格 */}
      <div style={styles.grid} />

      {/* 头部 */}
      <div style={styles.header}>
        <h1 style={styles.title}>🏠 游戏大厅</h1>
        <div style={styles.playerInfo}>
          <span style={styles.playerName}>👤 {playerName}</span>
          <button
            data-magnetic
            style={styles.logoutButton}
            onClick={onLogout}
          >
            [ 退出登录 ]
          </button>
        </div>
      </div>

      {/* 主内容 */}
      <div style={styles.content}>
        {/* 房间列表 */}
        <div style={styles.main}>
          <div style={styles.sectionTitle}>
            <span>📋 可用房间</span>
            <button
              data-magnetic
              style={styles.refreshButton}
              onClick={onRefresh}
              disabled={isLoading}
            >
              🔄 刷新
            </button>
          </div>

          {isLoading ? (
            <div style={styles.emptyState}>正在加载房间列表...</div>
          ) : rooms.length === 0 ? (
            <div style={styles.emptyState}>
              <p>暂无可用房间</p>
              <p style={{ fontSize: '12px', marginTop: '12px', color: '#6cb4cc' }}>
                点击右侧"创建房间"开始游戏
              </p>
            </div>
          ) : (
            <div style={styles.roomList}>
              {rooms.map((room) => {
                const ownRoom = isOwnRoom(room);
                const inCurrentRoom = currentRoomId === room.id;
                const canJoin = !inCurrentRoom;

                return (
                  <div
                    key={room.id}
                    data-magnetic
                    style={{
                      ...styles.roomCard,
                      ...(hoveredRoomId === room.id && canJoin ? styles.roomCardHover : {}),
                      ...(inCurrentRoom ? { opacity: 0.7, cursor: 'not-allowed' } : {}),
                    }}
                    onMouseEnter={() => setHoveredRoomId(room.id)}
                    onMouseLeave={() => setHoveredRoomId(null)}
                    onClick={() => handleJoinRoom(room)}
                  >
                    <div style={styles.roomName}>
                      {room.name}
                      {(room.metadata as any)?.isPrivate && ' 🔒'}
                      {ownRoom && ' 👑'}
                    </div>
                    <div style={styles.roomMeta}>
                      <div style={styles.roomStatus}>
                        <div style={styles.statusDot} />
                        <span>{room.clients}/{room.maxClients} 玩家</span>
                      </div>
                      {(room.metadata as any)?.phase && (
                        <span>阶段：{(room.metadata as any).phase}</span>
                      )}
                      {inCurrentRoom ? (
                        <span style={{ color: '#fbbf24', fontWeight: 'bold' }}>当前所在房间</span>
                      ) : ownRoom ? (
                        <span style={{ color: '#4ade80', fontWeight: 'bold' }}>你的房间</span>
                      ) : null}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '12px' }}>
                      <button
                        data-magnetic
                        style={{
                          ...styles.refreshButton,
                          padding: '8px 12px',
                          opacity: canJoin ? 1 : 0.5,
                        }}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJoinRoom(room);
                        }}
                        disabled={!canJoin}
                      >
                        {ownRoom ? '重新进入' : '进入房间'}
                      </button>
                      {ownRoom && (
                        <button
                          data-magnetic
                          style={{
                            ...styles.logoutButton,
                            padding: '8px 12px',
                            borderColor: 'rgba(248, 113, 113, 0.4)',
                            fontSize: '12px',
                          }}
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteRoom(room);
                          }}
                        >
                          删除房间
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 侧边栏 */}
        <div style={styles.sidebar}>
          {/* 创建房间 */}
          <div style={styles.section}>
            <button
              data-magnetic
              style={{
                ...styles.button,
                ...(isLoading ? styles.buttonDisabled : {}),
              }}
              onClick={onCreateRoom}
              disabled={isLoading}
              onMouseEnter={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = styles.buttonHover.background;
                  e.currentTarget.style.boxShadow = styles.buttonHover.boxShadow;
                }
              }}
              onMouseLeave={(e) => {
                if (!isLoading) {
                  e.currentTarget.style.background = styles.button.background;
                  e.currentTarget.style.boxShadow = styles.button.boxShadow;
                }
              }}
            >
              ➕ 创建新房间
            </button>
          </div>

          {/* 统计信息 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📊 实时统计</div>
            <div style={styles.stat}>
              <span>活跃房间</span>
              <span style={{ color: '#4a9eff', fontWeight: 'bold' }}>{stats.totalRooms}</span>
            </div>
            <div style={styles.stat}>
              <span>在线玩家</span>
              <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{stats.totalPlayers}</span>
            </div>
            <div style={styles.stat}>
              <span>已满房间</span>
              <span style={{ color: '#f87171', fontWeight: 'bold' }}>{stats.fullRooms}</span>
            </div>
          </div>

          {/* 游戏指南 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📖 快速指南</div>
            <div style={{ fontSize: '12px', color: '#6cb4cc', lineHeight: '1.8' }}>
              <div>1. 创建或加入房间</div>
              <div>2. 首个玩家自动成为 DM</div>
              <div>3. 等待其他玩家加入</div>
              <div>4. DM 开始游戏</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LobbyPanel;
