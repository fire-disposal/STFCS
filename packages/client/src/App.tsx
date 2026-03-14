import React, { useEffect, useState } from "react";

import { DEFAULT_WS_URL } from "@/config";
import GameView from "@/features/game/GameView";
import { websocketService } from "@/services/websocket";
import { useAppDispatch, useAppSelector } from "@/store";
import {
	setConnected,
	setConnecting,
	setPlayerId,
	setPlayerName,
	setRoomId,
} from "@/store/slices/uiSlice";

// 简化的连接视图 - 只输入玩家名称
const PlayerNameView: React.FC<{
	isConnecting: boolean;
	isConnected: boolean;
	onJoin: (playerName: string) => Promise<void>;
	onReconnect: () => Promise<void>;
}> = ({ isConnecting, isConnected, onJoin, onReconnect }) => {
	const [name, setName] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isConnected) {
			// 如果未连接，尝试重新连接
			try {
				setError("");
				await onReconnect();
				// 重新连接成功后，需要用户重新提交名称
				return;
			} catch (err) {
				setError(`Failed to reconnect: ${err instanceof Error ? err.message : String(err)}`);
				return;
			}
		}

		if (!name.trim()) {
			setError("Please enter your player name");
			return;
		}
		if (name.length > 32) {
			setError("Player name must be 32 characters or less");
			return;
		}
		setError("");
		try {
			await onJoin(name);
		} catch (err) {
			setError(`Failed to join: ${err instanceof Error ? err.message : String(err)}`);
		}
	};

	return (
		<div className="connection-view">
			<div className="connection-card">
				<h2>Join STFCS Game</h2>
				<p className="connection-description">
					Enter your player name to join the tactical space fleet combat simulation.
				</p>

				<form onSubmit={handleSubmit} className="connection-form">
					<div className="form-group">
						<label htmlFor="playerName">
							{isConnected ? "Player Name" : "Unable to connect to server"}
						</label>
						{isConnected ? (
							<input
								id="playerName"
								type="text"
								value={name}
								onChange={(e) => setName(e.target.value)}
								placeholder="Enter your name"
								disabled={isConnecting}
								className="form-input"
								maxLength={32}
								autoFocus
							/>
						) : (
							<div className="connection-status-text">
								Unable to connect to {DEFAULT_WS_URL}. Please check if the server is running.
							</div>
						)}
						{isConnected ? (
							<small className="form-help">
								Maximum 32 characters. Must be unique in the room.
							</small>
						) : null}
						{error && <div className="form-error">{error}</div>}
					</div>

					<div className="form-actions">
						<button
							type="submit"
							disabled={isConnecting || (isConnected && !name.trim())}
							className="connect-button"
						>
							{isConnecting ? (
								<>
									<span className="spinner"></span>
									{isConnected ? "Joining..." : "Reconnecting..."}
								</>
							) : isConnected ? (
								"Join Game"
							) : (
								"Retry Connection"
							)}
						</button>
					</div>
				</form>

				<div className="connection-info">
					<h3>Server Information</h3>
					<ul>
						<li>Auto-connected to: {DEFAULT_WS_URL}</li>
						<li>Server running on localhost:3001</li>
						<li>Player names must be unique in each room</li>
						<li>You can change rooms after joining</li>
					</ul>
				</div>
			</div>
		</div>
	);
};

// 主应用内容组件
const App: React.FC = () => {
	const dispatch = useAppDispatch();
	const { isConnected, playerName, isConnecting } = useAppSelector((state) => state.ui.connection);

	// 初始连接
	useEffect(() => {
		const initConnection = async () => {
			if (!websocketService.isConnected()) {
				dispatch(setConnecting(true));
				try {
					await websocketService.connect(DEFAULT_WS_URL);
					dispatch(setConnected(true));
					console.log("Connected to server:", DEFAULT_WS_URL);
				} catch (error) {
					console.error("Failed to connect to server:", error);
					// 连接失败时保持 disconnected 状态，不抛出错误
				} finally {
					dispatch(setConnecting(false));
				}
			}
		};

		initConnection();

		// 设置WebSocket消息处理器
		const handlePlayerJoined = (payload: any) => {
			console.log("Player joined:", payload);
		};

		const handlePlayerLeft = (payload: any) => {
			console.log("Player left:", payload);
		};

		const handleChatMessage = (payload: any) => {
			console.log("Chat message:", payload);
		};

		const handleWebSocketError = (payload: any) => {
			console.error("WebSocket error:", payload);
		};

		// 注册监听器
		websocketService.on("PLAYER_JOINED", handlePlayerJoined);
		websocketService.on("PLAYER_LEFT", handlePlayerLeft);
		websocketService.on("CHAT_MESSAGE", handleChatMessage);
		websocketService.on("ERROR", handleWebSocketError);

		return () => {
			// 清理所有监听器
			websocketService.off("PLAYER_JOINED", handlePlayerJoined);
			websocketService.off("PLAYER_LEFT", handlePlayerLeft);
			websocketService.off("CHAT_MESSAGE", handleChatMessage);
			websocketService.off("ERROR", handleWebSocketError);
		};
	}, [dispatch]);

	// 处理玩家加入游戏
	const handlePlayerJoin = async (name: string) => {
		dispatch(setConnecting(true));

		try {
			// 检查WebSocket连接状态
			if (!websocketService.isConnected()) {
				throw new Error("Not connected to server");
			}

			// 发送玩家加入消息到服务器
			// 使用临时玩家ID，服务器会分配正式ID
			const tempPlayerId = `player_${Date.now()}`;
			const defaultRoomId = "default_room";

			// 发送玩家加入请求
			await websocketService.sendRequest("player.join", {
				id: tempPlayerId,
				name,
				roomId: defaultRoomId,
			});

			// 更新本地状态
			dispatch(setPlayerName(name));
			dispatch(setPlayerId(tempPlayerId));
			dispatch(setRoomId(defaultRoomId));

			console.log(`Player ${name} joined the game in room ${defaultRoomId}`);
		} catch (error) {
			console.error("Failed to join game:", error);
			throw error;
		} finally {
			dispatch(setConnecting(false));
		}
	};

	// 处理重新连接
	const handleReconnect = async () => {
		dispatch(setConnecting(true));
		try {
			// 如果已经连接，先断开
			if (websocketService.isConnected()) {
				websocketService.disconnect();
				dispatch(setConnected(false));
			}

			await websocketService.connect(DEFAULT_WS_URL);
			dispatch(setConnected(true));
		} catch (error) {
			console.error("Failed to reconnect:", error);
			dispatch(setConnected(false));
			throw error;
		} finally {
			dispatch(setConnecting(false));
		}
	};

	// 处理断开连接
	const handleDisconnect = () => {
		websocketService.disconnect();
		dispatch(setConnected(false));
		dispatch(setPlayerName(""));
	};

	// 如果已连接且有玩家名称，显示游戏界面
	if (isConnected && playerName) {
		return <GameView onDisconnect={handleDisconnect} />;
	}

	// 其他情况显示登录界面
	return (
		<PlayerNameView
			isConnecting={isConnecting}
			isConnected={isConnected}
			onJoin={handlePlayerJoin}
			onReconnect={handleReconnect}
		/>
	);
};

export default App;
