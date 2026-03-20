import { useTranslation } from "react-i18next";
import { TopBarMenu } from "@/components/ui/TopBarMenu";
import GameCanvas from "@/components/map/GameCanvas";
import { LayerControlPanel } from "@/components/map/LayerControlPanel";
import { websocketService } from "@/services/websocket";
import { useAppDispatch, useAppSelector } from "@/store";
import { setSelectedTool } from "@/store/slices/uiSlice";
import DMToggleButton from "@/features/ui/DMToggleButton";
import DMControlPanel from "@/features/ui/DMControlPanel";
import { TacticalCommandPanel } from "@/features/ui/TacticalCommandPanel";
import { RightInfoPanel } from "@/features/ui/RightInfoPanel";
import React, { useState, useEffect } from "react";
import { Circle, Crown, LogOut, UserX } from "lucide-react";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";

interface GameViewProps {
	onDisconnect: () => void;
}

const GameView: React.FC<GameViewProps> = ({ onDisconnect }) => {
	const dispatch = useAppDispatch();
	const { t } = useTranslation();
	const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
	const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);

	// 获取相机状态用于显示
	const camera = useAppSelector((state) => state.camera.local);

	// 缩放控制处理
	const handleZoomIn = () => {
		window.dispatchEvent(new CustomEvent("game-zoom", { detail: { action: "in" } }));
	};

	const handleZoomOut = () => {
		window.dispatchEvent(new CustomEvent("game-zoom", { detail: { action: "out" } }));
	};

	const handleResetZoom = () => {
		window.dispatchEvent(new CustomEvent("game-zoom", { detail: { action: "reset" } }));
	};

	// 在组件顶层获取所有需要的状态
	const { selectedTokenId } = useAppSelector((state) => state.selection);
	const { tokens } = useAppSelector((state) => state.map);
	const { selectedTool } = useAppSelector((state) => state.ui);
	const { roomId, currentPlayerId, players } = useAppSelector((state) => state.player);
	const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;
	const currentPlayerName = currentPlayer?.name || 'Player';
	const { isDMMode } = useAppSelector((state) => state.ui.dmMode);

	// 房间状态
	const [roomOwner, setRoomOwner] = useState<string | null>(null);
	const [roomPhase, setRoomPhase] = useState<string>("lobby");

	// 监听房间状态更新
	useEffect(() => {
		const handleRoomStateUpdate = (payload: unknown) => {
			const data = payload as { ownerId?: string; phase?: string };
			if (data.ownerId) setRoomOwner(data.ownerId);
			if (data.phase) setRoomPhase(data.phase);
		};

		websocketService.on(WS_MESSAGE_TYPES.ROOM_STATE_UPDATE, handleRoomStateUpdate);

		return () => {
			websocketService.off(WS_MESSAGE_TYPES.ROOM_STATE_UPDATE, handleRoomStateUpdate);
		};
	}, []);

	// 踢出玩家
	const handleKickPlayer = async (playerId: string) => {
		if (!currentPlayerId || roomOwner !== currentPlayerId || !roomId) return;

		try {
			await websocketService.sendRequest("room.kick", {
				playerId,
				roomId,
			});
		} catch (error) {
			console.error("Failed to kick player:", error);
		}
	};

	// 转移房主
	const handleTransferOwner = async (newOwnerId: string) => {
		if (!currentPlayerId || roomOwner !== currentPlayerId || !roomId) return;

		try {
			await websocketService.sendRequest("room.setOwner", {
				newOwnerId,
				roomId,
			});
		} catch (error) {
			console.error("Failed to transfer owner:", error);
		}
	};

	// 处理工具选择
	const handleToolSelect = (tool: string) => {
		dispatch(setSelectedTool(tool as any));
	};

	// 处理结束回合
	const handleEndTurn = () => {
		if (currentPlayerId) {
			websocketService.send({
				type: "PLAYER_ACTION",
				payload: {
					playerId: currentPlayerId,
					action: "end_turn",
					timestamp: Date.now(),
				},
				timestamp: Date.now(),
			} as any);
		}
	};

	// 初始化 WebSocket 消息处理器
	useEffect(() => {
		websocketService.on("SHIP_MOVED", (payload) => {
			console.log("Ship moved received:", payload);
		});

		websocketService.on("COMBAT_EVENT", (payload) => {
			console.log("Combat result:", payload);
		});

		return () => {
			websocketService.off("SHIP_MOVED", () => {});
			websocketService.off("COMBAT_EVENT", () => {});
		};
	}, []);

	return (
		<div className="gv-container">
			{/* 顶部菜单栏 */}
			<TopBarMenu
				onDisconnect={onDisconnect}
				playerName={currentPlayerName}
				zoom={camera.zoom}
				minZoom={camera.minZoom}
				maxZoom={camera.maxZoom}
				onZoomIn={handleZoomIn}
				onZoomOut={handleZoomOut}
				onReset={handleResetZoom}
			/>

			<div className="gv-content">
				{/* 左侧面板 - 房间和玩家信息 */}
				<aside className={`gv-sidebar gv-sidebar--left ${leftPanelCollapsed ? "gv-sidebar--collapsed" : ""}`}>
					<button
						className="gv-panel-toggle"
						onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
						type="button"
						aria-label={leftPanelCollapsed ? "Expand panel" : "Collapse panel"}
					>
						{leftPanelCollapsed ? "›" : "‹"}
					</button>
					{!leftPanelCollapsed && (
						<div className="gv-panel-content">
							{/* 图层控制面板 */}
							<LayerControlPanel />

							<div className="gv-room-panel">
								<h3 className="gv-section-title">{t("room.title")}</h3>
								<div className="gv-room-info-row">
									<span className="gv-info-text">{t("room.roomId")}: {roomId || t("room.notJoined")}</span>
									<span className={`gv-phase-badge gv-phase-badge--${roomPhase}`}>
										{t(`room.phase.${roomPhase}`)}
									</span>
								</div>
								<p className="gv-info-text">{t("room.players")}: {Object.keys(players).length}</p>
								<div className="gv-player-list">
									{Object.values(players).map((player) => {
										const isOwner = player.id === roomOwner;
										const canManage = roomOwner === currentPlayerId && player.id !== currentPlayerId;
										return (
											<div key={player.id} className={`gv-player-item ${isOwner ? "gv-player-item--owner" : ""}`}>
												<div className="gv-player-info">
													<span className="gv-player-name">
														{isOwner && <Crown size={10} className="gv-owner-icon" />}
														{player.name}
													</span>
													<span className={`gv-player-status ${player.isConnected ? "gv-player-status--connected" : "gv-player-status--disconnected"}`}>
														<Circle size={12} />
													</span>
												</div>
												{canManage && (
													<div className="gv-player-actions">
														<button
															className="gv-action-btn gv-action-btn--transfer"
															onClick={() => handleTransferOwner(player.id)}
															title={t("room.transferOwner")}
															type="button"
														>
															<Crown size={12} />
														</button>
														<button
															className="gv-action-btn gv-action-btn--kick"
															onClick={() => handleKickPlayer(player.id)}
															title={t("room.kickPlayer")}
															type="button"
														>
															<UserX size={12} />
														</button>
													</div>
												)}
											</div>
										);
									})}
								</div>
							</div>

							<div className="gv-controls-panel">
								<h3 className="gv-section-title">{t("player.controls")}</h3>
								<button onClick={handleEndTurn} className="btn btn-primary gv-end-turn-btn">
									{t("player.endTurn")}
								</button>
								<div className="gv-action-points">
									<span>{t("player.actionPoints", { current: 3, total: 5 })}</span>
								</div>
							</div>
						</div>
					)}
				</aside>

				{/* 主游戏区域 - 使用 GameCanvas */}
				<main className="gv-main">
					<GameCanvas />
				</main>

				{/* 右侧面板 - 新的多功能信息面板（聊天/战斗/全部） */}
				<aside className={`gv-sidebar gv-sidebar--right ${rightPanelCollapsed ? "gv-sidebar--collapsed" : ""}`}>
					<button
						className="gv-panel-toggle"
						onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
						type="button"
						aria-label={rightPanelCollapsed ? "Expand panel" : "Collapse panel"}
					>
						{rightPanelCollapsed ? "‹" : "›"}
					</button>
					{!rightPanelCollapsed && (
						<div className="gv-panel-content gv-panel-content--right">
							<RightInfoPanel />
						</div>
					)}
				</aside>
			</div>

			{/* DM 模式切换按钮 */}
			<DMToggleButton />

			{/* DM 控制面板 - 仅在DM模式下显示 */}
			<DMControlPanel />

			{/* 底部战术指挥面板 - 纯游戏相关 */}
			<TacticalCommandPanel />

			<style>{`
				/* ====== 游戏视图容器 ====== */
				.gv-container {
					width: 100%;
					height: 100%;
					display: flex;
					flex-direction: column;
					overflow: hidden;
					padding-top: var(--header-height);
					padding-bottom: var(--bottom-panel-height);
				}

				/* 主内容区域 */
				.gv-content {
					display: flex;
					flex: 1;
					overflow: hidden;
					position: relative;
				}

				/* 主游戏区域 */
				.gv-main {
					flex: 1;
					position: relative;
					overflow: hidden;
					background: var(--bg-primary);
					display: flex;
					min-height: 0;
					min-width: 0;
				}

				/* 侧边栏 */
				.gv-sidebar {
					position: relative;
					width: var(--panel-width);
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					display: flex;
					flex-direction: column;
					transition: width var(--transition-normal);
					overflow: hidden;
					z-index: var(--z-dropdown);
				}

				.gv-sidebar--left {
					border-right: 1px solid var(--border-color);
				}

				.gv-sidebar--right {
					border-left: 1px solid var(--border-color);
					z-index: var(--z-dropdown);
				}

				.gv-sidebar--collapsed {
					width: var(--panel-width-collapsed);
				}

				/* 面板切换按钮 */
				.gv-panel-toggle {
					position: absolute;
					top: 50%;
					transform: translateY(-50%);
					width: 20px;
					height: 48px;
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					color: var(--text-tertiary);
					font-size: var(--text-lg);
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: var(--transition-fast);
					z-index: var(--z-base);
				}

				.gv-sidebar--left .gv-panel-toggle {
					right: -20px;
					border-left: none;
					border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
				}

				.gv-sidebar--right .gv-panel-toggle {
					left: -20px;
					border-right: none;
					border-radius: var(--radius-sm) 0 0 var(--radius-sm);
				}

				.gv-panel-toggle:hover {
					background: var(--bg-hover);
					color: var(--color-primary);
				}

				/* 面板内容 */
				.gv-panel-content {
					flex: 1;
					overflow-y: auto;
					padding: var(--space-3);
					display: flex;
					flex-direction: column;
					gap: var(--space-3);
				}

				.gv-panel-content--right {
					padding: 0;
					height: 100%;
				}

				/* 房间面板 */
				.gv-room-panel,
				.gv-controls-panel {
					padding: var(--space-3);
					background: rgba(20, 20, 40, 0.7);
					border-radius: var(--radius-sm);
					border: 1px solid var(--border-color);
				}

				.gv-section-title {
					color: var(--color-primary);
					margin-bottom: var(--space-2);
					font-size: var(--text-sm);
					font-weight: var(--font-semibold);
					text-transform: uppercase;
					letter-spacing: var(--tracking-wide);
				}

				.gv-info-text {
					color: var(--text-secondary);
					font-size: var(--text-xs);
					margin-bottom: var(--space-1);
				}

				/* 玩家列表 */
				.gv-player-list {
					margin-top: var(--space-2);
					display: flex;
					flex-direction: column;
					gap: var(--space-1);
				}

				.gv-player-item {
					display: flex;
					flex-direction: column;
					padding: var(--space-2);
					background: rgba(30, 30, 60, 0.5);
					border-radius: var(--radius-sm);
					border: 1px solid transparent;
					transition: var(--transition-fast);
				}

				.gv-player-item--owner {
					background: rgba(74, 158, 255, 0.1);
					border-color: rgba(74, 158, 255, 0.3);
				}

				.gv-player-info {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.gv-player-name {
					display: flex;
					align-items: center;
					gap: var(--space-1);
					font-size: var(--text-xs);
					color: var(--text-primary);
				}

				.gv-owner-icon {
					color: var(--color-warning);
				}

				.gv-player-status {
					display: flex;
					align-items: center;
				}

				.gv-player-status--connected {
					color: var(--color-success);
				}

				.gv-player-status--disconnected {
					color: var(--color-danger);
				}

				.gv-player-actions {
					display: flex;
					gap: var(--space-1);
					margin-top: var(--space-1);
					justify-content: flex-end;
				}

				.gv-action-btn {
					display: flex;
					align-items: center;
					justify-content: center;
					width: 24px;
					height: 24px;
					padding: 0;
					background: rgba(0, 0, 0, 0.3);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-sm);
					color: var(--text-tertiary);
					cursor: pointer;
					transition: var(--transition-fast);
				}

				.gv-action-btn:hover {
					background: rgba(74, 158, 255, 0.2);
					border-color: rgba(74, 158, 255, 0.4);
					color: var(--color-primary);
				}

				.gv-action-btn--kick:hover {
					background: rgba(255, 68, 68, 0.2);
					border-color: rgba(255, 68, 68, 0.4);
					color: var(--color-danger);
				}

				/* 房间信息行 */
				.gv-room-info-row {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: var(--space-1);
				}

				/* 阶段徽章 */
				.gv-phase-badge {
					display: inline-flex;
					align-items: center;
					padding: 2px var(--space-2);
					border-radius: var(--radius-sm);
					font-size: 10px;
					font-weight: var(--font-semibold);
					text-transform: uppercase;
					letter-spacing: var(--tracking-wide);
				}

				.gv-phase-badge--lobby {
					background: rgba(100, 116, 139, 0.2);
					color: var(--text-tertiary);
				}

				.gv-phase-badge--deployment {
					background: rgba(234, 179, 8, 0.2);
					color: var(--color-warning);
				}

				.gv-phase-badge--playing {
					background: rgba(34, 197, 94, 0.2);
					color: var(--color-success);
				}

				.gv-phase-badge--paused {
					background: rgba(234, 179, 8, 0.2);
					color: var(--color-warning);
				}

				.gv-phase-badge--ended {
					background: rgba(100, 116, 139, 0.2);
					color: var(--text-tertiary);
				}

				/* 结束回合按钮 */
				.gv-end-turn-btn {
					width: 100%;
					margin-top: var(--space-2);
				}

				/* 行动点 */
				.gv-action-points {
					margin-top: var(--space-2);
					text-align: center;
					color: var(--color-warning);
					font-size: var(--text-xs);
				}

				/* 响应式 */
				@media (max-width: 1024px) {
					.gv-sidebar {
						width: 200px;
					}

					.gv-sidebar--collapsed {
						width: var(--panel-width-collapsed);
					}
				}

				@media (max-width: 768px) {
					.gv-sidebar--left {
						display: none;
					}

					.gv-sidebar--right {
						width: 100%;
						position: absolute;
						right: 0;
						top: 0;
						bottom: 0;
						transform: translateX(100%);
						transition: transform var(--transition-normal);
					}

					.gv-sidebar--right:not(.gv-sidebar--collapsed) {
						transform: translateX(0);
					}
				}
			`}</style>
		</div>
	);
};

export default GameView;