/**
 * 登录面板组件
 *
 * 玩家输入名称并选择加入/创建房间
 */

import React, { useState, useCallback } from 'react';
import '@/styles/auth-lobby.css';

interface LoginPanelProps {
  serverUrl: string;
  onLogin: (playerName: string, mode: 'create' | 'join') => void;
  isLoading?: boolean;
  error?: string | null;
  progress?: string;
}

export const LoginPanel: React.FC<LoginPanelProps> = ({
  serverUrl,
  onLogin,
  isLoading = false,
  error = null,
  progress,
}) => {
  const [playerName, setPlayerName] = useState('');

  const handleSubmit = useCallback((selectedMode: 'create' | 'join') => {
    if (!playerName.trim()) return;
    onLogin(playerName.trim(), selectedMode);
  }, [playerName, onLogin]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && playerName.trim()) {
      handleSubmit('create');
    }
  }, [playerName, handleSubmit]);

  return (
    <div className="login-page">
      <div className="login-card">
        <div className="login-card__header">
          <h1 className="login-card__title">🚀 STFCS</h1>
          <p className="login-card__subtitle">远行星号桌面推演系统</p>
        </div>

        {error && (
          <div className="form-error-banner">
            ⚠️ {error}
          </div>
        )}

        <div className="form-group">
          <label className="form-group__label">玩家名称</label>
          <input
            className="form-group__input"
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的玩家名称"
            maxLength={32}
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div className="button-group">
          <button
            className="btn btn-primary"
            style={{ width: '100%' }}
            onClick={() => handleSubmit('create')}
            disabled={isLoading || !playerName.trim()}
          >
            {isLoading ? '连接中...' : '➕ 创建房间'}
          </button>
          <button
            className="btn btn-secondary"
            style={{ width: '100%' }}
            onClick={() => handleSubmit('join')}
            disabled={isLoading || !playerName.trim()}
          >
            🚪 加入房间
          </button>
        </div>

        {progress && (
          <div className="form-progress">
            {progress}
          </div>
        )}

        <div className="server-status">
          <div>服务端：<span className="server-status__url">{serverUrl}</span></div>
          <div className="server-status__hint">确保服务端已运行在端口 2567</div>
        </div>
      </div>
    </div>
  );
};

export default LoginPanel;
