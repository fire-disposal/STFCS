/**
 * STFCS 主应用（Socket.IO 版）
 */

import { AuthPage } from "@/pages/AuthPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { notify } from "@/ui/shared/Notification";
import { DEFAULT_WS_URL } from "@/config";
import GamePage from "@/pages/GamePage";
type AppState = "auth" | "lobby" | "game" | "loading";

import { SocketNetworkManager, useRoomList } from "@/network";
import { userService } from "@/services/UserService";
import React, { useEffect, useState, useCallback, useRef, useMemo } from "react";

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>("auth");
	const [networkManager, setNetworkManager] = useState<SocketNetworkManager | null>(null);
	const networkManagerRef = useRef<SocketNetworkManager | null>(null);
	const [userName, setUserName] = useState<string>("");
	const [userProfile, setUserProfile] = useState<{ nickname: string; avatar: string | null; avatarAssetId?: string }>({ nickname: "", avatar: null });
	const [playerId, setPlayerId] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	const { rooms, isLoading: roomsLoading } = useRoomList(
		networkManager,
		refreshKey
	);

	const myRoom = useMemo(() => {
		if (!rooms.length) return null;
		return rooms.find((r) => r.ownerName === userProfile.nickname) ?? null;
	}, [userProfile.nickname, rooms]);

	useEffect(() => {
		const manager = new SocketNetworkManager(DEFAULT_WS_URL);

		manager.connect().then((connected) => {
			if (!connected) {
				notify.error("连接服务器失败");
				return;
			}
			setNetworkManager(manager);
			networkManagerRef.current = manager;
			window.__STFCS_SOCKET__ = manager.getSocket();

			const restoredName = userService.restoreUsername();
			if (restoredName) {
				manager.authenticate(restoredName).then((result) => {
if (result.success) {
setPlayerId(networkManagerRef.current?.getPlayerId() ?? null);
				setUserName(restoredName);
				setUserProfile(result.profile ?? { nickname: restoredName, avatar: null });
				setAppState("lobby");
				notify.success(`欢迎回来，${restoredName}！`);
				setRefreshKey(Date.now());
			}
				});
			}
		});

		return () => {
			window.__STFCS_SOCKET__ = undefined;
			manager.disconnect();
		};
	}, []);

	const handleAuthenticated = useCallback(async (username: string) => {
		if (!networkManagerRef.current) return;

		const result = await networkManagerRef.current.authenticate(username);
		if (result.success) {
			setUserName(username);
			setPlayerId(networkManagerRef.current.getPlayerId());
			setUserProfile(result.profile ?? { nickname: username, avatar: null });
			userService.setUsername(username);
			setAppState("lobby");
			notify.success(`欢迎，${username}！`);
			setRefreshKey(Date.now());
		} else {
			notify.error(result.error || "认证失败");
		}
	}, []);

	const handleLogout = useCallback(() => {
		userService.logout();
		setUserName("");
		setPlayerId(null);
		setAppState("auth");
		networkManagerRef.current?.leaveRoom();
		notify.info("已退出");
	}, []);

	const handleCreateRoom = useCallback(async () => {
		if (!networkManagerRef.current) return;

		setAppState("loading");
		const result = await networkManagerRef.current.createRoom({
			roomName: `${userName}的房间`,
			maxPlayers: 4,
		});

		if (result.success && result.roomId) {
			notify.success("房间创建成功，点击「进入房间」开始游戏");
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
			notify.success("进入房间成功");
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
			notify.success("加入房间成功");
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
		notify.info("已返回大厅");
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
			notify.success("玩家档案已保存");
		},
		[]
	);

	const handleDeleteRoom = useCallback(async (roomId: string) => {
		if (!networkManagerRef.current) return;

		const result = await networkManagerRef.current.deleteRoom(roomId);
		if (result.success) {
			notify.success("房间已删除");
			setRefreshKey(Date.now());
		} else {
			notify.error(result.error || "删除房间失败");
		}
	}, []);

	if (!networkManager) {
		return <div style={{ padding: "40px", textAlign: "center", color: "#fff" }}>初始化中...</div>;
	}

	return (
		<div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
			{appState === "auth" && <AuthPage onAuthenticated={handleAuthenticated} />}

			{appState === "lobby" && (
				<LobbyPage
					networkManager={networkManager}
					playerName={userName}
					profile={userProfile}
					rooms={rooms}
					isLoading={roomsLoading}
					myRoom={myRoom}
					playerId={playerId}
					onCreateRoom={handleCreateRoom}
					onEnterMyRoom={handleEnterMyRoom}
					onJoinRoom={handleJoinRoom}
					onDeleteRoom={handleDeleteRoom}
					onRefresh={handleRefresh}
					onLogout={handleLogout}
					onUpdateProfile={handleUpdateProfile}
				/>
			)}

			{appState === "game" && networkManager.getCurrentRoomId() && (
				<GamePage
					networkManager={networkManager}
					onLeaveRoom={handleBackToLobby}
				/>
			)}
		</div>
	);
};

export default App;