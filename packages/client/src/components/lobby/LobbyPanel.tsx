/**
 * 大厅面板组件
 *
 * 房间列表和玩家信息
 * 使用 CSS 类名而非内联样式
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { RoomInfo } from '@/network/NetworkManager';

const AVATARS = ['👤', '🚀', '🛰️', '🤖', '🧠', '🛸'];

interface LobbyPanelProps {
  playerName: string;
  profile: { nickname: string; avatar: string };
  currentShortId: number | null;
  currentRoomId: string | null;
  rooms: RoomInfo[];
  isLoading: boolean;
  onCreateRoom: () => void;
  onJoinRoom: (roomId: string) => void;
  onDeleteRoom: (roomId: string) => void;
  onRefresh: () => void;
  onLogout: () => void;
  onUpdateProfile: (profile: { nickname?: string; avatar?: string }) => void;
}

export const LobbyPanel: React.FC<LobbyPanelProps> = ({
  playerName,
  profile,
  currentShortId,
  currentRoomId,
  rooms,
  isLoading,
  onCreateRoom,
  onJoinRoom,
  onDeleteRoom,
  onRefresh,
  onLogout,
  onUpdateProfile,
}) => {
  const [showProfile, setShowProfile] = useState(false);
  const [nickname, setNickname] = useState(profile.nickname);
  const [avatar, setAvatar] = useState(profile.avatar || '👤');

  const stats = useMemo(() => ({
    totalRooms: rooms.length,
    totalPlayers: rooms.reduce((sum, room) => sum + room.clients, 0),
  }), [rooms]);

  const isOwnRoom = useCallback((room: RoomInfo) => (
    currentShortId !== null && room.ownerShortId === currentShortId
  ), [currentShortId]);

  return (
    <div className="lobby-container">
      <header className="lobby-header">
        <h2 className="lobby-title">🏠 游戏大厅</h2>
        <div className="lobby-user-bar">
          <span>{avatar} {profile.nickname || playerName}</span>
          <button data-magnetic onClick={() => setShowProfile(true)}>玩家档案</button>
          <button data-magnetic onClick={onLogout}>退出登录</button>
        </div>
      </header>

      <div className="lobby-main">
        <div>
          <div className="lobby-room-list-header">
            <h3>房间列表</h3>
            <button data-magnetic onClick={onRefresh} disabled={isLoading}>刷新</button>
          </div>
          {isLoading ? (
            <p>加载中...</p>
          ) : (
            <div className="lobby-room-list">
              {rooms.map((room) => (
                <div key={room.id} className="lobby-room-card">
                  <div className="lobby-room-name">
                    {room.name}
                    {room.isPrivate && ' 🔒'}
                    {isOwnRoom(room) && ' 👑'}
                  </div>
                  <div className="lobby-room-meta">
                    <span>{room.clients}/{room.maxClients}</span>
                    <span>{room.phase}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      data-magnetic
                      disabled={currentRoomId === room.id}
                      onClick={() => onJoinRoom(room.id)}
                    >
                      加入
                    </button>
                    {isOwnRoom(room) && (
                      <button data-magnetic onClick={() => onDeleteRoom(room.id)}>删除</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="lobby-sidebar">
          <button data-magnetic style={{ width: '100%' }} onClick={onCreateRoom}>
            ➕ 创建房间
          </button>
          <div className="lobby-stats">
            <div>房间数：{stats.totalRooms}</div>
            <div>在线玩家：{stats.totalPlayers}</div>
          </div>
        </div>
      </div>

      {showProfile && (
        <div className="modal-overlay" onClick={() => setShowProfile(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3 className="modal-title">玩家档案</h3>
            <input
              className="modal-input"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="昵称（可选）"
              maxLength={24}
            />
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AVATARS.map((item) => (
                <button
                  key={item}
                  data-magnetic
                  onClick={() => setAvatar(item)}
                  style={{ opacity: avatar === item ? 1 : 0.6 }}
                >
                  {item}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              <button className="modal-btn" onClick={() => setShowProfile(false)}>取消</button>
              <button
                className="modal-btn modal-btn--primary"
                onClick={() => {
                  onUpdateProfile({ nickname, avatar });
                  setShowProfile(false);
                }}
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyPanel;