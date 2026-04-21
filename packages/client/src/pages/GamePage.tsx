/**
 * 游戏视图组件
 *
 * 现代 RTS 风格布局：
 * - 顶栏：阶段信息 + 快捷操作
 * - 中央：战术地图
 * - 底部：新的战斗面板（类文件夹设计）
 */

import type { RoomPlayerState } from "@vt/data";
import type { ShipJSON } from "@vt/data";
import { GamePhase, PlayerRole } from "@vt/data";
import type { ShipViewModel } from "@/renderer";
import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useUIStore } from "@/state/stores/uiStore";
import { useSocketRoom, useShips } from "@/sync";
import { ClientCommand } from "@/sync/types";
import { notify } from "@/ui/shared/Notification";
import { normalizeRotation, screenDeltaToWorldDelta } from "@/utils/coordinateSystem";
import { Crown, LogOut, Settings, Users, CheckCircle, XCircle, Info, Edit, Ship, Eye } from "lucide-react";
import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import type { SocketNetworkManager } from "@/network";
import "@/styles/game-layout.css";

// 导入新的底部战斗面板组件
import BattlePanel from "@/ui/panels/BattlePanel";
import ShipInfoPanel from "@/ui/panels/ShipInfoPanel";
import RealityEditPanel from "@/ui/panels/RealityEditPanel";
import HangarPanel from "@/ui/panels/HangarPanel";
import ViewControlPanel from "@/ui/panels/ViewControlPanel";

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
	const [hangarShips, setHangarShips] = useState<ShipJSON[]>([]);
	const [hangarLoading, setHangarLoading] = useState(false);

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

	useEffect(() => {
		let disposed = false;

		const loadHangar = async () => {
			setHangarLoading(true);
			const result = await networkManager.getLoadout();
			if (disposed) return;

			if (!result.success || !result.loadout) {
				notify.error(result.error || "机库数据加载失败");
				setHangarShips([]);
				setHangarLoading(false);
				return;
			}

			setHangarShips(result.loadout.ships || []);
			setHangarLoading(false);
		};

		void loadHangar();

		return () => {
			disposed = true;
		};
	}, [networkManager]);

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
			</main>

			{/* 底部战斗面板 */}
			<BattlePanel
				tabs={[
					{
						id: "ship-info",
						label: "舰船信息",
						icon: <Info size={14} />,
						component: (
							<ShipInfoPanel
								ship={selectedShip}
								canControl={canControlSelectedShip}
								onToggleShield={handleToggleShield}
								onVent={handleVent}
							/>
						),
						enabled: true,
					},
					{
						id: "reality-edit",
						label: "现实修改",
						icon: <Edit size={14} />,
						component: (
							<RealityEditPanel
								ship={selectedShip}
								onSubmit={(shipId, data) => {
									console.log("提交舰船数据修改:", shipId, data);
									// TODO: 实现实际的数据提交逻辑
									notify.success("舰船数据已提交修改");
								}}
							/>
						),
						enabled: true,
					},
					{
						id: "hangar",
						label: "机库",
						icon: <Ship size={14} />,
						component: (
							<HangarPanel
								cursorPosition={cameraPosition}
								ships={hangarShips}
								isLoading={hangarLoading}
								onDeployShip={(shipProfile, position) => {
									console.log("部署舰船:", shipProfile, position);
									// TODO: 实现实际的舰船部署逻辑
									notify.success(`已部署 ${shipProfile.name} 到 (${position.x}, ${position.y})`);
								}}
							/>
						),
						enabled: true,
					},
					{
						id: "view-control",
						label: "视图控制",
						icon: <Eye size={14} />,
						component: (
							<ViewControlPanel
								onResetView={resetView}
							/>
						),
						enabled: true,
					},
				]}
				defaultActiveTab="ship-info"
			/>

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