/**
 * 聊天系统状态管理
 */

import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  content: string;
  timestamp: number;
  type: 'chat' | 'system' | 'combat';
}

interface ChatState {
  messages: ChatMessage[];
  unreadCount: number;
  isConnected: boolean;
}

const initialState: ChatState = {
  messages: [],
  unreadCount: 0,
  isConnected: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    // 添加消息
    addMessage: (state, action: PayloadAction<ChatMessage>) => {
      state.messages.push(action.payload);
      // 保留最近 100 条消息
      if (state.messages.length > 100) {
        state.messages = state.messages.slice(-100);
      }
      // 如果不是当前用户发送，增加未读数
      if (action.payload.type === 'chat') {
        state.unreadCount++;
      }
    },
    
    // 添加系统消息
    addSystemMessage: (state, action: PayloadAction<string>) => {
      state.messages.push({
        id: `sys_${Date.now()}`,
        senderId: 'system',
        senderName: '系统',
        content: action.payload,
        timestamp: Date.now(),
        type: 'system',
      });
      if (state.messages.length > 100) {
        state.messages = state.messages.slice(-100);
      }
    },
    
    // 清除未读计数
    clearUnreadCount: (state) => {
      state.unreadCount = 0;
    },
    
    // 设置连接状态
    setConnectionState: (state, action: PayloadAction<boolean>) => {
      state.isConnected = action.payload;
    },
    
    // 清除聊天历史
    clearHistory: (state) => {
      state.messages = [];
      state.unreadCount = 0;
    },
  },
});

export const {
  addMessage,
  addSystemMessage,
  clearUnreadCount,
  setConnectionState,
  clearHistory,
} = chatSlice.actions;

export default chatSlice.reducer;
