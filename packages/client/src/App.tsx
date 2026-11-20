/**
 * STFCS 主应用（Socket.IO 版）
 */

import { AuthPage } from "@/pages/AuthPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { notify } from "@/ui/shared/Notification";
import { BASE_PATH, DEFAULT_WS_URL, ROUTER_BASENAME } from "@/config";
import { MagneticPointerProvider } from "@/ui/shared/MagneticPointer";
import { ConnectionBanner } from "@/ui/shared/ConnectionBanner";
import { LoadingScreen } from "@/ui/shared/LoadingScreen";
import { ErrorBoundary } from "@/ui/shared/ErrorBoundary";
import type { RoomInfo } from "@/network";
import { SocketNetworkManager, useRoomList } from "@/network";
import { userService } from "@/services/UserService";
import { useUIStore } from "@/state/stores/uiStore";
import React, { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";

type AppState = "auth" | "lobby" | "game" | "loading";

const GamePage = React.lazy(() => import("@/pages/GamePage"));

const JOIN_ROUTE = /^\/join\/([\w-]+)\/?$/;

/** 从 URL 解析房间邀请链接：/stfcs/join/<roomId> */
function readJoinRoomId(): string | null {
	if (typeof window === "undefined") return null;
	const base = ROUTER_BASENAME === "/" ? "" : ROUTER_BASENAME;
	const { pathname } = window.location;
	const local = base && pathname.startsWith(base) ? pathname.slice(base.length) : pathname;
	return JOIN_ROUTE.exec(local)?.[1] ?? null;
}

/** 清掉地址栏里的邀请路径，避免刷新后重复加入 */
function clearJoinPath(): void {
	if (typeof window === "undefined") return;
	const { search, hash } = window.location;
	window.history.replaceState(null, "", `${BASE_PATH}${search}${hash}`);
}

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>("auth");
	const [networkManager, setNetworkManager] = useState<SocketNetworkManager | null>(null);
	const networkManagerRef = useRef<SocketNetworkManager | null>(null);
	const [userName, setUserName] = useState<string>("");
	const [userProfile, setUserProfile] = useState<{ nickname: string; avatar: string | null; avatarAssetId?: string }>({ nickname: "", avatar: null });
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);
	const [connected, setConnected] = useState(false);
	const [pendingJoinId, setPendingJoinId] = useState<string | null>(readJoinRoomId);
	const pendingJoinRef = useRef<string | null>(pendingJoinId);

	const setConnectedState = useUIStore((state) => state.setConnected);
	const setConnectionError = useUIStore((state) => state.setConnectionError);

	const { rooms, isLoading: roomsLoading } = useRoomList(
		networkManager,
		refreshKey
	);

	const myRoom: RoomInfo | null = useMemo(() => {
		if (!rooms.length || !playerId) return null;
		return rooms.find((r) => r.ownerId === playerId) ?? null;
	}, [playerId, rooms]);

	/** 登录成功后处理邀请链接：加入成功就直接进对局 */
	const enterPendingRoom = useCallback(async (manager: SocketNetworkManager): Promise<boolean> => {
		const roomId = pendingJoinRef.current;
		if (!roomId) return false;
		pendingJoinRef.current = null;
		const result = await manager.joinRoom(roomId);
		if (!result.success) {
			setPendingJoinId(roomId);
			toastJoinFailed(result.error);
			return false;
		}
		setPendingJoinId(null);
		clearJoinPath();
		return true;
	}, []);

	useEffect(() => {
		const manager = new SocketNetworkManager(DEFAULT_WS_URL);
		networkManagerRef.current = manager;
		setNetworkManager(manager);
		setConnectedState(false);

		let disposed = false;
		let restored = false;

		const onConnect = () => {
			if (disposed) return;
			setConnected(true);
			setConnectedState(true);
			setConnectionError(null);
			window.__STFCS_SOCKET__ = manager.getSocket();
			if (restored) return;
			restored = true;

			const restoredName = userService.restoreUsername();
			if (!restoredName) return;
			void manager.authenticate(restoredName).then(async (result) => {
				if (disposed || !result.success) return;
				setPlayerId(manager.getPlayerId());
				setUserName(result.playerName || restoredName);
				setUserProfile(result.profile ?? { nickname: restoredName, avatar: null });
				const joined = await enterPendingRoom(manager);
				if (disposed) return;
				setAppState(joined ? "game" : "lobby");
				setRefreshKey(Date.now());
				notify.success(`欢迎回来，${result.playerName || restoredName}`);
			});
		};

		const onDisconnect = (reason: string) => {
			setConnected(false);
			setConnectedState(false);
			setConnectionError(reason);
		};

		const onConnectError = (error: Error) => {
			setConnectedState(false);
			setConnectionError(error.message);
		};

		void manager.connect();
		const socket = manager.getSocket();
		socket?.on("connect", onConnect);
		socket?.on("disconnect", onDisconnect);
		socket?.on("connect_error", onConnectError);
		// connect() 可能在监听器挂载前已完成
		if (socket?.connected) onConnect();

		return () => {
			disposed = true;
			socket?.off("connect", onConnect);
			socket?.off("disconnect", onDisconnect);
			socket?.off("connect_error", onConnectError);
			window.__STFCS_SOCKET__ = undefined;
			manager.disconnect();
		};
	}, [enterPendingRoom, setConnectedState, setConnectionError]);

	const handleAuthenticated = useCallback(async (username: string) => {
		const manager = networkManagerRef.current;
		if (!manager) return;
		const result = await manager.authenticate(username);
		if (!result.success) {
			notify.error(result.error || "认证失败");
			return;
		}
		setUserName(username);
		setPlayerId(manager.getPlayerId());
		setUserProfile(result.profile ?? { nickname: username, avatar: null });
		userService.setUsername(username);
		const joined = await enterPendingRoom(manager);
		setAppState(joined ? "game" : "lobby");
		setRefreshKey(Date.now());
	}, [enterPendingRoom]);

	const handleLogout = useCallback(() => {
		userService.logout();
		setUserName("");
		setPlayerId(null);
		setAppState("auth");
		networkManagerRef.current?.logout();
	}, []);

	const handleCreateRoom = useCallback(async (options?: { name?: string; maxPlayers?: number }) => {
		if (!networkManagerRef.current) return;

		setAppState("loading");
		const result = await networkManagerRef.current.createRoom({
			roomName: options?.name?.trim() || `${userName}的房间`,
			maxPlayers: options?.maxPlayers ?? 4,
		});

		if (result.success && result.roomId) {
			setAppState("lobby");
			setRefreshKey(Date.now());
		} else {
			notify.error(result.error || "创建房间失败");
			setAppState("lobby");
		}
	}, [userName]);

	const handleEnterMyRoom = useCallback(async () => {
		if (!networkManagerRef.current || !myRoom?.roomId) return;

		setAppState("loading");
		const result = await networkManagerRef.current.joinRoom(myRoom.roomId);

		if (result.success) {
			setAppState("game");
		} else {
			notify.error(result.error || "进入房间失败");
			setAppState("lobby");
		}
	}, [myRoom]);

	const handleJoinRoom = useCallback(async (roomId: string) => {
		if (!networkManagerRef.current) return;

		setAppState("loading");
		const result = await networkManagerRef.current.joinRoom(roomId);

		if (result.success) {
			setAppState("game");
		} else {
			notify.error(result.error || "加入房间失败");
			setAppState("lobby");
		}
	}, []);

	const handleBackToLobby = useCallback(() => {
		setAppState("lobby");
		networkManagerRef.current?.leaveRoom();
		setRefreshKey(Date.now());
	}, []);

	const handleRefresh = useCallback(() => {
		setRefreshKey(Date.now());
	}, []);

	const handleUpdateProfile = useCallback(
		async (profile: { nickname?: string; avatar?: string; avatarAssetId?: string }) => {
			if (!networkManagerRef.current) return;
			const result = await networkManagerRef.current.updateProfile(profile);
			if (!result.success || !result.profile) {
				notify.error(result.error || "玩家档案保存失败");
				return;
			}

			setUserProfile(result.profile);
		},
		[]
	);

	const handleDeleteRoom = useCallback(async (roomId: string) => {
		if (!networkManagerRef.current) return;

		const result = await networkManagerRef.current.deleteRoom(roomId);
		if (result.success) {
			setRefreshKey(Date.now());
		} else {
			notify.error(result.error || "删除房间失败");
		}
	}, []);

	if (!networkManager) {
		return <LoadingScreen label="初始化指挥终端" />;
	}

	const magneticEnabled = appState === "lobby" || appState === "game";

	return (
		<MagneticPointerProvider enabled={magneticEnabled}>
			<div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
				<ConnectionBanner />
				<ErrorBoundary>
					{appState === "auth" && (
						<AuthPage connected={connected} onAuthenticated={handleAuthenticated} />
					)}

					{appState === "lobby" && (
						<LobbyPage
							networkManager={networkManager}
							playerName={userName}
							profile={userProfile}
							rooms={rooms}
							isLoading={roomsLoading}
							myRoom={myRoom}
							playerId={playerId}
							pendingJoinId={pendingJoinId}
							onCreateRoom={handleCreateRoom}
							onEnterMyRoom={handleEnterMyRoom}
							onJoinRoom={handleJoinRoom}
							onDeleteRoom={handleDeleteRoom}
							onRefresh={handleRefresh}
							onLogout={handleLogout}
							onUpdateProfile={handleUpdateProfile}
						/>
					)}

					{appState === "game" && (
						<Suspense fallback={<LoadingScreen label="载入战术地图" />}>
							<GamePage
								networkManager={networkManager}
								onLeaveRoom={handleBackToLobby}
							/>
						</Suspense>
					)}

					{appState === "loading" && <LoadingScreen label="处理中" />}
				</ErrorBoundary>
			</div>
		</MagneticPointerProvider>
	);
};

function toastJoinFailed(error?: string) {
	notify.error(error || "邀请链接无效：房间可能已关闭");
}

export default App;
