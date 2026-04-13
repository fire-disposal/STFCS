/**
 * 游戏视图组件
 *
 * 类似星际争霸的战术终端布局：
 * - 顶部：回合状态栏
 * - 中央：地图区域
 * - 右侧：信息面板（视图/日志/DM，支持折叠）
 * - 底部：命令 Dock（整合舰船信息/辐能/护甲）
 *
 * 样式：game-layout.css + game-panels.css
 */

import { GameCanvas } from "@/components/map/GameCanvas";
import { notify } from "@/components/ui/Notification";
import { PhaseBar } from "@/features/game/PhaseBar";
import { PlayerRosterModal } from "@/features/lobby";
import { FuelBasedMovementController } from "@/features/movement/FuelBasedMovementController";
import { SettingsMenu } from "@/features/ui/SettingsMenu";
import { useCurrentGameRoom } from "@/hooks";
import { NetworkManager } from "@/network/NetworkManager";
import { useUIStore } from "@/store/uiStore";
import { normalizeRotation } from "@/utils/angleSystem";
import type { ClientCommandValue, FactionValue, PlayerState, ShipState } from "@vt/contracts";
import { ClientCommand, Faction, PlayerRole } from "@vt/contracts";
import { LogOut, Rocket, Settings, Users } from "lucide-react";
import React, { useState, useMemo, useCallback, useRef } from "react";
import "@/styles/game-layout.css";

interface GameViewProps {
	networkManager: NetworkManager;
	onLeaveRoom: () => void;
	playerName?: string;
}

export const GameView: React.FC<GameViewProps> = ({ networkManager, onLeaveRoom }) => {
	const room = useCurrentGameRoom({ networkManager, onLeaveRoom });
	const [showSettings, setShowSettings] = useState(false);
	const [showPlayerRoster, setShowPlayerRoster] = useState(false);
	const [showMovementPanel, setShowMovementPanel] = useState(false);
	const mapSectionRef = useRef<HTMLDivElement | null>(null);
	const [pendingPlacement, setPendingPlacement] = useState<{
		type: "ship" | "station" | "asteroid";
		hullId?: string;
		heading: number;
		faction: FactionValue;
		ownerId?: string;
	} | null>(null);
	const [isPlacementMode, setIsPlacementMode] = useState(false);

	// 玩家列表
	const players = useMemo(() => {
		const rosterByIdentity = new Map<string, PlayerState>();
		const playersMap = room?.state?.players as Map<string, PlayerState> | undefined;
		if (!playersMap) {
			return [];
		}
		playersMap.forEach((value: PlayerState) => {
			const shortId = (value as PlayerState & { shortId?: number }).shortId ?? 0;
			const identityKey = shortId > 0 ? `short:${shortId}` : `session:${value.sessionId}`;
			const current = rosterByIdentity.get(identityKey);
			if (!current) {
				rosterByIdentity.set(identityKey, value);
				return;
			}
			if ((value.connected && !current.connected) || value.sessionId === room?.sessionId) {
				rosterByIdentity.set(identityKey, value);
			}
		});
		return Array.from(rosterByIdentity.values());
	}, [room?.state?.players, room?.sessionId]);

	// 当前玩家
	const currentPlayer = useMemo(() => {
		return players.find((p) => p.sessionId === room?.sessionId) || null;
	}, [players, room?.sessionId]);

	// 舰船列表
	const ships = useMemo(() => {
		const result: ShipState[] = [];
		const shipsMap = room?.state?.ships as Map<string, ShipState> | undefined;
		if (!shipsMap) {
			return [];
		}
		shipsMap.forEach((value: ShipState) => result.push(value));
		return result;
	}, [room?.state?.ships]);

	// 选中的舰船
	const selectedShipId = useMemo(() => {
		const selected = ships.find((s) => {
			const owner = players.find((p) => p.sessionId === room?.sessionId);
			return s.ownerId === owner?.sessionId;
		});
		return selected?.id || null;
	}, [ships, players, room?.sessionId]);

	const selectedShip = useMemo(() => {
		return ships.find((s) => s.id === selectedShipId) || null;
	}, [ships, selectedShipId]);

	// UI 状态
	const {
		zoom,
		cameraPosition,
		setCameraPosition,
		viewRotation,
		setViewRotation,
		showGrid,
		showBackground,
		showWeaponArcs,
		showMovementRange,
	} = useUIStore();

	// 地图控制
	const handleMapPan = useCallback(
		(deltaX: number, deltaY: number) => {
			setCameraPosition(cameraPosition.x + deltaX, cameraPosition.y + deltaY);
		},
		[cameraPosition.x, cameraPosition.y, setCameraPosition]
	);

	const handleMapRotate = useCallback(
		(delta: number) => {
			setViewRotation(normalizeRotation(viewRotation + delta));
		},
		[viewRotation, setViewRotation]
	);

	const handleMapClick = useCallback(
		(x: number, y: number) => {
			// 点击摆放模式
			if (isPlacementMode && pendingPlacement) {
				// 使用点击的坐标发送创建命令
				room?.send("DM_CREATE_OBJECT", {
					...pendingPlacement,
					x,
					y,
				});
				setPendingPlacement(null);
				setIsPlacementMode(false);
			}
		},
		[isPlacementMode, pendingPlacement, room]
	);

	// 命令发送
	const sendCommand = useCallback(
		async (command: ClientCommandValue, payload: unknown) => {
			if (!room) return;
			try {
				await room.send(command, payload);
			} catch (error) {
				console.error("[GameView] Send command error:", error);
				notify.error("命令发送失败");
			}
		},
		[room]
	);

	// DM 操作 - 手动模式直接创建
	const createObject = useCallback(
		(payload: {
			type: "ship" | "station" | "asteroid";
			hullId?: string;
			x: number;
			y: number;
			heading: number;
			faction: FactionValue;
			ownerId?: string;
		}) => {
			if (!room) return;
			if (isPlacementMode) {
				// 摆放模式：保存数据等待地图点击
				setPendingPlacement(payload);
			} else {
				// 手动模式：直接创建
				room.send("DM_CREATE_OBJECT", payload);
			}
		},
		[room, isPlacementMode]
	);

	// 切换摆放模式
	const togglePlacementMode = useCallback(() => {
		setIsPlacementMode((prev) => !prev);
		setPendingPlacement(null);
	}, []);

	const createTestShip = useCallback(
		(faction: "player" | "dm", x: number, y: number) => {
			if (!room) return;
			room.send("CREATE_TEST_SHIP", {
				faction: faction === "player" ? Faction.PLAYER : Faction.DM,
				x,
				y,
			});
		},
		[room]
	);

	const clearOverload = useCallback(
		(shipId: string) => {
			if (!room) return;
			room.send("DM_CLEAR_OVERLOAD", { shipId });
		},
		[room]
	);

	const setArmor = useCallback(
		(shipId: string, section: number, value: number) => {
			if (!room) return;
			room.send("DM_SET_ARMOR", { shipId, section, value });
		},
		[room]
	);

	const assignShip = useCallback(
		(shipId: string, targetSessionId: string) => {
			if (!room) return;
			room.send(ClientCommand.CMD_ASSIGN_SHIP, { shipId, targetSessionId });
		},
		[room]
	);

	const nextPhase = useCallback(() => {
		if (!room) return;
		room.send(ClientCommand.CMD_NEXT_PHASE, {});
	}, [room]);

	const toggleReady = useCallback(() => {
		if (!room) return;
		room.send(ClientCommand.CMD_TOGGLE_READY, { isReady: !currentPlayer?.isReady });
	}, [room, currentPlayer?.isReady]);

	const kickPlayer = useCallback(
		(sessionId: string) => {
			if (!room) return;
			room.send("ROOM_KICK_PLAYER", { targetSessionId: sessionId });
			notify.info("已发送踢出请求");
		},
		[room]
	);

	const invitePlayer = useCallback(async () => {
		if (!room) return;
		const link = networkManager.buildInviteLink(room.roomId);
		await navigator.clipboard.writeText(link);
		notify.success("邀请链接已复制到剪贴板");
	}, [networkManager, room]);

	// 命令 Dock 操作
	const handleOpenMovement = useCallback(() => {
		setShowMovementPanel(true);
	}, []);

	const handleCloseMovement = useCallback(() => {
		setShowMovementPanel(false);
	}, []);

	const handleToggleShield = useCallback(() => {
		if (!selectedShip) return;
		sendCommand(ClientCommand.CMD_TOGGLE_SHIELD, {
			shipId: selectedShip.id,
			isActive: !selectedShip.isShieldUp,
			orientation: selectedShip.transform.heading,
		});
	}, [selectedShip, sendCommand]);

	const handleFire = useCallback(() => {
		notify.info("请选择武器和目标进行攻击");
	}, []);

	const handleVent = useCallback(() => {
		if (!selectedShip) return;
		sendCommand(ClientCommand.CMD_VENT_FLUX, { shipId: selectedShip.id });
	}, [selectedShip, sendCommand]);

	if (!room || !room.state) {
		return (
			<div className="game-layout">
				<div className="game-layout__loading">
					<div className="game-layout__loading-text">连接中...</div>
				</div>
			</div>
		);
	}

	if (!room.state.players || !room.state.ships) {
		return (
			<div className="game-layout">
				<div className="game-layout__loading">
					<div className="game-layout__loading-text">初始化房间状态...</div>
				</div>
			</div>
		);
	}

	const isDM = currentPlayer?.role === PlayerRole.DM;

	return (
		<div className="game-layout">
			{/* 顶部状态栏 */}
			<div className="game-layout__top-bar">
				<div className="game-layout__top-bar-left">
					<div className="game-layout__top-bar-title">
						<Rocket className="game-layout__top-bar-icon" />
						STFCS
					</div>
					<div className="game-layout__top-bar-phase">{room.state.currentPhase || "加载中"}</div>
				</div>

				<div className="game-layout__top-bar-center">
					<PhaseBar
						currentPhase={room.state.currentPhase}
						turnCount={room.state.turnCount}
						activeFaction={room.state.activeFaction}
						playerRole={currentPlayer?.role || PlayerRole.PLAYER}
					/>
				</div>

				<div className="game-layout__top-bar-right">
					<button
						data-magnetic
						className="game-btn game-btn--small"
						onClick={() => setShowPlayerRoster(true)}
					>
						<Users className="game-btn__icon game-btn__icon--left" />
						玩家
					</button>
					<button
						data-magnetic
						className="game-btn game-btn--small"
						onClick={() => setShowSettings(true)}
					>
						<Settings className="game-btn__icon game-btn__icon--left" />
						设置
					</button>
					<button
						data-magnetic
						className="game-btn game-btn--small game-btn--danger"
						onClick={onLeaveRoom}
					>
						<LogOut className="game-btn__icon game-btn__icon--left" />
						离开
					</button>
				</div>
			</div>

			{/* 主内容区 */}
			<div className="game-layout__main">
				{/* 地图区域 */}
				<div className="game-layout__map-area">
					<div ref={mapSectionRef} className="game-layout__map-section">
						<GameCanvas
							ships={ships}
							zoom={zoom}
							cameraX={cameraPosition.x}
							cameraY={cameraPosition.y}
							viewRotation={viewRotation}
							showGrid={showGrid}
							showBackground={showBackground}
							showWeaponArcs={showWeaponArcs}
							showMovementRange={showMovementRange}
							selectedShipId={selectedShipId}
							onSelectShip={(id) => console.log("[GameView] Select:", id)}
							onPanDelta={handleMapPan}
							onRotateDelta={handleMapRotate}
							onClick={isPlacementMode && isDM ? handleMapClick : undefined}
						/>
					</div>
				</div>

				{/* 右侧面板 - 视图/日志/DM */}
				<RightSidePanel
					room={room}
					isDM={isDM}
					ships={ships}
					players={players}
					onCreateObject={createObject}
					isPlacementMode={isPlacementMode}
					onTogglePlacementMode={togglePlacementMode}
					onCreateTestShip={createTestShip}
					onClearOverload={clearOverload}
					onSetArmor={setArmor}
					onAssignShip={assignShip}
					onNextPhase={nextPhase}
					zoom={zoom}
					cameraX={cameraPosition.x}
					cameraY={cameraPosition.y}
					viewRotation={viewRotation}
					showGrid={showGrid}
					showBackground={showBackground}
					showWeaponArcs={showWeaponArcs}
					showMovementRange={showMovementRange}
					onZoomChange={(newZoom) => useUIStore.getState().setZoom(newZoom)}
					onCameraChange={(x, y) => setCameraPosition(x, y)}
					onViewRotationChange={(rotation) => setViewRotation(rotation)}
					onToggleGrid={() => useUIStore.getState().toggleGrid()}
					onToggleBackground={() => useUIStore.getState().toggleBackground()}
					onToggleWeaponArcs={() => useUIStore.getState().toggleWeaponArcs()}
					onToggleMovementRange={() => useUIStore.getState().toggleMovementRange()}
					onResetView={() => {
						setCameraPosition(0, 0);
						setViewRotation(0);
						useUIStore.getState().setZoom(1);
					}}
				/>
			</div>

			{/* 底部命令 Dock - 整合舰船信息/辐能/护甲 */}
			<BottomCommandDock
				selectedShip={selectedShip}
				playerRole={currentPlayer?.role || PlayerRole.PLAYER}
				onMove={handleOpenMovement}
				onToggleShield={handleToggleShield}
				onFire={handleFire}
				onVent={handleVent}
				disabled={false}
			/>

			{/* 移动面板弹窗 - 燃料池制度 */}
			{showMovementPanel && selectedShip && (
				<div className="game-modal-overlay" onClick={handleCloseMovement}>
					<div className="game-modal game-modal--large" onClick={(e) => e.stopPropagation()}>
						<FuelBasedMovementController
							ship={selectedShip}
							networkManager={networkManager}
							onClose={handleCloseMovement}
							onOpenAttack={handleFire}
						/>
					</div>
				</div>
			)}

			{/* 弹窗 */}
			<PlayerRosterModal
				isOpen={showPlayerRoster}
				onClose={() => setShowPlayerRoster(false)}
				players={players}
				ships={ships}
				currentSessionId={room.sessionId || ""}
				currentPhase={room.state.currentPhase || "DEPLOYMENT"}
				onToggleReady={toggleReady}
				canManagePlayers={isDM}
				onKickPlayer={isDM ? kickPlayer : undefined}
				onInvitePlayer={isDM ? invitePlayer : undefined}
				onCloseRoom={undefined}
				onSaveRoom={undefined}
				onLeaveRoom={onLeaveRoom}
			/>

			<SettingsMenu isOpen={showSettings} onClose={() => setShowSettings(false)} />
		</div>
	);
};

export default GameView;
