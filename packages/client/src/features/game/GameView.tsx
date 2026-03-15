import { useTranslation } from "react-i18next";
import { TopBarMenu } from "@/components/ui/TopBarMenu";
import GameCanvas from "@/components/map/GameCanvas";
import { LayerControlPanel } from "@/components/map/LayerControlPanel";
import { websocketService } from "@/services/websocket";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectToken } from "@/store/slices/selectionSlice";
import { setSelectedTool } from "@/store/slices/uiSlice";
import {
	nextTurnUnit,
	selectTurnOrder,
	selectCurrentUnit,
} from "@/store/slices/turnSlice";
import TurnIndicator from "@/features/ui/TurnIndicator";
import DMToggleButton from "@/features/ui/DMToggleButton";
import { TacticalCommandPanel } from "@/features/ui/TacticalCommandPanel";
import { RightInfoPanel } from "@/features/ui/RightInfoPanel";
import React, { useState, useEffect, useRef } from "react";
import {
	Circle,
} from "lucide-react";

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
	const currentUnit = useAppSelector(selectCurrentUnit);

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

	// 处理单位点击
	const handleUnitClick = (unit: any) => {
		console.log("Unit clicked:", unit);
	};

	// 处理单位悬停
	const handleUnitHover = (unit: any) => {
		if (unit) {
			console.log("Unit hovered:", unit);
		}
	};

	// 处理下一回合
	const handleNextTurn = () => {
		dispatch(nextTurnUnit());
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
		<div className="game-view">
			{/* 顶部菜单栏 */}
			<TopBarMenu
				onDisconnect={onDisconnect}
				playerName={currentPlayerId || 'Player'}
				zoom={camera.zoom}
				minZoom={camera.minZoom}
				maxZoom={camera.maxZoom}
				onZoomIn={handleZoomIn}
				onZoomOut={handleZoomOut}
				onReset={handleResetZoom}
			/>

			<div className="game-content">
				{/* 左侧面板 - 房间和玩家信息 */}
				<aside className={`game-sidebar left ${leftPanelCollapsed ? "collapsed" : ""}`}>
					<button
						className="panel-toggle"
						onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
						type="button"
					>
						{leftPanelCollapsed ? "›" : "‹"}
					</button>
					{!leftPanelCollapsed && (
						<div className="panel-content">
							{/* 图层控制面板 */}
							<LayerControlPanel />

							<div className="room-panel-placeholder">
								<h3>{t("room.title")}</h3>
								<p>{t("room.roomId")}: {roomId || t("room.notJoined")}</p>
								<p>{t("room.players")}: {Object.keys(players).length}</p>
								<div className="player-list">
									{Object.values(players).map((player) => (
										<div key={player.id} className="player-item">
											<span className="player-name">{player.name}</span>
											<span
												className={`player-status ${
													player.isConnected ? "connected" : "disconnected"
												}`}
											>
												{player.isConnected ? (
													<Circle size={12} style={{ color: "#4ade80" }} />
												) : (
													<Circle size={12} style={{ color: "#ef4444" }} />
												)}
											</span>
										</div>
									))}
								</div>
							</div>

							<div className="player-controls-placeholder">
								<h3>{t("player.controls")}</h3>
								<button onClick={handleEndTurn} className="end-turn-button">
									{t("player.endTurn")}
								</button>
								<div className="action-points">
									<span>{t("player.actionPoints", { current: 3, total: 5 })}</span>
								</div>
							</div>
						</div>
					)}
				</aside>

				{/* 主游戏区域 - 使用 GameCanvas */}
				<main className="game-main">
					<GameCanvas />
					{/* 回合指示器 - 位于右上角 */}
					<TurnIndicator
						onUnitClick={handleUnitClick}
						onUnitHover={handleUnitHover}
						onNextTurn={handleNextTurn}
					/>
				</main>

				{/* 右侧面板 - 新的多功能信息面板（聊天/战斗/全部） */}
				<aside className={`game-sidebar right ${rightPanelCollapsed ? "collapsed" : ""}`}>
					<button
						className="panel-toggle"
						onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
						type="button"
					>
						{rightPanelCollapsed ? "‹" : "›"}
					</button>
					{!rightPanelCollapsed && (
						<div className="panel-content" style={{ padding: 0, height: '100%' }}>
							<RightInfoPanel />
						</div>
					)}
				</aside>
			</div>

			{/* DM 模式切换按钮 */}
			<DMToggleButton />

			{/* 底部战术指挥面板 - 纯游戏相关 */}
			<TacticalCommandPanel />

			<style>{`
				/* 游戏视图容器 - 为顶栏和底部面板留出空间 */
				.game-view {
					width: 100%;
					height: 100%;
					display: flex;
					flex-direction: column;
					overflow: hidden;
					padding-top: 48px; /* 顶栏高度 */
					padding-bottom: 64px; /* 底部面板高度 */
				}

				.toolbar {
					display: flex;
					gap: 24px;
					align-items: center;
				}

				.toolbar-section {
					display: flex;
					align-items: center;
					gap: 12px;
				}

				.room-panel-placeholder,
				.player-controls-placeholder {
					padding: 12px;
					background: rgba(20, 20, 40, 0.7);
					border-radius: 4px;
					margin-bottom: 12px;
				}

				.room-panel-placeholder h3,
				.player-controls-placeholder h3 {
					color: #aaccff;
					margin-bottom: 8px;
					font-size: 14px;
				}

				.player-list {
					margin-top: 8px;
				}

				.player-item {
					display: flex;
					justify-content: space-between;
					align-items: center;
					padding: 4px 8px;
					background: rgba(30, 30, 60, 0.5);
					margin-bottom: 4px;
					border-radius: 3px;
				}

				.player-status.connected {
					color: #4ade80;
				}

				.player-status.disconnected {
					color: #ef4444;
				}

				.end-turn-button {
					background: rgba(74, 158, 255, 0.2);
					border: 1px solid #4a9eff;
					color: #aaccff;
					padding: 8px 16px;
					border-radius: 4px;
					cursor: pointer;
					width: 100%;
				}

				.end-turn-button:hover {
					background: rgba(74, 158, 255, 0.3);
				}

				.action-points {
					margin-top: 8px;
					text-align: center;
					color: #fbbf24;
				}

				.game-content {
					display: flex;
					flex: 1;
					overflow: hidden;
					position: relative;
				}

				.game-main {
					flex: 1;
					position: relative;
					overflow: hidden;
					background: rgba(10, 10, 26, 0.95);
					display: flex;
					min-height: 0;
					min-width: 0;
				}

				/* 右侧面板样式调整 */
				.game-sidebar.right {
					position: relative;
					z-index: 100;
				}

				.game-sidebar.right .panel-content {
					height: 100%;
					overflow: hidden;
					padding: 0;
				}

				/* 覆盖全局样式 */
				:global(.game-view) {
					padding-top: 48px !important;
					padding-bottom: 64px !important;
				}
			`}</style>
		</div>
	);
};

export default GameView;
