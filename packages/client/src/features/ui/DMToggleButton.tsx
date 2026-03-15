import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, ShieldAlert } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAppDispatch, useAppSelector } from "@/store";
import { setDMMode, updateDMPlayers } from "@/store/slices/uiSlice";
import { websocketService } from "@/services/websocket";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";
import { store } from "@/store";

interface DMToggleButtonProps {
	className?: string;
}

/**
 * DM 模式切换按钮组件
 *
 * 功能特性：
 * - 折叠状态：角落中的小图标按钮
 * - 展开状态：方形红色物理按钮效果
 * - 点击触发后端 DM 模式切换逻辑
 * - 模拟按下/弹出的类物理按钮效果
 * - 与周围科幻风格一致的 UI 设计
 */
const DMToggleButton: React.FC<DMToggleButtonProps> = ({ className }) => {
	const dispatch = useAppDispatch();
	const { t } = useTranslation();
	const { isDMMode, players } = useAppSelector((state) => state.ui.dmMode);
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const [isExpanded, setIsExpanded] = useState(false);
	const [isPressed, setIsPressed] = useState(false);
	const [isAnimating, setIsAnimating] = useState(false);

	// 监听后端的 DM 状态更新
	useEffect(() => {
		const handleDMStatusUpdate = (payload: any) => {
			if (payload.players) {
				dispatch(updateDMPlayers(payload.players));
			}
		};

		const handleDMToggle = (payload: any) => {
			// 当其他玩家切换 DM 状态时，更新列表
			if (payload.players) {
				dispatch(updateDMPlayers(payload.players));
			}
		};

		websocketService.on("DM_STATUS_UPDATE", handleDMStatusUpdate);
		websocketService.on("DM_TOGGLE", handleDMToggle);

		return () => {
			websocketService.off("DM_STATUS_UPDATE", handleDMStatusUpdate);
			websocketService.off("DM_TOGGLE", handleDMToggle);
		};
	}, [dispatch]);

	// 初始化时请求当前 DM 状态
	useEffect(() => {
		if (players.length === 0 && websocketService.isConnected()) {
			// 如果有玩家列表，尝试获取 DM 状态
			const playerList = store.getState().player.players;
			if (Object.keys(playerList).length > 0) {
				const dmPlayers = Object.values(playerList).map((p) => ({
					id: p.id,
					name: p.name,
					isDMMode: p.isDMMode || false,
				}));
				dispatch(updateDMPlayers(dmPlayers));
			}
		}
	}, [dispatch, players.length]);

	// 处理按钮点击 - 切换 DM 模式
	const handleDMToggle = async () => {
		if (isAnimating) return;

		setIsAnimating(true);
		setIsPressed(true);

		// 模拟物理按钮按下延迟
		await new Promise((resolve) => setTimeout(resolve, 150));

		try {
			const newDMState = !isDMMode;

			// 发送请求到后端切换 DM 模式
			await websocketService.sendRequest("dm.toggle", {
				enable: newDMState,
			});

			// 更新本地状态
			dispatch(setDMMode(newDMState));

			// 添加系统消息提示
			websocketService.send({
				type: WS_MESSAGE_TYPES.CHAT_MESSAGE,
				payload: {
					senderId: currentPlayerId || "",
					senderName: store.getState().ui.connection.playerName,
					content: newDMState
						? t("player.dmMode.enabled")
						: t("player.dmMode.disabled"),
					timestamp: Date.now(),
				},
			});
		} catch (error) {
			console.error("Failed to toggle DM mode:", error);
		} finally {
			// 模拟物理按钮弹起延迟
			await new Promise((resolve) => setTimeout(resolve, 100));
			setIsPressed(false);
			setIsAnimating(false);
		}
	};

	// 处理展开/折叠切换
	const handleExpandToggle = (e: React.MouseEvent) => {
		e.stopPropagation();
		if (!isExpanded) {
			setIsExpanded(true);
		}
	};

	// 点击外部区域时折叠
	useEffect(() => {
		const handleClickOutside = () => {
			if (isExpanded) {
				setIsExpanded(false);
			}
		};

		if (isExpanded) {
			document.addEventListener("click", handleClickOutside);
			return () => {
				document.removeEventListener("click", handleClickOutside);
			};
		}
	}, [isExpanded]);

	const currentPlayerDMState = players.find((p) => p.id === currentPlayerId);
	const displayDMState = currentPlayerDMState?.isDMMode ?? isDMMode;

	return (
		<div className={`dm-toggle-container ${className || ""}`}>
			<AnimatePresence>
				{isExpanded ? (
					// 展开状态 - 方形红色物理按钮
					<motion.div
						key="expanded"
						initial={{ scale: 0.5, opacity: 0, rotate: -15 }}
						animate={{
							scale: 1,
							opacity: 1,
							rotate: 0,
							y: isPressed ? 4 : 0,
						}}
						exit={{ scale: 0.5, opacity: 0, rotate: 15 }}
						transition={{
							type: "spring",
							stiffness: 400,
							damping: 25,
							mass: 0.8,
						}}
						className="dm-button-wrapper"
						onClick={(e) => {
							e.stopPropagation();
							handleDMToggle();
						}}
						style={{ cursor: "pointer" }}
					>
						{/* 按钮外框 - 发光效果 */}
						<div
							className={`dm-button-glow ${displayDMState ? "active" : ""}`}
						/>

						{/* 按钮主体 */}
						<div
							className={`dm-button ${displayDMState ? "active" : ""} ${
								isPressed ? "pressed" : ""
							}`}
						>
							{/* 按钮表面装饰 */}
							<div className="dm-button-surface">
								{/* 中心图标 */}
								<div className="dm-button-icon">
									<Crown size={28} strokeWidth={2.5} />
								</div>

								{/* 状态指示灯 */}
								<div className={`dm-status-light ${displayDMState ? "on" : "off"}`} />

								{/* 装饰性扫描线 */}
								<div className="dm-scanline" />
							</div>

							{/* 按钮侧面（3D 效果） */}
							<div className="dm-button-side" />
						</div>

						{/* 按钮标签 */}
						<div className="dm-button-label">
							<span className="label-text">
								{displayDMState ? t("player.dmMode.active") : t("player.dmMode.enable")}
							</span>
						</div>

						{/* 底座阴影 */}
						<div
							className={`dm-button-shadow ${isPressed ? "pressed" : ""}`}
						/>
					</motion.div>
				) : (
					// 折叠状态 - 小图标按钮
					<motion.div
						key="collapsed"
						initial={{ scale: 0, opacity: 0 }}
						animate={{ scale: 1, opacity: 1 }}
						exit={{ scale: 0, opacity: 0 }}
						transition={{
							type: "spring",
							stiffness: 500,
							damping: 30,
						}}
						className="dm-toggle-collapsed"
						onClick={handleExpandToggle}
						title={t("player.dmMode.toggle")}
						style={{ cursor: "pointer" }}
					>
						{/* 图标容器 */}
						<div className={`toggle-icon-container ${displayDMState ? "active" : ""}`}>
							<ShieldAlert size={20} strokeWidth={2.5} />
							{/* 激活状态指示灯 */}
							{displayDMState && (
								<motion.div
									className="active-indicator-dot"
									animate={{
										scale: [1, 1.2, 1],
										opacity: [0.7, 1, 0.7],
									}}
									transition={{
										duration: 1.5,
										repeat: Infinity,
										ease: "easeInOut",
									}}
								/>
							)}
						</div>

						{/* 装饰性光晕 */}
						<div
							className={`toggle-glow ${displayDMState ? "active" : ""}`}
						/>
					</motion.div>
				)}
			</AnimatePresence>

			<style>{`
				.dm-toggle-container {
					position: absolute;
					top: 20px;
					right: 20px;
					z-index: 1500;
					display: flex;
					flex-direction: column;
					align-items: center;
					font-family: 'Segoe UI', 'Roboto', monospace;
				}

				/* ========== 折叠状态样式 ========== */
				.dm-toggle-collapsed {
					position: relative;
					width: 48px;
					height: 48px;
					border-radius: 12px;
					background: linear-gradient(
						135deg,
						rgba(20, 30, 60, 0.95) 0%,
						rgba(10, 15, 30, 0.98) 100%
					);
					border: 1px solid rgba(74, 158, 255, 0.25);
					display: flex;
					align-items: center;
					justify-content: center;
					box-shadow:
						0 4px 15px rgba(0, 0, 0, 0.4),
						inset 0 0 20px rgba(74, 158, 255, 0.05);
					transition: all 0.2s ease;
					overflow: hidden;
				}

				.dm-toggle-collapsed:hover {
					border-color: rgba(74, 158, 255, 0.5);
					box-shadow:
						0 6px 20px rgba(0, 0, 0, 0.5),
						inset 0 0 30px rgba(74, 158, 255, 0.1),
						0 0 20px rgba(74, 158, 255, 0.2);
					transform: translateY(-2px);
				}

				.toggle-icon-container {
					position: relative;
					display: flex;
					align-items: center;
					justify-content: center;
					color: #6a7a9f;
					transition: all 0.3s ease;
				}

				.toggle-icon-container.active {
					color: #ff4444;
					text-shadow: 0 0 10px rgba(255, 68, 68, 0.5);
				}

				.toggle-icon-container.active svg {
					filter: drop-shadow(0 0 8px rgba(255, 68, 68, 0.6));
				}

				.active-indicator-dot {
					position: absolute;
					bottom: -2px;
					right: -2px;
					width: 8px;
					height: 8px;
					border-radius: 50%;
					background: #ff4444;
					box-shadow: 0 0 10px rgba(255, 68, 68, 0.8);
				}

				.toggle-glow {
					position: absolute;
					inset: -2px;
					border-radius: 12px;
					background: radial-gradient(
						circle at center,
						rgba(74, 158, 255, 0.15) 0%,
						transparent 70%
					);
					opacity: 0;
					transition: opacity 0.3s ease;
					pointer-events: none;
				}

				.toggle-glow.active {
					opacity: 1;
					background: radial-gradient(
						circle at center,
						rgba(255, 68, 68, 0.2) 0%,
						transparent 70%
					);
				}

				/* ========== 展开状态样式 ========== */
				.dm-button-wrapper {
					position: relative;
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 8px;
				}

				.dm-button-glow {
					position: absolute;
					inset: -15px;
					border-radius: 20px;
					background: radial-gradient(
						circle at center,
						rgba(255, 68, 68, 0.3) 0%,
						transparent 60%
					);
					opacity: 0;
					transition: opacity 0.3s ease;
					pointer-events: none;
					animation: pulse-glow 2s ease-in-out infinite;
				}

				.dm-button-glow.active {
					opacity: 1;
				}

				@keyframes pulse-glow {
					0%, 100% {
						opacity: 0.6;
						transform: scale(1);
					}
					50% {
						opacity: 1;
						transform: scale(1.05);
					}
				}

				.dm-button {
					position: relative;
					width: 80px;
					height: 80px;
					border-radius: 16px;
					background: linear-gradient(
						145deg,
						#2a1a1a 0%,
						#1a0a0a 100%
					);
					border: 2px solid rgba(255, 68, 68, 0.3);
					display: flex;
					align-items: center;
					justify-content: center;
					box-shadow:
						0 8px 25px rgba(0, 0, 0, 0.5),
						inset 0 2px 10px rgba(255, 255, 255, 0.05),
						inset 0 -2px 10px rgba(0, 0, 0, 0.3);
					transition: all 0.15s ease;
					transform-style: preserve-3d;
				}

				.dm-button.active {
					border-color: rgba(255, 68, 68, 0.8);
					background: linear-gradient(
						145deg,
						#3a1a1a 0%,
						#2a0a0a 100%
					);
					box-shadow:
						0 8px 25px rgba(0, 0, 0, 0.5),
						inset 0 2px 10px rgba(255, 68, 68, 0.1),
						inset 0 -2px 10px rgba(0, 0, 0, 0.3),
						0 0 30px rgba(255, 68, 68, 0.3);
				}

				.dm-button.pressed {
					transform: translateY(4px) scale(0.98);
					box-shadow:
						0 2px 10px rgba(0, 0, 0, 0.5),
						inset 0 2px 15px rgba(255, 68, 68, 0.2),
						inset 0 -1px 5px rgba(0, 0, 0, 0.4);
				}

				.dm-button-surface {
					position: relative;
					width: 100%;
					height: 100%;
					display: flex;
					flex-direction: column;
					align-items: center;
					justify-content: center;
					border-radius: 14px;
					background: linear-gradient(
						135deg,
						rgba(30, 15, 15, 0.9) 0%,
						rgba(20, 10, 10, 0.95) 100%
					);
					overflow: hidden;
				}

				.dm-button-icon {
					color: #ff4444;
					filter: drop-shadow(0 0 8px rgba(255, 68, 68, 0.5));
					animation: icon-pulse 2s ease-in-out infinite;
				}

				@keyframes icon-pulse {
					0%, 100% {
						transform: scale(1);
						opacity: 0.9;
					}
					50% {
						transform: scale(1.05);
						opacity: 1;
					}
				}

				.dm-status-light {
					position: absolute;
					top: 8px;
					right: 8px;
					width: 6px;
					height: 6px;
					border-radius: 50%;
					transition: all 0.3s ease;
				}

				.dm-status-light.on {
					background: #ff4444;
					box-shadow:
						0 0 8px rgba(255, 68, 68, 0.8),
						0 0 15px rgba(255, 68, 68, 0.4);
					animation: blink-light 1.5s ease-in-out infinite;
				}

				.dm-status-light.off {
					background: #4a4a4a;
					box-shadow: 0 0 3px rgba(74, 74, 74, 0.5);
				}

				@keyframes blink-light {
					0%, 100% {
						opacity: 1;
					}
					50% {
						opacity: 0.5;
					}
				}

				.dm-scanline {
					position: absolute;
					inset: 0;
					background: linear-gradient(
						180deg,
						transparent 0%,
						rgba(255, 68, 68, 0.1) 50%,
						transparent 100%
					);
					animation: scanline-move 3s linear infinite;
					pointer-events: none;
				}

				@keyframes scanline-move {
					0% {
						transform: translateY(-100%);
					}
					100% {
						transform: translateY(100%);
					}
				}

				.dm-button-side {
					position: absolute;
					inset: 0;
					border-radius: 16px;
					background: linear-gradient(
						180deg,
						rgba(255, 68, 68, 0.1) 0%,
						transparent 50%,
						rgba(0, 0, 0, 0.2) 100%
					);
					pointer-events: none;
				}

				.dm-button-label {
					text-align: center;
				}

				.label-text {
					font-size: 10px;
					font-weight: 700;
					letter-spacing: 2px;
					color: #ff4444;
					text-shadow: 0 0 8px rgba(255, 68, 68, 0.5);
					background: linear-gradient(
						90deg,
						#ff4444 0%,
						#ff6666 50%,
						#ff4444 100%
					);
					-webkit-background-clip: text;
					-webkit-text-fill-color: transparent;
					background-clip: text;
					animation: label-shimmer 2s linear infinite;
					background-size: 200% auto;
				}

				@keyframes label-shimmer {
					0% {
						background-position: 0% center;
					}
					100% {
						background-position: 200% center;
					}
				}

				.dm-button-shadow {
					position: absolute;
					bottom: -10px;
					left: 50%;
					transform: translateX(-50%);
					width: 60px;
					height: 10px;
					border-radius: 50%;
					background: radial-gradient(
						ellipse at center,
						rgba(0, 0, 0, 0.5) 0%,
						transparent 70%
					);
					transition: all 0.15s ease;
				}

				.dm-button-shadow.pressed {
					width: 70px;
					height: 6px;
					opacity: 0.8;
				}

				/* ========== 响应式设计 ========== */
				@media (max-width: 768px) {
					.dm-toggle-container {
						top: 10px;
						right: 10px;
					}

					.dm-toggle-collapsed {
						width: 42px;
						height: 42px;
					}

					.dm-button {
						width: 70px;
						height: 70px;
					}

					.label-text {
						font-size: 9px;
					}
				}
			`}</style>
		</div>
	);
};

export default DMToggleButton;
