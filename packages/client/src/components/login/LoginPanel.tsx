/**
 * 登录面板组件
 * 
 * 玩家输入名称并选择加入/创建房间
 */

import React, { useState, useCallback } from 'react';

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: '100vh',
    backgroundColor: '#060a10',
    padding: '24px',
  },
  card: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '12px',
    padding: '32px',
    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)',
    border: '1px solid #2b4261',
    maxWidth: '480px',
    width: '100%',
  },
  title: {
    fontSize: '28px',
    fontWeight: 'bold',
    color: '#4a9eff',
    marginBottom: '8px',
    textAlign: 'center' as const,
  },
  subtitle: {
    fontSize: '14px',
    color: '#8ba4c7',
    textAlign: 'center' as const,
    marginBottom: '32px',
  },
  formGroup: {
    marginBottom: '20px',
    width: '100%',
  },
  label: {
    fontSize: '12px',
    color: '#8ba4c7',
    marginBottom: '8px',
    display: 'block',
    fontWeight: 'bold' as const,
  },
  input: {
    width: '100%',
    padding: '12px 16px',
    borderRadius: '6px',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color 0.2s',
  },
  button: {
    width: '100%',
    padding: '14px',
    borderRadius: '6px',
    border: 'none',
    backgroundColor: '#1a4a7a',
    color: '#4a9eff',
    fontSize: '14px',
    fontWeight: 'bold' as const,
    cursor: 'pointer',
    transition: 'all 0.2s',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  buttonPrimary: {
    backgroundColor: '#1a4a7a',
    borderColor: '#4a9eff',
  },
  buttonSecondary: {
    backgroundColor: 'transparent',
    border: '1px solid #2b4261',
    color: '#8ba4c7',
  },
  buttonDisabled: {
    opacity: 0.5,
    cursor: 'not-allowed',
  },
  error: {
    padding: '12px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 74, 74, 0.2)',
    border: '1px solid #ff4a4a',
    color: '#ff6f8f',
    fontSize: '13px',
    marginBottom: '20px',
  },
  progress: {
    fontSize: '12px',
    color: '#4a9eff',
    textAlign: 'center' as const,
    marginTop: '12px',
    fontStyle: 'italic' as const,
  },
  serverStatus: {
    fontSize: '11px',
    color: '#6b7280',
    textAlign: 'center' as const,
    marginTop: '16px',
  },
  buttonGroup: {
    display: 'flex',
    gap: '12px',
    marginTop: '16px',
  },
};

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
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const handleSubmit = useCallback((selectedMode: 'create' | 'join') => {
    if (!playerName.trim()) return;
    onLogin(playerName.trim(), selectedMode);
  }, [playerName, onLogin]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && playerName.trim()) {
      handleSubmit(mode);
    }
  }, [playerName, mode, handleSubmit]);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>🚀 STFCS</h1>
        <p style={styles.subtitle}>远行星号桌面推演系统</p>

        {error && (
          <div style={styles.error}>
            ⚠️ {error}
          </div>
        )}

        <div style={styles.formGroup}>
          <label style={styles.label}>玩家名称</label>
          <input
            style={styles.input}
            value={playerName}
            onChange={(e) => setPlayerName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="输入你的玩家名称"
            maxLength={32}
            disabled={isLoading}
            autoFocus
          />
        </div>

        <div style={styles.buttonGroup}>
          <button
            style={{
              ...styles.button,
              ...styles.buttonPrimary,
              ...(isLoading || !playerName.trim() ? styles.buttonDisabled : {}),
            }}
            onClick={() => handleSubmit('create')}
            disabled={isLoading || !playerName.trim()}
          >
            {isLoading ? '连接中...' : '➕ 创建房间'}
          </button>
          <button
            style={{
              ...styles.button,
              ...styles.buttonSecondary,
              ...(isLoading || !playerName.trim() ? styles.buttonDisabled : {}),
            }}
            onClick={() => handleSubmit('join')}
            disabled={isLoading || !playerName.trim()}
          >
            🚪 加入房间
          </button>
        </div>

        {progress && (
          <div style={styles.progress}>
            {progress}
          </div>
        )}

        <div style={styles.serverStatus}>
          服务端：{serverUrl}
          <br />
          <span style={{ color: '#4a5a6a' }}>确保服务端已运行在端口 2567</span>
        </div>
      </div>
    </div>
  );
};

export default LoginPanel;
