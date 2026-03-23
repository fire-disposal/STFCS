/**
 * DM模式切换按钮 - 简约风格
 * 
 * 设计要点：
 * 1. 边缘触发器 - 右侧细线
 * 2. 小抽屉面板 - 与竖线长度相当
 * 3. 简约按钮 - 标准按钮组件
 * 4. 后端集成 - 实际DM切换逻辑
 */

import React, { useState, useEffect, useCallback } from "react";
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

const DMToggleButton: React.FC<DMToggleButtonProps> = ({ className = "" }) => {
	const dispatch = useAppDispatch();
	const { t } = useTranslation();
	const { isDMMode, players } = useAppSelector((state) => state.ui.dmMode);
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const currentPlayerName = useAppSelector((state) => state.ui.connection.playerName);

	// 面板展开状态
	const [isExpanded, setIsExpanded] = useState(false);
	// 加载状态
	const [isLoading, setIsLoading] = useState(false);

	// 监听后端的 DM 状态更新
	useEffect(() => {
		const handleDMStatusUpdate = (payload: any) => {
			console.log("[DM] Status update received:", payload);
			if (payload.players) {
				dispatch(updateDMPlayers(payload.players));
			}
			if (payload.isDMMode !== undefined) {
				dispatch(setDMMode(payload.isDMMode));
			}
		};

		const handleDMToggle = (payload: any) => {
			console.log("[DM] Toggle event received:", payload);
			if (payload.players) {
				dispatch(updateDMPlayers(payload.players));
			}
			if (payload.playerId === currentPlayerId && payload.isDMMode !== undefined) {
				dispatch(setDMMode(payload.isDMMode));
			}
		};

		websocketService.on("DM_STATUS_UPDATE", handleDMStatusUpdate);
		websocketService.on("DM_TOGGLE", handleDMToggle);

		return () => {
			websocketService.off("DM_STATUS_UPDATE", handleDMStatusUpdate);
			websocketService.off("DM_TOGGLE", handleDMToggle);
		};
	}, [dispatch, currentPlayerId]);

	// 初始化时请求当前 DM 状态
	useEffect(() => {
		const initDMStatus = async () => {
			if (!websocketService.isConnected()) return;

			try {
				// 请求当前DM状态
				const response = await websocketService.sendRequest("dm.getStatus", {}) as { isDMMode: boolean; players: Array<{ id: string; name: string; isDMMode: boolean }> };
				console.log("[DM] Initial status:", response);

				if (response && response.isDMMode !== undefined) {
					dispatch(setDMMode(response.isDMMode));
				}
				if (response && response.players) {
					dispatch(updateDMPlayers(response.players));
				}
			} catch (error) {
				console.warn("[DM] Failed to get initial status:", error);
				// 使用本地状态作为回退
				const playerList = store.getState().player.players;
				if (Object.keys(playerList).length > 0) {
					const dmPlayers = Object.values(playerList).map((p: any) => ({
						id: p.id,
						name: p.name,
						isDMMode: p.isDMMode || false,
					}));
					dispatch(updateDMPlayers(dmPlayers));
				}
			}
		};

		initDMStatus();
	}, [dispatch]);

	// 切换 DM 模式 - 连接后端
	const handleDMToggle = async () => {
		if (!currentPlayerId || isLoading) return;

		setIsLoading(true);
		const newDMState = !isDMMode;

		try {
			console.log("[DM] Toggling to:", newDMState);

			// 发送请求到后端
			const response = await websocketService.sendRequest("dm.toggle", {
				enable: newDMState,
				playerId: currentPlayerId,
			}) as { id: string; name: string; joinedAt: number; isActive: boolean; isDMMode: boolean };

			console.log("[DM] Toggle response:", response);

			// 更新本地状态
			dispatch(setDMMode(newDMState));

			// 发送系统消息
			websocketService.send({
				type: WS_MESSAGE_TYPES.CHAT_MESSAGE,
				payload: {
					senderId: "system",
					senderName: "System",
					content: newDMState
						? `🎮 ${currentPlayerName || currentPlayerId} 已启用 DM 模式`
						: `👤 ${currentPlayerName || currentPlayerId} 已禁用 DM 模式`,
					timestamp: Date.now(),
				},
			});

			// 关闭面板
			setIsExpanded(false);
		} catch (error) {
			console.error("[DM] Failed to toggle DM mode:", error);
			// 显示错误（可以添加toast通知）
		} finally {
			setIsLoading(false);
		}
	};

	// 点击外部关闭面板
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			const target = e.target as HTMLElement;
			if (isExpanded && !target.closest('.dm-toggle-container')) {
				setIsExpanded(false);
			}
		};

		if (isExpanded) {
			document.addEventListener('click', handleClickOutside);
		}

		return () => {
			document.removeEventListener('click', handleClickOutside);
		};
	}, [isExpanded]);

	// 获取当前玩家的DM状态
	const currentPlayerDMState = players.find((p) => p.id === currentPlayerId);
	const displayDMState = currentPlayerDMState?.isDMMode ?? isDMMode;

	const handleInitializeTurn = async () => {
		if (!displayDMState) return;
		await websocketService.initializeTurn();
	};

	const handleAdvanceTurn = async () => {
		if (!displayDMState) return;
		await websocketService.advanceTurn();
	};

	const handleSetMovementPhase = async () => {
		if (!displayDMState) return;
		await websocketService.setTurnPhase("movement");
	};

	const handleSetDeploymentPhase = async () => {
		if (!displayDMState) return;
		await websocketService.setTurnPhase("deployment");
	};

	return (
		<div className={`dm-toggle-container ${className}`}>
			<AnimatePresence mode="wait">
				{!isExpanded ? (
					// 折叠状态 - 边缘触发器
					<motion.div
						key="collapsed"
						className="dm-edge-trigger"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						transition={{ duration: 0.15 }}
						onClick={(e) => {
							e.stopPropagation();
							setIsExpanded(true);
						}}
						title={t("player.dmMode.toggle")}
					>
						{/* 触发器线条 */}
						<div className={`dm-trigger-line ${displayDMState ? 'active' : ''}`}>
							{displayDMState && (
								<div className="dm-trigger-pulse" />
							)}
						</div>

						{/* 悬停提示 */}
						<div className="dm-trigger-tooltip">
							<ShieldAlert size={12} />
							<span>DM</span>
						</div>
					</motion.div>
				) : (
					// 展开状态 - 小抽屉面板
					<motion.div
						key="expanded"
						className="dm-drawer"
						initial={{ x: 20, opacity: 0 }}
						animate={{ x: 0, opacity: 1 }}
						exit={{ x: 20, opacity: 0 }}
						transition={{ type: "spring", stiffness: 400, damping: 30 }}
						onClick={(e) => e.stopPropagation()}
					>
						{/* 简约按钮 */}
						<button
							className={`dm-toggle-btn ${displayDMState ? 'active' : ''} ${isLoading ? 'loading' : ''}`}
							onClick={handleDMToggle}
							disabled={isLoading}
							type="button"
						>
							{isLoading ? (
								<div className="dm-loading-spinner" />
							) : (
								<>
									<Crown size={16} />
									<span className="dm-btn-text">
										{displayDMState ? t("player.dmMode.disable") : t("player.dmMode.enable")}
									</span>
									<div className={`dm-status-dot ${displayDMState ? 'on' : 'off'}`} />
								</>
							)}
						</button>

						{/* 关闭按钮 */}
						<button 
							className="dm-close-btn"
							onClick={() => setIsExpanded(false)}
							type="button"
						>
							×
						</button>

						{displayDMState && (
							<div className="dm-ops-panel">
								<button className="dm-op-btn" type="button" onClick={handleInitializeTurn}>
									初始化回合
								</button>
								<button className="dm-op-btn" type="button" onClick={handleAdvanceTurn}>
									推进回合
								</button>
								<button className="dm-op-btn" type="button" onClick={handleSetDeploymentPhase}>
									部署阶段
								</button>
								<button className="dm-op-btn" type="button" onClick={handleSetMovementPhase}>
									移动阶段
								</button>
							</div>
						)}
					</motion.div>
				)}
			</AnimatePresence>

			<style>{`
				.dm-toggle-container {
					position: fixed;
					top: 50%;
					right: 0;
					transform: translateY(-50%);
					z-index: var(--z-fixed);
					pointer-events: none;
				}

				/* ========== 边缘触发器 ========== */
				.dm-edge-trigger {
					position: absolute;
					right: 0;
					top: 50%;
					transform: translateY(-50%);
					width: 8px;
					height: 80px;
					cursor: pointer;
					pointer-events: auto;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.dm-trigger-line {
					width: 3px;
					height: 100%;
					background: linear-gradient(
						180deg,
						transparent 0%,
						rgba(100, 100, 150, 0.3) 20%,
						rgba(100, 100, 150, 0.3) 80%,
						transparent 100%
					);
					position: relative;
					transition: var(--transition-fast);
					border-radius: 2px;
				}

				.dm-trigger-line.active {
					background: linear-gradient(
						180deg,
						transparent 0%,
						rgba(255, 68, 68, 0.5) 20%,
						rgba(255, 68, 68, 0.5) 80%,
						transparent 100%
					);
				}

				.dm-trigger-pulse {
					position: absolute;
					inset: -2px;
					background: rgba(255, 68, 68, 0.3);
					border-radius: 4px;
					animation: pulse 1.5s ease-in-out infinite;
				}

				@keyframes pulse {
					0%, 100% { opacity: 0.3; transform: scale(1); }
					50% { opacity: 0.6; transform: scale(1.1); }
				}

				.dm-trigger-tooltip {
					position: absolute;
					right: 12px;
					top: 50%;
					transform: translateY(-50%);
					display: flex;
					align-items: center;
					gap: 4px;
					padding: 4px 8px;
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					color: var(--text-tertiary);
					font-size: var(--text-xs);
					font-weight: var(--font-semibold);
					letter-spacing: var(--tracking-wider);
					opacity: 0;
					pointer-events: none;
					transition: var(--transition-fast);
					white-space: nowrap;
					border-radius: var(--radius-sm);
				}

				.dm-edge-trigger:hover .dm-trigger-tooltip {
					opacity: 1;
					right: 16px;
				}

				.dm-edge-trigger:hover .dm-trigger-line {
					width: 4px;
					background: linear-gradient(
						180deg,
						transparent 0%,
						rgba(74, 158, 255, 0.5) 20%,
						rgba(74, 158, 255, 0.5) 80%,
						transparent 100%
					);
				}

				/* ========== 抽屉面板 ========== */
				.dm-drawer {
					position: absolute;
					right: 8px;
					top: 50%;
					transform: translateY(-50%);
					display: flex;
					align-items: center;
					gap: var(--space-2);
					padding: var(--space-3);
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					border-right: none;
					border-radius: var(--radius-sm) 0 0 var(--radius-sm);
					box-shadow: -4px 0 16px rgba(0, 0, 0, 0.3);
					pointer-events: auto;
				}

				/* ========== 切换按钮 ========== */
				.dm-toggle-btn {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					padding: var(--space-2) var(--space-3);
					background: rgba(40, 50, 70, 0.6);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-sm);
					color: var(--text-secondary);
					font-family: var(--font-body);
					font-size: var(--text-xs);
					font-weight: var(--font-medium);
					letter-spacing: var(--tracking-wide);
					text-transform: uppercase;
					cursor: pointer;
					transition: var(--transition-fast);
					white-space: nowrap;
				}

				.dm-toggle-btn:hover:not(:disabled) {
					background: rgba(74, 158, 255, 0.15);
					border-color: rgba(74, 158, 255, 0.4);
					color: var(--color-primary);
				}

				.dm-toggle-btn.active {
					background: rgba(255, 68, 68, 0.15);
					border-color: rgba(255, 68, 68, 0.4);
					color: var(--color-danger);
				}

				.dm-toggle-btn.active:hover:not(:disabled) {
					background: rgba(255, 68, 68, 0.25);
					border-color: rgba(255, 68, 68, 0.6);
				}

				.dm-toggle-btn:disabled {
					opacity: 0.6;
					cursor: not-allowed;
				}

				.dm-btn-text {
					min-width: 60px;
					text-align: center;
				}

				.dm-status-dot {
					width: 6px;
					height: 6px;
					border-radius: var(--radius-full);
					transition: var(--transition-fast);
				}

				.dm-status-dot.on {
					background: var(--color-danger);
					box-shadow: 0 0 6px var(--color-danger-glow);
					animation: blink 1.5s ease-in-out infinite;
				}

				.dm-status-dot.off {
					background: var(--text-tertiary);
				}

				@keyframes blink {
					0%, 100% { opacity: 1; }
					50% { opacity: 0.4; }
				}

				.dm-loading-spinner {
					width: 14px;
					height: 14px;
					border: 2px solid rgba(74, 158, 255, 0.2);
					border-top-color: var(--color-primary);
					border-radius: var(--radius-full);
					animation: spin 0.8s linear infinite;
				}

				@keyframes spin {
					to { transform: rotate(360deg); }
				}

				/* ========== 关闭按钮 ========== */
				.dm-close-btn {
					width: 20px;
					height: 20px;
					display: flex;
					align-items: center;
					justify-content: center;
					background: transparent;
					border: 1px solid var(--border-color);
					border-radius: var(--radius-sm);
					color: var(--text-tertiary);
					font-size: 14px;
					cursor: pointer;
					transition: var(--transition-fast);
					padding: 0;
					line-height: 1;
				}

				.dm-ops-panel {
					margin-top: 8px;
					display: grid;
					grid-template-columns: 1fr 1fr;
					gap: 6px;
				}

				.dm-op-btn {
					background: rgba(26, 26, 32, 0.95);
					border: 1px solid rgba(120, 120, 180, 0.4);
					color: rgba(210, 210, 255, 0.9);
					font-size: 11px;
					padding: 6px 8px;
					cursor: pointer;
					transition: var(--transition-fast);
				}

				.dm-op-btn:hover {
					border-color: rgba(130, 220, 255, 0.8);
					color: rgba(240, 255, 255, 0.95);
				}

				.dm-close-btn:hover {
					background: rgba(255, 68, 68, 0.1);
					border-color: rgba(255, 68, 68, 0.3);
					color: var(--color-danger);
				}

				/* 响应式 */
				@media (min-width: 2560px) {
					.dm-edge-trigger {
						height: 100px;
					}

					.dm-toggle-btn {
						padding: var(--space-3) var(--space-4);
						font-size: var(--text-sm);
					}

					.dm-btn-text {
						min-width: 80px;
					}
				}
			`}</style>
		</div>
	);
};

export default DMToggleButton;
