/**
 * 主应用组件
 *
 * 使用新的房间框架：
 * - RoomClient 管理连接和状态
 * - useRoomState 订阅状态
 */

import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import { SciFiLanguageSwitcher } from '@/components/ui/SciFiLanguageSwitcher';
import { RoomSelector } from '@/components/login/RoomSelector';
import { FactionSelector } from '@/components/login/FactionSelector';
import GameView from '@/features/game/GameView';
import { RoomLobbyView } from '@/features/lobby/RoomLobbyView';

import { DEFAULT_WS_URL } from '@/config';
import { RoomClient, createRoomClient } from '@/room';
import type { OperationMap } from '@vt/shared/room';
import type { FactionId } from '@vt/shared/types';
import { DEFAULT_FACTION_IDS } from '@vt/shared/constants';

// ==================== 类型定义 ====================

type AppPhase = 'connecting' | 'login' | 'lobby' | 'game';

interface AppState {
  phase: AppPhase;
  isConnecting: boolean;
  error: string | null;
  client: RoomClient<OperationMap> | null;
  playerId: string | null;
  playerName: string | null;
  roomId: string | null;
}

// ==================== 登录视图 ====================

interface LoginViewProps {
  isConnecting: boolean;
  isConnected: boolean;
  error: string | null;
  onJoin: (name: string, roomId: string, faction: FactionId) => Promise<void>;
  onReconnect: () => Promise<void>;
  onCreateRoom: (options: {
    roomId: string;
    name?: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
  }) => Promise<void>;
}

const LoginView: React.FC<LoginViewProps> = ({
  isConnecting,
  isConnected,
  error,
  onJoin,
  onReconnect,
  onCreateRoom,
}) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');
  const [selectedRoomId, setSelectedRoomId] = useState<string>('default');
  const [selectedFaction, setSelectedFaction] = useState<FactionId>(DEFAULT_FACTION_IDS[0]);
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!isConnected) {
      try {
        setLocalError('');
        await onReconnect();
        return;
      } catch (err) {
        setLocalError(
          t('connection.error.failedToReconnect', {
            error: err instanceof Error ? err.message : String(err),
          })
        );
        return;
      }
    }

    if (!name.trim()) {
      setLocalError(t('connection.error.nameRequired'));
      return;
    }

    if (name.length > 32) {
      setLocalError(t('connection.error.nameTooLong'));
      return;
    }

    if (!selectedRoomId) {
      setLocalError(t('connection.error.roomRequired'));
      return;
    }

    if (!selectedFaction) {
      setLocalError(t('faction.error.factionRequired'));
      return;
    }

    setLocalError('');

    try {
      await onJoin(name, selectedRoomId, selectedFaction);
    } catch (err) {
      setLocalError(
        t('connection.error.failedToJoin', {
          error: err instanceof Error ? err.message : String(err),
        })
      );
    }
  };

  return (
    <div className="connection-view">
      <div className="connection-card connection-card-expanded">
        <div className="connection-header">
          <h2>{t('connection.title')}</h2>
          <SciFiLanguageSwitcher />
        </div>
        <p className="connection-description">{t('connection.description')}</p>

        <form onSubmit={handleSubmit} className="connection-form">
          {/* 用户名输入 */}
          <div className="form-group">
            <label htmlFor="playerName">
              {isConnected ? t('connection.playerName') : t('connection.unableToConnect')}
            </label>
            {isConnected ? (
              <input
                id="playerName"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={t('placeholder.enterName')}
                disabled={isConnecting}
                className="form-input"
                maxLength={32}
                autoFocus
              />
            ) : (
              <div className="connection-status-text">
                {t('connection.connectionStatusText', { url: DEFAULT_WS_URL })}
              </div>
            )}
            {isConnected && <small className="form-help">{t('connection.formHelp')}</small>}
          </div>

          {/* 房间选择 */}
          {isConnected && (
            <div className="form-group">
              <label>{t('connection.roomSelection')}</label>
              <RoomSelector
                selectedRoomId={selectedRoomId}
                onRoomSelect={setSelectedRoomId}
                onRoomCreate={onCreateRoom}
                disabled={isConnecting}
              />
            </div>
          )}

          {/* 阵营选择 */}
          {isConnected && (
            <div className="form-group">
              <FactionSelector
                selectedFaction={selectedFaction}
                onFactionSelect={setSelectedFaction}
                disabled={isConnecting}
              />
            </div>
          )}

          {(error || localError) && (
            <div className="form-error">{error || localError}</div>
          )}

          <div className="form-actions">
            <button
              type="submit"
              disabled={isConnecting || (isConnected && !name.trim())}
              className="connect-button"
            >
              {isConnecting ? (
                <>
                  <span className="spinner"></span>
                  {isConnected
                    ? t('connection.submit.joining')
                    : t('connection.submit.reconnecting')}
                </>
              ) : isConnected ? (
                t('connection.submit.joinGame')
              ) : (
                t('connection.submit.retryConnection')
              )}
            </button>
          </div>
        </form>

        <div className="connection-info">
          <h3>{t('connectionInfo.title')}</h3>
          <ul>
            <li>{t('connectionInfo.autoConnect', { url: DEFAULT_WS_URL })}</li>
            <li>{t('connectionInfo.serverRunning')}</li>
            <li>{t('connectionInfo.uniqueName')}</li>
            <li>{t('connectionInfo.selectOrCreateRoom')}</li>
          </ul>
        </div>
      </div>
    </div>
  );
};

// ==================== 主应用 ====================

const App: React.FC = () => {
  const { t } = useTranslation();

  const [state, setState] = useState<AppState>({
    phase: 'connecting',
    isConnecting: true,
    error: null,
    client: null,
    playerId: null,
    playerName: null,
    roomId: null,
  });

  // 初始化连接
  useEffect(() => {
    let ws: WebSocket | null = null;

    const connect = async () => {
      try {
        ws = new WebSocket(DEFAULT_WS_URL);

        ws.onopen = () => {
          console.log('[App] Connected to:', DEFAULT_WS_URL);

          // 创建 RoomClient
          const client = createRoomClient<OperationMap>(ws!);

          setState(prev => ({
            ...prev,
            phase: 'login',
            isConnecting: false,
            error: null,
            client,
          }));
        };

        ws.onerror = () => {
          console.error('[App] WebSocket error');
          setState(prev => ({
            ...prev,
            isConnecting: false,
            error: 'Connection failed',
          }));
        };

        ws.onclose = () => {
          console.log('[App] WebSocket closed');
          setState(prev => ({
            ...prev,
            phase: 'connecting',
            isConnecting: false,
            client: null,
          }));
        };
      } catch (error) {
        console.error('[App] Failed to connect:', error);
        setState(prev => ({
          ...prev,
          isConnecting: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        }));
      }
    };

    connect();

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, []);

  // 加入房间
  const handleJoin = useCallback(async (name: string, roomId: string, _faction: FactionId) => {
    if (!state.client) {
      throw new Error('Not connected');
    }

    const playerId = `player_${Date.now()}`;

    try {
      // 调用 join 操作
      await state.client.call('join', name);

      setState(prev => ({
        ...prev,
        phase: 'lobby',
        playerId,
        playerName: name,
        roomId,
      }));
    } catch (error) {
      console.error('[App] Failed to join:', error);
      throw error;
    }
  }, [state.client]);

  // 创建房间
  const handleCreateRoom = useCallback(async (options: {
    roomId: string;
    name?: string;
    maxPlayers: number;
    isPrivate: boolean;
    password?: string;
  }) => {
    // 通过 HTTP API 创建房间
    const apiUrl = DEFAULT_WS_URL.replace('ws://', 'http://').replace(':3001', ':3000');
    
    const response = await fetch(`${apiUrl}/api/rooms`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        roomId: options.roomId,
        name: options.name,
        playerId: state.playerId,
      }),
    });

    if (!response.ok) {
      throw new Error('Failed to create room');
    }

    console.log(`[App] Room ${options.roomId} created`);
  }, [state.playerId]);

  // 重连
  const handleReconnect = useCallback(async () => {
    setState(prev => ({ ...prev, isConnecting: true, error: null }));

    try {
      const ws = new WebSocket(DEFAULT_WS_URL);

      await new Promise<void>((resolve, reject) => {
        ws.onopen = () => resolve();
        ws.onerror = () => reject(new Error('Connection failed'));
      });

      const client = createRoomClient<OperationMap>(ws);

      setState(prev => ({
        ...prev,
        phase: 'login',
        isConnecting: false,
        error: null,
        client,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnecting: false,
        error: error instanceof Error ? error.message : 'Reconnection failed',
      }));
      throw error;
    }
  }, []);

  // 离开房间
  const handleLeaveRoom = useCallback(async () => {
    if (state.client) {
      try {
        await state.client.call('leave');
      } catch (error) {
        console.error('[App] Failed to leave:', error);
      }
    }

    setState(prev => ({
      ...prev,
      phase: 'login',
      roomId: null,
    }));
  }, [state.client]);

  // 断开连接
  const handleDisconnect = useCallback(() => {
    setState({
      phase: 'connecting',
      isConnecting: false,
      error: null,
      client: null,
      playerId: null,
      playerName: null,
      roomId: null,
    });
  }, []);

  // 渲染
  switch (state.phase) {
    case 'connecting':
      return (
        <div className="connection-view">
          <div className="connection-card">
            <div className="loading-content">
              <div className="spinner" />
              <p>{t('connection.connecting')}</p>
            </div>
          </div>
        </div>
      );

    case 'login':
      return (
        <LoginView
          isConnecting={state.isConnecting}
          isConnected={state.client?.isConnected ?? false}
          error={state.error}
          onJoin={handleJoin}
          onReconnect={handleReconnect}
          onCreateRoom={handleCreateRoom}
        />
      );

    case 'lobby':
      return (
        <RoomLobbyView
          client={state.client}
          currentPlayerId={state.playerId || ''}
          onLeaveRoom={handleLeaveRoom}
        />
      );

    case 'game':
      return (
        <GameView
          client={state.client}
          currentPlayerId={state.playerId || ''}
          onDisconnect={handleDisconnect}
        />
      );

    default:
      return null;
  }
};

export default App;