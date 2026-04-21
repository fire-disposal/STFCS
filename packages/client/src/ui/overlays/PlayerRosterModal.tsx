import type { RoomPlayerState, ShipRuntime } from "@vt/data";
import { PlayerRole } from "@vt/data";
import { Crown, User, CheckCircle, XCircle, Copy, LogOut, Users } from "lucide-react";
import React, { useMemo } from "react";

interface PlayerRosterModalProps {
	isOpen: boolean;
	onClose: () => void;
	players: RoomPlayerState[];
	ships: (ShipRuntime & { id: string })[];
	currentSessionId: string;
	currentPhase: string;
	onToggleReady: (isReady: boolean) => void;
	canManagePlayers?: boolean;
	onKickPlayer?: (playerSessionId: string) => void;
	onInvitePlayer?: () => void;
	onCloseRoom?: () => void;
	onSaveRoom?: () => void;
	onLeaveRoom?: () => void;
}

export const PlayerRosterModal: React.FC<PlayerRosterModalProps> = ({
	isOpen,
	onClose,
	players,
	ships,
	currentSessionId,
	onToggleReady,
	canManagePlayers = false,
	onInvitePlayer,
	onLeaveRoom,
}) => {
	const playerShipCounts = useMemo(() => {
		const counts: Record<string, number> = {};
		ships.forEach((ship) => {
			if (ship.ownerId) {
				counts[ship.ownerId] = (counts[ship.ownerId] || 0) + 1;
			}
		});
		return counts;
	}, [ships]);

	const currentPlayer = useMemo(() => {
		return players.find((p) => p.sessionId === currentSessionId);
	}, [players, currentSessionId]);

	const stats = useMemo(() => {
		const connectedPlayers = players.filter((p) => p.connected);
		const total = connectedPlayers.length;
		const ready = connectedPlayers.filter((p) => p.isReady).length;
		const dmCount = connectedPlayers.filter((p) => p.role === PlayerRole.HOST).length;
		return { total, ready, dmCount };
	}, [players]);

	if (!isOpen) return null;

	return (
		<div className="modal-overlay-tactical" onClick={onClose}>
			<div className="modal-tactical game-panel" onClick={(e) => e.stopPropagation()}>
				<div className="game-panel__header">
					<div className="game-panel__title">
						<Users className="game-panel__title-icon" />
						玩家列表
					</div>
					<button className="game-panel__close" onClick={onClose}>×</button>
				</div>

				<div className="game-panel__content" style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
					<div className="game-section">
						<div className="game-section__title">
							<Users className="game-section__icon" />
							房间成员 ({stats.total})
						</div>
						<div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
							{players.filter((p) => p.connected).map((player) => {
								const isCurrent = player.sessionId === currentSessionId;
								const isDM = player.role === PlayerRole.HOST;
								const shipCount = playerShipCounts[player.sessionId] || 0;

								return (
									<div
										key={player.sessionId}
										className={`game-list-item ${isCurrent ? "game-list-item--selected" : ""}`}
									>
										{isDM ? (
											<Crown className="game-icon--md" style={{ color: "#ff6f8f" }} />
										) : (
											<User className="game-icon--md" />
										)}
										<div style={{ flex: 1, minWidth: 0 }}>
											<div className="game-text--primary" style={{ fontSize: "13px" }}>
												{player.nickname}
												{isCurrent && <span style={{ color: "#2ecc71", marginLeft: "4px" }}>（你）</span>}
											</div>
											<div className="game-text--secondary" style={{ fontSize: "11px" }}>
												{isDM ? "主持人" : "玩家"}
												{shipCount > 0 && ` · ${shipCount} 舰船`}
											</div>
										</div>
										<div className="game-badge" style={{
											backgroundColor: player.isReady ? "#1a5a3a" : "#132235",
											color: player.isReady ? "#2ecc71" : "#8ba4c7"
										}}>
											{player.isReady ? (
												<CheckCircle className="game-icon--xs" />
											) : (
												<XCircle className="game-icon--xs" />
											)}
											{isDM ? "DM" : player.isReady ? "已准备" : "等待"}
										</div>
									</div>
								);
							})}
						</div>
					</div>

					<div className="game-section">
						<div className="game-section__title">统计</div>
						<div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
							<div className="info-item">
								<div className="info-label">总人数</div>
								<div className="info-value">{stats.total}</div>
							</div>
							<div className="info-item">
								<div className="info-label">已准备</div>
								<div className="info-value" style={{ color: "#2ecc71" }}>{stats.ready}</div>
							</div>
							<div className="info-item">
								<div className="info-label">主持</div>
								<div className="info-value" style={{ color: "#ff6f8f" }}>{stats.dmCount}</div>
							</div>
						</div>
					</div>

					<div className="game-section__divider" />

					<div className="game-btn-group">
						{currentPlayer && currentPlayer.role !== PlayerRole.HOST && (
							<button
								className={`game-btn ${currentPlayer.isReady ? "game-btn--success" : "game-btn--primary"}`}
								onClick={() => onToggleReady(!currentPlayer.isReady)}
							>
								{currentPlayer.isReady ? (
									<CheckCircle className="game-btn__icon" />
								) : (
									<XCircle className="game-btn__icon" />
								)}
								{currentPlayer.isReady ? "取消准备" : "准备"}
							</button>
						)}
						{canManagePlayers && onInvitePlayer && (
							<button className="game-btn" onClick={onInvitePlayer}>
								<Copy className="game-btn__icon" />
								邀请链接
							</button>
						)}
						{onLeaveRoom && (
							<button className="game-btn game-btn--danger" onClick={onLeaveRoom}>
								<LogOut className="game-btn__icon" />
								离开房间
							</button>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default PlayerRosterModal;