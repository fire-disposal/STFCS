/**
 * STFCS 主应用
 *
 * 纯 WebSocket 版本：
 * - 房间列表通过 SystemService 获取
 * - 存档管理通过 SaveService 处理
 * - 用户管理通过 UserService 处理
 */

import { AuthPanel } from "@/components/auth/AuthPanel";
import { LobbyPanel } from "@/components/lobby/LobbyPanel";
import { notify } from "@/components/ui/Notification";
import { DEFAULT_WS_URL } from "@/config";
import { GameView } from "@/features/game/GameView";
import { NetworkManager, type RoomInfo } from "@/network/NetworkManager";
import { SystemService } from "@/services/SystemService";
import { userService } from "@/services/UserService";
import React, { useEffect, useState, useCallback, useRef } from "react";

type AppState = "auth" | "lobby" | "game";

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>("auth");
	const [networkManager, setNetworkManager] = useState<NetworkManager | null>(null);
	const networkManagerRef = useRef<NetworkManager | null>(null);
	const systemServiceRef = useRef<SystemService | null>(null);
	const [userName, setUserName] = useState<string>("");
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [pendingInviteRoomId, setPendingInviteRoomId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);

	// 初始化 NetworkManager 和 SystemService
	useEffect(() => {
		const manager = new NetworkManager(DEFAULT_WS_URL);
		const systemService = new SystemService(manager["client"]);

		setNetworkManager(manager);
		networkManagerRef.current = manager;
		systemServiceRef.current = systemService;

		// 恢复上次用户名
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
			systemService.disconnect();
		};
	}, []);

	// 连接 SystemService 并订阅房间列表
	useEffect(() => {
		if (!systemServiceRef.current || appState !== "lobby") {
			return;
		}

		const systemService = systemServiceRef.current;

		// 连接到系统房间
		systemService
			.connect()
			.then(() => {
				console.log("[App] SystemService connected");
				// 订阅房间列表更新（SystemRoom 每 3 秒自动推送）
				const unsubscribe = systemService.subscribeRooms(setRooms);
				// 立即请求一次房间列表
				systemService.requestRooms();

				// 保存取消订阅函数
				roomsUnsubscribeRef.current = unsubscribe;
			})
			.catch((error) => {
				console.error("[App] SystemService connection error:", error);
				notify.error("连接系统服务失败");
			});

		return () => {
			roomsUnsubscribeRef.current?.();
		};
	}, [appState]);

	// 房间订阅取消引用
	const roomsUnsubscribeRef = useRef<(() => void) | null>(null);

	// 监听业务错误消息（如：已拥有房间）
	useEffect(() => {
		const handleBusinessError = (event: CustomEvent<string>) => {
			console.log("[App] Business error received:", event.detail);
			notify.error(event.detail);
		};

		window.addEventListener("stfcs-room-error", handleBusinessError as EventListener);

		return () => {
			window.removeEventListener("stfcs-room-error", handleBusinessError as EventListener);
		};
	}, []);

	// 认证成功处理
	const handleAuthenticated = useCallback((username: string) => {
		setUserName(username);

		// 设置到 UserService 和 NetworkManager
		if (networkManagerRef.current) {
			networkManagerRef.current.setUser(username);
		}
		userService.setUser(username);

		setAppState("lobby");
		notify.success(`欢迎，${username}！`);
	}, []);

	// 登出处理
	const handleLogout = useCallback(async () => {
		roomsUnsubscribeRef.current?.();
		roomsUnsubscribeRef.current = null;

		if (networkManagerRef.current) {
			networkManagerRef.current.logout();
		}
		userService.logout();

		// 清除用户名，但保留 shortId（可复用）
		localStorage.removeItem("stfcs_username");
		setUserName("");
		setRooms([]);
		setAppState("auth");
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

	// 检查并处理待处理的邀请房间
	useEffect(() => {
		if (!pendingInviteRoomId || appState !== "lobby" || !userName) return;

		console.log("[App] Processing pending invite room:", pendingInviteRoomId);
		handleJoinRoom(pendingInviteRoomId);
		setPendingInviteRoomId(null);
	}, [pendingInviteRoomId, appState, userName, handleJoinRoom]);

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

	// 更新玩家档案
	const handleUpdateProfile = useCallback((profile: { nickname?: string; avatar?: string }) => {
		if (networkManagerRef.current) {
			networkManagerRef.current.setProfile(profile);
		}
		userService.setProfile(profile);
	}, []);

	// 删除房间（通过 WS 消息或 SystemService 远程删除）
	const handleDeleteRoom = useCallback(async (roomId: string) => {
		const nm = networkManagerRef.current;
		const ss = systemServiceRef.current;
		const shortId = nm?.getShortId();

		if (!nm || !ss || !shortId) {
			notify.error("请先登录后再操作");
			return;
		}

		try {
			// 如果当前在房间内，使用 NetworkManager 直接删除
			if (nm.getCurrentRoomId() === roomId) {
				await nm.deleteRoom();
				setAppState("lobby");
			} else {
				// 否则通过 SystemService 远程删除
				await ss.deleteRoom(roomId, shortId);
				// 远程删除成功后，清理本地房间状态
				nm.clearRoomState(roomId);
			}
			notify.success("房间已删除");
		} catch (e) {
			const errorMsg = e instanceof Error ? e.message : "删除房间失败";
			console.error("[App] Delete room error:", e);
			notify.error(errorMsg);
		}
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
					onDeleteRoom={handleDeleteRoom}
					onRefresh={() => systemServiceRef.current?.requestRooms()}
					onLogout={handleLogout}
					onUpdateProfile={handleUpdateProfile}
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
