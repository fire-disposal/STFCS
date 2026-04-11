/**
 * 认证面板组件 - 简化版（保留原设计风格）
 *
 * 只需输入用户名即可进入大厅，保留原有视觉风格
 */

import React, { useState, useCallback, useEffect } from 'react';
import type { User } from '@/types/auth';

type AuthMode = 'login' | 'register';

const styles = {
  container: {
    minHeight: '100vh' as const,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    background: 'linear-gradient(135deg, #00050a 0%, #001020 50%, #00050a 100%)',
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
  card: {
    position: 'relative' as const,
    display: 'flex',
    width: '100%',
    maxWidth: '950px',
    background: 'rgba(13, 40, 71, 0.8)',
    border: '2px solid #4a9eff',
    boxShadow: '0 0 40px rgba(74, 158, 255, 0.4)',
    zIndex: 1,
  },
  leftPanel: {
    flex: '0 0 300px',
    padding: '48px 40px',
    borderRight: '2px solid #1a6b8c',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'space-between',
    background: 'linear-gradient(180deg, #0d2847 0%, #0a2340 100%)',
    borderRadius: '14px 0 0 14px',
  },
  rightPanel: {
    flex: 1,
    padding: '48px 40px',
    display: 'flex',
    flexDirection: 'column' as const,
    justifyContent: 'center',
    minHeight: '420px',
  },
  logo: {
    fontSize: '72px',
    marginBottom: '16px',
    textAlign: 'center' as const,
    color: '#4a9eff',
    textShadow: '0 0 20px rgba(74, 158, 255, 0.6)',
  },
  title: {
    fontSize: '32px',
    fontWeight: 'bold',
    color: '#ffffff',
    textAlign: 'center' as const,
    marginBottom: '8px',
    letterSpacing: '8px',
  },
  subtitle: {
    fontSize: '13px',
    color: '#6cb4cc',
    textAlign: 'center' as const,
    letterSpacing: '4px',
    fontWeight: '500',
  },
  statusBlock: {
    padding: '20px',
    background: 'rgba(13, 40, 71, 0.6)',
    border: '2px solid rgba(74, 158, 255, 0.4)',
    marginTop: '32px',
  },
  statusLine: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '15px',
    color: '#8fbfd4',
    marginBottom: '14px',
    fontWeight: '600',
  },
  statusLabel: {
    color: '#5a8a9e',
    fontWeight: '600',
  },
  statusValue: {
    color: '#4ade80',
    fontWeight: 'bold',
  },
  statusValueWarning: {
    color: '#fbbf24',
    fontWeight: 'bold',
  },
  statusValueError: {
    color: '#f87171',
    fontWeight: 'bold',
  },
  version: {
    fontSize: '12px',
    color: '#4a6f85',
    marginTop: '24px',
    textAlign: 'center' as const,
    fontWeight: '600',
  },
  formGroup: {
    marginBottom: '24px',
  },
  label: {
    display: 'block',
    fontSize: '14px',
    color: '#8fbfd4',
    marginBottom: '10px',
    fontWeight: '700',
    letterSpacing: '1px',
  },
  input: {
    width: '100%',
    padding: '14px 16px',
    background: 'rgba(13, 40, 71, 0.5)',
    border: '2px solid rgba(74, 158, 255, 0.3)',
    color: '#ffffff',
    fontSize: '16px',
    outline: 'none',
    boxSizing: 'border-box' as const,
    transition: 'all 0.2s ease',
  },
  inputFocus: {
    borderColor: '#4a9eff',
    boxShadow: '0 0 20px rgba(74, 158, 255, 0.4)',
    background: 'rgba(13, 40, 71, 0.7)',
  },
  button: {
    width: '100%',
    padding: '16px',
    border: '2px solid #4a9eff',
    background: 'rgba(74, 158, 255, 0.15)',
    color: '#ffffff',
    fontSize: '16px',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    marginTop: '8px',
    transition: 'all 0.3s ease',
  },
  buttonHover: {
    background: 'rgba(74, 158, 255, 0.25)',
    boxShadow: '0 0 25px rgba(74, 158, 255, 0.5)',
  },
  buttonDisabled: {
    opacity: 0.3,
    cursor: 'not-allowed',
    borderColor: '#2a3a4a',
    color: '#3a4a5a',
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
  progress: {
    textAlign: 'center' as const,
    fontSize: '13px',
    color: '#6cb4cc',
    marginTop: '16px',
    fontWeight: '500',
  },
  footer: {
    marginTop: '24px',
    textAlign: 'center' as const,
    fontSize: '12px',
    color: '#5a8a9e',
    borderTop: '2px solid rgba(74, 158, 255, 0.3)',
    paddingTop: '16px',
    fontWeight: '600',
  },
};

interface AuthPanelProps {
  serverUrl: string;
  onAuthenticated: (user: User, token: string) => void;
}

export const AuthPanel: React.FC<AuthPanelProps> = ({
  serverUrl,
  onAuthenticated,
}) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [buttonHovered, setButtonHovered] = useState(false);
  const [serverStatus, setServerStatus] = useState({ online: true, port: '2567', secure: false });

  // 恢复上次用户名
  useEffect(() => {
    const saved = localStorage.getItem('stfcs_username');
    if (saved) setUsername(saved);
  }, []);

  const handleSubmit = useCallback(async () => {
    const trimmed = username.trim();
    if (!trimmed) {
      setError('请输入指挥官代号');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // 简化：直接返回用户，不需要密码
      const user: User = { username: trimmed };
      const token = 'simple-token-' + Date.now();
      
      // 保存用户名
      localStorage.setItem('stfcs_username', trimmed);
      
      setTimeout(() => {
        onAuthenticated(user, token);
      }, 300);
    } catch (e) {
      console.error('[AuthPanel] Error:', e);
      setError(e instanceof Error ? e.message : '连接失败');
    } finally {
      setIsLoading(false);
    }
  }, [username, onAuthenticated]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !isLoading) {
      handleSubmit();
    }
  }, [handleSubmit, isLoading]);

  const isValid = username.trim().length > 0;

  return (
    <div style={styles.container}>
      {/* 背景网格 */}
      <div style={styles.grid} />

      <div style={styles.card}>
        {/* 左侧面板 */}
        <div style={styles.leftPanel}>
          <div>
            <div style={styles.logo}>◈</div>
            <h1 style={styles.title}>STFCS</h1>
            <p style={styles.subtitle}>战术指挥系统</p>

            <div style={styles.statusBlock}>
              <div style={styles.statusLine}>
                <span style={styles.statusLabel}>系统状态</span>
                <span style={serverStatus.online ? styles.statusValue : styles.statusValueError}>
                  [ {serverStatus.online ? '在线' : '离线'} ]
                </span>
              </div>
              <div style={styles.statusLine}>
                <span style={styles.statusLabel}>服务端口</span>
                <span style={styles.statusValue}>{serverStatus.port}</span>
              </div>
              <div style={styles.statusLine}>
                <span style={styles.statusLabel}>连接加密</span>
                <span style={serverStatus.secure ? styles.statusValue : styles.statusValueWarning}>
                  [ {serverStatus.secure ? '是' : '否'} ]
                </span>
              </div>
            </div>
          </div>

          <div style={styles.version}>
            <div>STFCS v2.0</div>
            <div>2026</div>
          </div>
        </div>

        {/* 右侧面板 */}
        <div style={styles.rightPanel}>
          {error && <div style={styles.error}>{error}</div>}

          {/* 表单 */}
          <div style={styles.formGroup}>
            <label style={styles.label}>指挥官代号</label>
            <input
              data-magnetic
              style={{
                ...styles.input,
                ...(focusedInput === 'username' ? styles.inputFocus : {}),
              }}
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onFocus={() => setFocusedInput('username')}
              onBlur={() => setFocusedInput(null)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的代号"
              maxLength={32}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <button
            data-magnetic
            style={{
              ...styles.button,
              ...(isLoading || !isValid ? styles.buttonDisabled : {}),
              ...(buttonHovered && !isLoading && isValid ? styles.buttonHover : {}),
            }}
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
            onMouseEnter={() => setButtonHovered(true)}
            onMouseLeave={() => setButtonHovered(false)}
          >
            {isLoading ? (
              <span>连接中...</span>
            ) : (
              <span>进  入</span>
            )}
          </button>

          {isLoading && (
            <div style={styles.progress}>
              正在验证身份...
            </div>
          )}

          {/* 底部状态 */}
          <div style={styles.footer}>
            <div>服务器：{serverUrl}</div>
            <div style={{ marginTop: '6px' }}>
              [{isLoading ? '认证中' : '就绪'}]
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuthPanel;
