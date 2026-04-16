/**
 * 聊天面板组件
 *
 * 使用本地消息管理（LocalChatMessage），不依赖 Schema
 */

import { useGameStore } from "@/state/stores";
import type { Room } from "@colyseus/sdk";
import type { GameRoomState } from "@/sync/types";
import React, { useState, useRef, useEffect } from "react";

const MAX_MESSAGES = 50;

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
	},
	title: {
		fontSize: "13px",
		fontWeight: "bold" as const,
		color: "#cfe8ff",
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

	useEffect(() => {
		messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
	}, [chatMessages]);

	const handleSendMessage = () => {
		const content = messageInput.trim();
		if (!content) return;

		addChatMessage({
			id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
			senderId: "local",
			senderName: playerName,
			content,
			timestamp: Date.now(),
			type: "chat",
		});

		setMessageInput("");
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter" && !e.shiftKey) {
			e.preventDefault();
			handleSendMessage();
		}
	};

	const formatTime = (timestamp: number) => {
		const date = new Date(timestamp);
		return date.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" });
	};

	return (
		<div style={styles.container}>
			<div style={styles.header}>
				<div style={styles.title}>💬 聊天</div>
			</div>

			<div style={styles.messageList}>
				{chatMessages.length === 0 ? (
					<div style={styles.emptyState}>暂无消息</div>
				) : (
					chatMessages.slice(-MAX_MESSAGES).map((msg) => (
						<div
							key={msg.id}
							style={msg.type === "system" ? { ...styles.message, ...styles.messageSystem } : styles.message}
						>
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

			<div style={styles.inputArea}>
				<input
					style={styles.input}
					type="text"
					value={messageInput}
					onChange={(e) => setMessageInput(e.target.value)}
					onKeyDown={handleKeyDown}
					placeholder="输入消息... (Enter 发送)"
					maxLength={200}
				/>
				<button style={styles.button} onClick={handleSendMessage} disabled={!messageInput.trim()}>
					发送
				</button>
			</div>
		</div>
	);
};

export default ChatPanel;