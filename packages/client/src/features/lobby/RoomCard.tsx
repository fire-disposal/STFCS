/**
 * 房间卡片组件
 *
 * 显示房间信息，支持加入操作
 */

import React from 'react';
import type { RoomInfo } from '@vt/contracts';

// 房间状态映射
const ROOM_STATUS: Record<string, { label: string; className: string }> = {
  lobby: { label: '等待中', className: 'room-card__status--lobby' },
  deployment: { label: '部署中', className: 'room-card__status--deployment' },
  playing: { label: '游戏中', className: 'room-card__status--playing' },
  paused: { label: '已暂停', className: 'room-card__status--paused' },
  ended: { label: '已结束', className: 'room-card__status--ended' },
};

interface RoomCardProps {
  room: RoomInfo;
  onJoin: () => void;
  isJoining?: boolean;
  isOwner?: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  onJoin,
  isJoining = false,
  isOwner = false,
}) => {
  // 是否可以加入
  const canJoin = room.phase === 'lobby' && room.playerCount < room.maxPlayers;

  // 处理点击
  const handleClick = () => {
    if (!canJoin) return;
    onJoin();
  };

  // 获取状态配置
  const statusConfig = ROOM_STATUS[room.phase] || ROOM_STATUS.lobby;

  return (
    <div
      className={`
        room-card
        ${canJoin ? '' : 'room-card--disabled'}
      `}
      onClick={handleClick}
    >
      <div className="room-card__header">
        <div className="room-card__name">
          {room.name || `房间 ${room.id.slice(0, 6)}`}
          {isOwner && <span className="room-card__owner-icon">👑</span>}
        </div>
        <span className={`room-card__status ${statusConfig.className}`}>
          {statusConfig.label}
        </span>
      </div>

      <div className="room-card__body">
        <div className="room-card__info">
          <div className="room-card__info-item">
            👥 {room.playerCount}/{room.maxPlayers}
          </div>
        </div>

        <button
          className="room-card__join-btn"
          disabled={!canJoin || isJoining}
        >
          {isJoining ? '加入中...' : canJoin ? '加入' : '已满'}
        </button>
      </div>
    </div>
  );
};

export default RoomCard;
