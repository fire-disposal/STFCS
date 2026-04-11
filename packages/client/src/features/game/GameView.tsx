/**
 * 游戏视图组件
 * 
 * 使用原生 Colyseus SDK 管理游戏状态
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { Room } from "colyseus.js";
import type { GameRoomState, ShipState, PlayerState, ClientCommand } from "@vt/shared";
import { ClientCommand as CC } from "@vt/shared";
import { NetworkManager } from "@/network/NetworkManager";
import { GameCanvas } from "@/components/map/GameCanvas";
import { useUIStore } from "@/store/uiStore";
import { ShipDetailPanel, ShipActionPanel, FluxSystemDisplay, ArmorQuadrantDisplay } from "@/features/ship";
import { TurnIndicator } from "@/features/game";
import { PlayerPanel } from "@/features/lobby";
import { DMControlPanel, DMObjectCreator } from "@/features/dm";
import { SettingsMenu } from "@/features/ui/SettingsMenu";
import { ViewRotationControl } from "@/features/ui/ViewRotationControl";

const layoutStyles = {
  gameView: {
    display: 'grid',
    gridTemplateColumns: '1fr 340px',
    gridTemplateRows: 'auto 1fr',
    gap: '16px',
    padding: '16px',
    minHeight: '100vh' as const,
    backgroundColor: '#060a10',
    color: '#cfe8ff',
    fontFamily: 'Arial, sans-serif',
  },
  topBar: {
    gridColumn: '1 / -1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '12px 16px',
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    border: '1px solid #2b4261',
  },
  topBarTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
  },
  topBarInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
    fontSize: '12px',
    color: '#8ba4c7',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '16px',
  },
  mapSection: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    borderRadius: '8px',
    border: '1px solid #2b4261',
    padding: '16px',
  },
  mapControls: {
    display: 'flex',
    gap: '8px',
    marginBottom: '12px',
    flexWrap: 'wrap' as const,
  },
  mapButton: {
    padding: '8px 12px',
    borderRadius: '4px',
    border: '1px solid #2b4261',
    backgroundColor: '#1a2d42',
    color: '#cfe8ff',
    fontSize: '11px',
    cursor: 'pointer',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    maxHeight: 'calc(100vh - 100px)',
    overflow: 'auto' as const,
  },
  leaveButton: {
    padding: '8px 16px',
    borderRadius: '4px',
    border: '1px solid #e74c3c',
    backgroundColor: '#5a2a3a',
    color: '#ff6f8f',
    fontSize: '12px',
    cursor: 'pointer',
  },
  settingsButton: {
    padding: '6px 12px',
    borderRadius: '4px',
    border: '1px solid #2b4261',
    backgroundColor: '#1a4a7a',
    color: '#4a9eff',
    fontSize: '11px',
    cursor: 'pointer',
  },
};

interface GameViewProps {
  networkManager: NetworkManager;
  onLeaveRoom: () => void;
}

export const GameView: React.FC<GameViewProps> = ({
  networkManager,
  onLeaveRoom,
}) => {
  const roomRef = useRef<Room<GameRoomState> | null>(null);
  const [room, setRoom] = useState<Room<GameRoomState> | null>(null);
  const [showObjectCreator, setShowObjectCreator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [pendingPlacement, setPendingPlacement] = useState<{
    type: 'ship' | 'station' | 'asteroid';
    hullId?: string;
    heading: number;
    faction: 'player' | 'dm';
    ownerId?: string;
  } | null>(null);
  const [forceUpdate, setForceUpdate] = useState(0);

  // 获取当前房间
  useEffect(() => {
    const currentRoom = networkManager.getCurrentRoom();
    if (currentRoom) {
      roomRef.current = currentRoom;
      setRoom(currentRoom);

      // 订阅状态变更 - Colyseus 会自动触发
      const unsubscribe = currentRoom.onStateChange(() => {
        setForceUpdate(v => v + 1);
      });

      // 房间离开处理
      currentRoom.onLeave(() => {
        onLeaveRoom();
      });

      return () => {
        // 清理
      };
    }
  }, [networkManager, onLeaveRoom]);

  // 玩家列表 - 直接使用 room.state.players，Colyseus 会处理响应式
  const players = useMemo(() => {
    const result: PlayerState[] = [];
    room?.state.players.forEach((value) => result.push(value));
    return result;
  }, [room?.state.players]);

  // 舰船列表
  const ships = useMemo(() => {
    const result: ShipState[] = [];
    room?.state.ships.forEach((value) => result.push(value));
    return result;
  }, [room?.state.ships]);

  // 当前玩家
  const currentPlayer = useMemo(() => {
    return players.find((p) => p.sessionId === room?.sessionId);
  }, [players, room?.sessionId]);

  // UI Store
  const {
    zoom,
    cameraPosition,
    showGrid,
    selectedShipId,
    setZoom,
    setCameraPosition,
    toggleGrid,
    selectShip,
  } = useUIStore();

  // 选中的舰船
  const selectedShip = useMemo(() => {
    return ships.find((s) => s.id === selectedShipId);
  }, [ships, selectedShipId]);

  // 发送命令
  const sendCommand = useCallback((command: ClientCommand, payload: Record<string, unknown>) => {
    room?.send(command, payload);
  }, [room]);

  const toggleReady = useCallback((isReady: boolean) => {
    sendCommand(CC.CMD_TOGGLE_READY, { isReady });
  }, [sendCommand]);

  const nextPhase = useCallback(() => {
    sendCommand(CC.CMD_NEXT_PHASE, {});
  }, [sendCommand]);

  const createTestShip = useCallback((faction: 'player' | 'dm', x: number, y: number) => {
    room?.send("CREATE_TEST_SHIP", { faction, x, y });
  }, [room]);

  const clearOverload = useCallback((shipId: string) => {
    room?.send("DM_CLEAR_OVERLOAD", { shipId });
  }, [room]);

  const setArmor = useCallback((shipId: string, section: number, value: number) => {
    room?.send("DM_SET_ARMOR", { shipId, section, value });
  }, [room]);

  const assignShip = useCallback((shipId: string, targetSessionId: string) => {
    sendCommand(CC.CMD_ASSIGN_SHIP, { shipId, targetSessionId });
  }, [sendCommand]);

  const createObject = useCallback((params: {
    type: 'ship' | 'station' | 'asteroid';
    hullId?: string;
    x: number;
    y: number;
    heading: number;
    faction: 'player' | 'dm';
    ownerId?: string;
  }) => {
    room?.send("DM_CREATE_OBJECT", params);
    setShowObjectCreator(false);
    setPendingPlacement(null);
  }, [room]);

  const handleMapClick = useCallback((x: number, y: number) => {
    if (pendingPlacement && currentPlayer?.role === 'dm') {
      createObject({ ...pendingPlacement, x, y });
    }
  }, [pendingPlacement, currentPlayer, createObject]);

  if (!room) {
    return <div style={{ padding: 40, color: '#cfe8ff' }}>加载游戏状态...</div>;
  }

  return (
    <div style={layoutStyles.gameView}>
      {/* 顶部栏 */}
      <div style={layoutStyles.topBar}>
        <div style={layoutStyles.topBarTitle}>
          🚀 STFCS · {room.state.currentPhase || '加载中'}
        </div>
        <div style={layoutStyles.topBarInfo}>
          <button style={layoutStyles.settingsButton} onClick={() => setShowSettings(true)}>
            ⚙️ 设置
          </button>
          <button style={layoutStyles.leaveButton} onClick={onLeaveRoom}>
            离开房间
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={layoutStyles.mainContent}>
        {room.state && (
          <TurnIndicator
            currentPhase={room.state.currentPhase}
            turnCount={room.state.turnCount}
            activeFaction={room.state.activeFaction}
            playerRole={currentPlayer?.role || 'player'}
            onNextPhase={currentPlayer?.role === 'dm' ? nextPhase : undefined}
          />
        )}

        <div style={layoutStyles.mapSection}>
          <div style={layoutStyles.mapControls}>
            <button style={layoutStyles.mapButton} onClick={() => setZoom(zoom + 0.1)}>放大 +</button>
            <button style={layoutStyles.mapButton} onClick={() => setZoom(zoom - 0.1)}>缩小 -</button>
            <button style={layoutStyles.mapButton} onClick={() => setCameraPosition(cameraPosition.x - 100, cameraPosition.y)}>← 左移</button>
            <button style={layoutStyles.mapButton} onClick={() => setCameraPosition(cameraPosition.x + 100, cameraPosition.y)}>→ 右移</button>
            <button style={layoutStyles.mapButton} onClick={() => setCameraPosition(cameraPosition.x, cameraPosition.y - 100)}>↑ 上移</button>
            <button style={layoutStyles.mapButton} onClick={() => setCameraPosition(cameraPosition.x, cameraPosition.y + 100)}>↓ 下移</button>
            <button style={layoutStyles.mapButton} onClick={toggleGrid}>网格：{showGrid ? "开" : "关"}</button>
            <button style={layoutStyles.mapButton} onClick={() => selectShip(null)}>取消选择</button>
          </div>

          <GameCanvas
            ships={ships}
            zoom={zoom}
            cameraX={cameraPosition.x}
            cameraY={cameraPosition.y}
            showGrid={showGrid}
            selectedShipId={selectedShipId}
            onSelectShip={(shipId) => selectShip(shipId)}
            onClick={pendingPlacement && currentPlayer?.role === 'dm' ? handleMapClick : undefined}
          />
        </div>
      </div>

      {/* 侧边面板 */}
      <div style={layoutStyles.sidePanel}>
        <PlayerPanel
          players={players}
          ships={ships}
          currentSessionId={room.sessionId || ''}
          currentPhase={room.state.currentPhase || 'DEPLOYMENT'}
          onToggleReady={toggleReady}
        />

        {selectedShip && (
          <>
            <ShipDetailPanel ship={selectedShip} currentPhase={room.state.currentPhase} />
            <FluxSystemDisplay ship={selectedShip} currentPhase={room.state.currentPhase} />
            <ArmorQuadrantDisplay ship={selectedShip} />
          </>
        )}

        <ShipActionPanel
          ship={selectedShip ?? null}
          allShips={ships}
          currentPhase={room.state.currentPhase || 'DEPLOYMENT'}
          activeFaction={room.state.activeFaction || 'player'}
          playerRole={currentPlayer?.role || 'player'}
          playerSessionId={room.sessionId || ''}
          onSendCommand={sendCommand}
        />

        <ViewRotationControl selectedShip={selectedShip ?? null} />

        {currentPlayer?.role === 'dm' && (
          <>
            <button
              style={{ ...layoutStyles.mapButton, backgroundColor: '#5a2a3a', borderColor: '#a78bfa', color: '#a78bfa' }}
              onClick={() => setShowObjectCreator(!showObjectCreator)}
            >
              🎨 {showObjectCreator ? '关闭' : '打开'} 对象创建工具
            </button>

            <DMObjectCreator
              isOpen={showObjectCreator}
              onClose={() => setShowObjectCreator(false)}
              onCreateObject={createObject}
              players={players.filter(p => p.role !== 'dm').map(p => ({
                sessionId: p.sessionId,
                name: p.name,
                role: p.role,
              }))}
            />

            <DMControlPanel
              ships={ships}
              players={players}
              isDM={true}
              onCreateTestShip={createTestShip}
              onClearOverload={clearOverload}
              onSetArmor={setArmor}
              onAssignShip={assignShip}
              onNextPhase={nextPhase}
            />
          </>
        )}
      </div>

      <SettingsMenu isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default GameView;
