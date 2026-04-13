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
    <div style={{ minHeight: '100vh', padding: 20, background: '#00050a', color: '#cfe8ff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2>🏠 游戏大厅</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span>{avatar} {profile.nickname || playerName}</span>
          <button onClick={() => setShowProfile(true)}>玩家档案</button>
          <button onClick={onLogout}>退出登录</button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 260px', gap: 16 }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <h3>房间列表</h3>
            <button onClick={onRefresh} disabled={isLoading}>刷新</button>
          </div>
          {isLoading ? <p>加载中...</p> : rooms.map((room) => (
            <div key={room.id} style={{ border: '1px solid #2b4261', padding: 10, marginBottom: 8 }}>
              <div>{room.name} {room.isPrivate ? '🔒' : ''} {isOwnRoom(room) ? '👑' : ''}</div>
              <div>{room.clients}/{room.maxClients} · {room.phase}</div>
              <button disabled={currentRoomId === room.id} onClick={() => onJoinRoom(room.id)}>加入</button>
              {isOwnRoom(room) && <button onClick={() => onDeleteRoom(room.id)}>删除</button>}
            </div>
          ))}
        </div>

        <div>
          <button onClick={onCreateRoom} style={{ width: '100%', marginBottom: 12 }}>➕ 创建房间</button>
          <div>房间数：{stats.totalRooms}</div>
          <div>在线玩家：{stats.totalPlayers}</div>
        </div>
      </div>

      {showProfile && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.6)', display: 'grid', placeItems: 'center' }} onClick={() => setShowProfile(false)}>
          <div style={{ width: 360, background: '#132235', padding: 16 }} onClick={(event) => event.stopPropagation()}>
            <h3>玩家档案</h3>
            <input value={nickname} onChange={(e) => setNickname(e.target.value)} placeholder="昵称（可选）" maxLength={24} style={{ width: '100%' }} />
            <div style={{ marginTop: 8, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {AVATARS.map((item) => <button key={item} onClick={() => setAvatar(item)}>{item}</button>)}
            </div>
            <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
              <button onClick={() => setShowProfile(false)}>取消</button>
              <button onClick={() => { onUpdateProfile({ nickname, avatar }); setShowProfile(false); }}>保存</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default LobbyPanel;
