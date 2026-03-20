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
import { websocketService } from "@/services/websocket";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";

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

	// 消息状态
	const [messages, setMessages] = useState<ChatMessage[]>([
		{ id: "1", type: "system", content: t("chat.welcome"), timestamp: Date.now() - 3600000 },
	]);

	const [combatEvents, setCombatEvents] = useState<CombatEvent[]>([]);

	// 监听WebSocket消息
	useEffect(() => {
		// 聊天消息处理
		const handleChatMessage = (payload: unknown) => {
			const msg = payload as { playerId?: string; playerName?: string; content: string; timestamp?: number };
			setMessages(prev => [...prev, {
				id: `chat-${Date.now()}`,
				type: "chat",
				senderId: msg.playerId,
				senderName: msg.playerName || 'Unknown',
				content: msg.content,
				timestamp: msg.timestamp || Date.now(),
			}]);
		};

		// 玩家加入处理
		const handlePlayerJoined = (payload: unknown) => {
			const data = payload as { playerName?: string };
			setMessages(prev => [...prev, {
				id: `join-${Date.now()}`,
				type: "join",
				senderName: data.playerName || 'Player',
				content: '',
				timestamp: Date.now(),
			}]);
		};

		// 玩家离开处理
		const handlePlayerLeft = (payload: unknown) => {
			const data = payload as { playerName?: string };
			setMessages(prev => [...prev, {
				id: `leave-${Date.now()}`,
				type: "leave",
				senderName: data.playerName || 'Player',
				content: '',
				timestamp: Date.now(),
			}]);
		};

		// 武器开火处理
		const handleWeaponFired = (payload: unknown) => {
			const data = payload as {
				sourceShipId?: string;
				targetShipId?: string;
				hit?: boolean;
				damage?: number;
				timestamp?: number;
			};
			setCombatEvents(prev => [...prev, {
				id: `fire-${Date.now()}`,
				type: "attack",
				actor: data.sourceShipId,
				target: data.targetShipId,
				content: `${data.sourceShipId || 'Unknown'} fired at ${data.targetShipId || 'Unknown'}${data.hit ? ' (Hit!)' : ' (Miss)'}`,
				timestamp: data.timestamp || Date.now(),
			}]);
		};

		// 伤害处理
		const handleDamageDealt = (payload: unknown) => {
			const data = payload as {
				targetShipId?: string;
				damage?: number;
				shieldAbsorbed?: number;
				hullDamage?: number;
				timestamp?: number;
			};
			setCombatEvents(prev => [...prev, {
				id: `dmg-${Date.now()}`,
				type: "damage",
				target: data.targetShipId,
				content: `${data.targetShipId || 'Target'} took ${data.damage || 0} damage (Shield: ${data.shieldAbsorbed || 0}, Hull: ${data.hullDamage || 0})`,
				timestamp: data.timestamp || Date.now(),
			}]);
		};

		// 回合结算处理
		const handleTurnResolution = (payload: unknown) => {
			const data = payload as { roundNumber?: number };
			setCombatEvents(prev => [...prev, {
				id: `turn-${Date.now()}`,
				type: "turn",
				content: `Round ${data.roundNumber || 1} resolved`,
				timestamp: Date.now(),
			}]);
		};

		// 注册消息处理器
		websocketService.on('CHAT_MESSAGE', handleChatMessage);
		websocketService.on('PLAYER_JOINED', handlePlayerJoined);
		websocketService.on('PLAYER_LEFT', handlePlayerLeft);
		websocketService.on('WEAPON_FIRED', handleWeaponFired);
		websocketService.on('DAMAGE_DEALT', handleDamageDealt);
		websocketService.on('TURN_RESOLUTION', handleTurnResolution);

		return () => {
			websocketService.off('CHAT_MESSAGE', handleChatMessage);
			websocketService.off('PLAYER_JOINED', handlePlayerJoined);
			websocketService.off('PLAYER_LEFT', handlePlayerLeft);
			websocketService.off('WEAPON_FIRED', handleWeaponFired);
			websocketService.off('DAMAGE_DEALT', handleDamageDealt);
			websocketService.off('TURN_RESOLUTION', handleTurnResolution);
		};
	}, []);

	// 自动滚动到底部
	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [messages, combatEvents, activeTab]);

	// 发送消息
	const handleSendMessage = useCallback(() => {
		if (!inputMessage.trim() || !currentPlayer) return;

		// 发送到服务器
		websocketService.send({
			type: WS_MESSAGE_TYPES.CHAT_MESSAGE,
			payload: {
				senderId: currentPlayerId || '',
				senderName: currentPlayer.name,
				content: inputMessage.trim(),
				timestamp: Date.now(),
			},
		});

		setInputMessage("");
	}, [inputMessage, currentPlayer, currentPlayerId]);

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