import { GamePhase, PlayerRole } from "@vt/data";
import type { ShipViewModel } from "@/renderer";
import PixiCanvas from "@/renderer/core/PixiCanvas";
import { useUIStore } from "@/state/stores/uiStore";
import { useSocketRoom, useShips } from "@/network";
import { notify } from "@/ui/shared/Notification";
import { Crown, LogOut, Settings, Users, CheckCircle, XCircle, Info, Edit, Ship, Eye } from "lucide-react";
import React, { useState } from "react";
import type { SocketNetworkManager } from "@/network";
import "@/styles/game-layout.css";

import BattlePanel from "@/ui/panels/BattlePanel";
import ShipInfoPanel from "@/ui/panels/ShipInfoPanel";
import RealityEditPanel from "@/ui/panels/RealityEditPanel";
import HangarPanel from "@/ui/panels/HangarPanel";
import ViewControlPanel from "@/ui/panels/ViewControlPanel";
import { useGameInteraction } from "./GamePage/useGameInteraction";

const PHASE_NAMES: Record<string, string> = {
	DEPLOYMENT: "部署",
	PLAYER_ACTION: "玩家回合",
	DM_ACTION: "DM回合",
	TURN_END: "结算",
};

interface GamePageProps {
	networkManager: SocketNetworkManager;
	onLeaveRoom: () => void;
}

export const GamePage: React.FC<GamePageProps> = ({ networkManager, onLeaveRoom }) => {
	const room = useSocketRoom(networkManager, onLeaveRoom);
	const [showSettings, setShowSettings] = useState(false);
	const [showPlayerRoster, setShowPlayerRoster] = useState(false);

	const selectedShipId = useUIStore((state) => state.selectedShipId);
	const mapCursor = useUIStore((state) => state.mapCursor);

	const ships = useShips(room) as unknown as ShipViewModel[];
	const selectedShip = ships.find((s) => s.id === selectedShipId) ?? null;

	const { handleToggleShield, handleVent } = useGameInteraction(room, selectedShip);

	const handleRealityEdit = async (shipId: string, runtimeData: Record<string, unknown>) => {
		if (!room) return;
		try {
			for (const [field, value] of Object.entries(runtimeData)) {
				await room.send("dm:modify", { tokenId: shipId, field, value });
			}
			notify.success("舰船数据已提交修改");
		} catch (error) {
			notify.error(error instanceof Error ? error.message : "修改失败");
		}
	};

	const currentPlayer = room?.state?.players?.get(room.sessionId ?? "") ?? null;
	const isHost = currentPlayer?.role === PlayerRole.HOST;

	const cursorPosition = mapCursor ? { x: mapCursor.x, y: mapCursor.y } : { x: 0, y: 0 };

	if (!room || !room.state) {
		return <div className="game-loading"><span>连接中...</span></div>;
	}

	const players = Array.from(room.state.players.values()).filter((p) => p.connected);
	const phaseColor = room.state.currentPhase === GamePhase.PLAYER_ACTION ? "#4a9eff"
		: room.state.currentPhase === GamePhase.DM_ACTION ? "#ff6f8f"
		: room.state.currentPhase === GamePhase.DEPLOYMENT ? "#9b59b6" : "#f1c40f";

	return (
		<div className="game-view">
			<header className="game-header">
				<div className="game-header__left">
					<span className="game-phase" style={{ borderColor: phaseColor }}>
						{room.state.currentPhase === GamePhase.DM_ACTION && <Crown size={14} style={{ color: phaseColor }} />}
						<span>{PHASE_NAMES[room.state.currentPhase] ?? room.state.currentPhase}</span>
					</span>
					<span className="game-turn">回合 {room.state.turnCount}</span>
				</div>

				<div className="game-header__center">
					{players.slice(0, 6).map((p) => (
						<span key={p.sessionId} className={`player-chip ${p.role === PlayerRole.HOST ? "player-chip--dm" : ""}`}>
							{p.role === PlayerRole.HOST && <Crown size={12} />}
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
					<PixiCanvas ships={ships} />
				</section>
			</main>

			<BattlePanel
				tabs={[
					{
						id: "ship-info",
						label: "舰船信息",
						icon: <Info size={14} />,
						component: <ShipInfoPanel ship={selectedShip} canControl={true} onToggleShield={handleToggleShield} onVent={handleVent} />,
						enabled: true,
					},
					{
						id: "reality-edit",
						label: "现实修改",
						icon: <Edit size={14} />,
						component: <RealityEditPanel ship={selectedShip} onSubmit={handleRealityEdit} />,
						enabled: isHost,
					},
					{
						id: "hangar",
						label: "机库",
						icon: <Ship size={14} />,
						component: (
							<HangarPanel
								cursorPosition={cursorPosition}
								networkManager={networkManager}
								room={room ?? undefined}
								isHost={isHost}
							/>
						),
						enabled: isHost,
					},
					{
						id: "view-control",
						label: "视图控制",
						icon: <Eye size={14} />,
						component: <ViewControlPanel />,
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
									{p.role === PlayerRole.HOST && <Crown size={14} className="player-row__icon" />}
									<span className="player-row__name">{p.nickname}</span>
									{p.isReady ? <CheckCircle size={12} className="player-row__ready" /> : <XCircle size={12} />}
								</div>
							))}
						</div>
						<div className="modal-footer">
							{isHost && <button className="action-btn" onClick={() => { navigator.clipboard.writeText(networkManager.buildInviteLink(room.roomId)); notify.success("邀请链接已复制"); }}>邀请链接</button>}
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
								<button className={`toggle ${useUIStore.getState().showGrid ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleGrid()} />
							</div>
							<div className="setting-row">
								<span>显示背景</span>
								<button className={`toggle ${useUIStore.getState().showBackground ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleBackground()} />
							</div>
							<div className="setting-row">
								<span>显示武器弧</span>
								<button className={`toggle ${useUIStore.getState().showWeaponArcs ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleWeaponArcs()} />
							</div>
							<div className="setting-row">
								<span>显示移动范围</span>
								<button className={`toggle ${useUIStore.getState().showMovementRange ? "toggle--on" : ""}`} onClick={() => useUIStore.getState().toggleMovementRange()} />
							</div>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default GamePage;