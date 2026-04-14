/**
 * useChatMessages - Colyseus 聊天消息 Hook
 *
 * 利用 Colyseus Schema 的响应式特性，自动监听聊天消息
 *
 * @example
 * // 在组件中使用
 * const messages = useChatMessages(room);
 *
 * // messages 会自动更新，无需手动 onMessage
 */

import type { Room } from "@colyseus/sdk";
import { useEffect, useState } from "react";

export interface ChatMessage {
	id: string;
	senderId: string;
	senderName: string;
	content: string;
	timestamp: number;
	type: "chat" | "system" | "combat";
}

/**
 * 监听聊天消息（使用 Schema 状态同步）
 */
export function useChatMessages(room: Room | null): ChatMessage[] {
	const [messages, setMessages] = useState<ChatMessage[]>([]);

	useEffect(() => {
		if (!room?.state) return;

		const state = room.state as any;
		if (!state.chatMessages) return;

		// 初始加载消息
		const initialMessages: ChatMessage[] = [];
		state.chatMessages.forEach((msg: any) => {
			initialMessages.push({
				id: msg.id,
				senderId: msg.senderId,
				senderName: msg.senderName,
				content: msg.content,
				timestamp: msg.timestamp,
				type: msg.type,
			});
		});
		setMessages(initialMessages);

		// 监听消息添加
		const removeAddListener = state.chatMessages.onAdd((msg: any, index: number) => {
			setMessages((prev) => {
				const newMsg = {
					id: msg.id,
					senderId: msg.senderId,
					senderName: msg.senderName,
					content: msg.content,
					timestamp: msg.timestamp,
					type: msg.type,
				};
				return [...prev, newMsg];
			});
		});

		// 监听消息移除（清理过期消息时）
		const removeRemoveListener = state.chatMessages.onRemove((msg: any, index: number) => {
			setMessages((prev) => prev.filter((m) => m.id !== msg.id));
		});

		return () => {
			removeAddListener();
			removeRemoveListener();
		};
	}, [room]);

	// 限制显示数量（最近 50 条）
	return messages.slice(-50);
}

/**
 * 监听系统消息（快捷方式）
 */
export function useSystemMessages(room: Room | null): ChatMessage[] {
	const allMessages = useChatMessages(room);
	return allMessages.filter((msg) => msg.type === "system" || msg.type === "combat");
}

/**
 * 发送聊天消息 Hook
 */
export function useSendChatMessage(room: Room | null, playerName: string) {
	const sendMessage = (content: string) => {
		if (!room) return;

		room.send("chat", {
			content,
			playerName,
		});
	};

	return sendMessage;
}
