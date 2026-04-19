/**
 * 游戏视图组件
 *
 * 类似星际争霸的战术终端布局：
 * - 顶部：回合状态栏
 * - 中央：地图区域
 * - 右侧：信息面板（视图/日志/DM，支持折叠）
 * - 底部：战斗命令面板（整合舰船信息/移动/武器/回合）
 *
 * 样式：game-layout.css + BattleCommandPanel 模块
 */

import { NetworkManager } from "@/network/NetworkManager";
import type { MovementPreviewState } from "@/renderer";
import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useGameStore } from "@/state/stores";
import { useUIStore } from "@/state/stores/uiStore";
import { useCurrentGameRoom } from "@/sync";
import { useShips } from "@/sync";
import type { ClientCommandValue, FactionValue, PlayerState } from "@/sync/types";
import { ClientCommand, Faction, GamePhase, PlayerRole } from "@/sync/types";
import PlayerRosterModal from "@/ui/overlays/PlayerRosterModal";
import SettingsModal from "@/ui/overlays/SettingsModal";
import ShipCustomizationModal from "@/ui/overlays/ShipCustomizationModal";
import { BattleCommandPanel } from "@/ui/panels/BattleCommandPanel";
import { RightSidePanel } from "@/ui/panels/RightSidePanel";
import { TurnStatusBar } from "@/ui/panels/TurnStatusBar";
import { notify } from "@/ui/shared/Notification";
import { normalizeRotation, screenDeltaToWorldDelta } from "@/utils/coordinateSystem";
import { LogOut, Rocket, Settings, Users, Crown } from "lucide-react";
import React, { useState, useMemo, useCallback, useRef } from "react";
import "@/styles/game-layout.css";

interface GamePageProps {
	networkManager: NetworkManager;
	onLeaveRoom: () => void;
	playerName?: string;
}

export const GamePage: React.FC<GamePageProps> = ({ networkManager, onLeaveRoom }) => {
	const room = useCurrentGameRoom({ networkManager, onLeaveRoom });
	const [showSettings, setShowSettings] = useState(false);
	const [showPlayerRoster, setShowPlayerRoster] = useState(false);
	const [showShipCustomization, setShowShipCustomization] = useState(false);
	const [movementPreview, setMovementPreview] = useState<MovementPreviewState | undefined>(
		undefined
	);
	const mapSectionRef = useRef<HTMLDivElement | null>(null);
	const selectedShipId = useUIStore((state) => state.selectedShipId);
	const selectShip = useUIStore((state) => state.selectShip);

	// 注意：不需要手动监听 ship_created/ship_destroyed
	// Colyseus 的 MapSchema 会自动同步状态变化并触发 React 更新
	// 只在需要播放动画或音效时才监听这些事件

	// 玩家列表 - 简化版，信任服务端去重逻辑
	const players = useMemo(() => {
		const playersMap = room?.state?.players;
		if (!playersMap) return [];

		// 只过滤掉断开的玩家，去重逻辑由服务端处理
		const result: PlayerState[] = [];
		playersMap.forEach((player) => {
			if (player.connected) {
				result.push(player);
			}
		});
		return result;
	}, [room?.state?.players]);

	// 当前玩家 - 直接使用 sessionId 查找
	const currentPlayer = useMemo(() => {
		if (!room?.state?.players) return null;
		return room.state.players.get(room.sessionId) || null;
	}, [room?.state?.players, room?.sessionId]);

	// 舰船列表 - 使用 Colyseus MapSchema 原生事件
	const ships = useShips(room);

	const selectedShip = useMemo(() => {
		return ships.find((s) => s.id === selectedShipId) || null;
	}, [ships, selectedShipId]);

	const isPlayerTurn = room?.state?.currentPhase === GamePhase.PLAYER_TURN;
	const canControlSelectedShip = useMemo(() => {
		if (!selectedShip || !currentPlayer) return false;
		if (currentPlayer.role === PlayerRole.OWNER) return true;
		return (
			currentPlayer.role === PlayerRole.PLAYER &&
			isPlayerTurn &&
			selectedShip.ownerId === currentPlayer.sessionId &&
			!selectedShip.isDestroyed
		);
	}, [selectedShip, currentPlayer, isPlayerTurn]);

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

	// 地图控制 - 使用 ref 存储当前位置避免无限循环
	const cameraPositionRef = useRef(cameraPosition);
	cameraPositionRef.current = cameraPosition;

	const handleMapPan = useCallback(
		(deltaX: number, deltaY: number) => {
			const worldDelta = screenDeltaToWorldDelta(deltaX, deltaY, zoom, -viewRotation);
			const { x, y } = cameraPositionRef.current;
			setCameraPosition(x - worldDelta.x, y - worldDelta.y);
		},
		[setCameraPosition, zoom, viewRotation]
	);

	// 视图旋转 ref
	const viewRotationRef = useRef(viewRotation);
	viewRotationRef.current = viewRotation;

	const handleMapRotate = useCallback(
		(delta: number) => {
			setViewRotation(normalizeRotation(viewRotationRef.current + delta));
		},
		[setViewRotation]
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

	// DM 操作 - 直接创建对象
	const createObject = useCallback(
		(payload: {
			type: "ship" | "station" | "asteroid";
			hullId?: string;
			x: number;
			y: number;
			heading: number;
			faction: FactionValue;
			ownerId?: string;
			name?: string;
		}) => {
			if (!room) return;
			room.send(ClientCommand.CMD_CREATE_OBJECT, payload);
		},
		[room]
	);

	const createTestShip = useCallback(
		(faction: "player" | "dm", x: number, y: number) => {
			if (!room) return;
			room.send(ClientCommand.CMD_CREATE_OBJECT, {
				type: "ship",
				hullId: "frigate_assault",
				x,
				y,
				heading: 0,
				faction: faction === "player" ? Faction.PLAYER : Faction.NEUTRAL,
			});
		},
		[room]
	);

	const clearOverload = useCallback(
		(shipId: string) => {
			if (!room) return;
			room.send(ClientCommand.CMD_CLEAR_OVERLOAD, { shipId });
		},
		[room]
	);

	const setArmor = useCallback(
		(shipId: string, quadrant: number, value: number) => {
			if (!room) return;
			room.send(ClientCommand.CMD_SET_ARMOR, { shipId, quadrant, value });
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
			room.send(ClientCommand.CMD_KICK_PLAYER, { playerId: sessionId });
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

	// 命令操作
	const handleToggleShield = useCallback(() => {
		if (!selectedShip) return;
		sendCommand(ClientCommand.CMD_TOGGLE_SHIELD, {
			shipId: selectedShip.id,
			isActive: !selectedShip.shield.active,
			orientation: selectedShip.shield.orientation ?? selectedShip.transform.heading,
		});
	}, [selectedShip, sendCommand]);

	const handleSetShieldOrientation = useCallback(
		(orientation: number) => {
			if (!selectedShip) return;
			// 全盾激活时可调整朝向
			if (selectedShip.shield.active && selectedShip.shield.type === "OMNI") {
				sendCommand(ClientCommand.CMD_TOGGLE_SHIELD, {
					shipId: selectedShip.id,
					isActive: true,
					orientation: orientation,
				});
			}
		},
		[selectedShip, sendCommand]
	);

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

	const isOwner = currentPlayer?.role === PlayerRole.OWNER;

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
					<TurnStatusBar
						currentPhase={room.state.currentPhase}
						turnCount={room.state.turnCount}
						activeFaction={room.state.activeFaction}
						players={players}
						ships={ships}
						currentSessionId={room.sessionId || ""}
						onToggleReady={toggleReady}
						isReady={!!currentPlayer?.isReady}
					/>
				</div>

				<div className="game-layout__top-bar-right">
					{isOwner && (
						<button
							data-magnetic
							className="game-btn game-btn--dm"
							onClick={() => setShowShipCustomization(true)}
							title="舰船自定义"
						>
							<Crown className="game-btn__icon game-btn__icon--left" />
							自定义
						</button>
					)}
					<button data-magnetic className="game-btn" onClick={() => setShowPlayerRoster(true)}>
						<Users className="game-btn__icon game-btn__icon--left" />
						玩家
					</button>
					<button data-magnetic className="game-btn" onClick={() => setShowSettings(true)}>
						<Settings className="game-btn__icon game-btn__icon--left" />
						设置
					</button>
					<button data-magnetic className="game-btn game-btn--danger" onClick={onLeaveRoom}>
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
						<PixiCanvas
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
							movementPreview={movementPreview}
							onSelectShip={(id) => {
								selectShip(id);
							}}
							onPanDelta={handleMapPan}
							onRotateDelta={handleMapRotate}
						/>
					</div>
				</div>

				{/* 右侧面板 - 视图/日志/DM */}
				<RightSidePanel
					isOwner={isOwner}
					ships={ships}
					players={players}
					onCreateObject={createObject}
					onCreateTestShip={createTestShip}
					onClearOverload={clearOverload}
					onSetArmor={setArmor}
					onAssignShip={assignShip}
					onNextPhase={nextPhase}
					onResetView={() => {
						setCameraPosition(0, 0);
						setViewRotation(0);
						useUIStore.getState().setZoom(1);
					}}
				/>
			</div>

			{/* 底部战斗命令面板 */}
			<BattleCommandPanel
				selectedShip={selectedShip}
				ships={ships}
				networkManager={networkManager}
				onToggleShield={handleToggleShield}
				onSetShieldOrientation={handleSetShieldOrientation}
				onVent={handleVent}
				disabled={!canControlSelectedShip}
				onMovementPreviewChange={setMovementPreview}
			/>

			{/* 弹窗 */}
			<PlayerRosterModal
				isOpen={showPlayerRoster}
				onClose={() => setShowPlayerRoster(false)}
				players={players}
				ships={ships}
				currentSessionId={room.sessionId || ""}
				currentPhase={room.state.currentPhase || "DEPLOYMENT"}
				onToggleReady={toggleReady}
				canManagePlayers={isOwner}
				onKickPlayer={isOwner ? kickPlayer : undefined}
				onInvitePlayer={isOwner ? invitePlayer : undefined}
				onCloseRoom={undefined}
				onSaveRoom={undefined}
				onLeaveRoom={onLeaveRoom}
			/>

			<SettingsModal isOpen={showSettings} onClose={() => setShowSettings(false)} />

			{/* 舰船自定义弹窗 */}
			<ShipCustomizationModal
				isOpen={showShipCustomization}
				onClose={() => setShowShipCustomization(false)}
				ships={ships}
				networkManager={networkManager}
				currentSessionId={room.sessionId || ""}
			/>
		</div>
	);
};

export default GamePage;
