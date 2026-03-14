import React, { useEffect } from "react";
import { Provider } from "react-redux";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { store, useAppDispatch, useAppSelector } from "@/store";
import { setConnected, setConnecting, setServerUrl } from "@/store/slices/uiSlice";
import { websocketService } from "@/services/websocket";
import ConnectionView from "@/features/connection/ConnectionView";
import GameView from "@/features/game/GameView";

// 主应用内容组件
const App: React.FC = () => {
	const dispatch = useAppDispatch();
	const { isConnected, serverUrl, isConnecting } = useAppSelector(
		(state) => state.ui.connection,
	);

	// 初始化WebSocket连接
	useEffect(() => {
		const savedServerUrl = localStorage.getItem("serverUrl");
		if (savedServerUrl) {
			dispatch(setServerUrl(savedServerUrl));
		}

		// 设置WebSocket消息处理器
		websocketService.on("PLAYER_JOINED", (payload) => {
			console.log("Player joined:", payload);
		});

		websocketService.on("PLAYER_LEFT", (payload) => {
			console.log("Player left:", payload);
		});

		websocketService.on("CHAT_MESSAGE", (payload) => {
			console.log("Chat message:", payload);
		});

		return () => {
			websocketService.disconnect();
		};
	}, [dispatch]);

	// 处理连接服务器
	const handleConnect = async (url: string) => {
		dispatch(setConnecting(true));
		try {
			await websocketService.connect(url);
			dispatch(setConnected(true));
			localStorage.setItem("serverUrl", url);
		} catch (error) {
			console.error("Failed to connect:", error);
			dispatch(setConnected(false));
		} finally {
			dispatch(setConnecting(false));
		}
	};

	// 处理断开连接
	const handleDisconnect = () => {
		websocketService.disconnect();
		dispatch(setConnected(false));
	};

	// 根据连接状态渲染不同页面
	if (!isConnected) {
		return (
			<ConnectionView
				serverUrl={serverUrl}
				isConnecting={isConnecting}
				onConnect={handleConnect}
			/>
		);
	}

	// 已连接 - 显示游戏界面
	return <GameView onDisconnect={handleDisconnect} />;
};

export default App;
