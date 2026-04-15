/**
 * STFCS 主应用
 *
 * 优化版 - 直接使用用户名认证，合理的 localStorage 使用
 */

import { AuthPanel } from "@/components/auth/AuthPanel";
import { LobbyPanel } from "@/components/lobby/LobbyPanel";
import { notify } from "@/components/ui/Notification";
import { DEFAULT_WS_URL } from "@/config";
import { GameView } from "@/features/game/GameView";
import { NetworkManager, type RoomInfo } from "@/network/NetworkManager";
import React, { useEffect, useState, useCallback, useRef } from "react";

type AppState = "auth" | "lobby" | "game";

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>("auth");
	const [networkManager, setNetworkManager] = useState<NetworkManager | null>(null);
	const networkManagerRef = useRef<NetworkManager | null>(null);
	const roomsUnsubscribeRef = useRef<(() => void) | null>(null);
	const [userName, setUserName] = useState<string>("");
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [pendingInviteRoomId, setPendingInviteRoomId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	// 初始化 NetworkManager
	useEffect(() => {
		const manager = new NetworkManager(DEFAULT_WS_URL);
		setNetworkManager(manager);
		networkManagerRef.current = manager;

		// 恢复上次用户名（仅从 localStorage，不自动登录）
		const restoredUser = localStorage.getItem("stfcs_username");

		if (restoredUser) {
			manager.setUser(restoredUser);
			setUserName(restoredUser);
			setAppState("lobby");
			console.log("[App] Restored user:", restoredUser);
			notify.success(`欢迎回来，${restoredUser}！`);
		}
		const inviteRoomId = new URLSearchParams(window.location.search).get("room");
		if (inviteRoomId) {
			setPendingInviteRoomId(inviteRoomId);
		}

		return () => {
			manager.dispose();
		};
	}, []);

	useEffect(() => {
		if (!networkManager || appState !== "lobby" || !userName) {
			return;
		}

		roomsUnsubscribeRef.current?.();
		roomsUnsubscribeRef.current = networkManager.subscribeRooms(setRooms);
		networkManager.getRooms();

		return () => {
			roomsUnsubscribeRef.current?.();
			roomsUnsubscribeRef.current = null;
		};
	}, [appState, networkManager, userName]);

	// 认证成功处理
	const handleAuthenticated = useCallback((username: string) => {
		setUserName(username);

		// 设置到 NetworkManager
		if (networkManagerRef.current) {
			networkManagerRef.current.setUser(username);
		}

		setAppState("lobby");
		notify.success(`欢迎，${username}！`);
	}, []);

	// 登出处理
	const handleLogout = useCallback(async () => {
		setIsLoading(true);
		roomsUnsubscribeRef.current?.();
		roomsUnsubscribeRef.current = null;

		if (networkManagerRef.current) {
			networkManagerRef.current.logout();
		}

		// 清除用户名，但保留 shortId（可复用）
		localStorage.removeItem("stfcs_username");
		setUserName("");
		setRooms([]);
		setAppState("auth");
		setIsLoading(false);
		notify.info("已退出");
	}, []);

	// 创建房间
	const handleCreateRoom = useCallback(async () => {
		if (!networkManagerRef.current) return;

		setIsLoading(true);

		try {
			await networkManagerRef.current.createRoom();
			notify.success("房间创建成功");
			setAppState("game");
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : "创建房间失败";
			console.error("[App] Create room error:", e);
			notify.error(errorMsg);
		} finally {
			setIsLoading(false);
		}
	}, []);

	// 加入房间
	const handleJoinRoom = useCallback(async (roomId: string) => {
		if (!networkManagerRef.current) return;

		setIsLoading(true);

		try {
			await networkManagerRef.current.joinRoom(roomId);
			notify.success("加入房间成功");
			setAppState("game");
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : "加入房间失败";
			console.error("[App] Join room error:", e);
			notify.error(errorMsg);
		} finally {
			setIsLoading(false);
		}
	}, []);

	useEffect(() => {
		if (!pendingInviteRoomId || appState !== "lobby") return;
		handleJoinRoom(pendingInviteRoomId);
		setPendingInviteRoomId(null);
	}, [pendingInviteRoomId, appState, handleJoinRoom]);

	// 返回大厅
	const handleBackToLobby = useCallback(async () => {
		console.log("[App] handleBackToLobby called, current appState:", appState);

		// 先切换状态，避免 UI 阻塞
		setAppState("lobby");

		if (networkManagerRef.current) {
			console.log("[App] Calling networkManager.leaveRoom()");
			// 异步离开，不阻塞 UI
			networkManagerRef.current.leaveRoom().catch((error) => {
				console.error("[App] leaveRoom error:", error);
			});
		}

		notify.info("已返回大厅");
	}, []);

	// 渲染
	if (!networkManager) {
		return <div style={{ padding: "40px", textAlign: "center", color: "#fff" }}>初始化中...</div>;
	}

	return (
		<div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
			{appState === "auth" && <AuthPanel onAuthenticated={handleAuthenticated} />}

			{appState === "lobby" && (
				<LobbyPanel
					playerName={userName}
					profile={networkManager.getProfile()}
					currentShortId={networkManager.getShortId()}
					currentRoomId={networkManager.getCurrentRoomId()}
					rooms={rooms}
					isLoading={isLoading}
					onCreateRoom={handleCreateRoom}
					onJoinRoom={handleJoinRoom}
					onDeleteRoom={(roomId) => networkManagerRef.current?.deleteRoom(roomId)}
					onRefresh={() => networkManagerRef.current?.getRooms()}
					onLogout={handleLogout}
					onUpdateProfile={(profile) => networkManagerRef.current?.setProfile(profile)}
				/>
			)}

			{appState === "game" && networkManager.getCurrentRoom() && (
				<GameView
					networkManager={networkManager}
					onLeaveRoom={handleBackToLobby}
					playerName={userName}
				/>
			)}
		</div>
	);
};

export default App;
