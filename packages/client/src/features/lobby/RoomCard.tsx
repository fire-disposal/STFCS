/**
 * 房间卡片组件
 *
 * 显示房间信息，支持加入操作
 */

import React, { useState } from 'react';
import type { RoomInfo } from '@vt/contracts';

// 样式
const styles = {
  card: {
    backgroundColor: 'var(--color-background)',
    borderRadius: '0',
    padding: '16px',
    border: '1px solid var(--color-border)',
    transition: 'all 0.2s ease',
    cursor: 'pointer',
  },
  cardHover: {
    borderColor: 'var(--color-primary)',
    boxShadow: '0 2px 8px rgba(0, 0, 0, 0.1)',
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: '12px',
  },
  roomName: {
    fontSize: '16px',
    fontWeight: 'bold',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  status: {
    padding: '4px 8px',
    borderRadius: '0',
    fontSize: '11px',
    fontWeight: 'bold',
  },
  statusWaiting: {
    backgroundColor: 'var(--color-warning-light)',
    color: 'var(--color-warning)',
  },
  statusPlaying: {
    backgroundColor: 'var(--color-success-light)',
    color: 'var(--color-success)',
  },
  statusEnded: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text-secondary)',
  },
  body: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  info: {
    display: 'flex',
    gap: '16px',
    fontSize: '13px',
    color: 'var(--color-text-secondary)',
  },
  infoItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  button: {
    padding: '8px 16px',
    borderRadius: '0',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  joinButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
  },
  disabledButton: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text-secondary)',
    cursor: 'not-allowed',
  },
  privateIcon: {
    color: 'var(--color-warning)',
  },
  passwordOverlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  passwordModal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '0',
    padding: '24px',
    width: '300px',
  },
  passwordTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    marginBottom: '16px',
  },
  passwordInput: {
    width: '100%',
    padding: '10px',
    borderRadius: '0',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
    fontSize: '14px',
    marginBottom: '16px',
  },
  passwordButtons: {
    display: 'flex',
    gap: '12px',
  },
};

// 房间状态映射
const ROOM_STATUS: Record<string, { label: string; style: React.CSSProperties }> = {
  lobby: { label: '等待中', style: styles.statusWaiting },
  deployment: { label: '部署中', style: styles.statusWaiting },
  playing: { label: '游戏中', style: styles.statusPlaying },
  paused: { label: '已暂停', style: styles.statusWaiting },
  ended: { label: '已结束', style: styles.statusEnded },
};

interface RoomCardProps {
  room: RoomInfo;
  onJoin: (password?: string) => void;
  isJoining?: boolean;
  isOwner?: boolean;
}

export const RoomCard: React.FC<RoomCardProps> = ({
  room,
  onJoin,
  isJoining = false,
  isOwner = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [showPasswordInput, setShowPasswordInput] = useState(false);
  const [password, setPassword] = useState('');

  // 是否可以加入
  const canJoin = room.phase === 'lobby' && room.playerCount < room.maxPlayers;

  // 处理点击
  const handleClick = () => {
    if (!canJoin) return;

    if (room.isPrivate && !isOwner) {
      setShowPasswordInput(true);
    } else {
      onJoin();
    }
  };

  // 处理密码确认
  const handlePasswordConfirm = () => {
    onJoin(password);
    setShowPasswordInput(false);
    setPassword('');
  };

  // 获取状态样式
  const statusConfig = ROOM_STATUS[room.phase] || ROOM_STATUS.lobby;

  return (
    <>
      <div
        style={{
          ...styles.card,
          ...(isHovered && canJoin ? styles.cardHover : {}),
          ...(!canJoin ? { opacity: 0.6, cursor: 'not-allowed' } : {}),
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onClick={handleClick}
      >
        <div style={styles.header}>
          <div style={styles.roomName}>
            {room.isPrivate && <span style={styles.privateIcon}>🔒</span>}
            {room.name || `房间 ${room.id.slice(0, 6)}`}
            {isOwner && <span style={{ color: 'var(--color-primary)' }}>👑</span>}
          </div>
          <span style={{ ...styles.status, ...statusConfig.style }}>
            {statusConfig.label}
          </span>
        </div>

        <div style={styles.body}>
          <div style={styles.info}>
            <div style={styles.infoItem}>
              👥 {room.playerCount}/{room.maxPlayers}
            </div>
            {room.isPrivate && (
              <div style={styles.infoItem}>
                🔒 私密
              </div>
            )}
          </div>

          <button
            style={{
              ...styles.button,
              ...styles.joinButton,
              ...(!canJoin ? styles.disabledButton : {}),
            }}
            disabled={!canJoin || isJoining}
          >
            {isJoining ? '加入中...' : canJoin ? '加入' : '已满'}
          </button>
        </div>
      </div>

      {/* 密码输入弹窗 */}
      {showPasswordInput && (
        <div
          style={styles.passwordOverlay}
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowPasswordInput(false);
            }
          }}
        >
          <div style={styles.passwordModal}>
            <div style={styles.passwordTitle}>
              🔒 输入房间密码
            </div>
            <input
              type="password"
              style={styles.passwordInput}
              placeholder="房间密码"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordConfirm();
                }
              }}
              autoFocus
            />
            <div style={styles.passwordButtons}>
              <button
                style={{ ...styles.button, flex: 1, backgroundColor: 'var(--color-surface-dark)' }}
                onClick={() => setShowPasswordInput(false)}
              >
                取消
              </button>
              <button
                style={{ ...styles.button, ...styles.joinButton, flex: 1 }}
                onClick={handlePasswordConfirm}
                disabled={!password}
              >
                确认
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default RoomCard;
