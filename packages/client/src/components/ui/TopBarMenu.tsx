/**
 * 顶栏菜单组件
 * 保持现有不透明风格，缩放指示器移至中央并改为表尺风格
 * 集成阵营回合指示器
 */

import { AnimatePresence, motion } from "framer-motion";
import { Globe, LogOut, Menu, RotateCcw, Settings, User, Volume2, VolumeX } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RulerZoomIndicator } from "@/features/ui/RulerZoomIndicator";
import { FactionTurnIndicator } from "@/features/ui/FactionTurnIndicator";
import { useAppSelector } from "@/store";

interface TopBarMenuProps {
	onDisconnect?: () => void;
	playerName?: string;
	// 缩放控制 props
	zoom?: number;
	minZoom?: number;
	maxZoom?: number;
	onZoomIn?: () => void;
	onZoomOut?: () => void;
	onReset?: () => void;
}

export const TopBarMenu: React.FC<TopBarMenuProps> = ({
	onDisconnect,
	playerName = "Player",
	// 缩放控制 props
	zoom = 1,
	minZoom = 0.5,
	maxZoom = 4,
	onZoomIn,
	onZoomOut,
	onReset,
}) => {
	const { t, i18n } = useTranslation();
	const [isMenuOpen, setIsMenuOpen] = useState(false);
	const [isMuted, setIsMuted] = useState(false);
	// 缩放方向状态：true = 正常（向上放大），false = 翻转（向下放大）
	const [invertZoomDirection, setInvertZoomDirection] = useState(() => {
		const saved = localStorage.getItem("zoomDirection");
		return saved === "inverted";
	});

	// 获取阵营回合初始化状态
	const isFactionTurnInitialized = useAppSelector(
		(state) => state.factionTurn?.isInitialized ?? false
	);

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		document.documentElement.lang = lng;
		localStorage.setItem("i18nextLng", lng);
	};

	const currentLanguage = i18n.language || "en-US";
	const isChinese = currentLanguage === "zh-CN";

	// 处理缩放方向切换
	const toggleZoomDirection = () => {
		const newValue = !invertZoomDirection;
		setInvertZoomDirection(newValue);
		localStorage.setItem("zoomDirection", newValue ? "inverted" : "normal");

		// 触发自定义事件通知 GameCanvas
		window.dispatchEvent(new CustomEvent("game-zoom-direction", {
			detail: { inverted: newValue }
		}));
	};

	return (
		<div className="top-bar-menu">
			{/* 左侧：菜单按钮 + 标题 */}
			<div className="top-bar-left">
				<button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} type="button">
					<Menu size={18} />
				</button>

				<span className="game-title">STFCS</span>
			</div>

			{/* 中央：阵营回合指示器 + 表尺缩放指示器 */}
			<div className="top-bar-center">
				{/* 阵营回合指示器 */}
				{isFactionTurnInitialized && <FactionTurnIndicator />}

				{/* 表尺缩放指示器 */}
				{onZoomIn && onZoomOut && onReset && (
					<RulerZoomIndicator
						zoom={zoom}
						minZoom={minZoom}
						maxZoom={maxZoom}
						onZoomIn={onZoomIn}
						onZoomOut={onZoomOut}
						onReset={onReset}
					/>
				)}
			</div>

			{/* 右侧：设置 + 玩家信息 + 断开连接 */}
			<div className="top-bar-right">
				{/* 设置按钮 - 打开菜单 */}
				<button 
					className="top-bar-btn"
					onClick={() => setIsMenuOpen(true)}
					title={t("game.settings")}
					type="button"
				>
					<Settings size={16} />
				</button>

				{/* 玩家信息 */}
				<div className="player-info">
					<User size={16} />
					<span className="player-name">{playerName}</span>
				</div>

				{/* 断开连接按钮 */}
				{onDisconnect && (
					<button className="disconnect-button" onClick={onDisconnect} type="button">
						<LogOut size={16} />
						<span>{t("game.disconnect") || "Disconnect"}</span>
					</button>
				)}
			</div>

			{/* 弹出菜单 - 居中显示 */}
			<AnimatePresence>
				{isMenuOpen && (
					<motion.div
						className="menu-overlay"
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						onClick={() => setIsMenuOpen(false)}
					>
						<motion.div
							className="menu-panel menu-panel--center"
							initial={{ scale: 0.9, opacity: 0, y: -20 }}
							animate={{ scale: 1, opacity: 1, y: 0 }}
							exit={{ scale: 0.9, opacity: 0, y: -20 }}
							transition={{ type: "spring", damping: 25, stiffness: 500 }}
							onClick={(e) => e.stopPropagation()}
						>
							<div className="menu-header">
								<h3>{t("game.settings") || "Settings"}</h3>
								<button className="close-menu" onClick={() => setIsMenuOpen(false)} type="button">
									×
								</button>
							</div>

							<div className="menu-content">
								<div className="menu-section">
									<div className="section-title">
										<Settings size={16} />
										<span>{t("game.settings") || "Settings"}</span>
									</div>

									<div className="menu-item">
										<Globe size={16} />
										<span>{t("game.language") || "Language"}</span>
										<div className="lang-toggle-wrapper">
											<span className="lang-label">{isChinese ? "中文" : "EN"}</span>
											<button
												className="toggle-switch"
												onClick={() => changeLanguage(isChinese ? "en-US" : "zh-CN")}
												type="button"
											>
												<div className={`toggle-inner ${isChinese ? "on" : "off"}`} />
											</button>
										</div>
									</div>

									<div className="menu-item">
										<RotateCcw size={16} />
										<span>{t("zoom.direction") || "Invert Zoom"}</span>
										<button
											className="toggle-switch"
											onClick={toggleZoomDirection}
											type="button"
										>
											<div className={`toggle-inner ${invertZoomDirection ? "on" : "off"}`} />
										</button>
									</div>

									<div className="menu-item">
										{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
										<span>{isMuted ? t("menu.unmute") : t("menu.mute")}</span>
										<button
											className="toggle-switch"
											onClick={() => setIsMuted(!isMuted)}
											type="button"
										>
											<div className={`toggle-inner ${isMuted ? "off" : "on"}`} />
										</button>
									</div>
								</div>

								{onDisconnect && (
									<div className="menu-section">
										<div className="menu-item danger" onClick={onDisconnect}>
											<LogOut size={16} />
											<span>{t("game.disconnect") || "Disconnect"}</span>
										</div>
									</div>
								)}
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<style>{`
				.top-bar-menu {
					position: fixed;
					top: 0;
					left: 0;
					right: 0;
					height: var(--header-height);
					background: var(--bg-hud);
					border-bottom: 1px solid var(--border-color);
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 0 var(--space-4);
					z-index: var(--z-fixed);
				}

				.top-bar-left {
					display: flex;
					align-items: center;
					gap: var(--space-3);
					flex-shrink: 0;
				}

				.top-bar-center {
					flex: 1;
					display: flex;
					align-items: center;
					justify-content: center;
					min-width: 0;
					padding: 0 var(--space-4);
				}

				.top-bar-right {
					display: flex;
					align-items: center;
					gap: var(--space-3);
					flex-shrink: 0;
				}

				.menu-toggle {
					background: transparent;
					border: 1px solid var(--border-color);
					color: var(--text-primary);
					padding: var(--space-2);
					border-radius: var(--radius-sm);
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: var(--transition-fast);
				}

				.menu-toggle:hover {
					background: var(--bg-hover);
					border-color: var(--border-color-hover);
				}

				.game-title {
					font-size: var(--text-lg);
					font-weight: var(--font-bold);
					color: var(--text-primary);
					letter-spacing: var(--tracking-wide);
					font-family: var(--font-display);
				}

				.top-bar-btn {
					background: transparent;
					border: 1px solid var(--border-color);
					color: var(--text-primary);
					padding: var(--space-2);
					border-radius: var(--radius-sm);
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: var(--transition-fast);
				}

				.top-bar-btn:hover {
					background: var(--bg-hover);
					border-color: var(--border-color-hover);
				}

				.player-info {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					background: rgba(40, 40, 80, 0.5);
					padding: var(--space-2) var(--space-3);
					border-radius: var(--radius-sm);
					border: 1px solid var(--border-color);
					color: var(--text-primary);
				}

				.player-name {
					font-size: var(--text-sm);
					font-weight: var(--font-medium);
				}

				.disconnect-button {
					background: rgba(239, 68, 68, 0.1);
					border: 1px solid rgba(239, 68, 68, 0.3);
					color: var(--color-danger);
					padding: var(--space-2) var(--space-3);
					border-radius: var(--radius-sm);
					cursor: pointer;
					display: flex;
					align-items: center;
					gap: var(--space-2);
					font-size: var(--text-sm);
					font-weight: var(--font-medium);
					transition: var(--transition-fast);
				}

				.disconnect-button:hover {
					background: rgba(239, 68, 68, 0.2);
					border-color: rgba(239, 68, 68, 0.5);
				}

				/* 菜单样式 */
				.menu-overlay {
					position: fixed;
					top: var(--header-height);
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0, 0, 0, 0.6);
					z-index: calc(var(--z-fixed) + 1);
					backdrop-filter: blur(4px);
					display: flex;
					align-items: flex-start;
					justify-content: center;
					padding-top: var(--space-10);
				}

				.menu-panel {
					width: clamp(320px, 30vw, 360px);
					max-height: calc(100vh - var(--header-height) - var(--space-20));
					background: var(--bg-hud);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-md);
					overflow-y: auto;
					box-shadow: var(--shadow-lg);
				}

				.menu-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: var(--space-4);
					border-bottom: 1px solid var(--border-color);
				}

				.menu-header h3 {
					margin: 0;
					font-size: var(--text-base);
					font-weight: var(--font-semibold);
					color: var(--text-primary);
				}

				.close-menu {
					background: transparent;
					border: none;
					color: var(--text-tertiary);
					font-size: var(--text-xl);
					cursor: pointer;
					padding: 0;
					width: var(--height-md);
					height: var(--height-md);
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: var(--radius-sm);
					transition: var(--transition-fast);
				}

				.close-menu:hover {
					background: var(--bg-hover);
					color: var(--text-primary);
				}

				.menu-content {
					padding: var(--space-4);
				}

				.menu-section {
					margin-bottom: var(--space-6);
				}

				.section-title {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					font-size: var(--text-xs);
					font-weight: var(--font-semibold);
					color: var(--text-tertiary);
					text-transform: uppercase;
					letter-spacing: var(--tracking-wide);
					margin-bottom: var(--space-3);
				}

				.menu-item {
					display: flex;
					align-items: center;
					gap: var(--space-3);
					padding: var(--space-3);
					background: rgba(40, 40, 80, 0.3);
					border-radius: var(--radius-sm);
					margin-bottom: var(--space-2);
					cursor: pointer;
					transition: var(--transition-fast);
					color: var(--text-primary);
				}

				.menu-item:hover {
					background: rgba(40, 40, 80, 0.5);
				}

				.menu-item.danger {
					background: rgba(239, 68, 68, 0.1);
					border: 1px solid rgba(239, 68, 68, 0.2);
					color: var(--color-danger);
				}

				.menu-item.danger:hover {
					background: rgba(239, 68, 68, 0.15);
					border-color: rgba(239, 68, 68, 0.4);
				}

				.menu-item span {
					flex: 1;
					font-size: var(--text-sm);
				}

				.lang-toggle-wrapper {
					display: flex;
					align-items: center;
					gap: var(--space-2);
				}

				.lang-label {
					font-size: var(--text-xs);
					color: var(--text-secondary);
					font-weight: var(--font-medium);
					min-width: 28px;
					text-align: center;
				}

				.toggle-switch {
					width: 40px;
					height: 20px;
					background: rgba(100, 100, 150, 0.3);
					border-radius: var(--radius-full);
					border: none;
					cursor: pointer;
					position: relative;
					padding: 0;
				}

				.toggle-inner {
					position: absolute;
					top: 2px;
					left: 2px;
					width: 16px;
					height: 16px;
					background: var(--text-tertiary);
					border-radius: var(--radius-full);
					transition: var(--transition-fast);
				}

				.toggle-inner.on {
					left: calc(100% - 18px);
					background: var(--color-success);
				}

				.toggle-inner.off {
					left: 2px;
					background: var(--text-tertiary);
				}

				/* 响应式 */
				@media (max-width: 768px) {
					.top-bar-center {
						display: none;
					}

					.game-title {
						font-size: 12px;
					}

					.player-name {
						display: none;
					}
				}
			`}</style>
		</div>
	);
};

export default TopBarMenu;
