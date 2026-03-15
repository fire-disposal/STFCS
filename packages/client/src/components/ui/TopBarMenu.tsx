/**
 * 顶栏菜单组件
 * 保持现有不透明风格，缩放指示器移至中央并改为表尺风格
 */

import { AnimatePresence, motion } from "framer-motion";
import { Globe, LogOut, Menu, RotateCcw, Settings, User, Volume2, VolumeX } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { RulerZoomIndicator } from "@/features/ui/RulerZoomIndicator";

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

			{/* 中央：表尺缩放指示器 */}
			<div className="top-bar-center">
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
										<div className="menu-language">
											<button
												className={`mini-lang ${isChinese ? "active" : ""}`}
												onClick={() => changeLanguage("zh-CN")}
												type="button"
											>
												中文
											</button>
											<button
												className={`mini-lang ${!isChinese ? "active" : ""}`}
												onClick={() => changeLanguage("en-US")}
												type="button"
											>
												English
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
					height: 48px;
					background: rgba(20, 20, 40, 0.98);
					border-bottom: 1px solid rgba(100, 100, 150, 0.3);
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 0 16px;
					z-index: 1000;
				}

				.top-bar-left {
					display: flex;
					align-items: center;
					gap: 12px;
					flex-shrink: 0;
				}

				.top-bar-center {
					flex: 1;
					display: flex;
					align-items: center;
					justify-content: center;
					min-width: 0;
					padding: 0 16px;
				}

				.top-bar-right {
					display: flex;
					align-items: center;
					gap: 12px;
					flex-shrink: 0;
				}

				.menu-toggle {
					background: transparent;
					border: 1px solid rgba(100, 100, 150, 0.3);
					color: #aaccff;
					padding: 6px 8px;
					border-radius: 2px;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;
				}

				.menu-toggle:hover {
					background: rgba(74, 158, 255, 0.1);
					border-color: rgba(74, 158, 255, 0.5);
				}

				.game-title {
					font-size: 14px;
					font-weight: 700;
					color: #aaccff;
					letter-spacing: 1px;
					font-family: 'Orbitron', sans-serif;
				}

				.top-bar-btn {
					background: transparent;
					border: 1px solid rgba(100, 100, 150, 0.3);
					color: #aaccff;
					padding: 6px;
					border-radius: 2px;
					cursor: pointer;
					display: flex;
					align-items: center;
					justify-content: center;
					transition: all 0.2s ease;
				}

				.top-bar-btn:hover {
					background: rgba(74, 158, 255, 0.1);
					border-color: rgba(74, 158, 255, 0.5);
				}

				.player-info {
					display: flex;
					align-items: center;
					gap: 6px;
					background: rgba(40, 40, 80, 0.5);
					padding: 6px 12px;
					border-radius: 2px;
					border: 1px solid rgba(100, 100, 150, 0.3);
					color: #aaccff;
				}

				.player-name {
					font-size: 12px;
					font-weight: 500;
				}

				.disconnect-button {
					background: rgba(239, 68, 68, 0.1);
					border: 1px solid rgba(239, 68, 68, 0.3);
					color: #ef4444;
					padding: 6px 12px;
					border-radius: 2px;
					cursor: pointer;
					display: flex;
					align-items: center;
					gap: 6px;
					font-size: 12px;
					font-weight: 500;
					transition: all 0.2s ease;
				}

				.disconnect-button:hover {
					background: rgba(239, 68, 68, 0.2);
					border-color: rgba(239, 68, 68, 0.5);
				}

				/* 菜单样式 */
				.menu-overlay {
					position: fixed;
					top: 48px;
					left: 0;
					right: 0;
					bottom: 0;
					background: rgba(0, 0, 0, 0.6);
					z-index: 1001;
					backdrop-filter: blur(4px);
					display: flex;
					align-items: flex-start;
					justify-content: center;
					padding-top: 40px;
				}

				.menu-panel {
					width: 360px;
					max-height: calc(100vh - 48px - 80px);
					background: rgba(20, 20, 40, 0.98);
					border: 1px solid rgba(100, 100, 150, 0.3);
					border-radius: 4px;
					overflow-y: auto;
					box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
				}

				.menu-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 16px;
					border-bottom: 1px solid rgba(100, 100, 150, 0.3);
				}

				.menu-header h3 {
					margin: 0;
					font-size: 14px;
					font-weight: 600;
					color: #aaccff;
				}

				.close-menu {
					background: transparent;
					border: none;
					color: #8a8aa8;
					font-size: 24px;
					cursor: pointer;
					padding: 0;
					width: 32px;
					height: 32px;
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: 2px;
					transition: all 0.2s ease;
				}

				.close-menu:hover {
					background: rgba(100, 100, 150, 0.1);
					color: #aaccff;
				}

				.menu-content {
					padding: 16px;
				}

				.menu-section {
					margin-bottom: 24px;
				}

				.section-title {
					display: flex;
					align-items: center;
					gap: 8px;
					font-size: 11px;
					font-weight: 600;
					color: #8a8aa8;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					margin-bottom: 12px;
				}

				.menu-item {
					display: flex;
					align-items: center;
					gap: 12px;
					padding: 10px 12px;
					background: rgba(40, 40, 80, 0.3);
					border-radius: 2px;
					margin-bottom: 8px;
					cursor: pointer;
					transition: all 0.2s ease;
					color: #aaccff;
				}

				.menu-item:hover {
					background: rgba(40, 40, 80, 0.5);
				}

				.menu-item.danger {
					background: rgba(239, 68, 68, 0.1);
					border: 1px solid rgba(239, 68, 68, 0.2);
					color: #ff8a8a;
				}

				.menu-item.danger:hover {
					background: rgba(239, 68, 68, 0.15);
					border-color: rgba(239, 68, 68, 0.4);
				}

				.menu-item span {
					flex: 1;
					font-size: 13px;
				}

				.menu-language {
					display: flex;
					gap: 4px;
				}

				.mini-lang {
					background: rgba(40, 40, 80, 0.5);
					border: 1px solid rgba(100, 100, 150, 0.3);
					color: #8a8aa8;
					padding: 4px 8px;
					font-size: 11px;
					border-radius: 2px;
					cursor: pointer;
					transition: all 0.2s ease;
				}

				.mini-lang.active {
					background: rgba(74, 158, 255, 0.2);
					border-color: rgba(74, 158, 255, 0.4);
					color: #aaccff;
				}

				.toggle-switch {
					width: 40px;
					height: 20px;
					background: rgba(100, 100, 150, 0.3);
					border-radius: 10px;
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
					background: #8a8aa8;
					border-radius: 50%;
					transition: all 0.2s ease;
				}

				.toggle-inner.on {
					left: calc(100% - 18px);
					background: #4ade80;
				}

				.toggle-inner.off {
					left: 2px;
					background: #8a8aa8;
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
