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
import React, { useEffect, useState, useCallback, useRef } from "react";

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>("auth");
	const [networkManager, setNetworkManager] = useState<SocketNetworkManager | null>(null);
	const networkManagerRef = useRef<SocketNetworkManager | null>(null);
	const [userName, setUserName] = useState<string>("");
	const [userProfile, setUserProfile] = useState<{ nickname: string; avatar: string | null; avatarAssetId?: string }>({ nickname: "", avatar: null });
	const [myRoomId, setMyRoomId] = useState<string | null>(null);
	const [refreshKey, setRefreshKey] = useState(0);

	const { rooms, isLoading: roomsLoading } = useRoomList(
		networkManager,
		refreshKey
	);

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
		setMyRoomId(null);
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
			setMyRoomId(result.roomId);
			notify.success("房间创建成功，点击「进入房间」开始游戏");
			setAppState("lobby");
			setRefreshKey(Date.now());
		} else {
			notify.error(result.error || "创建房间失败");
			setAppState("lobby");
		}
	}, [userName]);

	const handleEnterMyRoom = useCallback(async () => {
		if (!networkManagerRef.current || !myRoomId) return;

		setAppState("loading");
		const result = await networkManagerRef.current.joinRoom(myRoomId);

		if (result.success) {
			notify.success("进入房间成功");
			setAppState("game");
		} else {
			notify.error(result.error || "进入房间失败");
			setAppState("lobby");
		}
	}, [myRoomId]);

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
		setMyRoomId(null);
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

	const handleDeleteRoom = useCallback(async (_roomId: string) => {
		notify.info("房间删除功能暂未实现");
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
					currentShortId={null}
					rooms={rooms}
					isLoading={roomsLoading}
					myRoomId={myRoomId}
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