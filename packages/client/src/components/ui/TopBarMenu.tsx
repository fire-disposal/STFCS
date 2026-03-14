import { TopZoomIndicator } from "@/features/ui/TopZoomIndicator";
import { AnimatePresence, motion } from "framer-motion";
import { Globe, LogOut, Menu, Settings, User, Volume2, VolumeX } from "lucide-react";
import React, { useState } from "react";
import { useTranslation } from "react-i18next";

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

	const changeLanguage = (lng: string) => {
		i18n.changeLanguage(lng);
		document.documentElement.lang = lng;
		localStorage.setItem("i18nextLng", lng);
	};

	const currentLanguage = i18n.language || "en-US";
	const isChinese = currentLanguage === "zh-CN";

	return (
		<div className="top-bar-menu">
			{/* 左侧菜单按钮 + 缩放指示器 */}
			<div className="top-bar-left">
				<button className="menu-toggle" onClick={() => setIsMenuOpen(!isMenuOpen)} type="button">
					<Menu size={18} />
				</button>

				<span className="game-title">STFCS</span>

				{/* 缩放指示器 - 集成在顶栏 */}
				{onZoomIn && onZoomOut && onReset && (
					<div className="top-bar-zoom">
						<TopZoomIndicator
							zoom={zoom}
							minZoom={minZoom}
							maxZoom={maxZoom}
							onZoomIn={onZoomIn}
							onZoomOut={onZoomOut}
							onReset={onReset}
						/>
					</div>
				)}
			</div>

			{/* 右侧功能区 */}
			<div className="top-bar-right">
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
										{isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
										<span>{isMuted ? "Unmute" : "Mute"}</span>
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
		</div>
	);
};
