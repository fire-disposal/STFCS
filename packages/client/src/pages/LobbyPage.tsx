/**
 * 大厅面板组件
 *
 * 房间列表和玩家信息
 * 使用 CSS 类名而非内联样式
 */

import type { RoomInfo } from "@/network";
import type { SocketNetworkManager } from "@/network";
import { notify } from "@/ui/shared/Notification";
import { Avatar } from "@/ui/shared/Avatar";
import LoadoutCustomizerDialog from "@/ui/overlays/LoadoutCustomizerDialog";
import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	Heading,
	ScrollArea,
	Separator,
	Tabs,
	Text,
	TextField,
} from "@radix-ui/themes";
import { DoorOpen, LogOut, RefreshCw, Upload, UserCircle, Wrench, Play, Plus, Save } from "lucide-react";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface LobbyPageProps {
	networkManager: SocketNetworkManager;
	playerName: string;
	profile: { nickname: string; avatar: string | null };
	rooms: RoomInfo[];
	isLoading: boolean;
	myRoom: RoomInfo | null;
	playerId: string | null;
	onCreateRoom: () => void;
	onEnterMyRoom: () => void;
	onJoinRoom: (roomId: string) => void;
	onDeleteRoom: (roomId: string) => void;
	onRefresh: () => void;
	onLogout: () => void;
	onUpdateProfile: (profile: { nickname?: string; avatar?: string }) => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
	networkManager,
	playerName,
	profile,
	rooms,
	isLoading,
	myRoom,
	playerId,
	onCreateRoom,
	onEnterMyRoom,
	onJoinRoom,
	onDeleteRoom,
	onRefresh,
	onLogout,
	onUpdateProfile,
}) => {
	const [showCustomizer, setShowCustomizer] = useState(false);
	const [showProfile, setShowProfile] = useState(false);
	const [roomTab, setRoomTab] = useState("all");
	const [nickname, setNickname] = useState(profile.nickname);
	// 内部预览状态：如果是 Base64，则直接作为预览，如果是 "👤" 或 null，则为 null
	const [previewAvatar, setPreviewAvatar] = useState<string | null>(
		profile.avatar && profile.avatar.startsWith("data:image/") ? profile.avatar : null
	);
	const fileInputRef = useRef<HTMLInputElement>(null);

	// 当外部 profile 更新时（例如服务器返回），同步内部预览状态
	useEffect(() => {
		setNickname(profile.nickname);
		if (profile.avatar && profile.avatar.startsWith("data:image/")) {
			setPreviewAvatar(profile.avatar);
		} else {
			setPreviewAvatar(null);
		}
	}, [profile]);

	const stats = useMemo(
		() => ({
			totalRooms: rooms.length,
			totalPlayers: rooms.reduce((sum, room) => sum + room.playerCount, 0),
			fullRooms: rooms.filter((room) => room.playerCount >= room.maxPlayers).length,
		}),
		[rooms]
	);

const isOwnRoom = useCallback(
    (room: RoomInfo) => playerId !== null && room.ownerId === playerId,
    [playerId]
  );

	const visibleRooms = useMemo(() => {
		if (roomTab === "joinable") {
			return rooms.filter((room) => room.playerCount < room.maxPlayers);
		}
		if (roomTab === "owned") {
			return rooms.filter((room) => isOwnRoom(room));
		}
		return rooms;
	}, [roomTab, rooms, isOwnRoom]);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const file = e.target.files?.[0];
		if (!file) return;

		// 检查文件类型
		if (!file.type.startsWith("image/")) {
			alert("请选择图片文件");
			return;
		}

		// 检查大小 (最大 2MB，前端限制)
		if (file.size > 2 * 1024 * 1024) {
			alert("图片文件过大，请选择小于 2MB 的图片");
			return;
		}

		const reader = new FileReader();
		reader.onload = (event) => {
			const data = event.target?.result as string;
			const img = new Image();
			img.onload = () => {
				console.log("[LobbyPage] Image loaded for canvas processing:", img.width, "x", img.height);
				// 使用 Canvas 裁剪并压缩为正方形
				const canvas = document.createElement("canvas");
				const size = 120; // 头像尺寸 120x120
				canvas.width = size;
				canvas.height = size;
				const ctx = canvas.getContext("2d");
				if (!ctx) {
					notify.error("Canvas context error");
					return;
				}

				// 计算裁剪区域 (居中正方形)
				const minDim = Math.min(img.width, img.height);
				const sx = (img.width - minDim) / 2;
				const sy = (img.height - minDim) / 2;

				ctx.drawImage(img, sx, sy, minDim, minDim, 0, 0, size, size);

				// 转换为 Base64
				const dataUrl = canvas.toDataURL("image/jpeg", 0.7);
				console.log("[LobbyPage] Avatar data URL generated, length:", dataUrl.length);
				setPreviewAvatar(dataUrl);
				notify.success("头像解析成功，请点击保存完成更换");
			};
			img.onerror = () => {
				notify.error("图片加载失败");
			};
			img.src = data;
		};
		reader.onerror = () => {
			notify.error("文件读取失败");
		};
		reader.readAsDataURL(file);
	};

	return (
		<div className="radix-lobby-shell">
			<div className="radix-grid-bg" />
			<Flex direction="column" gap="4" className="radix-lobby-content">
				<Card className="radix-surface-card" size="3">
					<Flex justify="between" align="center" wrap="wrap" gap="3">
						<Flex align="center" gap="3">
							<Avatar src={profile.avatar} size="medium" />
							<Box>
								<Heading size="5">🏠 游戏大厅</Heading>
								<Text color="gray" size="2">欢迎，{profile.nickname || playerName}</Text>
							</Box>
						</Flex>
						<Flex gap="2" align="center" wrap="wrap">
							<Button variant="soft" onClick={() => setShowCustomizer(true)} data-magnetic>
								<Wrench size={16} /> 舰船/武器工坊
							</Button>
							<Button variant="soft" onClick={() => setShowProfile(true)} data-magnetic>
								<UserCircle size={16} /> 玩家档案
							</Button>
							<Button color="red" variant="soft" onClick={onLogout} data-magnetic>
								<LogOut size={16} /> 退出
							</Button>
						</Flex>
					</Flex>
				</Card>

				<div className="radix-lobby-grid">
					<Card className="radix-surface-card" size="3">
						<Flex justify="between" align="center" mb="3">
							<Heading size="4">房间列表</Heading>
							<Button variant="soft" onClick={onRefresh} data-magnetic>
								<RefreshCw size={14} /> 刷新
							</Button>
						</Flex>
						<Tabs.Root value={roomTab} onValueChange={setRoomTab}>
							<Tabs.List>
								<Tabs.Trigger value="all">全部</Tabs.Trigger>
								<Tabs.Trigger value="joinable">可加入</Tabs.Trigger>
								<Tabs.Trigger value="owned">我的房间</Tabs.Trigger>
							</Tabs.List>
						</Tabs.Root>
						<Separator my="3" size="4" />
						{isLoading ? (
							<Text color="gray">正在加载房间列表...</Text>
						) : visibleRooms.length === 0 ? (
							<Box className="radix-empty-state">
								<Text size="4">暂无可用房间</Text>
								<Text color="gray" size="2">点击右侧“创建新房间”开始游戏</Text>
							</Box>
						) : (
							<ScrollArea type="always" scrollbars="vertical" className="radix-room-scroll">
								<Flex direction="column" gap="3" pr="2">
									{visibleRooms.map((room) => (
										<Card key={room.roomId} variant="surface">
											<Flex justify="between" align="start" gap="3" wrap="wrap">
												<Box>
													<Flex align="center" gap="2" mb="2" wrap="wrap">
														<Heading size="3">{room.name}</Heading>
														{/* 后端没有 isPrivate 属性，暂时移除私密标记 */}
														{isOwnRoom(room) && <Badge color="blue" variant="soft">你的房间</Badge>}
													</Flex>
													<Flex gap="2" wrap="wrap">
														<Badge variant="soft">{room.playerCount}/{room.maxPlayers} 玩家</Badge>
														<Badge variant="soft">阶段：{room.phase}</Badge>
														{room.turnCount !== undefined && room.turnCount > 0 && (
															<Badge variant="soft">回合：{room.turnCount}</Badge>
														)}
														{room.ownerName ? (
															<Badge variant="soft">房主：{room.ownerName}</Badge>
														) : (
															<Badge color="amber" variant="soft">等待房主</Badge>
														)}
													</Flex>
												</Box>
												<Flex gap="2" wrap="wrap">
													<Button onClick={() => onJoinRoom(room.roomId)} data-magnetic>
														<DoorOpen size={14} /> 进入
													</Button>
													{isOwnRoom(room) && (
														<Button color="red" variant="soft" onClick={() => onDeleteRoom(room.roomId)} data-magnetic>
															删除
														</Button>
													)}
												</Flex>
											</Flex>
										</Card>
									))}
								</Flex>
							</ScrollArea>
						)}
					</Card>

					<Flex direction="column" gap="3">
						<Card className="radix-surface-card" size="3">
							{myRoom ? (
								<Button size="3" color="green" className="radix-full-btn" onClick={onEnterMyRoom} data-magnetic>
									<Play size={16} /> 进入我的房间
								</Button>
							) : (
								<Button size="3" className="radix-full-btn" onClick={onCreateRoom} data-magnetic>
									<Plus size={16} /> 创建新房间
								</Button>
							)}
						</Card>

						<Card className="radix-surface-card" size="3">
							<Heading size="3" mb="3">📊 实时统计</Heading>
							<Flex direction="column" gap="2">
								<Flex justify="between"><Text color="gray">活跃房间</Text><Badge color="blue">{stats.totalRooms}</Badge></Flex>
								<Flex justify="between"><Text color="gray">在线玩家</Text><Badge color="green">{stats.totalPlayers}</Badge></Flex>
								<Flex justify="between"><Text color="gray">已满房间</Text><Badge color="red">{stats.fullRooms}</Badge></Flex>
							</Flex>
						</Card>

						<Card className="radix-surface-card" size="3">
							<Heading size="3" mb="3">📖 快速指南</Heading>
							<Flex direction="column" gap="2">
								<Text size="2" color="gray">1. 创建或加入房间</Text>
								<Text size="2" color="gray">2. 首个玩家自动成为 DM</Text>
								<Text size="2" color="gray">3. 等待其他玩家加入</Text>
								<Text size="2" color="gray">4. DM 开始游戏</Text>
							</Flex>
						</Card>
					</Flex>
				</div>
			</Flex>

			<Dialog.Root open={showProfile} onOpenChange={setShowProfile}>
				<Dialog.Content maxWidth="420px">
					<Dialog.Title>玩家档案</Dialog.Title>
					<Dialog.Description size="2" mb="3">调整昵称与头像，保存后立即生效。</Dialog.Description>
					<Flex direction="column" gap="3">
						<Flex align="center" gap="3">
							<Avatar src={previewAvatar} size="large" />
							<Button variant="soft" onClick={() => fileInputRef.current?.click()}>
								<Upload size={14} /> 上传图片
							</Button>
							<input
								type="file"
								ref={fileInputRef}
								style={{ display: "none" }}
								accept="image/*"
								onChange={handleFileChange}
							/>
						</Flex>
						<Box>
							<Text as="label" size="2" color="gray" mb="2" className="radix-label">昵称</Text>
							<TextField.Root
								value={nickname}
								onChange={(e) => setNickname(e.target.value)}
								placeholder="昵称（可选）"
								maxLength={24}
							/>
						</Box>
					</Flex>
					<Flex justify="end" gap="2" mt="4">
						<Button variant="soft" color="gray" onClick={() => setShowProfile(false)}>取消</Button>
						<Button
							onClick={() => {
								onUpdateProfile({
									nickname,
									avatar: previewAvatar || "",
								});
								setShowProfile(false);
							}}
						>
							<Save size={14} /> 保存
						</Button>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>

			<LoadoutCustomizerDialog
				open={showCustomizer}
				onOpenChange={setShowCustomizer}
				networkManager={networkManager}
			/>
		</div>
	);
};

export default LobbyPage;
