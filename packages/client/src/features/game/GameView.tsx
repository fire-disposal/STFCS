/**
 * 游戏视图组件
 *
 * 战术终端风格布局：
 * - 顶部固定状态栏
 * - 中央地图区域
 * - 右侧功能面板（可折叠）
 * - 底部操作栏
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { ShipState, PlayerState } from "@vt/contracts";
import { ClientCommand } from "@vt/contracts";
import { NetworkManager } from "@/network/NetworkManager";
import { GameCanvas } from "@/components/map/GameCanvas";
import { useUIStore } from "@/store/uiStore";
import { normalizeRotation } from "@/utils/angleSystem";
import { ShipDetailPanel, ShipActionPanel, FluxSystemDisplay, ArmorQuadrantDisplay } from "@/features/ship";
import { TurnIndicator } from "@/features/game";
import { PlayerRosterModal } from "@/features/lobby";
import { DMControlPanel, DMObjectCreator } from "@/features/dm";
import { SettingsMenu } from "@/features/ui/SettingsMenu";
import { ActionCommandDock, type ActionCommandGroup } from "@/features/ui/ActionCommandDock";
import { ThreePhaseMovementController } from "@/features/movement";
import { ChatPanel } from "@/features/ui/ChatPanel";
import { RightPanelTabs } from "@/features/ui/RightPanelTabs";
import { useCurrentGameRoom } from "@/hooks";
import { notify } from "@/components/ui/Notification";

// ==================== 布局样式 ====================

const layoutStyles = {
  // 主容器 - 占满全屏
  gameView: {
    display: 'flex',
    flexDirection: 'column' as const,
    width: '100%',
    height: '100vh',
    backgroundColor: '#00050a',
    color: '#cfe8ff',
    fontFamily: 'Arial, sans-serif',
    overflow: 'hidden',
  },

  // 顶部状态栏
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: '48px',
    padding: '0 16px',
    backgroundColor: 'rgba(13, 40, 71, 0.95)',
    borderBottom: '2px solid rgba(74, 158, 255, 0.3)',
    flexShrink: 0,
    zIndex: 1000,
  },

  topBarLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },

  topBarTitle: {
    fontSize: '14px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    color: '#4a9eff',
    textShadow: '0 0 8px rgba(74, 158, 255, 0.5)',
  },

  topBarCenter: {
    flex: 1,
    display: 'flex',
    justifyContent: 'center',
  },

  topBarRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },

  // 主内容区
  mainContent: {
    display: 'flex',
    flex: 1,
    overflow: 'hidden',
  },

  // 地图区域
  mapContainer: {
    flex: 1,
    position: 'relative' as const,
    backgroundColor: 'rgba(6, 16, 26, 0.8)',
    overflow: 'hidden',
  },

  mapSection: {
    width: '100%',
    height: '100%',
    position: 'relative' as const,
  },

  // 右侧面板容器
  sidePanelContainer: {
    width: '400px',
    display: 'flex',
    flexDirection: 'column' as const,
    backgroundColor: 'rgba(13, 40, 71, 0.9)',
    borderLeft: '2px solid rgba(74, 158, 255, 0.2)',
    flexShrink: 0,
  },

  // 右侧面板内容区（滚动）
  sidePanelContent: {
    flex: 1,
    overflowY: 'auto' as const,
    padding: '12px',
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
  },

  // 底部操作栏
  bottomBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '72px',
    padding: '0 16px',
    backgroundColor: 'rgba(13, 40, 71, 0.95)',
    borderTop: '2px solid rgba(74, 158, 255, 0.3)',
    flexShrink: 0,
  },

  // 按钮样式
  button: {
    padding: '8px 16px',
    backgroundColor: 'rgba(26, 45, 66, 0.8)',
    border: '1px solid rgba(74, 158, 255, 0.3)',
    color: '#cfe8ff',
    fontSize: '12px',
    fontWeight: 'bold',
    cursor: 'pointer',
    transition: 'all 0.2s',
    letterSpacing: '1px',
  },

  buttonPrimary: {
    backgroundColor: 'rgba(26, 74, 122, 0.9)',
    borderColor: 'rgba(74, 158, 255, 0.5)',
    color: '#4a9eff',
  },

  buttonDanger: {
    backgroundColor: 'rgba(90, 42, 58, 0.9)',
    borderColor: 'rgba(255, 111, 143, 0.5)',
    color: '#ff6f8f',
  },

  // 面板样式
  panel: {
    backgroundColor: 'rgba(6, 16, 26, 0.95)',
    border: '1px solid rgba(74, 158, 255, 0.2)',
    padding: '12px',
  },

  panelTitle: {
    fontSize: '11px',
    fontWeight: 'bold',
    color: '#7aa2d4',
    marginBottom: '8px',
    letterSpacing: '1px',
    textTransform: 'uppercase' as const,
  },
};

// ==================== 组件 ====================

interface GameViewProps {
  networkManager: NetworkManager;
  onLeaveRoom: () => void;
  playerName?: string;
}

export const GameView: React.FC<GameViewProps> = ({
  networkManager,
  onLeaveRoom,
  playerName,
}) => {
  const room = useCurrentGameRoom({ networkManager, onLeaveRoom });
  const [showObjectCreator, setShowObjectCreator] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showPlayerRoster, setShowPlayerRoster] = useState(false);
  const mapSectionRef = useRef<HTMLDivElement | null>(null);
  const [mapSize, setMapSize] = useState(() => ({
    width: 980,
    height: typeof window !== 'undefined' ? Math.max(680, window.innerHeight - 200) : 680,
  }));
  const [pendingPlacement, setPendingPlacement] = useState<{
    type: 'ship' | 'station' | 'asteroid';
    hullId?: string;
    heading: number;
    faction: 'player' | 'dm';
    ownerId?: string;
  } | null>(null);

  // 玩家列表
  const players = useMemo(() => {
    const rosterByIdentity = new Map<string, PlayerState>();

    room?.state.players.forEach((value) => {
      const shortId = (value as PlayerState & { shortId?: number }).shortId ?? 0;
      const identityKey = shortId > 0 ? `short:${shortId}` : `session:${value.sessionId}`;
      const current = rosterByIdentity.get(identityKey);

      if (!current) {
        rosterByIdentity.set(identityKey, value);
        return;
      }

      const shouldReplace = (value.connected && !current.connected)
        || value.sessionId === room?.sessionId
        || (current.pingMs < 0 && value.pingMs >= 0);

      if (shouldReplace) {
        rosterByIdentity.set(identityKey, value);
      }
    });

    return Array.from(rosterByIdentity.values());
  }, [room?.state.players, room?.sessionId]);

  // 当前玩家
  const currentPlayer = useMemo(() => {
    return players.find(p => p.sessionId === room?.sessionId) || null;
  }, [players, room?.sessionId]);

  // 舰船列表
  const ships = useMemo(() => {
    const result: ShipState[] = [];
    room?.state.ships.forEach((value) => result.push(value));
    return result;
  }, [room?.state.ships]);

  // 选中的舰船
  const selectedShipId = useMemo(() => {
    const selected = ships.find(s => {
      const owner = players.find(p => p.sessionId === room?.sessionId);
      return s.ownerId === owner?.sessionId;
    });
    return selected?.id || null;
  }, [ships, players, room?.sessionId]);

  const selectShip = useCallback((shipId: string | null) => {
    console.log('[GameView] Select ship:', shipId);
  }, []);

  // UI 状态
  const {
    zoom,
    setZoom,
    cameraPosition,
    setCameraPosition,
    viewRotation,
    setViewRotation,
    resetViewRotation,
    showGrid,
    showBackground,
    showWeaponArcs,
    showMovementRange,
  } = useUIStore();

  // 地图控制
  const handleMapPan = useCallback((deltaX: number, deltaY: number) => {
    setCameraPosition(cameraPosition.x + deltaX, cameraPosition.y + deltaY);
  }, [cameraPosition.x, cameraPosition.y, setCameraPosition]);

  const handleMapRotate = useCallback((delta: number) => {
    setViewRotation(normalizeRotation(viewRotation + delta));
  }, [viewRotation, setViewRotation]);

  const handleMapClick = useCallback((x: number, y: number) => {
    if (pendingPlacement) {
      createObject({
        type: pendingPlacement.type,
        hullId: pendingPlacement.hullId,
        x,
        y,
        heading: pendingPlacement.heading,
        faction: pendingPlacement.faction,
        ownerId: pendingPlacement.ownerId,
      });
      setPendingPlacement(null);
    }
  }, [pendingPlacement]);

  // 命令发送
  const sendCommand = useCallback(async (command: ClientCommand, payload: unknown) => {
    if (!room) return;

    try {
      await room.send(command, payload);
    } catch (error) {
      console.error('[GameView] Send command error:', error);
      notify.error('命令发送失败');
    }
  }, [room]);

  // DM 操作
  const createObject = useCallback((payload: {
    type: 'ship' | 'station' | 'asteroid';
    hullId?: string;
    x: number;
    y: number;
    heading: number;
    faction: 'player' | 'dm';
    ownerId?: string;
  }) => {
    if (!room) return;
    room.send('DM_CREATE_OBJECT', payload);
  }, [room]);

  const createTestShip = useCallback(() => {
    if (!room) return;
    room.send('CREATE_TEST_SHIP', { faction: 'dm', x: 500, y: 500 });
  }, [room]);

  const clearOverload = useCallback((shipId: string) => {
    if (!room) return;
    room.send('DM_CLEAR_OVERLOAD', { shipId });
  }, [room]);

  const setArmor = useCallback((shipId: string, section: number, value: number) => {
    if (!room) return;
    room.send('DM_SET_ARMOR', { shipId, section, value });
  }, [room]);

  const assignShip = useCallback((shipId: string, targetSessionId: string) => {
    if (!room) return;
    room.send(ClientCommand.CMD_ASSIGN_SHIP, { shipId, targetSessionId });
  }, [room]);

  const nextPhase = useCallback(() => {
    if (!room) return;
    room.send(ClientCommand.CMD_NEXT_PHASE, {});
  }, [room]);

  const toggleReady = useCallback(() => {
    if (!room) return;
    room.send(ClientCommand.CMD_TOGGLE_READY, { isReady: !currentPlayer?.isReady });
  }, [room, currentPlayer?.isReady]);

  const kickPlayer = useCallback((sessionId: string) => {
    console.log('[GameView] Kick player:', sessionId);
  }, []);

  const invitePlayer = useCallback((sessionId: string) => {
    console.log('[GameView] Invite player:', sessionId);
  }, []);

  const closeRoom = useCallback(() => {
    console.log('[GameView] Close room');
  }, []);

  const saveRoom = useCallback(() => {
    console.log('[GameView] Save room');
  }, []);

  // 地图控制指令
  const mapActionGroups: ActionCommandGroup[] = useMemo(() => [
    {
      id: 'view_control',
      title: '视图控制',
      actions: [
        {
          id: 'zoom_in',
          label: '放大',
          icon: '🔍',
          shortcut: '+',
          onActivate: () => setZoom(Math.min(3, zoom + 0.2)),
        },
        {
          id: 'zoom_out',
          label: '缩小',
          icon: '🔍',
          shortcut: '-',
          onActivate: () => setZoom(Math.max(0.5, zoom - 0.2)),
        },
        {
          id: 'reset_view',
          label: '重置',
          icon: '🔄',
          shortcut: 'R',
          onActivate: () => {
            setZoom(1);
            setCameraPosition(0, 0);
            resetViewRotation();
          },
        },
      ],
    },
    {
      id: 'display_control',
      title: '显示控制',
      actions: [
        {
          id: 'toggle_grid',
          label: '网格',
          icon: '▦',
          active: showGrid,
          onActivate: () => {},
        },
        {
          id: 'toggle_arcs',
          label: '射界',
          icon: '🎯',
          active: showWeaponArcs,
          onActivate: () => {},
        },
      ],
    },
  ], [zoom, showGrid, showWeaponArcs, setZoom, setCameraPosition, resetViewRotation]);

  if (!room) {
    return (
      <div style={layoutStyles.gameView}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1 }}>
          <div style={{ fontSize: '16px', color: '#6b7280' }}>连接中...</div>
        </div>
      </div>
    );
  }

  return (
    <div style={layoutStyles.gameView}>
      {/* 顶部状态栏 */}
      <div style={layoutStyles.topBar}>
        <div style={layoutStyles.topBarLeft}>
          <div style={layoutStyles.topBarTitle}>
            🚀 STFCS
          </div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            {room.state.currentPhase || '加载中'}
          </div>
        </div>

        <div style={layoutStyles.topBarCenter}>
          <TurnIndicator
            currentPhase={room.state.currentPhase}
            turnCount={room.state.turnCount}
            activeFaction={room.state.activeFaction}
            playerRole={currentPlayer?.role || 'player'}
            onNextPhase={currentPlayer?.role === 'dm' ? nextPhase : undefined}
            compact
          />
        </div>

        <div style={layoutStyles.topBarRight}>
          <button
            style={layoutStyles.button}
            onClick={() => setShowPlayerRoster(true)}
          >
            👥 玩家
          </button>
          <button
            style={layoutStyles.button}
            onClick={() => setShowSettings(true)}
          >
            ⚙️ 设置
          </button>
          <button
            style={{ ...layoutStyles.button, ...layoutStyles.buttonDanger }}
            onClick={onLeaveRoom}
          >
            离开
          </button>
        </div>
      </div>

      {/* 主内容区 */}
      <div style={layoutStyles.mainContent}>
        {/* 地图区域 */}
        <div style={layoutStyles.mapContainer}>
          <div ref={mapSectionRef} style={layoutStyles.mapSection}>
            <GameCanvas
              ships={ships}
              width={mapSize.width}
              height={mapSize.height}
              zoom={zoom}
              cameraX={cameraPosition.x}
              cameraY={cameraPosition.y}
              viewRotation={viewRotation}
              showGrid={showGrid}
              showBackground={showBackground}
              showWeaponArcs={showWeaponArcs}
              showMovementRange={showMovementRange}
              selectedShipId={selectedShipId}
              onSelectShip={(shipId) => selectShip(shipId)}
              onPanDelta={handleMapPan}
              onRotateDelta={handleMapRotate}
              onClick={pendingPlacement && currentPlayer?.role === 'dm' ? handleMapClick : undefined}
            />
          </div>
        </div>

        {/* 右侧面板 */}
        <div style={layoutStyles.sidePanelContainer}>
          {/* Tab 切换 */}
          <RightPanelTabs
            room={room}
            playerName={playerName || 'Player'}
            onShowPlayerRoster={() => setShowPlayerRoster(true)}
            onShowSettings={() => setShowSettings(true)}
            playerCount={players.length}
            unreadChatCount={0}
          />
          
          {/* 可滚动内容区 */}
          <div style={layoutStyles.sidePanelContent}>
            {/* 舰船信息面板（选中时显示） */}
            {selectedShipId && ships.find(s => s.id === selectedShipId) && (
              <>
                <ShipDetailPanel
                  ship={ships.find(s => s.id === selectedShipId)!}
                  currentPhase={room.state.currentPhase}
                />
                <FluxSystemDisplay
                  ship={ships.find(s => s.id === selectedShipId)!}
                  currentPhase={room.state.currentPhase}
                />
                <ArmorQuadrantDisplay
                  ship={ships.find(s => s.id === selectedShipId)!}
                />
                <ThreePhaseMovementController
                  ship={ships.find(s => s.id === selectedShipId)!}
                  networkManager={networkManager}
                  onClose={() => {}}
                  onOpenAttack={() => {
                    notify.info('请选择武器和目标进行攻击');
                  }}
                />
                <ShipActionPanel
                  ship={ships.find(s => s.id === selectedShipId)!}
                  allShips={ships}
                  currentPhase={room.state.currentPhase || 'DEPLOYMENT'}
                  activeFaction={room.state.activeFaction || 'player'}
                  playerRole={currentPlayer?.role || 'player'}
                  playerSessionId={room.sessionId || ''}
                  onSendCommand={sendCommand}
                />
              </>
            )}

            {/* DM 控制面板 */}
            {currentPlayer?.role === 'dm' && (
              <div style={layoutStyles.panel}>
                <div style={layoutStyles.panelTitle}>🎨 DM 工具</div>
                <button
                  style={{ ...layoutStyles.button, ...layoutStyles.buttonPrimary, width: '100%', marginBottom: '12px' }}
                  onClick={() => setShowObjectCreator(!showObjectCreator)}
                >
                  {showObjectCreator ? '关闭' : '打开'} 对象创建工具
                </button>

                {showObjectCreator && (
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
                )}

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
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 底部操作栏 */}
      <div style={layoutStyles.bottomBar}>
        <ActionCommandDock
          title=""
          subtitle=""
          groups={mapActionGroups}
        />
      </div>

      {/* 弹窗 */}
      <PlayerRosterModal
        isOpen={showPlayerRoster}
        onClose={() => setShowPlayerRoster(false)}
        players={players}
        ships={ships}
        currentSessionId={room.sessionId || ''}
        currentPhase={room.state.currentPhase || 'DEPLOYMENT'}
        onToggleReady={toggleReady}
        canManagePlayers={currentPlayer?.role === 'dm'}
        onKickPlayer={currentPlayer?.role === 'dm' ? () => {} : undefined}
        onInvitePlayer={currentPlayer?.role === 'dm' ? () => {} : undefined}
        onCloseRoom={currentPlayer?.role === 'dm' ? () => {} : undefined}
        onSaveRoom={currentPlayer?.role === 'dm' ? () => {} : undefined}
      />

      <SettingsMenu isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default GameView;
