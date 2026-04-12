/**
 * 游戏大厅视图
 *
 * 玩家可以：
 * 1. 设置玩家名称
 * 2. 创建新房间
 * 3. 加入已有房间
 * 4. 查看房间列表
 */

import React, { useState, useCallback } from 'react';
import { useAppSelector } from '@/store';
import { selectCurrentPlayerId } from '@/store/slices/playerSlice';
import { RoomCard } from './RoomCard';
import { CreateRoomModal } from './CreateRoomModal';
import type { RoomInfo } from '@vt/contracts/types';
import '@/styles/auth-lobby.css';

interface LobbyViewProps {
  rooms: RoomInfo[];
  onJoinRoom: (roomId: string) => void;
  onCreateRoom: (params: {
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
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
  const handleJoinRoom = useCallback((roomId: string) => {
    if (!playerName.trim()) {
      alert('请先输入你的名称');
      return;
    }
    setJoiningRoomId(roomId);
    onJoinRoom(roomId);
  }, [playerName, onJoinRoom]);

  // 处理创建房间
  const handleCreateRoom = useCallback((params: {
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
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
    <div className="lobby-page">
      {/* 头部 */}
      <header className="lobby-page__header">
        <h1 className="lobby-page__title">🚀 STFCS - 星际战术指挥系统</h1>
        <div className="lobby-page__player-info">
          <input
            className="lobby-page__name-input"
            type="text"
            placeholder="输入你的名称"
            value={playerName}
            onChange={(e) => setPlayerNameState(e.target.value)}
            maxLength={20}
          />
        </div>
      </header>

      {/* 主内容 */}
      <main className="lobby-page__main">
        {/* 侧边栏 */}
        <aside className="lobby-page__sidebar">
          {/* 操作按钮 */}
          <div className="section-panel">
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setShowCreateModal(true)}
              disabled={!playerName.trim()}
            >
              ➕ 创建房间
            </button>
          </div>

          {/* 游戏指南 */}
          <div className="game-guide">
            <div className="game-guide__title">
              📋 快速指南
            </div>
            <ol className="game-guide__list">
              <li>输入你的名称</li>
              <li>创建房间或加入已有房间</li>
              <li>在房间中选择角色和阵营</li>
              <li>等待 DM 开始游戏</li>
            </ol>
          </div>

          {/* 统计信息 */}
          <div className="section-panel">
            <div className="section-panel__header">
              <span className="section-panel__title">📊 在线统计</span>
            </div>
            <div className="stats-list">
              <div className="stats-list__item">
                <span className="stats-list__label">活跃房间:</span>
                <span className="stats-list__value">{rooms.length}</span>
              </div>
              <div className="stats-list__item">
                <span className="stats-list__label">在线玩家:</span>
                <span className="stats-list__value">
                  {rooms.reduce((sum, r) => sum + r.playerCount, 0)}
                </span>
              </div>
            </div>
          </div>
        </aside>

        {/* 房间列表 */}
        <div className="lobby-page__content">
          <div className="section-panel">
            <div className="section-panel__header">
              <span className="section-panel__title">🏠 房间列表</span>
              <button
                className="btn btn-secondary"
                onClick={onRefresh}
                disabled={isLoading}
              >
                🔄 刷新
              </button>
            </div>

            {isLoading ? (
              <div className="loading-state">加载中...</div>
            ) : visibleRooms.length === 0 ? (
              <div className="empty-state">
                <p className="empty-state__text">暂无可用房间</p>
                <p className="empty-state__hint">
                  点击"创建房间"开始新游戏
                </p>
              </div>
            ) : (
              <div className="room-list">
                {visibleRooms.map(room => (
                  <RoomCard
                    key={room.id}
                    room={room}
                    onJoin={() => handleJoinRoom(room.id)}
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
