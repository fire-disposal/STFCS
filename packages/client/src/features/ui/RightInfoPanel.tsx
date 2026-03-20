/**
 * 右侧信息面板组件
 * 包含三个标签页：聊天 / 战斗 / 全部
 * 复用战斗日志样式，统一科幻风格
 * 使用设计系统CSS变量
 */

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/store";
import { MessageSquare, Swords, Layers, Send, LogIn, LogOut, Zap, Shield, Move, CircleDot } from "lucide-react";
import { useRoomState, useRoomOperations, useRoomEvent } from "@/room";
import type { RoomClient, OperationMap } from "@/room";

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
	// 房间客户端
	client: RoomClient<OperationMap> | null;
	// GameView 传递的 props
	players?: Array<{ id: string; name: string; isReady?: boolean }>;
	ownerId?: string | null;
	currentPlayerId?: string;
	isOwner?: boolean;
	onKickPlayer?: (playerId: string) => Promise<void>;
	onTransferOwner?: (newOwnerId: string) => Promise<void>;
}

export const RightInfoPanel: React.FC<RightInfoPanelProps> = ({ className = "", client }) => {
	const { t } = useTranslation();
	const [activeTab, setActiveTab] = useState<TabType>("all");
	const [inputMessage, setInputMessage] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	// 获取房间状态和操作
	const roomState = useRoomState(client);
	const ops = useRoomOperations(client);

	// 从Redux获取玩家信息
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const players = useAppSelector((state) => state.player.players);
	const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;

	// 消息状态
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ id: "1", type: "system", content: t("chat.welcome"), timestamp: Date.now() - 3600000 },
	]);

	const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([]);

	// 监听房间事件
	useRoomEvent(client, 'chat', (payload: { playerId?: string; playerName?: string; content: string; timestamp?: number }) => {
		setMessages(prev => [...prev, {
			id: `chat-${Date.now()}`,
			type: "chat",
			senderId: payload.playerId,
			senderName: payload.playerName || 'Unknown',
			content: payload.content,
			timestamp: payload.timestamp || Date.now(),
		}]);
	});

	useRoomEvent(client, 'player.joined', (payload: { playerName?: string }) => {
		setMessages(prev => [...prev, {
			id: `join-${Date.now()}`,
			type: "join",
			senderName: payload.playerName || 'Player',
			content: '',
			timestamp: Date.now(),
		}]);
	});

	useRoomEvent(client, 'player.left', (payload: { playerName?: string }) => {
		setMessages(prev => [...prev, {
			id: `leave-${Date.now()}`,
			type: "leave",
			senderName: payload.playerName || 'Player',
			content: '',
			timestamp: Date.now(),
		}]);
	});

	useRoomEvent(client, 'weapon.fired', (payload: {
		sourceShipId?: string;
		targetShipId?: string;
		hit?: boolean;
		damage?: number;
		timestamp?: number;
	}) => {
		setCombatEvents(prev => [...prev, {
			id: `fire-${Date.now()}`,
			type: "attack",
			actor: payload.sourceShipId,
			target: payload.targetShipId,
			content: `${payload.sourceShipId || 'Unknown'} fired at ${payload.targetShipId || 'Unknown'}${payload.hit ? ' (Hit!)' : ' (Miss)'}`,
			timestamp: payload.timestamp || Date.now(),
		}]);
	});

	useRoomEvent(client, 'damage.dealt', (payload: {
		targetShipId?: string;
		damage?: number;
		shieldAbsorbed?: number;
		hullDamage?: number;
		timestamp?: number;
	}) => {
		setCombatEvents(prev => [...prev, {
			id: `dmg-${Date.now()}`,
			type: "damage",
			target: payload.targetShipId,
			content: `${payload.targetShipId || 'Target'} took ${payload.damage || 0} damage (Shield: ${payload.shieldAbsorbed || 0}, Hull: ${payload.hullDamage || 0})`,
			timestamp: payload.timestamp || Date.now(),
		}]);
	});

	useRoomEvent(client, 'turn.resolution', (payload: { roundNumber?: number }) => {
		setCombatEvents(prev => [...prev, {
			id: `turn-${Date.now()}`,
			type: "turn",
			content: `Round ${payload.roundNumber || 1} resolved`,
			timestamp: Date.now(),
		}]);
	});

	// 自动滚动到底部
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, combatEvents, activeTab]);

	// 发送消息
	const handleSendMessage = useCallback(async () => {
		if (!inputMessage.trim() || !currentPlayer) return;

		// 通过房间框架发送聊天消息
		try {
			// 发送聊天事件到房间
			client?.emit('chat', {
				playerId: currentPlayerId || '',
				playerName: currentPlayer.name,
				content: inputMessage.trim(),
				timestamp: Date.now(),
			});
		} catch (error) {
			console.error('Failed to send message:', error);
		}

		setInputMessage("");
	}, [inputMessage, currentPlayer, currentPlayerId, client]);

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
			className={`info-panel-tab ${activeTab === tab ? "active" : ""}`}
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
				<div key={msg.id} className="info-panel-message info-panel-message--system">
					<span className="rip-time">{formatTime(msg.timestamp)}</span>
					<span className="rip-content rip-content--system">{msg.content}</span>
				</div>
			);
		}

		if (msg.type === "join" || msg.type === "leave") {
			return (
				<div key={msg.id} className="info-panel-message info-panel-message--event">
					<span className="rip-time">{formatTime(msg.timestamp)}</span>
					<span className="rip-content rip-content--event">
						{msg.type === "join" ? <LogIn size={12} /> : <LogOut size={12} />}
						{msg.senderName} {msg.type === "join" ? t("chat.joined") : t("chat.left")}
					</span>
				</div>
			);
		}

		return (
			<div key={msg.id} className={`info-panel-message info-panel-message--chat ${isSelf ? "info-panel-message--self" : ""}`}>
				<span className="rip-time">{formatTime(msg.timestamp)}</span>
				<span className="rip-sender">{msg.senderName}:</span>
				<span className="rip-content">{msg.content}</span>
			</div>
		);
	};

	// 渲染战斗事件
	const renderCombatEvent = (event: CombatEvent) => {
		const getEventIcon = () => {
			switch (event.type) {
				case "attack": return <Swords size={12} />;
				case "damage": return <Zap size={12} className="rip-icon rip-icon--damage" />;
				case "shield": return <Shield size={12} className="rip-icon rip-icon--shield" />;
				case "move": return <Move size={12} className="rip-icon" />;
				case "turn": return <CircleDot size={12} className="rip-icon" />;
				default: return <span className="rip-icon">•</span>;
			}
		};

		return (
			<div key={event.id} className={`info-panel-log-entry info-panel-log-entry--${event.type}`}>
				<span className="rip-time">{formatTime(event.timestamp)}</span>
				<span className="rip-icon-wrapper">{getEventIcon()}</span>
				<span className="rip-text">{event.content}</span>
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
		<div className={`rip-panel ${className}`}>
			{/* 标签页头部 */}
			<div className="rip-tabs">
				{renderTabButton("chat", <MessageSquare size={16} />, t("panel.chat"))}
				{renderTabButton("combat", <Swords size={16} />, t("panel.combat"))}
				{renderTabButton("all", <Layers size={16} />, t("panel.all"))}
			</div>

			{/* 内容区域 */}
			<div className="rip-content">
				{/* 聊天标签 */}
				{activeTab === "chat" && (
					<div className="rip-tab-content">
						<div className="rip-messages scrollbar-thin">
							{messages.map(renderChatMessage)}
							<div ref={messagesEndRef} />
						</div>
						{/* 聊天输入 */}
						<div className="info-panel-input">
							<input
								type="text"
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								placeholder={t("chat.typeMessage")}
								onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
							/>
							<button onClick={handleSendMessage} type="button" aria-label="Send message">
								<Send size={16} />
							</button>
						</div>
					</div>
				)}

				{/* 战斗标签 */}
				{activeTab === "combat" && (
					<div className="rip-tab-content">
						<div className="rip-combat-log scrollbar-thin">
							{combatEvents.map(renderCombatEvent)}
							<div ref={messagesEndRef} />
						</div>
					</div>
				)}

				{/* 全部标签 */}
				{activeTab === "all" && (
					<div className="rip-tab-content">
						<div className="rip-mixed-log scrollbar-thin">
							{allMessages.map(renderAllMessage)}
							<div ref={messagesEndRef} />
						</div>
						{/* 聊天输入 */}
						<div className="info-panel-input">
							<input
								type="text"
								value={inputMessage}
								onChange={(e) => setInputMessage(e.target.value)}
								placeholder={t("chat.typeMessage")}
								onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
							/>
							<button onClick={handleSendMessage} type="button" aria-label="Send message">
								<Send size={16} />
							</button>
						</div>
					</div>
				)}
			</div>

			<style>{`
				/* ====== 右侧信息面板 ====== */
				.rip-panel {
					width: 100%;
					height: 100%;
					display: flex;
					flex-direction: column;
					background: var(--bg-panel);
					border-left: 1px solid var(--border-color);
					position: relative;
					z-index: var(--z-base);
				}

				/* 标签页头部 */
				.rip-tabs {
					display: flex;
					border-bottom: 1px solid var(--border-color);
					background: rgba(10, 12, 20, 0.8);
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
				.rip-time {
					font-family: var(--font-mono);
					font-size: var(--text-xs);
					color: var(--text-tertiary);
					min-width: 60px;
					flex-shrink: 0;
				}

				.rip-sender {
					font-weight: var(--font-semibold);
					color: var(--color-primary);
					margin-right: var(--space-1);
				}

				.rip-content {
					color: var(--text-secondary);
					flex: 1;
				}

				.rip-content--system {
					color: var(--text-tertiary);
					font-style: italic;
				}

				.rip-content--event {
					display: flex;
					align-items: center;
					gap: var(--space-1);
				}

				/* 战斗日志样式 */
				.rip-icon-wrapper {
					display: flex;
					align-items: center;
					justify-content: center;
					width: var(--icon-md);
					color: var(--text-tertiary);
				}

				.rip-icon--damage {
					color: var(--color-warning);
				}

				.rip-icon--shield {
					color: var(--color-primary);
				}

				.rip-text {
					color: var(--text-secondary);
					flex: 1;
				}

				/* 响应式 */
				@media (max-width: 768px) {
					.rip-panel {
						font-size: var(--text-xs);
					}
				}
			`}</style>
		</div>
	);
};

export default RightInfoPanel;