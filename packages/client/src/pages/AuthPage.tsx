/**
 * 认证面板组件 - 简化版
 *
 * 只需输入用户名即可进入大厅
 * 使用 CSS 类名而非内联样式
 */

import React, { useState, useCallback, useEffect } from 'react';

interface AuthPageProps {
  onAuthenticated: (username: string) => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({
  onAuthenticated,
}) => {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverStatus] = useState({ online: true, port: '2567', secure: false });

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
      localStorage.setItem('stfcs_username', trimmed);
      onAuthenticated(trimmed);
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
    <div className="auth-container">
      <div className="auth-grid-bg" />

      <div className="auth-dual-panel">
        <div className="auth-left-panel">
          <div>
            <div className="auth-logo">◈</div>
            <h1 className="auth-title">STFCS</h1>
            <p className="auth-subtitle">战术指挥系统</p>

            <div className="auth-status-block">
              <div className="auth-status-line">
                <span className="auth-status-label">系统状态</span>
                <span className={serverStatus.online ? 'auth-status-value' : 'auth-status-value--error'}>
                  [ {serverStatus.online ? '在线' : '离线'} ]
                </span>
              </div>
              <div className="auth-status-line">
                <span className="auth-status-label">服务端口</span>
                <span className="auth-status-value">{serverStatus.port}</span>
              </div>
              <div className="auth-status-line">
                <span className="auth-status-label">连接加密</span>
                <span className={serverStatus.secure ? 'auth-status-value' : 'auth-status-value--warning'}>
                  [ {serverStatus.secure ? '是' : '否'} ]
                </span>
              </div>
            </div>
          </div>

          <div className="auth-version">
            <div>STFCS v2.0</div>
            <div>2026</div>
          </div>
        </div>

        <div className="auth-right-panel">
          {error && <div className="auth-error">{error}</div>}

          <div className="auth-form-group">
            <label className="auth-label">指挥官代号</label>
            <input
              data-magnetic
              className="auth-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入你的代号"
              maxLength={32}
              disabled={isLoading}
              autoFocus
            />
          </div>

          <button
            data-magnetic
            className="auth-btn"
            onClick={handleSubmit}
            disabled={isLoading || !isValid}
          >
            {isLoading ? '连接中...' : '进  入'}
          </button>

          {isLoading && <div className="auth-progress">正在连接...</div>}
        </div>
      </div>
    </div>
  );
};

export default AuthPage;