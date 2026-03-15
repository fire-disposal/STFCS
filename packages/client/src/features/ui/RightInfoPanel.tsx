/**
 * 右侧信息面板组件
 * 包含三个标签页：聊天 / 战斗 / 全部
 * 复用战斗日志样式，统一科幻风格
 */

import React, { useState, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/store";
import { MessageSquare, Swords, Layers, Send, User, LogIn, LogOut } from "lucide-react";

interface ChatMessage {
	id: string;
	type: "chat" | "system" | "join" | "leave";
	senderId?: string;
	senderName?: string;
	content: string;
	timestamp: number;
}

interface CombatEvent {
	id: string;
	type: "attack" | "damage" | "shield" | "move" | "turn" | "system";
	actor?: string;
	target?: string;
	content: string;
	timestamp: number;
}

type TabType = "chat" | "combat" | "all";

interface RightInfoPanelProps {
	className?: string;
}

export const RightInfoPanel: React.FC<RightInfoPanelProps> = ({ className = "" }) => {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<TabType>("all");
	const [inputMessage, setInputMessage] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 从Redux获取玩家信息
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const players = useAppSelector((state) => state.player.players);
	const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;

	// 模拟数据 - 实际应从Redux或WebSocket获取
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ id: "1", type: "system", content: t("chat.welcome"), timestamp: Date.now() - 3600000 },
		{ id: "2", type: "join", senderName: "Player1", content: "", timestamp: Date.now() - 3000000 },
		{ id: "3", type: "chat", senderId: "p1", senderName: "Player1", content: "准备开始战斗！", timestamp: Date.now() - 2400000 },
		{ id: "4", type: "chat", senderId: "p2", senderName: "Player2", content: "收到，正在部署舰队。", timestamp: Date.now() - 1800000 },
		{ id: "5", type: "system", content: t("combat.roundStart", { round: 1 }), timestamp: Date.now() - 1200000 },
	]);

	const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([
		{ id: "c1", type: "turn", content: t("combat.turnStart", { unit: "企业号" }), timestamp: Date.now() - 600000 },
		{ id: "c2", type: "move", actor: "企业号", content: t("combat.moved", { distance: "500km" }), timestamp: Date.now() - 550000 },
		{ id: "c3", type: "attack", actor: "企业号", target: "敌舰A", content: t("combat.fired", { weapon: "重型激光炮" }), timestamp: Date.now() - 500000 },
		{ id: "c4", type: "damage", target: "敌舰A", content: t("combat.shieldDamage", { damage: 150 }), timestamp: Date.now() - 480000 },
		{ id: "c5", type: "system", content: t("combat.shieldActive", { ship: "敌舰A" }), timestamp: Date.now() - 450000 },
	]);

	// 自动滚动到底部
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, combatEvents, activeTab]);

	// 发送消息
	const handleSendMessage = () => {
		if (!inputMessage.trim() || !currentPlayer) return;

		const newMessage: ChatMessage = {
			id: Date.now().toString(),
			type: "chat",
			senderId: currentPlayerId || undefined,
			senderName: currentPlayer.name,
			content: inputMessage.trim(),
			timestamp: Date.now(),
		};

		setMessages((prev) => [...prev, newMessage]);
		setInputMessage("");
	};

	// 格式化时间
	const formatTime = (timestamp: number): string => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString("zh-CN", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" });
	};

	// 获取所有消息（聊天+战斗，按时间排序）
	const allMessages = [...messages, ...combatEvents.map(e => ({
		id: e.id,
		type: "system" as const,
		content: e.content,
		timestamp: e.timestamp,
	}))].sort((a, b) => a.timestamp - b.timestamp);

	// 渲染标签按钮
	const renderTabButton = (tab: TabType, icon: React.ReactNode, label: string) => (
		<button
			className={`rip-tab-btn ${activeTab === tab ? "active" : ""}`}
			onClick={() => setActiveTab(tab)}
			type="button"
		>
			{icon}
			<span>{label}</span>
		</button>
	);

	// 渲染聊天消息
	const renderChatMessage = (msg: ChatMessage) => {
		const isSelf = msg.senderId === currentPlayerId;

		if (msg.type === "system") {
			return (
				<div key={msg.id} className="rip-message rip-message--system">
					<span className="rip-message-time">{formatTime(msg.timestamp)}</span>
					<span className="rip-message-content rip-message-content--system">{msg.content}</span>
				</div>
			);
		}

		if (msg.type === "join" || msg.type === "leave") {
			return (
				<div key={msg.id} className="rip-message rip-message--event">
					<span className="rip-message-time">{formatTime(msg.timestamp)}</span>
					<span className="rip-message-content rip-message-content--event">
						{msg.type === "join" ? <LogIn style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} /> : <LogOut style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} />}
						{msg.senderName} {msg.type === "join" ? t("chat.joined") : t("chat.left")}
					</span>
				</div>
			);
		}

		return (
			<div key={msg.id} className={`rip-message rip-message--chat ${isSelf ? "self" : ""}`}>
				<span className="rip-message-time">{formatTime(msg.timestamp)}</span>
				<span className="rip-message-sender">{msg.senderName}:</span>
				<span className="rip-message-content">{msg.content}</span>
			</div>
		);
	};

	// 渲染战斗事件
	const renderCombatEvent = (event: CombatEvent) => {
		const getEventIcon = () => {
			switch (event.type) {
				case "attack": return <Swords style={{ width: 'var(--icon-xs)', height: 'var(--icon-xs)' }} />;
				case "damage": return <span className="rip-event-icon rip-event-icon--damage">⚡</span>;
				case "shield": return <span className="rip-event-icon rip-event-icon--shield">🛡️</span>;
				case "move": return <span className="rip-event-icon">➤</span>;
				case "turn": return <span className="rip-event-icon">◉</span>;
				default: return <span className="rip-event-icon">•</span>;
			}
		};

		return (
			<div key={event.id} className={`rip-log-entry rip-log-entry--${event.type}`}>
				<span className="rip-log-time">{formatTime(event.timestamp)}</span>
				<span className="rip-log-icon">{getEventIcon()}</span>
				<span className="rip-log-text">{event.content}</span>
			</div>
		);
	};

	// 渲染全部消息（混合）
	const renderAllMessage = (msg: typeof allMessages[0]) => {
		// 判断是聊天消息还是战斗事件
		const isChat = messages.find(m => m.id === msg.id);
		if (isChat) {
			return renderChatMessage(isChat);
		}
		const combatEvent = combatEvents.find(e => e.id === msg.id);
		if (combatEvent) {
			return renderCombatEvent(combatEvent);
		}
		return null;
	};

	return (
		<div className={`right-info-panel ${className}`}>
			{/* 标签页头部 */}
			<div className="rip-tabs">
				{renderTabButton("chat", <MessageSquare style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />, t("panel.chat"))}
				{renderTabButton("combat", <Swords style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />, t("panel.combat"))}
				{renderTabButton("all", <Layers style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />, t("panel.all"))}
			</div>

			{/* 内容区域 */}
			<div className="rip-content">
				{/* 聊天标签 */}
				{activeTab === "chat" && (
					<div className="rip-tab-content">
						<div className="rip-messages">
							{messages.map(renderChatMessage)}
							<div ref={messagesEndRef} />
						</div>
						{/* 聊天输入 */}
						<div className="rip-chat-input">
							<input
								type="text"
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								placeholder={t("chat.typeMessage")}
								onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
							/>
							<button onClick={handleSendMessage} type="button">
								<Send style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
							</button>
						</div>
					</div>
				)}

				{/* 战斗标签 */}
				{activeTab === "combat" && (
					<div className="rip-tab-content">
						<div className="rip-combat-log">
							{combatEvents.map(renderCombatEvent)}
							<div ref={messagesEndRef} />
						</div>
					</div>
				)}

				{/* 全部标签 */}
				{activeTab === "all" && (
					<div className="rip-tab-content">
						<div className="rip-mixed-log">
							{allMessages.map(renderAllMessage)}
							<div ref={messagesEndRef} />
						</div>
						{/* 聊天输入 */}
						<div className="rip-chat-input">
							<input
								type="text"
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								placeholder={t("chat.typeMessage")}
								onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
							/>
							<button onClick={handleSendMessage} type="button">
								<Send style={{ width: 'var(--icon-sm)', height: 'var(--icon-sm)' }} />
							</button>
						</div>
					</div>
				)}
			</div>

			<style>{`
				.right-info-panel {
					width: 100%;
					height: 100%;
					display: flex;
					flex-direction: column;
					background: rgba(15, 18, 28, 0.95);
					border-left: 1px solid rgba(74, 158, 255, 0.2);
					position: relative;
					z-index: 1;
				}

				/* 标签页头部 */
				.rip-tabs {
					display: flex;
					border-bottom: 1px solid rgba(74, 158, 255, 0.2);
					background: rgba(10, 12, 20, 0.8);
				}

				.rip-tab-btn {
					flex: 1;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: var(--space-2);
					padding: var(--space-3) var(--space-2);
					background: transparent;
					border: none;
					border-bottom: 2px solid transparent;
					color: var(--text-tertiary);
					font-size: var(--text-sm);
					font-weight: var(--font-medium);
					cursor: pointer;
					transition: var(--transition-fast);
					text-transform: uppercase;
					letter-spacing: var(--tracking-wide);
				}

				.rip-tab-btn:hover {
					color: var(--text-secondary);
					background: rgba(74, 158, 255, 0.05);
				}

				.rip-tab-btn.active {
					color: var(--color-primary);
					border-bottom-color: var(--color-primary);
					background: rgba(74, 158, 255, 0.1);
				}

				/* 内容区域 */
				.rip-content {
					flex: 1;
					overflow: hidden;
					display: flex;
					flex-direction: column;
				}

				.rip-tab-content {
					flex: 1;
					display: flex;
					flex-direction: column;
					overflow: hidden;
				}

				/* 消息列表 */
				.rip-messages,
				.rip-combat-log,
				.rip-mixed-log {
					flex: 1;
					overflow-y: auto;
					padding: var(--space-3);
					display: flex;
					flex-direction: column;
					gap: var(--space-2);
				}

				/* 聊天消息样式 */
				.rip-message {
					display: flex;
					align-items: flex-start;
					gap: var(--space-2);
					padding: var(--space-2) var(--space-3);
					font-size: var(--text-sm);
					line-height: var(--leading-normal);
					border-radius: var(--radius-none);
				}

				.rip-message--system {
					background: rgba(74, 158, 255, 0.1);
					border-left: 2px solid rgba(74, 158, 255, 0.4);
				}

				.rip-message--event {
					background: rgba(100, 100, 150, 0.1);
					border-left: 2px solid rgba(100, 100, 150, 0.3);
					color: var(--text-tertiary);
				}

				.rip-message--chat {
					background: rgba(40, 50, 70, 0.3);
				}

				.rip-message--chat.self {
					background: rgba(74, 158, 255, 0.15);
					border-left: 2px solid rgba(74, 158, 255, 0.4);
				}

				.rip-message-time {
					font-family: var(--font-mono);
					font-size: var(--text-xs);
					color: var(--text-tertiary);
					min-width: 60px;
					flex-shrink: 0;
				}

				.rip-message-sender {
					font-weight: var(--font-semibold);
					color: var(--color-primary);
					margin-right: var(--space-1);
				}

				.rip-message-content {
					color: var(--text-secondary);
					flex: 1;
				}

				.rip-message-content--system {
					color: var(--text-tertiary);
					font-style: italic;
				}

				.rip-message-content--event {
					display: flex;
					align-items: center;
					gap: var(--space-1);
				}

				/* 战斗日志样式 - 复用原有风格 */
				.rip-log-entry {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					padding: var(--space-2) var(--space-3);
					background: rgba(30, 30, 60, 0.3);
					border-left: 2px solid transparent;
					font-size: var(--text-sm);
					line-height: var(--leading-normal);
					border-radius: 0;
				}

				.rip-log-entry--attack {
					border-left-color: #ff4444;
					background: rgba(255, 68, 68, 0.1);
				}

				.rip-log-entry--damage {
					border-left-color: #ffaa00;
					background: rgba(255, 170, 0, 0.1);
				}

				.rip-log-entry--shield {
					border-left-color: #4a9eff;
					background: rgba(74, 158, 255, 0.1);
				}

				.rip-log-entry--move {
					border-left-color: #00ff88;
					background: rgba(0, 255, 136, 0.1);
				}

				.rip-log-entry--turn {
					border-left-color: #ff44ff;
					background: rgba(255, 68, 255, 0.1);
				}

				.rip-log-time {
					font-family: var(--font-mono);
					font-size: var(--text-xs);
					color: var(--text-tertiary);
					min-width: 60px;
					flex-shrink: 0;
				}

				.rip-log-icon {
					display: flex;
					align-items: center;
					justify-content: center;
					width: var(--icon-md);
					color: var(--text-tertiary);
				}

				.rip-event-icon--damage {
					color: var(--color-warning);
				}

				.rip-event-icon--shield {
					color: var(--color-primary);
				}

				.rip-log-text {
					color: var(--text-secondary);
					flex: 1;
				}

				/* 聊天输入 */
				.rip-chat-input {
					display: flex;
					gap: var(--space-2);
					padding: var(--space-3);
					border-top: 1px solid rgba(74, 158, 255, 0.2);
					background: rgba(10, 12, 20, 0.8);
				}

				.rip-chat-input input {
					flex: 1;
					padding: var(--space-2) var(--space-3);
					background: rgba(0, 0, 0, 0.5);
					border: 1px solid rgba(74, 158, 255, 0.3);
					color: var(--text-secondary);
					font-size: var(--text-sm);
					border-radius: var(--radius-none);
					outline: none;
					transition: var(--transition-fast);
				}

				.rip-chat-input input:focus {
					border-color: rgba(74, 158, 255, 0.6);
					box-shadow: 0 0 8px rgba(74, 158, 255, 0.2);
				}

				.rip-chat-input button {
					width: var(--height-md);
					height: var(--height-md);
					background: rgba(74, 158, 255, 0.15);
					border: 1px solid rgba(74, 158, 255, 0.4);
					color: var(--color-primary);
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					transition: var(--transition-fast);
					border-radius: var(--radius-none);
					padding: 0;
				}

				.rip-chat-input button:hover {
					background: rgba(74, 158, 255, 0.25);
					border-color: rgba(74, 158, 255, 0.6);
					box-shadow: 0 0 8px rgba(74, 158, 255, 0.3);
				}

				/* 滚动条样式 */
				.rip-messages::-webkit-scrollbar,
				.rip-combat-log::-webkit-scrollbar,
				.rip-mixed-log::-webkit-scrollbar {
					width: 4px;
				}

				.rip-messages::-webkit-scrollbar-track,
				.rip-combat-log::-webkit-scrollbar-track,
				.rip-mixed-log::-webkit-scrollbar-track {
					background: rgba(0, 0, 0, 0.3);
				}

				.rip-messages::-webkit-scrollbar-thumb,
				.rip-combat-log::-webkit-scrollbar-thumb,
				.rip-mixed-log::-webkit-scrollbar-thumb {
					background: rgba(74, 158, 255, 0.3);
					border-radius: 0;
				}

				.rip-messages::-webkit-scrollbar-thumb:hover,
				.rip-combat-log::-webkit-scrollbar-thumb:hover,
				.rip-mixed-log::-webkit-scrollbar-thumb:hover {
					background: rgba(74, 158, 255, 0.5);
				}
			`}</style>
		</div>
	);
};

export default RightInfoPanel;
