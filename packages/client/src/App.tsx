/**
 * STFCS 主应用
 *
 * 架构：
 * - NetworkManager: 连接管理
 * - GameClient: 命令发送（通过 NetworkManager 获取）
 * - UserService: 本地用户缓存
 * - SystemService: 系统房间服务
 */

import { AuthPage } from "@/pages/AuthPage";
import { LobbyPage } from "@/pages/LobbyPage";
import { notify } from "@/ui/shared/Notification";
import { DEFAULT_WS_URL } from "@/config";
import GamePage from "@/pages/GamePage";
import { NetworkManager, type RoomInfo } from "@/network/NetworkManager";
import { SystemService } from "@/services/SystemService";
import { userService } from "@/services/UserService";
import { usePlayerProfile } from "@/sync";
import React, { useEffect, useState, useCallback, useRef } from "react";

type AppState = "auth" | "lobby" | "game";

const App: React.FC = () => {
	const [appState, setAppState] = useState<AppState>("auth");
	const [networkManager, setNetworkManager] = useState<NetworkManager | null>(null);
	const networkManagerRef = useRef<NetworkManager | null>(null);
	const systemServiceRef = useRef<SystemService | null>(null);
	const [userName, setUserName] = useState<string>("");
	const [userProfile, setUserProfile] = useState<{ nickname: string; avatar: string } | null>(null);
	const [rooms, setRooms] = useState<RoomInfo[]>([]);
	const [pendingInviteRoomId, setPendingInviteRoomId] = useState<string | null>(null);
	const [isLoading, setIsLoading] = useState(false);
	const roomsUnsubscribeRef = useRef<(() => void) | null>(null);

	// 初始化数据源
	const currentRoom = networkManager?.getCurrentRoom() || null;
	const syncedProfile = usePlayerProfile(currentRoom);

	// 当进入房间后，使用从服务器同步回来的最新档案
	useEffect(() => {
		if (appState === "game" && syncedProfile.nickname) {
			setUserProfile(syncedProfile);
			setUserName(syncedProfile.nickname);
		}
	}, [appState, syncedProfile]);

	// 初始化
	useEffect(() => {
		const manager = new NetworkManager(DEFAULT_WS_URL);
		const systemService = new SystemService(manager["client"]);

		setNetworkManager(manager);
		networkManagerRef.current = manager;
		systemServiceRef.current = systemService;

		// 恢复用户
		const restoredName = userService.restoreUsername();
		if (restoredName) {
			setUserName(restoredName);
			setUserProfile({ nickname: restoredName, avatar: "" });
			setAppState("lobby");
			notify.success(`欢迎回来，${restoredName}！`);
		}

		// 处理邀请链接
		const inviteRoomId = new URLSearchParams(window.location.search).get("room");
		if (inviteRoomId) setPendingInviteRoomId(inviteRoomId);

		return () => {
			manager.dispose();
			systemService.disconnect();
		};
	}, []);

	// 连接 SystemService 并订阅房间列表
	useEffect(() => {
		if (!systemServiceRef.current || appState !== "lobby") return;

		const systemService = systemServiceRef.current;
		const currentUserName = networkManagerRef.current?.getProfile()?.nickname || userName;

		systemService
			.connect()
			.then(async () => {
				const unsubscribe = systemService.subscribeRooms(setRooms);
				systemService.requestRooms();
				roomsUnsubscribeRef.current = unsubscribe;

				// 从全局档案服务加载已保存的档案（仅首次加载）
				if (currentUserName && !userProfile?.avatar) {
					try {
						const profile = await systemService.getProfile(currentUserName);
						if (profile.avatar) {
							setUserProfile({ nickname: profile.nickname, avatar: profile.avatar });
						}
					} catch (error) {
						console.warn("[App] Failed to load profile from SystemService:", error);
					}
				}
			})
			.catch((error) => {
				console.error("[App] SystemService connection error:", error);
				notify.error("连接系统服务失败");
			});

		return () => roomsUnsubscribeRef.current?.();
	}, [appState]);

	// 监听业务错误
	useEffect(() => {
		const handleBusinessError = (event: CustomEvent<string>) => {
			notify.error(event.detail);
		};
		const handleProfileUpdated = (event: CustomEvent<{ success: boolean; nickname: string; avatar: string }>) => {
			if (event.detail.success) {
				notify.success("玩家档案已持久化保存");
				// 同步本地状态（确保与后端一致）
				setUserProfile({
					nickname: event.detail.nickname,
					avatar: event.detail.avatar,
				});
				setUserName(event.detail.nickname);
			}
		};
		window.addEventListener("stfcs-room-error", handleBusinessError as EventListener);
		window.addEventListener("stfcs-profile-updated", handleProfileUpdated as EventListener);
		return () => {
			window.removeEventListener("stfcs-room-error", handleBusinessError as EventListener);
			window.removeEventListener("stfcs-profile-updated", handleProfileUpdated as EventListener);
		};
	}, []);

	// 认证成功
	const handleAuthenticated = useCallback((username: string) => {
		setUserName(username);
		setUserProfile({ nickname: username, avatar: "" });
		userService.setUsername(username);
		setAppState("lobby");
		notify.success(`欢迎，${username}！`);
	}, []);

	// 登出
	const handleLogout = useCallback(() => {
		roomsUnsubscribeRef.current?.();
		roomsUnsubscribeRef.current = null;

		userService.logout();
		setUserName("");
		setRooms([]);
		setAppState("auth");
		notify.info("已退出");
	}, []);

	// 创建房间
	const handleCreateRoom = useCallback(async () => {
		if (!networkManagerRef.current) return;

		const username = userService.getUsername();
		if (!username) {
			notify.error("请先登录");
			return;
		}

		setIsLoading(true);
		try {
			await networkManagerRef.current.createRoom({ playerName: username });
			notify.success("房间创建成功");
			setAppState("game");
		} catch (e) {
			notify.error(e instanceof Error ? e.message : "创建房间失败");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// 加入房间
	const handleJoinRoom = useCallback(async (roomId: string) => {
		if (!networkManagerRef.current) return;

		const username = userService.getUsername();
		if (!username) {
			notify.error("请先登录");
			return;
		}

		setIsLoading(true);
		try {
			await networkManagerRef.current.joinRoom(roomId, { playerName: username });
			notify.success("加入房间成功");
			setAppState("game");
		} catch (e) {
			notify.error(e instanceof Error ? e.message : "加入房间失败");
		} finally {
			setIsLoading(false);
		}
	}, []);

	// 处理待处理的邀请房间
	useEffect(() => {
		if (!pendingInviteRoomId || appState !== "lobby" || !userName) return;
		handleJoinRoom(pendingInviteRoomId);
		setPendingInviteRoomId(null);
	}, [pendingInviteRoomId, appState, userName, handleJoinRoom]);

	// 返回大厅
	const handleBackToLobby = useCallback(() => {
		setAppState("lobby");
		networkManagerRef.current?.leaveRoom().catch(() => {});
		notify.info("已返回大厅");
	}, []);

	// 更新玩家档案（支持大厅和游戏房间两种场景）
	const handleUpdateProfile = useCallback(
		async (profile: { nickname?: string; avatar?: string }) => {
			// 在游戏房间内：使用 GameClient（房间内同步）
			const gameClient = networkManagerRef.current?.getGameClient();
			if (gameClient) {
				gameClient.sendUpdateProfile(profile);
				return;
			}

			// 在大厅：使用 SystemService（全局档案）
			if (systemServiceRef.current && userName) {
				try {
					await systemServiceRef.current.updateProfile(userName, profile);
					// 成功后会通过 PROFILE_UPDATED 事件触发 UI 更新
				} catch (error) {
					notify.error(error instanceof Error ? error.message : "更新档案失败");
				}
			}
		},
		[userName]
	);

	// 刷新房间列表
	const handleRefresh = useCallback(() => {
		systemServiceRef.current?.requestRooms().catch((error) => {
			console.error("[App] Failed to refresh rooms:", error);
			notify.error("刷新房间列表失败");
		});
	}, []);

	// 删除房间（远程删除自己拥有的房间）
	const handleDeleteRoom = useCallback(async (roomId: string) => {
		const nm = networkManagerRef.current;
		const ss = systemServiceRef.current;

		if (!nm || !ss) {
			notify.error("请先登录后再操作");
			return;
		}

		try {
			// 远程删除需要 shortId，从房间列表获取
			const room = rooms.find(r => r.roomId === roomId);
			if (room?.metadata?.ownerShortId) {
				await ss.deleteRoom(roomId, room.metadata.ownerShortId);
				nm.clearRoomState(roomId);
			}
			notify.success("房间已删除");
		} catch (e) {
			notify.error(e instanceof Error ? e.message : "删除房间失败");
		}
	}, [rooms]);

	// 渲染
	if (!networkManager) {
		return <div style={{ padding: "40px", textAlign: "center", color: "#fff" }}>初始化中...</div>;
	}

	return (
		<div style={{ width: "100%", height: "100vh", overflow: "hidden" }}>
			{appState === "auth" && <AuthPage onAuthenticated={handleAuthenticated} />}

			{appState === "lobby" && (
				<LobbyPage
					playerName={userName}
					profile={userProfile ?? { nickname: userName, avatar: "" }}
					currentShortId={networkManager.getShortId()}
					rooms={rooms}
					isLoading={isLoading}
					onCreateRoom={handleCreateRoom}
					onJoinRoom={handleJoinRoom}
					onDeleteRoom={handleDeleteRoom}
					onRefresh={handleRefresh}
					onLogout={handleLogout}
					onUpdateProfile={handleUpdateProfile}
				/>
			)}

			{appState === "game" && networkManager.getCurrentRoom() && (
				<GamePage
					networkManager={networkManager}
					onLeaveRoom={handleBackToLobby}
					playerName={userName}
				/>
			)}
		</div>
	);
};

export default App;