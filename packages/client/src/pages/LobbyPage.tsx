/**
 * 大厅面板组件
 *
 * 房间列表和玩家信息
 * 使用 CSS 类名而非内联样式
 */

import type { RoomInfo } from "@/network/NetworkManager";
import { notify } from "@/ui/shared/Notification";
import { Avatar } from "@/ui/shared/Avatar";
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";

interface LobbyPageProps {
	playerName: string;
	profile: { nickname: string; avatar: string };
	currentShortId: number | null;
	rooms: RoomInfo[];
	isLoading: boolean;
	onCreateRoom: () => void;
	onJoinRoom: (roomId: string) => void;
	onDeleteRoom: (roomId: string) => void;
	onRefresh: () => void;
	onLogout: () => void;
	onUpdateProfile: (profile: { nickname?: string; avatar?: string }) => void;
}

export const LobbyPage: React.FC<LobbyPageProps> = ({
	playerName,
	profile,
	currentShortId,
	rooms,
	isLoading,
	onCreateRoom,
	onJoinRoom,
	onDeleteRoom,
	onRefresh,
	onLogout,
	onUpdateProfile,
}) => {
	const [showProfile, setShowProfile] = useState(false);
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
			totalPlayers: rooms.reduce((sum, room) => sum + room.clients, 0),
			fullRooms: rooms.filter((room) => room.clients >= room.maxClients).length,
		}),
		[rooms]
	);

	const isOwnRoom = useCallback(
		(room: RoomInfo) => currentShortId !== null && room.metadata.ownerShortId === currentShortId,
		[currentShortId]
	);

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
		<div className="lobby-container">
			<div className="lobby-grid" />
			<header className="lobby-header">
				<h2 className="lobby-title">🏠 游戏大厅</h2>
				<div className="lobby-user-bar">
					<span className="lobby-user-name">
						<Avatar src={profile.avatar} size="medium" /> {profile.nickname || playerName}
					</span>
					<button
						className="lobby-btn lobby-btn--secondary"
						data-magnetic
						onClick={() => setShowProfile(true)}
					>
						玩家档案
					</button>
					<button className="lobby-btn lobby-btn--danger" data-magnetic onClick={onLogout}>
						退出登录
					</button>
				</div>
			</header>

			<div className="lobby-main">
				<section className="lobby-room-panel">
					<div className="lobby-room-list-header">
						<h3 className="lobby-section-title">📋 可用房间</h3>
						<button
							className="lobby-btn lobby-btn--refresh"
							data-magnetic
							onClick={onRefresh}
						>
							🔄 刷新
						</button>
					</div>
					{isLoading ? (
						<div className="lobby-empty">正在加载房间列表...</div>
					) : rooms.length === 0 ? (
						<div className="lobby-empty">
							<p>暂无可用房间</p>
							<p className="lobby-empty-hint">点击右侧“创建新房间”开始游戏</p>
						</div>
					) : (
						<div className="lobby-room-list">
							{rooms.map((room) => (
								<div
									key={room.roomId}
									className="lobby-room-card"
								>
									<div className="lobby-room-name">
										{room.name}
										{room.metadata.isPrivate && " 🔒"}
										{isOwnRoom(room) && " 👑"}
									</div>
									<div className="lobby-room-meta">
										<span className="lobby-room-status">
											<span className="lobby-status-dot" />
											{room.clients}/{room.maxClients} 玩家
										</span>
										<span>阶段：{room.metadata.phase}</span>
										{room.metadata.turnCount !== undefined && room.metadata.turnCount > 0 && (
											<span>回合：{room.metadata.turnCount}</span>
										)}
										{room.metadata.ownerShortId != null ? (
											<span>房主：#{room.metadata.ownerShortId}</span>
										) : (
											<span className="lobby-room-badge lobby-room-badge--warning">等待房主</span>
										)}
										{isOwnRoom(room) && (
											<span className="lobby-room-badge lobby-room-badge--success">你的房间</span>
										)}
									</div>
									<div className="lobby-room-actions">
										<button
											className="lobby-btn lobby-btn--join"
											data-magnetic
											onClick={() => onJoinRoom(room.roomId)}
										>
											进入房间
										</button>
										{isOwnRoom(room) && (
											<button
												className="lobby-btn lobby-btn--small lobby-btn--danger"
												data-magnetic
												onClick={() => onDeleteRoom(room.roomId)}
											>
												删除房间
											</button>
										)}
									</div>
								</div>
							))}
						</div>
					)}
				</section>

				<aside className="lobby-sidebar">
					<div className="lobby-section">
						<button
							className="lobby-btn lobby-btn--primary lobby-btn--block"
							data-magnetic
							onClick={onCreateRoom}
						>
							➕ 创建新房间
						</button>
					</div>
					<div className="lobby-section">
						<div className="lobby-section-title">📊 实时统计</div>
						<div className="lobby-stat">
							<span>活跃房间</span>
							<span className="lobby-stat-value lobby-stat-value--primary">{stats.totalRooms}</span>
						</div>
						<div className="lobby-stat">
							<span>在线玩家</span>
							<span className="lobby-stat-value lobby-stat-value--success">
								{stats.totalPlayers}
							</span>
						</div>
						<div className="lobby-stat">
							<span>已满房间</span>
							<span className="lobby-stat-value lobby-stat-value--danger">{stats.fullRooms}</span>
						</div>
					</div>
					<div className="lobby-section">
						<div className="lobby-section-title">📖 快速指南</div>
						<div className="lobby-guide">
							<div>1. 创建或加入房间</div>
							<div>2. 首个玩家自动成为 DM</div>
							<div>3. 等待其他玩家加入</div>
							<div>4. DM 开始游戏</div>
						</div>
					</div>
				</aside>
			</div>

			{showProfile && (
				<div className="modal-overlay" onClick={() => setShowProfile(false)}>
					<div className="modal-content lobby-modal" onClick={(e) => e.stopPropagation()}>
						<h3 className="modal-title">玩家档案</h3>
						<div className="lobby-avatar-preview">
							<Avatar src={previewAvatar} size="large" />
							<button
								className="lobby-btn lobby-btn--small lobby-btn--secondary"
								onClick={() => fileInputRef.current?.click()}
							>
								📤 上传图片
							</button>
							<input
								type="file"
								ref={fileInputRef}
								style={{ display: "none" }}
								accept="image/*"
								onChange={handleFileChange}
							/>
						</div>
						<div className="modal-label">修改昵称</div>
						<input
							className="modal-input"
							value={nickname}
							onChange={(e) => setNickname(e.target.value)}
							placeholder="昵称（可选）"
							maxLength={24}
						/>
						<div className="modal-actions">
							<button className="modal-btn" onClick={() => setShowProfile(false)}>
								取消
							</button>
							<button
								className="modal-btn modal-btn--primary"
								onClick={() => {
									onUpdateProfile({
										nickname,
										avatar: previewAvatar || "", 
									});
									setShowProfile(false);
								}}
							>
								保存
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default LobbyPage;
