/**
 * 游戏视图组件
 * 
 * 使用原生 Colyseus SDK 管理游戏状态
 */

import React, { useEffect, useState, useMemo, useCallback, useRef } from "react";
import type { ShipState, PlayerState, ClientCommand } from "@vt/contracts";
import { ClientCommand as CC } from "@vt/contracts";
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

const layoutStyles = {
  gameView: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0, 2.15fr) minmax(320px, 380px)',
    gridTemplateRows: 'auto 1fr',
    gap: '18px',
    padding: '20px',
    minHeight: '100vh' as const,
    background: 'linear-gradient(135deg, #00050a 0%, #001020 50%, #00050a 100%)',
    color: '#cfe8ff',
    fontFamily: 'Arial, sans-serif',
    alignItems: 'start',
  },
  topBar: {
    gridColumn: '1 / -1',
    position: 'relative' as const,
    zIndex: 3,
    display: 'grid',
    gridTemplateColumns: 'auto minmax(0, 1fr) auto',
    alignItems: 'center',
    columnGap: '16px',
    padding: '14px 18px',
    background: 'rgba(13, 40, 71, 0.82)',
    borderRadius: '14px',
    border: '2px solid rgba(74, 158, 255, 0.35)',
    boxShadow: '0 0 30px rgba(74, 158, 255, 0.18)',
  },
  topBarTitle: {
    fontSize: '16px',
    fontWeight: 'bold',
    letterSpacing: '2px',
    color: '#ffffff',
    whiteSpace: 'nowrap' as const,
  },
  topBarCenter: {
    display: 'flex',
    justifyContent: 'center',
    minWidth: 0,
  },
  topBarInfo: {
    display: 'flex',
    alignItems: 'center',
    flexWrap: 'wrap' as const,
    gap: '12px',
    fontSize: '12px',
    color: '#8ba4c7',
    justifySelf: 'end' as const,
    maxWidth: '100%',
  },
  mainContent: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0',
    minWidth: 0,
    minHeight: 0,
  },
  mapSection: {
    position: 'relative' as const,
    display: 'flex',
    flexDirection: 'column' as const,
    minHeight: 'calc(100vh - 118px)',
    background: 'rgba(13, 40, 71, 0.72)',
    borderRadius: '14px',
    border: '2px solid rgba(74, 158, 255, 0.3)',
    padding: '12px',
    overflow: 'hidden',
    minWidth: 0,
    boxShadow: '0 0 28px rgba(74, 158, 255, 0.14)',
  },
  sidePanel: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '12px',
    maxHeight: 'calc(100vh - 24px)',
    overflow: 'auto' as const,
    position: 'sticky' as const,
    top: '20px',
    zIndex: 1,
    padding: '12px',
    paddingRight: '12px',
    borderRadius: '14px',
    border: '2px solid rgba(74, 158, 255, 0.3)',
    background: 'rgba(13, 40, 71, 0.72)',
    boxShadow: '0 0 28px rgba(74, 158, 255, 0.14)',
    minWidth: 0,
  },
  leaveButton: {
    padding: '10px 16px',
    borderRadius: '8px',
    border: '2px solid rgba(248, 113, 113, 0.45)',
    background: 'rgba(248, 113, 113, 0.12)',
    color: '#ff6f8f',
    fontSize: '12px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  settingsButton: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '2px solid rgba(74, 158, 255, 0.35)',
    background: 'rgba(74, 158, 255, 0.14)',
    color: '#cfe8ff',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
  rosterButton: {
    padding: '10px 14px',
    borderRadius: '8px',
    border: '2px solid rgba(67, 193, 255, 0.32)',
    background: 'rgba(26, 58, 90, 0.78)',
    color: '#d8ecff',
    fontSize: '11px',
    fontWeight: 700,
    cursor: 'pointer',
  },
};

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

  // 玩家列表 - 直接使用 room.state.players，Colyseus 会处理响应式
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
    viewRotation,
    showGrid,
    showBackground,
    showWeaponArcs,
    showMovementRange,
    selectedShipId,
    setCameraPosition,
    setViewRotation,
    resetViewRotation,
    setZoom,
    toggleGrid,
    toggleBackground,
    toggleWeaponArcs,
    toggleMovementRange,
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

  const closeRoom = useCallback(async () => {
    const currentRoomId = room?.roomId;
    if (!currentRoomId) {
      return;
    }

    try {
      await networkManager.deleteRoom(currentRoomId);
      setShowPlayerRoster(false);
      onLeaveRoom();
      notify.success('房间已关闭');
    } catch (error) {
      const message = error instanceof Error ? error.message : '关闭房间失败';
      notify.error(message);
    }
  }, [networkManager, onLeaveRoom, room?.roomId]);

  const saveRoom = useCallback(() => {
    notify.info('保存房间功能已预留，等待后端接口接入。');
  }, []);

  const invitePlayer = useCallback(() => {
    notify.info('邀请玩家功能已预留，等待邀请流程接入。');
  }, []);

  const kickPlayer = useCallback((playerSessionId: string) => {
    notify.info(`踢出玩家功能已预留：${playerSessionId}`);
  }, []);

  const handleMapClick = useCallback((x: number, y: number) => {
    if (pendingPlacement && currentPlayer?.role === 'dm') {
      createObject({ ...pendingPlacement, x, y });
    }
  }, [pendingPlacement, currentPlayer, createObject]);

  const applyScreenPanDelta = useCallback((deltaX: number, deltaY: number) => {
    const theta = (viewRotation * Math.PI) / 180;
    const cos = Math.cos(-theta);
    const sin = Math.sin(-theta);
    const worldDeltaX = deltaX * cos - deltaY * sin;
    const worldDeltaY = deltaX * sin + deltaY * cos;

    setCameraPosition(cameraPosition.x + worldDeltaX, cameraPosition.y + worldDeltaY);
  }, [cameraPosition.x, cameraPosition.y, setCameraPosition, viewRotation]);

  const handleMapPan = useCallback((deltaX: number, deltaY: number) => {
    applyScreenPanDelta(deltaX, deltaY);
  }, [applyScreenPanDelta]);

  const handleMapRotate = useCallback((delta: number) => {
    setViewRotation(normalizeRotation(viewRotation + delta));
  }, [setViewRotation, viewRotation]);

  const mapActionGroups = useMemo<ActionCommandGroup[]>(() => {
    const panStep = 240;
    const zoomStep = 0.15;

    return [
      {
        id: 'view',
        title: '视图控制',
        description: '缩放 / 旋转 / 复位',
        actions: [
          {
            id: 'zoom-out',
            label: '缩小',
            icon: '−',
            shortcut: '滚轮↓',
            hint: '缩小地图视图',
            onActivate: () => setZoom(zoom - zoomStep),
          },
          {
            id: 'zoom-reset',
            label: '重置缩放',
            icon: '◎',
            shortcut: 'Z',
            hint: '将缩放恢复到默认值',
            onActivate: () => setZoom(1),
          },
          {
            id: 'zoom-in',
            label: '放大',
            icon: '+',
            shortcut: '滚轮↑',
            hint: '放大地图视图',
            onActivate: () => setZoom(zoom + zoomStep),
          },
          {
            id: 'rotate-left',
            label: '左旋',
            icon: '↺',
            shortcut: 'Alt+Q',
            hint: '逆时针旋转视图',
            onActivate: () => handleMapRotate(-15),
          },
          {
            id: 'rotate-reset',
            label: '归正',
            icon: '▣',
            shortcut: 'R',
            hint: '重置视图旋转',
            onActivate: resetViewRotation,
          },
          {
            id: 'rotate-right',
            label: '右旋',
            icon: '↻',
            shortcut: 'Alt+E',
            hint: '顺时针旋转视图',
            onActivate: () => handleMapRotate(15),
          },
        ],
      },
      {
        id: 'camera',
        title: '地图导航',
        description: '空格拖动 / 微调平移',
        actions: [
          {
            id: 'pan-up',
            label: '上移',
            icon: '↑',
            shortcut: 'W',
            onActivate: () => applyScreenPanDelta(0, -panStep),
          },
          {
            id: 'pan-center',
            label: '回中',
            icon: '◎',
            shortcut: 'C',
            onActivate: () => setCameraPosition(0, 0),
          },
          {
            id: 'pan-down',
            label: '下移',
            icon: '↓',
            shortcut: 'S',
            onActivate: () => applyScreenPanDelta(0, panStep),
          },
          {
            id: 'pan-left',
            label: '左移',
            icon: '←',
            shortcut: 'A',
            onActivate: () => applyScreenPanDelta(-panStep, 0),
          },
          {
            id: 'pan-basis',
            label: '对齐舰向',
            icon: '⇢',
            shortcut: 'Ship',
            disabled: !selectedShip,
            hint: '将视角对齐到选中舰船朝向',
            onActivate: () => selectedShip && setViewRotation(normalizeRotation(90 - selectedShip.transform.heading)),
          },
          {
            id: 'pan-right',
            label: '右移',
            icon: '→',
            shortcut: 'D',
            onActivate: () => applyScreenPanDelta(panStep, 0),
          },
        ],
      },
      {
        id: 'layers',
        title: '图层开关',
        description: '战术可视化层',
        actions: [
          {
            id: 'grid',
            label: '网格',
            icon: '▦',
            active: showGrid,
            shortcut: 'G',
            onActivate: toggleGrid,
          },
          {
            id: 'background',
            label: '星图',
            icon: '✦',
            active: showBackground,
            shortcut: 'B',
            onActivate: toggleBackground,
          },
          {
            id: 'weapon-arcs',
            label: '射界',
            icon: '◜',
            active: showWeaponArcs,
            shortcut: 'V',
            onActivate: toggleWeaponArcs,
          },
          {
            id: 'movement-range',
            label: '机动',
            icon: '◌',
            active: showMovementRange,
            shortcut: 'M',
            onActivate: toggleMovementRange,
          },
        ],
      },
    ];
  }, [
    cameraPosition.x,
    cameraPosition.y,
    handleMapRotate,
    resetViewRotation,
    selectedShip,
    setCameraPosition,
    setViewRotation,
    setZoom,
    showBackground,
    showGrid,
    showMovementRange,
    showWeaponArcs,
    toggleBackground,
    toggleGrid,
    toggleMovementRange,
    toggleWeaponArcs,
    zoom,
  ]);

  useEffect(() => {
    const element = mapSectionRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      return;
    }

    const observer = new ResizeObserver((entries) => {
      const rect = entries[0]?.contentRect;
      const nextWidth = Math.floor(rect?.width ?? 980);
      if (Number.isFinite(nextWidth) && nextWidth > 0) {
        setMapSize((current) => ({ ...current, width: nextWidth }));
      }
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const updateHeight = () => {
      setMapSize((current) => ({
        ...current,
        height: Math.max(680, window.innerHeight - 200),
      }));
    };

    updateHeight();
    window.addEventListener('resize', updateHeight);
    return () => window.removeEventListener('resize', updateHeight);
  }, []);

  if (!room) {
    return <div style={{ padding: 40, color: '#cfe8ff' }}>加载游戏状态...</div>;
  }

  return (
    <div style={layoutStyles.gameView}>
      {/* 顶部栏 */}
      <div style={{
        ...layoutStyles.topBar,
        position: 'fixed' as const,
        top: '0',
        left: '0',
        right: '0',
        zIndex: 1000,
        marginBottom: '0',
      }}>
        <div style={layoutStyles.topBarTitle}>
          🚀 STFCS · {room.state.currentPhase || '加载中'}
        </div>
        <div style={layoutStyles.topBarCenter}>
          {room.state && (
            <TurnIndicator
              currentPhase={room.state.currentPhase}
              turnCount={room.state.turnCount}
              activeFaction={room.state.activeFaction}
              playerRole={currentPlayer?.role || 'player'}
              onNextPhase={currentPlayer?.role === 'dm' ? nextPhase : undefined}
              compact
            />
          )}
        </div>
        <div style={layoutStyles.topBarInfo}>
          <button style={layoutStyles.rosterButton} onClick={() => setShowPlayerRoster(true)}>
            👥 玩家
          </button>
          <button style={layoutStyles.settingsButton} onClick={() => setShowSettings(true)}>
            ⚙️ 设置
          </button>
          <button style={layoutStyles.leaveButton} onClick={onLeaveRoom}>
            离开房间
          </button>
        </div>
      </div>

      {/* 主内容区 - 添加顶部 padding 避免被顶栏遮挡 */}
      <div style={{
        ...layoutStyles.mainContent,
        paddingTop: '80px', // 为顶栏留出空间
      }}>
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

      {/* 侧边面板 */}
      <div style={layoutStyles.sidePanel}>
        <ActionCommandDock
          title="🎮 指令技能区"
          subtitle="地图控制已并入操作区"
          groups={mapActionGroups}
        />

        {/* 右侧功能面板（带 Tab） */}
        <div style={{ height: '400px', marginBottom: '12px' }}>
          <RightPanelTabs
            room={room}
            playerName={playerName || 'Player'}
            onShowPlayerRoster={() => setShowPlayerRoster(true)}
            onShowSettings={() => setShowSettings(true)}
            playerCount={players.length}
            unreadChatCount={0}
          />
        </div>

        {selectedShip && (
          <>
            <ShipDetailPanel ship={selectedShip} currentPhase={room.state.currentPhase} />
            <FluxSystemDisplay ship={selectedShip} currentPhase={room.state.currentPhase} />
            <ArmorQuadrantDisplay ship={selectedShip} />
            
            {/* 三阶段移动控制器 */}
            <ThreePhaseMovementController
              ship={selectedShip}
              networkManager={networkManager}
              onClose={() => {}}
              onOpenAttack={() => {
                notify.info('请选择武器和目标进行攻击');
                // 这里可以打开武器选择面板
              }}
            />
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

        {currentPlayer?.role === 'dm' && (
          <>
            <button
              style={{
                padding: '8px 12px',
                borderRadius: '4px',
                border: '1px solid #a78bfa',
                backgroundColor: '#5a2a3a',
                color: '#a78bfa',
                fontSize: '11px',
                cursor: 'pointer',
              }}
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

      <PlayerRosterModal
        isOpen={showPlayerRoster}
        onClose={() => setShowPlayerRoster(false)}
        players={players}
        ships={ships}
        currentSessionId={room.sessionId || ''}
        currentPhase={room.state.currentPhase || 'DEPLOYMENT'}
        onToggleReady={toggleReady}
        canManagePlayers={currentPlayer?.role === 'dm'}
        onKickPlayer={currentPlayer?.role === 'dm' ? kickPlayer : undefined}
        onInvitePlayer={currentPlayer?.role === 'dm' ? invitePlayer : undefined}
        onCloseRoom={currentPlayer?.role === 'dm' ? closeRoom : undefined}
        onSaveRoom={currentPlayer?.role === 'dm' ? saveRoom : undefined}
      />

      <SettingsMenu isOpen={showSettings} onClose={() => setShowSettings(false)} />
    </div>
  );
};

export default GameView;
