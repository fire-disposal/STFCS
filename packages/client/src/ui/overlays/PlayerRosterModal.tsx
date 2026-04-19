import type { PlayerState, ShipState } from "@/sync/types";
import { PlayerRole } from "@/sync/types";
import { Avatar } from "@/ui/shared/Avatar";
import React, { useMemo } from "react";

const styles = {
	overlay: {
		position: "fixed" as const,
		inset: 0,
		backgroundColor: "rgba(0, 0, 0, 0.72)",
		display: "flex",
		alignItems: "flex-start",
		justifyContent: "flex-end",
		zIndex: 10020,
		padding: "16px",
		overflow: "auto",
	},
	modal: {
		width: "min(1180px, calc(100vw - 32px))",
		maxHeight: "calc(100vh - 32px)",
		backgroundColor: "rgba(6, 16, 26, 0.98)",
		borderRadius: "0",
		border: "1px solid rgba(74, 158, 255, 0.28)",
		boxShadow: "0 18px 60px rgba(0, 0, 0, 0.58)",
		display: "flex",
		flexDirection: "column" as const,
		overflow: "hidden",
	},
	header: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "16px",
		padding: "16px 20px",
		borderBottom: "1px solid rgba(43, 66, 97, 0.9)",
		background: "linear-gradient(180deg, rgba(18, 45, 73, 0.9) 0%, rgba(10, 24, 38, 0.95) 100%)",
	},
	titleBlock: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "4px",
		minWidth: 0,
	},
	title: {
		fontSize: "17px",
		fontWeight: 700,
		color: "#d8ecff",
		letterSpacing: "1px",
	},
	subtitle: {
		fontSize: "12px",
		color: "#8ba4c7",
	},
	headerMeta: {
		display: "flex",
		alignItems: "center",
		gap: "10px",
		flexWrap: "wrap" as const,
		justifyContent: "flex-end",
	},
	headerBadge: {
		padding: "6px 10px",
		borderRadius: "0",
		border: "1px solid rgba(43, 66, 97, 0.9)",
		background: "rgba(26, 45, 66, 0.92)",
		color: "#cfe8ff",
		fontSize: "11px",
		fontWeight: 700,
	},
	closeButton: {
		background: "transparent",
		border: "none",
		color: "#8ba4c7",
		fontSize: "24px",
		cursor: "pointer",
		lineHeight: 1,
		padding: "4px 6px",
	},
	content: {
		display: "grid",
		gridTemplateColumns: "minmax(0, 1.45fr) minmax(300px, 0.85fr)",
		gap: "16px",
		padding: "18px 20px 20px",
		overflow: "auto",
		minHeight: 0,
		scrollbarGutter: "stable" as const,
	},
	leftColumn: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "14px",
		minWidth: 0,
		minHeight: 0,
	},
	rightColumn: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "14px",
		minWidth: 0,
		minHeight: 0,
	},
	section: {
		background: "rgba(12, 26, 40, 0.88)",
		border: "1px solid rgba(43, 66, 97, 0.85)",
		borderRadius: "0",
		padding: "14px",
		minWidth: 0,
	},
	sectionTitle: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "12px",
		marginBottom: "12px",
		fontSize: "13px",
		fontWeight: 700,
		color: "#d8ecff",
	},
	sectionHint: {
		fontSize: "11px",
		color: "#8ba4c7",
		fontWeight: 400,
	},
	statsGrid: {
		display: "grid",
		gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
		gap: "10px",
	},
	statCard: {
		background: "rgba(26, 45, 66, 0.92)",
		border: "1px solid rgba(43, 66, 97, 0.9)",
		borderRadius: "0",
		padding: "12px",
		minWidth: 0,
	},
	statLabel: {
		fontSize: "11px",
		color: "#8ba4c7",
		marginBottom: "6px",
	},
	statValue: {
		fontSize: "20px",
		fontWeight: 700,
		color: "#d8ecff",
	},
	statNote: {
		fontSize: "11px",
		color: "#8ba4c7",
		marginTop: "4px",
	},
	list: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "10px",
		maxHeight: "54vh",
		overflow: "auto" as const,
		paddingRight: "4px",
	},
	emptyState: {
		textAlign: "center" as const,
		color: "#8ba4c7",
		padding: "20px 14px",
		fontSize: "12px",
		border: "1px dashed rgba(43, 66, 97, 0.9)",
		borderRadius: "0",
		background: "rgba(26, 45, 66, 0.5)",
	},
	playerItem: {
		display: "grid",
		gridTemplateColumns: "auto minmax(0, 1fr) auto",
		gap: "12px",
		alignItems: "center",
		padding: "12px",
		backgroundColor: "#1a2d42",
		borderRadius: "0",
		border: "1px solid transparent",
	},
	playerItemCurrent: {
		borderColor: "#43c1ff",
		backgroundColor: "#1a3a5a",
	},
	playerItemDM: {
		borderColor: "#ff6f8f",
	},
	playerAvatar: {
		width: "40px",
		height: "40px",
		borderRadius: "0",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		fontSize: "18px",
		flexShrink: 0,
	},
	playerInfo: {
		minWidth: 0,
		display: "flex",
		flexDirection: "column" as const,
		gap: "4px",
	},
	playerNameRow: {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		flexWrap: "wrap" as const,
	},
	playerName: {
		fontSize: "13px",
		fontWeight: 700,
		color: "#d8ecff",
		whiteSpace: "nowrap" as const,
	},
	playerRole: {
		fontSize: "11px",
		color: "#8ba4c7",
	},
	playerMetaRow: {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		flexWrap: "wrap" as const,
	},
	metaChip: {
		padding: "4px 8px",
		borderRadius: "0",
		fontSize: "10px",
		fontWeight: 700,
		border: "1px solid transparent",
	},
	playerStatus: {
		display: "flex",
		flexDirection: "column" as const,
		alignItems: "flex-end",
		gap: "6px",
		minWidth: "120px",
	},
	rowActions: {
		display: "flex",
		gap: "6px",
		flexWrap: "wrap" as const,
		justifyContent: "flex-end",
	},
	rowButton: {
		padding: "6px 10px",
		borderRadius: "0",
		border: "1px solid #2b4261",
		background: "#132235",
		color: "#cfe8ff",
		fontSize: "11px",
		cursor: "pointer",
		whiteSpace: "nowrap" as const,
	},
	rowButtonDanger: {
		borderColor: "rgba(248, 113, 113, 0.45)",
		background: "rgba(248, 113, 113, 0.12)",
		color: "#ff9cb2",
	},
	rowButtonDisabled: {
		opacity: 0.45,
		cursor: "not-allowed",
	},
	actionCard: {
		background: "rgba(26, 45, 66, 0.9)",
		border: "1px solid rgba(43, 66, 97, 0.9)",
		borderRadius: "0",
		padding: "12px",
	},
	actionRow: {
		display: "flex",
		gap: "10px",
		flexWrap: "wrap" as const,
		marginTop: "10px",
	},
	actionButton: {
		flex: 1,
		minWidth: "120px",
		padding: "10px 12px",
		borderRadius: "0",
		border: "1px solid #2b4261",
		background: "#132235",
		color: "#cfe8ff",
		fontSize: "12px",
		fontWeight: 700,
		cursor: "pointer",
	},
	actionButtonPrimary: {
		borderColor: "#4a9eff",
		background: "rgba(74, 158, 255, 0.14)",
	},
	actionButtonDanger: {
		borderColor: "rgba(248, 113, 113, 0.5)",
		background: "rgba(248, 113, 113, 0.12)",
		color: "#ff9cb2",
	},
	actionButtonSuccess: {
		borderColor: "rgba(46, 204, 113, 0.5)",
		background: "rgba(46, 204, 113, 0.12)",
		color: "#bdf4cf",
	},
	footer: {
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
		gap: "12px",
		padding: "0 20px 18px",
		marginTop: "auto",
	},
	readyButton: {
		padding: "10px 16px",
		borderRadius: "0",
		border: "1px solid #2b4261",
		backgroundColor: "#1a2d42",
		color: "#cfe8ff",
		fontSize: "12px",
		fontWeight: "bold",
		cursor: "pointer",
		transition: "all 0.2s ease",
		minWidth: "220px",
	},
	readyButtonActive: {
		backgroundColor: "#2ecc71",
		borderColor: "#2ecc71",
		color: "white",
	},
	footerNote: {
		fontSize: "11px",
		color: "#8ba4c7",
	},
	roomActions: {
		display: "grid",
		gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
		gap: "8px",
	},
	roomActionButton: {
		padding: "10px 12px",
		borderRadius: "0",
		border: "1px solid #2b4261",
		background: "#132235",
		color: "#cfe8ff",
		fontSize: "12px",
		fontWeight: 700,
		cursor: "pointer",
	},
	roomActionButtonDisabled: {
		opacity: 0.45,
		cursor: "not-allowed",
	},
	leaveRoomButton: {
		padding: "10px 12px",
		borderRadius: "0",
		border: "1px solid rgba(248, 113, 113, 0.5)",
		background: "rgba(248, 113, 113, 0.12)",
		color: "#ff9cb2",
		fontSize: "12px",
		fontWeight: 700,
		cursor: "pointer",
		gridColumn: "1 / -1" as const,
	},
};

const qualityColors: Record<string, { color: string; bg: string }> = {
	excellent: { color: "#2ecc71", bg: "#1a5a3a" },
	good: { color: "#43c1ff", bg: "#1a4a7a" },
	fair: { color: "#f1c40f", bg: "#5a4a2a" },
	poor: { color: "#e67e22", bg: "#5a3a2a" },
	offline: { color: "#e74c3c", bg: "#5a2a3a" },
};

const qualityIcons: Record<string, string> = {
	excellent: "●",
	good: "●",
	fair: "◐",
	poor: "○",
	offline: "✕",
};

interface PlayerRosterModalProps {
	isOpen: boolean;
	onClose: () => void;
	players: PlayerState[];
	ships: ShipState[];
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
	currentPhase,
	onToggleReady,
	canManagePlayers = false,
	onKickPlayer,
	onInvitePlayer,
	onCloseRoom,
	onSaveRoom,
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
		const total = players.length;
		const ready = players.filter((p) => p.isReady && p.connected).length;
		const online = players.filter((p) => p.connected).length;
		const dmCount = players.filter((p) => p.role === PlayerRole.OWNER).length;
		return { total, ready, online, dmCount };
	}, [players]);

	const canReady = useMemo(() => {
		if (!currentPlayer) return false;
		if (!currentPlayer.connected) return false;
		if (currentPlayer.role === PlayerRole.OWNER) return false;
		if (currentPhase !== "PLAYER_TURN") return false;
		return true;
	}, [currentPlayer, currentPhase]);

	if (!isOpen) return null;

	return (
		<div style={styles.overlay} onClick={onClose}>
			<div style={styles.modal} onClick={(event) => event.stopPropagation()}>
				<div style={styles.header}>
					<div style={styles.titleBlock}>
						<div style={styles.title}>👥 玩家列表</div>
						<div style={styles.subtitle}>独立弹窗视图 · 房间成员、准备状态与房主管理入口</div>
					</div>
					<div style={styles.headerMeta}>
						<span style={styles.headerBadge}>
							在线 {stats.online}/{stats.total}
						</span>
						<span style={styles.headerBadge}>
							准备 {stats.ready}/{Math.max(0, stats.online - stats.dmCount)}
						</span>
						<span style={styles.headerBadge}>主持 {stats.dmCount}</span>
						{canManagePlayers && <span style={styles.headerBadge}>房主模式</span>}
						<button style={styles.closeButton} onClick={onClose}>
							×
						</button>
					</div>
				</div>

				<div style={styles.content}>
					<div style={styles.leftColumn}>
						<div style={styles.section}>
							<div style={styles.sectionTitle}>
								<span>房间成员</span>
								<span style={styles.sectionHint}>连接质量、舰船数量与准备状态</span>
							</div>

							{players.length === 0 ? (
								<div style={styles.emptyState}>房间内暂无玩家</div>
							) : (
								<div style={styles.list}>
									{players.map((player) => {
										const isCurrent = player.sessionId === currentSessionId;
										const isDM = player.role === PlayerRole.OWNER;
										const shipCount = playerShipCounts[player.sessionId] || 0;
										const quality =
											qualityColors[player.connectionQuality] || qualityColors.offline;
										const qualityIcon = qualityIcons[player.connectionQuality] || "○";
										const displayName = player.nickname || player.name;
										const avatar = player.avatar || (isDM ? "👑" : "👤");

										return (
											<div
												key={player.sessionId}
												style={{
													...styles.playerItem,
													...(isCurrent ? styles.playerItemCurrent : {}),
													...(isDM ? styles.playerItemDM : {}),
												}}
											>
												<Avatar src={avatar} size={42} />

												<div style={styles.playerInfo}>
													<div style={styles.playerNameRow}>
														<div style={styles.playerName}>
															{displayName}
															{isCurrent && (
																<span style={{ color: "#2ecc71", marginLeft: "4px" }}>（你）</span>
															)}
														</div>
													</div>
													<div style={styles.playerRole}>
														{isDM ? "主持人" : "玩家"}
														{shipCount > 0 && ` · ${shipCount} 舰船`}
													</div>
													<div style={styles.playerMetaRow}>
														<span
															style={{
																...styles.metaChip,
																background: quality.bg,
																color: quality.color,
															}}
														>
															{player.connected ? qualityIcon : "✕"}{" "}
															{player.connected ? player.connectionQuality : "offline"}
														</span>
														{player.connected && player.pingMs >= 0 && (
															<span
																style={{
																	...styles.metaChip,
																	background: "#132235",
																	color: "#8ba4c7",
																}}
															>
																{player.pingMs}ms
															</span>
														)}
														<span
															style={{
																...styles.metaChip,
																background: player.isReady ? "#1a5a3a" : "#132235",
																color: player.isReady ? "#ffffff" : "#8ba4c7",
															}}
														>
															{isDM ? "DM" : player.isReady ? "已准备" : "等待中"}
														</span>
													</div>
												</div>

												<div style={styles.playerStatus}>
													{canManagePlayers && !isCurrent && (
														<div style={styles.rowActions}>
															<button
																style={{
																	...styles.rowButton,
																	...styles.rowButtonDanger,
																	...(!onKickPlayer ? styles.rowButtonDisabled : {}),
																}}
																onClick={() => onKickPlayer?.(player.sessionId)}
																disabled={!onKickPlayer}
																title="预留的踢出接口"
															>
																踢出
															</button>
														</div>
													)}
												</div>
											</div>
										);
									})}
								</div>
							)}
						</div>
					</div>

					<div style={styles.rightColumn}>
						<div style={styles.section}>
							<div style={styles.sectionTitle}>
								<span>房间概览</span>
								<span style={styles.sectionHint}>快速查看当前战局</span>
							</div>

							<div style={styles.statsGrid}>
								<div style={styles.statCard}>
									<div style={styles.statLabel}>总人数</div>
									<div style={styles.statValue}>{stats.total}</div>
									<div style={styles.statNote}>当前房间成员</div>
								</div>
								<div style={styles.statCard}>
									<div style={styles.statLabel}>在线</div>
									<div style={styles.statValue}>{stats.online}</div>
									<div style={styles.statNote}>已连接玩家</div>
								</div>
								<div style={styles.statCard}>
									<div style={styles.statLabel}>准备</div>
									<div style={styles.statValue}>{stats.ready}</div>
									<div style={styles.statNote}>已就绪成员</div>
								</div>
								<div style={styles.statCard}>
									<div style={styles.statLabel}>主持</div>
									<div style={styles.statValue}>{stats.dmCount}</div>
									<div style={styles.statNote}>DM / 房主角色</div>
								</div>
							</div>
						</div>

						<div style={styles.section}>
							<div style={styles.sectionTitle}>
								<span>当前身份</span>
								<span style={styles.sectionHint}>准备与房主管理</span>
							</div>

							<div style={styles.actionCard}>
								<div
									style={{
										fontSize: "13px",
										fontWeight: 700,
										color: "#d8ecff",
										marginBottom: "6px",
									}}
								>
									{currentPlayer?.nickname || currentPlayer?.name || "未知玩家"}
								</div>
								<div style={{ fontSize: "11px", color: "#8ba4c7", lineHeight: 1.6 }}>
									{currentPlayer?.role === PlayerRole.OWNER
										? "你当前是主持人，可管理成员并推进回合。"
										: "你当前是玩家，可在回合允许时切换准备状态。"}
								</div>
								<div style={styles.actionRow}>
									{currentPlayer?.role !== PlayerRole.OWNER && (
										<button
											style={{
												...styles.actionButton,
												...(currentPlayer?.isReady ? styles.actionButtonPrimary : {}),
												...(!canReady ? styles.rowButtonDisabled : {}),
											}}
											onClick={() => onToggleReady(!currentPlayer?.isReady)}
											disabled={!canReady}
										>
											{currentPlayer?.isReady ? "✓ 取消准备" : "准备就绪"}
										</button>
									)}
									{canManagePlayers && (
										<button
											style={{
												...styles.actionButton,
												...styles.actionButtonPrimary,
												...(!onInvitePlayer ? styles.rowButtonDisabled : {}),
											}}
											onClick={() => onInvitePlayer?.()}
											disabled={!onInvitePlayer}
											title="预留的邀请接口"
										>
											邀请玩家
										</button>
									)}
								</div>
							</div>
						</div>

						<div style={styles.section}>
							<div style={styles.sectionTitle}>
								<span>房间管理</span>
								<span style={styles.sectionHint}>保存、关闭与邀请入口预留</span>
							</div>
							<div style={styles.roomActions}>
								<button
									type="button"
									style={{
										...styles.roomActionButton,
										...styles.actionButtonPrimary,
										...(!onInvitePlayer || !canManagePlayers
											? styles.roomActionButtonDisabled
											: {}),
									}}
									onClick={() => onInvitePlayer?.()}
									disabled={!onInvitePlayer || !canManagePlayers}
								>
									邀请玩家
								</button>
								<button
									type="button"
									style={{
										...styles.roomActionButton,
										...styles.actionButtonSuccess,
										...(!onSaveRoom || !canManagePlayers ? styles.roomActionButtonDisabled : {}),
									}}
									onClick={() => onSaveRoom?.()}
									disabled={!onSaveRoom || !canManagePlayers}
								>
									保存房间
								</button>
								<button
									type="button"
									style={{
										...styles.roomActionButton,
										...styles.actionButtonDanger,
										...(!onCloseRoom || !canManagePlayers ? styles.roomActionButtonDisabled : {}),
									}}
									onClick={() => onCloseRoom?.()}
									disabled={!onCloseRoom || !canManagePlayers}
								>
									关闭房间
								</button>
								<button
									type="button"
									style={{
										...styles.roomActionButton,
										...(!canManagePlayers ? styles.roomActionButtonDisabled : {}),
									}}
									disabled
									title="后续可扩展房主专用权限管理"
								>
									权限管理
								</button>
								<button
									type="button"
									style={{
										...styles.leaveRoomButton,
										...(!onLeaveRoom ? styles.roomActionButtonDisabled : {}),
									}}
									onClick={() => onLeaveRoom?.()}
									disabled={!onLeaveRoom}
								>
									离开房间
								</button>
							</div>
							<div
								style={{ fontSize: "11px", color: "#8ba4c7", lineHeight: 1.7, marginTop: "10px" }}
							>
								- “踢出”按钮按玩家行展示，接入后可直接触发服务端操作。
								<br />- “保存房间”与“关闭房间”已预留为房主管理动作。
								<br />- 当前为战术终端风格布局，宽度会自动限制在可视范围内。
							</div>
						</div>
					</div>
				</div>

				<div style={styles.footer}>
					<div style={styles.footerNote}>
						仅在当前回合允许时显示准备按钮；房主管理入口保留在弹窗内。
					</div>
					{currentPlayer && currentPlayer.role !== PlayerRole.OWNER && (
						<button
							style={{
								...styles.readyButton,
								...(currentPlayer.isReady ? styles.readyButtonActive : {}),
								...(!canReady ? styles.rowButtonDisabled : {}),
							}}
							onClick={() => onToggleReady(!currentPlayer.isReady)}
							disabled={!canReady}
						>
							{currentPlayer.isReady ? "✓ 已准备 - 点击取消" : "准备就绪"}
						</button>
					)}
				</div>
			</div>
		</div>
	);
};

export default PlayerRosterModal;
