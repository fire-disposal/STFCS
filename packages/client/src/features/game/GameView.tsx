import React, { useState, useEffect } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import { selectShip } from "@/store/slices/shipSlice";
import { selectToken } from "@/store/slices/mapSlice";
import { setSelectedTool } from "@/store/slices/uiSlice";
import { websocketService } from "@/services/websocket";

interface GameViewProps {
	onDisconnect: () => void;
}

const GameView: React.FC<GameViewProps> = ({ onDisconnect }) => {
	const dispatch = useAppDispatch();
	const [leftPanelCollapsed, setLeftPanelCollapsed] = useState(false);
	const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
	const [chatExpanded, setChatExpanded] = useState(false);

	// 在组件顶层获取所有需要的状态
	const { selectedShipId } = useAppSelector((state) => state.ship);
	const { selectedTokenId, tokens } = useAppSelector((state) => state.map);
	const { selectedTool } = useAppSelector((state) => state.ui);
	const { roomId, currentPlayerId, players } = useAppSelector((state) => state.player);

	// 获取选中的token
	const selectedToken = selectedTokenId ? tokens[selectedTokenId] : null;

	// 处理token点击
	const handleTokenClick = (tokenId: string) => {
		dispatch(selectToken(tokenId));

		// 如果是舰船token，也选中对应的舰船
		const token = tokens[tokenId];
		if (token && token.type === "ship") {
			dispatch(selectShip(token.id));
		}
	};

	// 处理工具选择
	const handleToolSelect = (tool: string) => {
		dispatch(setSelectedTool(tool as any));
	};

	// 处理聊天消息发送
	const handleChatSend = (content: string) => {
		if (currentPlayerId && content.trim()) {
			const player = players[currentPlayerId];
			if (player) {
				websocketService.sendChatMessage(
					content,
					currentPlayerId,
					player.name,
					"player"
				);
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

	// 处理舰船移动
	const handleShipMove = (
		shipId: string,
		position: { x: number; y: number },
		heading: number,
		speed: number
	) => {
		websocketService.sendShipMovement(shipId, position, heading, speed);
	};

	// 初始化WebSocket消息处理器
	useEffect(() => {
		// 设置舰船移动处理器
		websocketService.on("SHIP_MOVED", (payload) => {
			console.log("Ship moved received:", payload);
			// 这里可以更新本地状态或触发重新获取
		});

		// 设置战斗结果处理器
		websocketService.on("COMBAT_RESULT", (payload) => {
			console.log("Combat result:", payload);
		});

		return () => {
			// 清理处理器
			websocketService.off("SHIP_MOVED", () => {});
			websocketService.off("COMBAT_RESULT", () => {});
		};
	}, []);

	return (
		<div className="game-view">
			{/* 顶部工具栏 */}
			<div className="game-toolbar">
				<div className="toolbar">
					<div className="toolbar-section">
						<div className="toolbar-title">Tools</div>
						<div className="tool-buttons">
							{["select", "pan", "draw", "measure", "place"].map((tool) => (
								<button
									key={tool}
									className={`tool-button ${
										selectedTool === tool ? "active" : ""
									}`}
									onClick={() => handleToolSelect(tool)}
									title={tool.charAt(0).toUpperCase() + tool.slice(1)}
								>
									<span className="tool-icon">
										{tool === "select"
											? "🖱️"
											: tool === "pan"
											? "✋"
											: tool === "draw"
											? "✏️"
											: tool === "measure"
											? "📏"
											: "📍"}
									</span>
									<span className="tool-label">
										{tool.charAt(0).toUpperCase() + tool.slice(1)}
									</span>
								</button>
							))}
						</div>
					</div>

					<div className="toolbar-section">
						<div className="toolbar-title">Game</div>
						<div className="game-controls">
							<button
								className="game-button"
								onClick={handleEndTurn}
								title="End Turn"
							>
								<span className="game-icon">⏭️</span>
								<span className="game-label">End Turn</span>
							</button>
							<button
								className="game-button danger"
								onClick={onDisconnect}
								title="Disconnect"
							>
								<span className="game-icon">🚪</span>
								<span className="game-label">Disconnect</span>
							</button>
						</div>
					</div>
				</div>
			</div>

			<div className="game-content">
				{/* 左侧面板 - 房间和玩家信息 */}
				<aside
					className={`game-sidebar left ${leftPanelCollapsed ? "collapsed" : ""}`}
				>
					<button
						className="panel-toggle"
						onClick={() => setLeftPanelCollapsed(!leftPanelCollapsed)}
					>
						{leftPanelCollapsed ? "›" : "‹"}
					</button>
					{!leftPanelCollapsed && (
						<div className="panel-content">
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
												{player.isConnected ? "●" : "○"}
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

				{/* 主游戏区域 */}
				<main className="game-main">
					<div className="map-canvas-placeholder">
						<div className="map-header">
							<h3>Map Canvas</h3>
							<p>Selected Token: {selectedTokenId || "None"}</p>
							<p>Selected Ship: {selectedShipId || "None"}</p>
						</div>
						<div className="map-grid">
							{/* 简化的网格展示 */}
							{Array.from({ length: 8 }).map((_, row) => (
								<div key={row} className="grid-row">
									{Array.from({ length: 12 }).map((_, col) => (
										<div key={col} className="grid-cell">
											{selectedTokenId && row === 3 && col === 5 ? "🚀" : ""}
										</div>
									))}
								</div>
							))}
						</div>
						<div className="map-controls">
							<button onClick={() => handleTokenClick("test_ship_1")}>
								Select Test Ship
							</button>
							<button
								onClick={() =>
									handleShipMove("test_ship_1", { x: 100, y: 100 }, 45, 10)
								}
							>
								Move Ship
							</button>
						</div>
					</div>

					{/* 选中的舰船信息卡片 */}
					{selectedShipId && (
						<div className="ship-info-placeholder">
							<h3>Ship Info</h3>
							<p>Ship ID: {selectedShipId}</p>
							<p>Type: Battlecruiser</p>
							<p>Position: x: 100, y: 100</p>
							<p>Health: 85%</p>
							<button
								onClick={() => {
									dispatch(selectShip(null));
									dispatch(selectToken(null));
								}}
								className="close-button"
							>
								Close
							</button>
						</div>
					)}
				</main>

				{/* 右侧面板 - 战斗日志和系统信息 */}
				<aside
					className={`game-sidebar right ${
						rightPanelCollapsed ? "collapsed" : ""
					}`}
				>
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
										<span className="log-text">
											Player1 fired missiles at EnemyShip
										</span>
									</div>
									<div className="log-entry">
										<span className="log-time">12:31:10</span>
										<span className="log-text">EnemyShip shield took 150 damage</span>
									</div>
									<div className="log-entry">
										<span className="log-time">12:31:25</span>
										<span className="log-text">
											EnemyShip returned fire with laser cannons
										</span>
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
								<button onClick={() => handleChatSend("Test message")}>
									Send
								</button>
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
					<span className="status-value">Player 1's Turn</span>
				</div>
			</div>

			<style>{`
				.room-panel-placeholder,
				.player-controls-placeholder,
				.map-canvas-placeholder,
				.ship-info-placeholder,
				.combat-log-placeholder,
				.chat-panel-placeholder {
					padding: 12px;
					background: rgba(20, 20, 40, 0.7);
					border-radius: 4px;
					margin-bottom: 12px;
				}

				.room-panel-placeholder h3,
				.player-controls-placeholder h3,
				.map-canvas-placeholder h3,
				.ship-info-placeholder h3,
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

				.map-grid {
					display: flex;
					flex-direction: column;
					gap: 1px;
					background: rgba(100, 100, 150, 0.1);
					padding: 8px;
					border-radius: 4px;
				}

				.grid-row {
					display: flex;
					gap: 1px;
				}

				.grid-cell {
					width: 30px;
					height: 30px;
					background: rgba(30, 30, 60, 0.5);
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 20px;
				}

				.map-controls {
					display: flex;
					gap: 8px;
					margin-top: 12px;
				}

				.map-controls button {
					background: rgba(40, 40, 80, 0.5);
					border: 1px solid rgba(100, 100, 150, 0.3);
					color: #aaccff;
					padding: 6px 12px;
					border-radius: 4px;
					cursor: pointer;
				}

				.map-controls button:hover {
					background: rgba(60, 60, 100, 0.6);
				}

				.ship-info-placeholder {
					position: absolute;
					top: 20px;
					right: 20px;
					width: 250px;
					background: rgba(15, 15, 30, 0.95);
					border: 1px solid rgba(100, 100, 150, 0.3);
					border-radius: 8px;
					padding: 16px;
					z-index: 100;
				}

				.close-button {
					background: rgba(239, 68, 68, 0.2);
					border: 1px solid #ef4444;
					color: #ff8a8a;
					padding: 6px 12px;
					border-radius: 4px;
					cursor: pointer;
					margin-top: 12px;
					width: 100%;
				}

				.close-button:hover {
					background: rgba(239, 68, 68, 0.3);
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
