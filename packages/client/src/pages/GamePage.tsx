/**
 * 游戏视图组件
 * 
 * 现代 RTS 风格布局：
 * - 顶栏：阶段信息 + 快捷操作
 * - 中央：战术地图
 * - 右侧：信息面板（可折叠）
 * - 底部：选中单位操作栏
 */

import type { RoomPlayerState } from "@vt/data";
import { Faction, GamePhase, PlayerRole } from "@vt/data";
import type { ShipViewModel } from "@/renderer";
import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useUIStore } from "@/state/stores/uiStore";
import { useSocketRoom, useShips } from "@/sync";
import { ClientCommand } from "@/sync/types";
import { notify } from "@/ui/shared/Notification";
import { normalizeRotation, screenDeltaToWorldDelta } from "@/utils/coordinateSystem";
import { Crown, LogOut, Settings, Users, ChevronLeft, ChevronRight, CheckCircle, XCircle, Shield, Zap, Navigation2 } from "lucide-react";
import React, { useState, useMemo, useCallback, useRef } from "react";
import type { SocketNetworkManager } from "@/network";
import "@/styles/game-layout.css";

const PHASE_NAMES: Record<string, string> = {
	DEPLOYMENT: "部署",
	PLAYER_ACTION: "玩家回合",
	DM_ACTION: "DM回合",
	TURN_END: "结算",
};

interface GamePageProps {
	networkManager: SocketNetworkManager;
	onLeaveRoom: () => void;
	playerName?: string;
}

export const GamePage: React.FC<GamePageProps> = ({ networkManager, onLeaveRoom }) => {
	const room = useSocketRoom(networkManager, onLeaveRoom);
	const [showSettings, setShowSettings] = useState(false);
	const [showPlayerRoster, setShowPlayerRoster] = useState(false);
	const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

	const selectedShipId = useUIStore((state) => state.selectedShipId);
	const selectShip = useUIStore((state) => state.selectShip);
	const { zoom, cameraPosition, setCameraPosition, viewRotation, setViewRotation, showGrid, showBackground, showWeaponArcs, showMovementRange } = useUIStore();

	const cameraPositionRef = useRef(cameraPosition);
	cameraPositionRef.current = cameraPosition;
	const viewRotationRef = useRef(viewRotation);
	viewRotationRef.current = viewRotation;

	const players = useMemo(() => {
		if (!room?.state?.players) return [];
		const result: RoomPlayerState[] = [];
		room.state.players.forEach((player: RoomPlayerState) => {
			if (player.connected) result.push(player);
		});
		return result;
	}, [room?.state?.players]);

	const currentPlayer = useMemo(() => {
		if (!room?.state?.players || !room.sessionId) return null;
		return room.state.players.get(room.sessionId) || null;
	}, [room?.state?.players, room?.sessionId]);

	const ships = useShips(room) as ShipViewModel[];

	const selectedShip = useMemo(() => ships.find((s) => s.id === selectedShipId) || null, [ships, selectedShipId]);

	const isPlayerTurn = room?.state?.currentPhase === GamePhase.PLAYER_ACTION;
	const isOwner = currentPlayer?.role === PlayerRole.OWNER;

	const canControlSelectedShip = useMemo(() => {
		if (!selectedShip || !currentPlayer) return false;
		if (currentPlayer.role === PlayerRole.OWNER) return true;
		return currentPlayer.role === PlayerRole.PLAYER && isPlayerTurn && selectedShip.ownerId === currentPlayer.sessionId && !selectedShip.destroyed;
	}, [selectedShip, currentPlayer, isPlayerTurn]);

	const handleMapPan = useCallback((deltaX: number, deltaY: number) => {
		const worldDelta = screenDeltaToWorldDelta(deltaX, deltaY, zoom, -viewRotationRef.current);
		setCameraPosition(cameraPositionRef.current.x - worldDelta.x, cameraPositionRef.current.y - worldDelta.y);
	}, [setCameraPosition, zoom]);

	const handleMapRotate = useCallback((delta: number) => {
		setViewRotation(normalizeRotation(viewRotationRef.current + delta));
	}, [setViewRotation]);

	const sendCommand = useCallback(async (command: string, payload: unknown) => {
		if (!room) return;
		try { await room.send(command, payload); }
		catch (error) { console.error("[GameView] Send command error:", error); notify.error("命令发送失败"); }
	}, [room]);

	const createTestShip = useCallback((faction: "player" | "owner", x: number, y: number) => {
		if (!room) return;
		room.send(ClientCommand.CMD_CREATE_OBJECT, {
			type: "ship", hullId: "frigate_assault", x, y, heading: 0,
			faction: faction === "player" ? Faction.PLAYER : Faction.NEUTRAL,
		});
	}, [room]);

	const nextPhase = useCallback(() => {
		if (!room) return;
		room.send(ClientCommand.CMD_NEXT_PHASE, {});
	}, [room]);

	const toggleReady = useCallback(() => {
		networkManager.setReady(!currentPlayer?.isReady);
	}, [networkManager, currentPlayer?.isReady]);

	const invitePlayer = useCallback(async () => {
		if (!room) return;
		const link = networkManager.buildInviteLink(room.roomId);
		await navigator.clipboard.writeText(link);
		notify.success("邀请链接已复制");
	}, [networkManager, room]);

	const handleToggleShield = useCallback(() => {
		if (!selectedShip) return;
		sendCommand(ClientCommand.CMD_TOGGLE_SHIELD, { shipId: selectedShip.id, active: !selectedShip.shield?.active });
	}, [selectedShip, sendCommand]);

	const handleVent = useCallback(() => {
		if (!selectedShip) return;
		sendCommand(ClientCommand.CMD_VENT_FLUX, { shipId: selectedShip.id });
	}, [selectedShip, sendCommand]);

	const resetView = useCallback(() => {
		setCameraPosition(0, 0);
		setViewRotation(0);
		useUIStore.getState().setZoom(1);
	}, [setCameraPosition, setViewRotation]);

	if (!room || !room.state) {
		return <div className="game-loading"><span>连接中...</span></div>;
	}

	const phaseColor = room.state.currentPhase === GamePhase.PLAYER_ACTION ? "#4a9eff"
		: room.state.currentPhase === GamePhase.DM_ACTION ? "#ff6f8f"
		: room.state.currentPhase === GamePhase.DEPLOYMENT ? "#9b59b6" : "#f1c40f";

	return (
		<div className="game-view">
			<header className="game-header">
				<div className="game-header__left">
					<span className="game-phase" style={{ borderColor: phaseColor }}>
						{room.state.currentPhase === GamePhase.DM_ACTION && <Crown size={14} style={{ color: phaseColor }} />}
						<span>{PHASE_NAMES[room.state.currentPhase] || room.state.currentPhase}</span>
					</span>
					<span className="game-turn">回合 {room.state.turnCount}</span>
				</div>

				<div className="game-header__center">
					{players.slice(0, 6).map((p) => (
						<span key={p.sessionId} className={`player-chip ${p.role === PlayerRole.OWNER ? "player-chip--dm" : ""}`}>
							{p.role === PlayerRole.OWNER && <Crown size={12} />}
							<span className="player-chip__name">{p.nickname}</span>
							{p.isReady ? <CheckCircle size={12} className="player-chip__ready" /> : <XCircle size={12} />}
						</span>
					))}
				</div>

				<div className="game-header__right">
					<button className="game-btn game-btn--ghost" onClick={() => setShowPlayerRoster(true)}><Users size={16} /></button>
					<button className="game-btn game-btn--ghost" onClick={() => setShowSettings(true)}><Settings size={16} /></button>
					<button className="game-btn game-btn--danger" onClick={onLeaveRoom}><LogOut size={16} /></button>
				</div>
			</header>

			<main className="game-main">
				<section className="game-map">
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
						movementPreview={undefined}
						onSelectShip={(id) => selectShip(id)}
						onPanDelta={handleMapPan}
						onRotateDelta={handleMapRotate}
					/>
				</section>

				<aside className={`game-sidebar ${rightPanelCollapsed ? "game-sidebar--collapsed" : ""}`}>
					<button className="sidebar-toggle" onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}>
						{rightPanelCollapsed ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
					</button>

					{!rightPanelCollapsed && (
						<div className="sidebar-content">
							{selectedShip ? (
								<div className="sidebar-section">
									<div className="ship-header">
										<span className="ship-header__id">{selectedShip.id.slice(-6)}</span>
										{selectedShip.overloaded && <span className="ship-badge ship-badge--overload">过载</span>}
										{selectedShip.shield?.active && <span className="ship-badge ship-badge--shield">护盾</span>}
									</div>

									<div className="ship-stats">
										<div className="stat-row">
											<span className="stat-label">HULL</span>
											<div className="stat-bar">
												<div className="stat-bar__fill stat-bar__fill--hull" style={{ width: `${(selectedShip.hull / (selectedShip.hullMax || 100)) * 100}%` }} />
											</div>
											<span className="stat-value">{selectedShip.hull}</span>
										</div>

										{selectedShip.shield && (
											<div className="stat-row">
												<span className="stat-label">SHIELD</span>
												<div className="stat-bar">
													<div className="stat-bar__fill stat-bar__fill--shield" style={{ width: `${(selectedShip.shield.value / 100) * 100}%` }} />
												</div>
												<span className="stat-value">{selectedShip.shield.value}</span>
											</div>
										)}

										{(selectedShip.fluxSoft || selectedShip.fluxHard) && (
											<div className="stat-row">
												<span className="stat-label">FLUX</span>
												<div className="stat-bar">
													<div className="stat-bar__fill stat-bar__fill--flux" style={{ width: `${((selectedShip.fluxSoft || 0) + (selectedShip.fluxHard || 0)) / (selectedShip.fluxCapacity || 100) * 100}%` }} />
												</div>
												<span className="stat-value">{(selectedShip.fluxSoft || 0) + (selectedShip.fluxHard || 0)}</span>
											</div>
										)}
									</div>

									<div className="ship-actions">
										<button className="action-btn" onClick={handleToggleShield} disabled={!canControlSelectedShip}><Shield size={14} /> 护盾</button>
										<button className="action-btn" onClick={handleVent} disabled={!canControlSelectedShip}><Zap size={14} /> 辐散</button>
									</div>
								</div>
							) : (
								<div className="sidebar-empty">选择舰船查看详情</div>
							)}

							{isOwner && (
								<div className="sidebar-section sidebar-section--dm">
									<div className="section-title">DM 控制</div>
									<div className="dm-actions">
										<button className="action-btn" onClick={() => createTestShip("player", 100, 100)}>创建玩家船</button>
										<button className="action-btn" onClick={() => createTestShip("owner", -100, 100)}>创建敌方船</button>
										<button className="action-btn action-btn--primary" onClick={nextPhase}>推进阶段</button>
									</div>
								</div>
							)}

							<div className="sidebar-section">
								<div className="section-title">视图</div>
								<button className="action-btn" onClick={resetView}>重置视角</button>
							</div>
						</div>
					)}
				</aside>
			</main>

			<footer className="game-footer">
				{selectedShip ? (
					<div className="command-bar">
						<div className="command-bar__unit">
							<span className="unit-icon">{selectedShip.faction === Faction.PLAYER ? "🔵" : "🔴"}</span>
							<span className="unit-name">{selectedShip.id.slice(-6)}</span>
							<span className="unit-phase">{selectedShip.movement?.currentPhase || "NONE"}</span>
						</div>
						<div className="command-bar__actions">
							<button className="cmd-btn" onClick={handleToggleShield} disabled={!canControlSelectedShip}><Shield size={16} /></button>
							<button className="cmd-btn" onClick={handleVent} disabled={!canControlSelectedShip}><Zap size={16} /></button>
							<button className="cmd-btn cmd-btn--primary" disabled={!canControlSelectedShip}><Navigation2 size={16} /></button>
						</div>
						<div className="command-bar__status">
							{selectedShip.overloaded && <span className="status-alert">过载</span>}
							{selectedShip.venting && <span className="status-info">辐散中</span>}
						</div>
					</div>
				) : (
					<div className="command-bar command-bar--empty"><span className="hint">点击舰船选择</span></div>
				)}

				{currentPlayer?.role !== PlayerRole.OWNER && (
					<button className={`ready-toggle ${currentPlayer?.isReady ? "ready-toggle--ready" : ""}`} onClick={toggleReady}>
						{currentPlayer?.isReady ? <CheckCircle size={16} /> : <XCircle size={16} />}
						<span>{currentPlayer?.isReady ? "已准备" : "准备"}</span>
					</button>
				)}
			</footer>

			{showPlayerRoster && (
				<div className="modal-overlay" onClick={() => setShowPlayerRoster(false)}>
					<div className="modal-panel" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<span><Users size={16} /> 玩家列表</span>
							<button className="modal-close" onClick={() => setShowPlayerRoster(false)}>×</button>
						</div>
						<div className="modal-body">
							{players.map((p) => (
								<div key={p.sessionId} className={`player-row ${p.sessionId === room.sessionId ? "player-row--current" : ""}`}>
									{p.role === PlayerRole.OWNER && <Crown size={14} className="player-row__icon" />}
									<span className="player-row__name">{p.nickname}</span>
									{p.isReady ? <CheckCircle size={12} className="player-row__ready" /> : <XCircle size={12} />}
								</div>
							))}
						</div>
						<div className="modal-footer">
							{isOwner && <button className="action-btn" onClick={invitePlayer}>邀请链接</button>}
							<button className="action-btn action-btn--danger" onClick={onLeaveRoom}>离开房间</button>
						</div>
					</div>
				</div>
			)}

			{showSettings && (
				<div className="modal-overlay" onClick={() => setShowSettings(false)}>
					<div className="modal-panel" onClick={(e) => e.stopPropagation()}>
						<div className="modal-header">
							<span><Settings size={16} /> 设置</span>
							<button className="modal-close" onClick={() => setShowSettings(false)}>×</button>
						</div>
						<div className="modal-body">
							<div className="setting-row">
								<span>显示网格</span>
								<button className={`toggle ${showGrid ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleGrid()} />
							</div>
							<div className="setting-row">
								<span>显示背景</span>
								<button className={`toggle ${showBackground ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleBackground()} />
							</div>
							<div className="setting-row">
								<span>显示武器弧</span>
								<button className={`toggle ${showWeaponArcs ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleWeaponArcs()} />
							</div>
							<div className="setting-row">
								<span>显示移动范围</span>
								<button className={`toggle ${showMovementRange ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleMovementRange()} />
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default GamePage;