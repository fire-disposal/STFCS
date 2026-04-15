/**
 * 聊天面板组件
 *
 * 显示在右侧面板区域，提供：
 * - 聊天消息显示
 * - 消息发送
 * - 系统消息集成
 *
 * 性能优化：
 * - 只渲染最近 50 条消息
 * - 自动滚动优化
 */

import { useGameStore } from "@/state/stores";
import type { ChatMessage } from "@/sync/types";
import type { Room } from "@colyseus/sdk";
import type { GameRoomState } from "@/sync/types";
import React, { useState, useRef, useEffect } from "react";

const MAX_MESSAGES = 50; // 最多显示 50 条

const styles = {
	container: {
		display: "flex",
		flexDirection: "column" as const,
		height: "100%",
		backgroundColor: "rgba(6, 16, 26, 0.95)",
		borderRadius: "8px",
		border: "1px solid #2b4261",
		overflow: "hidden",
	},
	header: {
		padding: "12px 16px",
		backgroundColor: "rgba(26, 45, 66, 0.9)",
		borderBottom: "1px solid #2b4261",
		display: "flex",
		alignItems: "center",
		justifyContent: "space-between",
	},
	title: {
		fontSize: "13px",
		fontWeight: "bold" as const,
		color: "#cfe8ff",
		display: "flex",
		alignItems: "center",
		gap: "8px",
	},
	unreadBadge: {
		backgroundColor: "#4a9eff",
		color: "white",
		fontSize: "10px",
		fontWeight: "bold" as const,
		padding: "2px 6px",
		borderRadius: "10px",
		minWidth: "18px",
		textAlign: "center" as const,
	},
	messageList: {
		flex: 1,
		overflowY: "auto" as const,
		padding: "12px",
		display: "flex",
		flexDirection: "column" as const,
		gap: "8px",
	},
	message: {
		padding: "8px 12px",
		backgroundColor: "rgba(20, 30, 40, 0.6)",
		borderRadius: "4px",
		border: "1px solid rgba(74, 158, 255, 0.2)",
	},
	messageSystem: {
		backgroundColor: "rgba(74, 158, 255, 0.15)",
		border: "1px solid rgba(74, 158, 255, 0.3)",
	},
	messageCombat: {
		backgroundColor: "rgba(255, 100, 100, 0.1)",
		border: "1px solid rgba(255, 100, 100, 0.3)",
	},
	messageHeader: {
		display: "flex",
		alignItems: "center",
		gap: "8px",
		marginBottom: "4px",
	},
	senderName: {
		fontSize: "11px",
		fontWeight: "bold" as const,
		color: "#4a9eff",
	},
	timestamp: {
		fontSize: "9px",
		color: "#6b7280",
	},
	messageContent: {
		fontSize: "12px",
		color: "#cfe8ff",
		lineHeight: 1.4,
		wordBreak: "break-word" as const,
	},
	inputArea: {
		padding: "12px",
		backgroundColor: "rgba(20, 30, 40, 0.8)",
		borderTop: "1px solid #2b4261",
		display: "flex",
		gap: "8px",
	},
	input: {
		flex: 1,
		padding: "10px 12px",
		backgroundColor: "rgba(0, 0, 0, 0.5)",
		border: "1px solid #2b4261",
		borderRadius: "0",
		color: "#cfe8ff",
		fontSize: "12px",
		outline: "none",
	},
	button: {
		padding: "10px 16px",
		backgroundColor: "#1a4a7a",
		border: "1px solid #4a9eff",
		borderRadius: "0",
		color: "#4a9eff",
		fontSize: "12px",
		fontWeight: "bold" as const,
		cursor: "pointer",
		transition: "all 0.2s",
	},
	emptyState: {
		padding: "24px",
		textAlign: "center" as const,
		color: "#6b7280",
		fontSize: "12px",
	},
};

interface ChatPanelProps {
	room: Room<GameRoomState> | null;
	playerName: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({ room, playerName }) => {
	const chatMessages = useGameStore((state) => state.chatMessages);
	const addChatMessage = useGameStore((state) => state.addChatMessage);
	const [messageInput, setMessageInput] = useState("");
	const messagesEndRef = useRef<HTMLDivElement>(null);

	const scrollToBottom = () => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	};

	useEffect(() => {
		scrollToBottom();
	}, [chatMessages]);

	useEffect(() => {
		if (!room) return;

		room.onMessage("chat", (payload: { senderId: string; senderName: string; content: string }) => {
			addChatMessage({
				id: `msg_${Date.now()}_${Math.random()}`,
				senderId: payload.senderId,
				senderName: payload.senderName,
				content: payload.content,
				timestamp: Date.now(),
				type: "chat" as any,
			});
		});

		room.onMessage("system", (payload: { message: string }) => {
			addChatMessage({
				id: `sys_${Date.now()}`,
				senderId: "system",
				senderName: "系统",
				content: payload.message,
				timestamp: Date.now(),
				type: "system" as any,
			});
		});

		return () => {};
	}, [room, addChatMessage]);

	const handleSendMessage = () => {
		const content = messageInput.trim();
		if (!content || !room) return;

		try {
			room.send("chat", { content, playerName });

			addChatMessage({
				id: `msg_${Date.now()}`,
				senderId: "local",
				senderName: playerName,
				content,
				timestamp: Date.now(),
				type: "chat" as any,
			});

			setMessageInput("");
		} catch (error) {
			console.error("[Chat] Failed to send message:", error);
		}
	};

	// 处理键盘事件
	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	// 格式化时间
	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString("zh-CN", {
			hour: "2-digit",
			minute: "2-digit",
		});
	};

	// 获取消息样式
	const getMessageStyle = (message: any) => {
		let style = { ...styles.message };
		if (message.type === "system") {
			style = { ...style, ...styles.messageSystem };
		} else if (message.type === "combat") {
			style = { ...style, ...styles.messageCombat };
		}
		return style;
	};

	return (
		<div style={styles.container}>
			{/* 头部 */}
			<div style={styles.header}>
				<div style={styles.title}>
					💬 聊天
				</div>
			</div>

			{/* 消息列表 */}
			<div style={styles.messageList}>
				{chatMessages.length === 0 ? (
					<div style={styles.emptyState}>
						暂无消息
						<br />
						<span style={{ fontSize: "10px", color: "#4a5a6a" }}>按 Enter 发送消息</span>
					</div>
				) : (
					chatMessages
						.slice(-MAX_MESSAGES)
						.map((msg) => (
							<div key={msg.id} style={getMessageStyle(msg)}>
								<div style={styles.messageHeader}>
									<span style={styles.senderName}>{msg.senderName}</span>
									<span style={styles.timestamp}>{formatTime(msg.timestamp)}</span>
								</div>
								<div style={styles.messageContent}>{msg.content}</div>
							</div>
						))
				)}
				<div ref={messagesEndRef} />
			</div>

			{/* 输入区域 */}
			<div style={styles.inputArea}>
				<input
					style={styles.input}
					type="text"
					value={messageInput}
					onChange={(e) => setMessageInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="输入消息... (Enter 发送)"
					maxLength={200}
					disabled={!room}
				/>
				<button
					style={styles.button}
					onClick={handleSendMessage}
					disabled={!room || !messageInput.trim()}
				>
					发送
				</button>
			</div>
		</div>
	);
};

export default ChatPanel;
