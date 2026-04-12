/**
 * 游戏大厅视图
 *
 * 玩家可以：
 * 1. 设置玩家名称
 * 2. 创建新房间
 * 3. 加入已有房间
 * 4. 查看房间列表
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useAppSelector } from '@/store';
import { selectCurrentPlayerId } from '@/store/slices/playerSlice';
import { RoomCard } from './RoomCard';
import { CreateRoomModal } from './CreateRoomModal';
import type { RoomInfo } from '@vt/contracts/types';

// 样式
const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: '100vh',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
  },
  header: {
    padding: '20px 40px',
    backgroundColor: 'var(--color-surface)',
    borderBottom: '1px solid var(--color-border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    fontSize: '24px',
    fontWeight: 'bold',
    color: 'var(--color-primary)',
  },
  playerInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  nameInput: {
    padding: '8px 16px',
    borderRadius: '0',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
    fontSize: '14px',
  },
  main: {
    flex: 1,
    display: 'flex',
    padding: '40px',
    gap: '40px',
  },
  sidebar: {
    width: '300px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  content: {
    flex: 1,
  },
  section: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0',
    padding: '20px',
    marginBottom: '20px',
  },
  sectionTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '16px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: {
    padding: '10px 20px',
    borderRadius: '0',
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
  roomList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },
  emptyState: {
    padding: '40px',
    textAlign: 'center' as const,
    color: 'var(--color-text-secondary)',
  },
  guide: {
    backgroundColor: 'var(--color-info-light)',
    borderRadius: '0',
    padding: '16px',
    fontSize: '13px',
    lineHeight: '1.6',
  },
  guideTitle: {
    fontWeight: 'bold',
    marginBottom: '8px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  guideList: {
    margin: 0,
    paddingLeft: '20px',
  },
};

interface LobbyViewProps {
  rooms: RoomInfo[];
  onJoinRoom: (roomId: string, password?: string) => void;
  onCreateRoom: (params: {
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
  }) => void;
  onRefresh: () => void;
  isLoading?: boolean;
}

export const LobbyView: React.FC<LobbyViewProps> = ({
  rooms,
  onJoinRoom,
  onCreateRoom,
  onRefresh,
  isLoading = false,
}) => {
  const currentPlayerId = useAppSelector(selectCurrentPlayerId);

  const [playerName, setPlayerNameState] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [joiningRoomId, setJoiningRoomId] = useState<string | null>(null);

  // 处理加入房间
  const handleJoinRoom = useCallback((roomId: string, password?: string) => {
    if (!playerName.trim()) {
      alert('请先输入你的名称');
      return;
    }
    setJoiningRoomId(roomId);
    onJoinRoom(roomId, password);
  }, [playerName, onJoinRoom]);

  // 处理创建房间
  const handleCreateRoom = useCallback((params: {
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
  }) => {
    if (!playerName.trim()) {
      alert('请先输入你的名称');
      return;
    }
    onCreateRoom(params);
    setShowCreateModal(false);
  }, [playerName, onCreateRoom]);

  // 过滤可见房间（非私密或自己创建的）
  const visibleRooms = rooms.filter(room => 
    !room.isPrivate || room.ownerId === currentPlayerId
  );

  return (
    <div style={styles.container}>
      {/* 头部 */}
      <header style={styles.header}>
        <h1 style={styles.title}>🚀 STFCS - 星际战术指挥系统</h1>
        <div style={styles.playerInfo}>
          <input
            type="text"
            style={styles.nameInput}
            placeholder="输入你的名称"
            value={playerName}
            onChange={(e) => setPlayerNameState(e.target.value)}
            maxLength={20}
          />
        </div>
      </header>

      {/* 主内容 */}
      <main style={styles.main}>
        {/* 侧边栏 */}
        <aside style={styles.sidebar}>
          {/* 操作按钮 */}
          <div style={styles.section}>
            <button
              style={{ ...styles.button, ...styles.primaryButton, width: '100%' }}
              onClick={() => setShowCreateModal(true)}
              disabled={!playerName.trim()}
            >
              ➕ 创建房间
            </button>
          </div>

          {/* 游戏指南 */}
          <div style={styles.guide}>
            <div style={styles.guideTitle}>
              📋 快速指南
            </div>
            <ol style={styles.guideList}>
              <li>输入你的名称</li>
              <li>创建房间或加入已有房间</li>
              <li>在房间中选择角色和阵营</li>
              <li>等待 DM 开始游戏</li>
            </ol>
          </div>

          {/* 统计信息 */}
          <div style={styles.section}>
            <div style={styles.sectionTitle}>📊 在线统计</div>
            <div style={{ fontSize: '13px', color: 'var(--color-text-secondary)' }}>
              <div>活跃房间: {rooms.length}</div>
              <div>在线玩家: {rooms.reduce((sum, r) => sum + r.playerCount, 0)}</div>
            </div>
          </div>
        </aside>

        {/* 房间列表 */}
        <div style={styles.content}>
          <div style={styles.section}>
            <div style={styles.sectionTitle}>
              <span>🏠 房间列表</span>
              <button
                style={{ ...styles.button, ...styles.secondaryButton }}
                onClick={onRefresh}
                disabled={isLoading}
              >
                🔄 刷新
              </button>
            </div>

            {isLoading ? (
              <div style={styles.emptyState}>
                加载中...
              </div>
            ) : visibleRooms.length === 0 ? (
              <div style={styles.emptyState}>
                <p>暂无可用房间</p>
                <p style={{ fontSize: '12px', marginTop: '8px' }}>
                  点击"创建房间"开始新游戏
                </p>
              </div>
            ) : (
              <div style={styles.roomList}>
                {visibleRooms.map(room => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onJoin={(password) => handleJoinRoom(room.id, password)}
                    isJoining={joiningRoomId === room.id}
                    isOwner={room.ownerId === currentPlayerId}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <CreateRoomModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreateRoom}
        />
      )}
    </div>
  );
};

export default LobbyView;
