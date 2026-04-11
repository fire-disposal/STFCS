/**
 * STFCS 主应用
 *
 * 简化版 - 去除 OAuth 认证
 */

import React, { useEffect, useState, useCallback, useRef } from "react";
import { NetworkManager, type RoomInfo } from "@/network/NetworkManager";
import { DEFAULT_WS_URL } from "@/config";
import { AuthPanel } from "@/components/auth/AuthPanel";
import { LobbyPanel } from "@/components/lobby/LobbyPanel";
import { GameView } from "@/features/game/GameView";
import type { User } from "@/types/auth";
import { notify } from "@/components/ui/Notification";

type AppState = 'auth' | 'lobby' | 'game';

const App: React.FC = () => {
  const [appState, setAppState] = useState<AppState>('auth');
  const [networkManager, setNetworkManager] = useState<NetworkManager | null>(null);
  const networkManagerRef = useRef<NetworkManager | null>(null);
  const [userName, setUserName] = useState<string>('');
  const [rooms, setRooms] = useState<RoomInfo[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 初始化 NetworkManager
  useEffect(() => {
    const manager = new NetworkManager(DEFAULT_WS_URL);
    setNetworkManager(manager);
    networkManagerRef.current = manager;

    // 尝试恢复用户名
    const restored = manager.restoreUser();
    if (restored && manager.userName) {
      setUserName(manager.userName);
      setAppState('lobby');

      manager.subscribeRooms(setRooms);
      manager.startRoomsPolling();

      console.log('[App] Restored user:', manager.userName);
    }

    return () => {
      manager.dispose();
    };
  }, []);

  // 认证成功处理（简化版）
  const handleAuthenticated = useCallback((user: User) => {
    setUserName(user.username);
    
    // 设置到 NetworkManager
    if (networkManagerRef.current) {
      networkManagerRef.current.setUser(user.username);
    }

    setAppState('lobby');
    notify.success(`欢迎，${user.username}！`);

    // 开始房间列表轮询
    if (networkManagerRef.current) {
      networkManagerRef.current.subscribeRooms(setRooms);
      networkManagerRef.current.startRoomsPolling();
    }
  }, []);

  // 登出处理
  const handleLogout = useCallback(async () => {
    setIsLoading(true);
    if (networkManagerRef.current) {
      networkManagerRef.current.logout();
    }
    setUserName('');
    setAppState('auth');
    setIsLoading(false);
    notify.info('已退出');
  }, []);

  // 创建房间
  const handleCreateRoom = useCallback(async () => {
    if (!networkManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await networkManagerRef.current.createRoom();
      notify.success('房间创建成功');
      setAppState('game');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '创建房间失败';
      notify.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 加入房间
  const handleJoinRoom = useCallback(async (roomId: string) => {
    if (!networkManagerRef.current) return;

    setIsLoading(true);
    setError(null);

    try {
      await networkManagerRef.current.joinRoom(roomId);
      notify.success('正在加入房间...');
      setAppState('game');
    } catch (e) {
      const errorMsg = e instanceof Error ? e.message : '加入房间失败';
      notify.error(errorMsg);
      setError(errorMsg);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // 离开房间返回大厅
  const handleLeaveRoom = useCallback(() => {
    if (networkManagerRef.current) {
      networkManagerRef.current.leaveRoom();
    }
    setAppState('lobby');
  }, []);

  // 渲染
  if (!networkManager) {
    return <div style={{ padding: 40, color: '#cfe8ff' }}>初始化中...</div>;
  }

  return (
    <>
      {appState === 'auth' && (
        <AuthPanel
          serverUrl={DEFAULT_WS_URL}
          onAuthenticated={handleAuthenticated}
        />
      )}

      {appState === 'lobby' && (
        <LobbyPanel
          playerName={userName}
          rooms={rooms}
          isLoading={isLoading}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onRefresh={() => networkManagerRef.current?.getRooms() || Promise.resolve()}
          onLogout={handleLogout}
        />
      )}

      {appState === 'game' && (
        <GameView
          networkManager={networkManager}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </>
  );
};

export default App;
