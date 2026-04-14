/**
 * 右侧面板 Tab 系统
 *
 * 提供多个功能面板的切换：
 * - 聊天
 * - 玩家列表
 * - 战斗日志
 * - 设置
 */

import type { Room } from "@colyseus/sdk";
import type { GameRoomState } from "@vt/types";
import { FileText, MessageCircle, Settings, Users } from "lucide-react";
import React, { useState } from "react";
import { ChatPanel } from "./ChatPanel";

type TabId = "chat" | "players" | "log" | "settings";

interface TabDefinition {
	id: TabId;
	label: string;
	Icon: React.ComponentType<{ className?: string }>;
	badge?: number;
}

interface RightPanelTabsProps {
	room: Room<GameRoomState> | null;
	playerName: string;
	onShowPlayerRoster?: () => void;
	onShowSettings?: () => void;
	playerCount?: number;
	unreadChatCount?: number;
}

export const RightPanelTabs: React.FC<RightPanelTabsProps> = ({
	room,
	playerName,
	onShowPlayerRoster,
	onShowSettings,
	playerCount,
	unreadChatCount,
}) => {
	const [activeTab, setActiveTab] = useState<TabId>("chat");

	const tabs: TabDefinition[] = [
		{ id: "chat", label: "聊天", Icon: MessageCircle, badge: unreadChatCount },
		{ id: "players", label: "玩家", Icon: Users, badge: playerCount },
		{ id: "log", label: "日志", Icon: FileText },
		{ id: "settings", label: "设置", Icon: Settings },
	];

	const renderTabContent = () => {
		switch (activeTab) {
			case "chat":
				return (
					<div className="right-panel__content">
						<ChatPanel room={room} playerName={playerName} />
					</div>
				);

			case "players":
				return (
					<div className="right-panel__empty">
						<Users className="game-icon--xl game-icon--primary" />
						<div className="right-panel__empty-title">玩家列表</div>
						<button
							data-magnetic
							className="game-btn game-btn--primary"
							onClick={onShowPlayerRoster}
						>
							查看玩家列表
						</button>
					</div>
				);

			case "log":
				return (
					<div className="right-panel__empty">
						<FileText className="game-icon--xl game-icon--muted" />
						<div className="right-panel__empty-hint">战斗日志功能开发中...</div>
					</div>
				);

			case "settings":
				return (
					<div className="right-panel__empty">
						<Settings className="game-icon--xl game-icon--primary" />
						<div className="right-panel__empty-title">游戏设置</div>
						<button data-magnetic className="game-btn game-btn--primary" onClick={onShowSettings}>
							打开设置菜单
						</button>
					</div>
				);

			default:
				return null;
		}
	};

	return (
		<div className="right-panel">
			<div className="right-panel__tabs">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						data-magnetic
						className={`right-panel__tab ${activeTab === tab.id ? "right-panel__tab--active" : ""}`}
						onClick={() => setActiveTab(tab.id)}
					>
						<tab.Icon className="game-icon--sm" />
						{tab.label}
						{tab.badge !== undefined && tab.badge > 0 && (
							<span className="right-panel__badge">{tab.badge}</span>
						)}
					</button>
				))}
			</div>
			<div className="right-panel__body">{renderTabContent()}</div>
		</div>
	);
};

export default RightPanelTabs;
