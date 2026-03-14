import React, { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { SciFiLanguageSwitcher } from "@/components/ui/SciFiLanguageSwitcher";

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
	const { t } = useTranslation();
	const [name, setName] = useState("");
	const [error, setError] = useState("");

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!isConnected) {
			try {
				setError("");
				await onReconnect();
				return;
			} catch (err) {
				setError(t("connection.error.failedToReconnect", {
					error: err instanceof Error ? err.message : String(err),
				}));
				return;
			}
		}

		if (!name.trim()) {
			setError(t("connection.error.nameRequired"));
			return;
		}
		if (name.length > 32) {
			setError(t("connection.error.nameTooLong"));
			return;
		}
		setError("");
		try {
			await onJoin(name);
		} catch (err) {
			setError(t("connection.error.failedToJoin", {
				error: err instanceof Error ? err.message : String(err),
			}));
		}
	};

	return (
		<div className="connection-view">
			<div className="connection-card">
				<div className="connection-header">
					<h2>{t("connection.title")}</h2>
					<SciFiLanguageSwitcher />
				</div>
				<p className="connection-description">
					{t("connection.description")}
				</p>

				<form onSubmit={handleSubmit} className="connection-form">
					<div className="form-group">
						<label htmlFor="playerName">
							{isConnected ? t("connection.playerName") : t("connection.unableToConnect")}
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
								{t("connection.connectionStatusText", { url: DEFAULT_WS_URL })}
							</div>
						)}
						{isConnected ? (
							<small className="form-help">{t("connection.formHelp")}</small>
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
									{isConnected ? t("connection.submit.joining") : t("connection.submit.reconnecting")}
								</>
							) : isConnected ? (
								t("connection.submit.joinGame")
							) : (
								t("connection.submit.retryConnection")
							)}
						</button>
					</div>
				</form>

				<div className="connection-info">
					<h3>{t("connectionInfo.title")}</h3>
					<ul>
						<li>{t("connectionInfo.autoConnect", { url: DEFAULT_WS_URL })}</li>
						<li>{t("connectionInfo.serverRunning")}</li>
						<li>{t("connectionInfo.uniqueName")}</li>
						<li>{t("connectionInfo.changeRooms")}</li>
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
	const { t } = useTranslation();

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
				} finally {
					dispatch(setConnecting(false));
				}
			}
		};

		initConnection();

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

		websocketService.on("PLAYER_JOINED", handlePlayerJoined);
		websocketService.on("PLAYER_LEFT", handlePlayerLeft);
		websocketService.on("CHAT_MESSAGE", handleChatMessage);
		websocketService.on("ERROR", handleWebSocketError);

		return () => {
			websocketService.off("PLAYER_JOINED", handlePlayerJoined);
			websocketService.off("PLAYER_LEFT", handlePlayerLeft);
			websocketService.off("CHAT_MESSAGE", handleChatMessage);
			websocketService.off("ERROR", handleWebSocketError);
		};
	}, [dispatch]);

	const handlePlayerJoin = async (name: string) => {
		dispatch(setConnecting(true));

		try {
			if (!websocketService.isConnected()) {
				throw new Error("Not connected to server");
			}

			const tempPlayerId = `player_${Date.now()}`;
			const defaultRoomId = "default_room";

			await websocketService.sendRequest("player.join", {
				id: tempPlayerId,
				name,
				roomId: defaultRoomId,
			});

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

	const handleReconnect = async () => {
		dispatch(setConnecting(true));
		try {
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

	const handleDisconnect = () => {
		websocketService.disconnect();
		dispatch(setConnected(false));
		dispatch(setPlayerName(""));
	};

	if (isConnected && playerName) {
		return <GameView onDisconnect={handleDisconnect} />;
	}

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
