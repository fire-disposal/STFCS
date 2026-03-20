/**
 * 创建房间弹窗组件
 */

import React, { useState } from 'react';

// 样式
const styles = {
  overlay: {
    position: 'fixed' as const,
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  modal: {
    backgroundColor: 'var(--color-surface)',
    borderRadius: '12px',
    padding: '32px',
    width: '400px',
    maxWidth: '90vw',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    marginBottom: '24px',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '20px',
  },
  formGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '8px',
  },
  label: {
    fontSize: '13px',
    fontWeight: 'bold',
    color: 'var(--color-text-secondary)',
  },
  input: {
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
    fontSize: '14px',
  },
  select: {
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid var(--color-border)',
    backgroundColor: 'var(--color-background)',
    color: 'var(--color-text)',
    fontSize: '14px',
    cursor: 'pointer',
  },
  checkboxGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  checkbox: {
    width: '18px',
    height: '18px',
    cursor: 'pointer',
  },
  checkboxLabel: {
    fontSize: '14px',
    cursor: 'pointer',
  },
  buttons: {
    display: 'flex',
    gap: '12px',
    marginTop: '8px',
  },
  button: {
    flex: 1,
    padding: '12px',
    borderRadius: '6px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 'bold',
    transition: 'all 0.2s ease',
  },
  cancelButton: {
    backgroundColor: 'var(--color-surface-dark)',
    color: 'var(--color-text)',
  },
  createButton: {
    backgroundColor: 'var(--color-primary)',
    color: 'white',
  },
  hint: {
    fontSize: '12px',
    color: 'var(--color-text-secondary)',
    marginTop: '4px',
  },
};

interface CreateRoomModalProps {
  onClose: () => void;
  onCreate: (params: {
    name: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
  }) => void;
}

export const CreateRoomModal: React.FC<CreateRoomModalProps> = ({
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('');
  const [maxPlayers, setMaxPlayers] = useState(4);
  const [isPrivate, setIsPrivate] = useState(false);
  const [password, setPassword] = useState('');

  // 处理创建
  const handleCreate = () => {
    onCreate({
      name: name.trim() || undefined,
      maxPlayers,
      isPrivate,
      password: isPrivate ? password : undefined,
    });
  };

  // 处理点击外部关闭
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div style={styles.overlay} onClick={handleOverlayClick}>
      <div style={styles.modal}>
        <div style={styles.title}>
          🚀 创建房间
        </div>

        <div style={styles.form}>
          {/* 房间名称 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>房间名称（可选）</label>
            <input
              type="text"
              style={styles.input}
              placeholder="输入房间名称"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={30}
            />
            <span style={styles.hint}>
              不填写将自动生成名称
            </span>
          </div>

          {/* 最大玩家数 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>最大玩家数</label>
            <select
              style={styles.select}
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
            >
              <option value={2}>2 人</option>
              <option value={3}>3 人</option>
              <option value={4}>4 人</option>
              <option value={6}>6 人</option>
              <option value={8}>8 人</option>
            </select>
            <span style={styles.hint}>
              推荐每个阵营1名玩家
            </span>
          </div>

          {/* 私密房间 */}
          <div style={styles.formGroup}>
            <div style={styles.checkboxGroup}>
              <input
                type="checkbox"
                id="private"
                style={styles.checkbox}
                checked={isPrivate}
                onChange={(e) => setIsPrivate(e.target.checked)}
              />
              <label htmlFor="private" style={styles.checkboxLabel}>
                🔒 私密房间
              </label>
            </div>
            {isPrivate && (
              <input
                type="password"
                style={{ ...styles.input, marginTop: '8px' }}
                placeholder="设置房间密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            )}
          </div>

          {/* 按钮 */}
          <div style={styles.buttons}>
            <button
              style={{ ...styles.button, ...styles.cancelButton }}
              onClick={onClose}
            >
              取消
            </button>
            <button
              style={{ ...styles.button, ...styles.createButton }}
              onClick={handleCreate}
              disabled={isPrivate && !password}
            >
              创建
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateRoomModal;