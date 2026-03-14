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
import { TopZoomIndicator } from "@/features/ui/TopZoomIndicator";
import React, { useState, useEffect, useRef } from "react";
import {
	MousePointer,
	Hand,
	Edit3,
	Ruler,
	MapPin,
	SkipForward,
	LogOut,
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
	const [chatExpanded, setChatExpanded] = useState(false);

	// 获取相机状态用于显示
	const camera = useAppSelector((state) => state.camera.local);

	// 缩放控制处理
	const handleZoomIn = () => {
		// 通过自定义事件通知 GameCanvas
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

	// 处理聊天消息发送
	const handleChatSend = (content: string) => {
		if (currentPlayerId && content.trim()) {
			const player = players[currentPlayerId];
			if (player) {
				websocketService.sendChatMessage(content, currentPlayerId, player.name, "player");
			}
		}
	};

	// 处理结束回合
	const handleEndTurn = () => {
		if (currentPlayerId) {
			// 发送结束回合消息
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
		// 设置舰船移动处理器
		websocketService.on("SHIP_MOVED", (payload) => {
			console.log("Ship moved received:", payload);
			// 这里可以更新本地状态或触发重新获取
		});

		// 设置战斗结果处理器
		websocketService.on("COMBAT_EVENT", (payload) => {
			console.log("Combat result:", payload);
		});

		return () => {
			// 清理处理器
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
				// 缩放控制
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
					>
						{leftPanelCollapsed ? "›" : "‹"}
					</button>
					{!leftPanelCollapsed && (
						<div className="panel-content">
							{/* 图层控制面板 */}
							<LayerControlPanel />

							<div className="room-panel-placeholder">
								<h3>Room Panel</h3>
								<p>Room ID: {roomId || "Not joined"}</p>
								<p>Players: {Object.keys(players).length}</p>
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
								<h3>Player Controls</h3>
								<button onClick={handleEndTurn} className="end-turn-button">
									End Turn
								</button>
								<div className="action-points">
									<span>Action Points: 3/5</span>
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

				{/* 右侧面板 - 战斗日志和系统信息 */}
				<aside className={`game-sidebar right ${rightPanelCollapsed ? "collapsed" : ""}`}>
					<button
						className="panel-toggle"
						onClick={() => setRightPanelCollapsed(!rightPanelCollapsed)}
					>
						{rightPanelCollapsed ? "‹" : "›"}
					</button>
					{!rightPanelCollapsed && (
						<div className="panel-content">
							<div className="combat-log-placeholder">
								<h3>Combat Log</h3>
								<div className="log-entries">
									<div className="log-entry">
										<span className="log-time">12:30:45</span>
										<span className="log-text">Player1 fired missiles at EnemyShip</span>
									</div>
									<div className="log-entry">
										<span className="log-time">12:31:10</span>
										<span className="log-text">EnemyShip shield took 150 damage</span>
									</div>
									<div className="log-entry">
										<span className="log-time">12:31:25</span>
										<span className="log-text">EnemyShip returned fire with laser cannons</span>
									</div>
								</div>
							</div>
						</div>
					)}
				</aside>
			</div>

			{/* 底部聊天面板 */}
			<div className="game-chat">
				<div className="chat-panel-placeholder">
					<div className="chat-header">
						<h3>Chat {chatExpanded ? "▼" : "▲"}</h3>
						<button onClick={() => setChatExpanded(!chatExpanded)}>
							{chatExpanded ? "Collapse" : "Expand"}
						</button>
					</div>
					{chatExpanded && (
						<div className="chat-content">
							<div className="chat-messages">
								<div className="chat-message">
									<span className="sender">System:</span>
									<span className="message">Welcome to the game!</span>
								</div>
								<div className="chat-message">
									<span className="sender">Player1:</span>
									<span className="message">Let's begin the battle!</span>
								</div>
							</div>
							<div className="chat-input">
								<input type="text" placeholder="Type a message..." />
								<button onClick={() => handleChatSend("Test message")}>Send</button>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* 游戏状态指示器 */}
			<div className="game-status">
				<div className="status-item">
					<span className="status-label">Room:</span>
					<span className="status-value">{roomId || "Not joined"}</span>
				</div>
				<div className="status-item">
					<span className="status-label">Players:</span>
					<span className="status-value">{Object.keys(players).length}</span>
				</div>
				<div className="status-item">
					<span className="status-label">Tool:</span>
					<span className="status-value">{selectedTool}</span>
				</div>
				<div className="status-item">
					<span className="status-label">Turn:</span>
					<span className="status-value">
						{currentUnit ? `${currentUnit.name}'s Turn` : "Waiting..."}
					</span>
				</div>
			</div>

			{/* DM 模式切换按钮 */}
			<DMToggleButton />

			<style>{`
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
				.player-controls-placeholder,
				.combat-log-placeholder,
				.chat-panel-placeholder {
					padding: 12px;
					background: rgba(20, 20, 40, 0.7);
					border-radius: 4px;
					margin-bottom: 12px;
				}

				.room-panel-placeholder h3,
				.player-controls-placeholder h3,
				.combat-log-placeholder h3,
				.chat-panel-placeholder h3 {
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

				.log-entries {
					max-height: 300px;
					overflow-y: auto;
				}

				.log-entry {
					padding: 6px 8px;
					background: rgba(30, 30, 60, 0.3);
					margin-bottom: 4px;
					border-radius: 3px;
					display: flex;
					gap: 8px;
					font-size: 12px;
				}

				.log-time {
					color: #8a8aa8;
					min-width: 60px;
				}

				.log-text {
					color: #c0c0d0;
				}

				.chat-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
				}

				.chat-header button {
					background: rgba(40, 40, 80, 0.5);
					border: 1px solid rgba(100, 100, 150, 0.3);
					color: #aaccff;
					padding: 4px 8px;
					border-radius: 3px;
					font-size: 12px;
					cursor: pointer;
				}

				.chat-messages {
					max-height: 120px;
					overflow-y: auto;
					margin: 12px 0;
				}

				.chat-message {
					margin-bottom: 6px;
					font-size: 13px;
				}

				.sender {
					color: #4a9eff;
					font-weight: 500;
					margin-right: 6px;
				}

				.chat-input {
					display: flex;
					gap: 8px;
				}

				.chat-input input {
					flex: 1;
					background: rgba(10, 10, 30, 0.8);
					border: 1px solid rgba(100, 100, 150, 0.3);
					border-radius: 4px;
					padding: 6px 10px;
					color: #c0c0d0;
				}

				.chat-input button {
					background: rgba(74, 158, 255, 0.2);
					border: 1px solid #4a9eff;
					color: #aaccff;
					padding: 6px 12px;
					border-radius: 4px;
					cursor: pointer;
				}
			`}</style>
		</div>
	);
};

export default GameView;
