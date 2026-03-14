import { createSlice, type PayloadAction } from "@reduxjs/toolkit";

export interface PanelState {
	id: string;
	collapsed: boolean;
	width: number;
	minWidth: number;
	maxWidth: number;
}

export interface ChatMessage {
	id: string;
	content: string;
	senderId: string;
	senderName: string;
	timestamp: number;
	type: "player" | "system" | "combat";
}

export interface DrawingElement {
	id: string;
	type: "line" | "circle" | "rectangle" | "arrow" | "text";
	points: Array<{ x: number; y: number }>;
	color: string;
	thickness: number;
	opacity: number;
	timestamp: number;
}

export interface ConnectionState {
	isConnected: boolean;
	serverUrl: string;
	playerId: string | null;
	roomId: string | null;
	isConnecting: boolean;
	lastPing: number;
}

interface UIState {
	panels: Record<string, PanelState>;
	chatMessages: ChatMessage[];
	drawingElements: DrawingElement[];
	connection: ConnectionState;
	selectedTool: "select" | "draw" | "measure" | "pan";
	drawingColor: string;
	drawingThickness: number;
	showGrid: boolean;
	showCoordinates: boolean;
	zoomLevel: number;
	theme: "dark" | "light";
	notifications: Array<{
		id: string;
		message: string;
		type: "info" | "warning" | "error" | "success";
		timestamp: number;
		timeout: number;
	}>;
}

const initialState: UIState = {
	panels: {
		left: {
			id: "left",
			collapsed: false,
			width: 280,
			minWidth: 200,
			maxWidth: 400,
		},
		right: {
			id: "right",
			collapsed: false,
			width: 280,
			minWidth: 200,
			maxWidth: 400,
		},
		bottom: {
			id: "bottom",
			collapsed: false,
			width: 64,
			minWidth: 48,
			maxWidth: 120,
		},
		chat: {
			id: "chat",
			collapsed: false,
			width: 300,
			minWidth: 250,
			maxWidth: 500,
		},
	},
	chatMessages: [],
	drawingElements: [],
	connection: {
		isConnected: false,
		serverUrl: "ws://localhost:3001",
		playerId: null,
		roomId: null,
		isConnecting: false,
		lastPing: 0,
	},
	selectedTool: "select",
	drawingColor: "#4a9eff",
	drawingThickness: 2,
	showGrid: true,
	showCoordinates: false,
	zoomLevel: 1,
	theme: "dark",
	notifications: [],
};

const uiSlice = createSlice({
	name: "ui",
	initialState,
	reducers: {
		togglePanel: (state, action: PayloadAction<string>) => {
			const panel = state.panels[action.payload];
			if (panel) {
				panel.collapsed = !panel.collapsed;
			}
		},
		setPanelWidth: (
			state,
			action: PayloadAction<{ id: string; width: number }>,
		) => {
			const panel = state.panels[action.payload.id];
			if (panel) {
				panel.width = Math.max(
					panel.minWidth,
					Math.min(panel.maxWidth, action.payload.width),
				);
			}
		},
		addChatMessage: (state, action: PayloadAction<ChatMessage>) => {
			state.chatMessages.push(action.payload);
			// 限制聊天消息数量
			if (state.chatMessages.length > 100) {
				state.chatMessages = state.chatMessages.slice(-100);
			}
		},
		addSystemMessage: (state, action: PayloadAction<string>) => {
			const message: ChatMessage = {
				id: `system_${Date.now()}`,
				content: action.payload,
				senderId: "system",
				senderName: "System",
				timestamp: Date.now(),
				type: "system",
			};
			state.chatMessages.push(message);
			if (state.chatMessages.length > 100) {
				state.chatMessages = state.chatMessages.slice(-100);
			}
		},
		clearChat: (state) => {
			state.chatMessages = [];
		},
		addDrawingElement: (state, action: PayloadAction<DrawingElement>) => {
			state.drawingElements.push(action.payload);
		},
		removeDrawingElement: (state, action: PayloadAction<string>) => {
			state.drawingElements = state.drawingElements.filter(
				(element) => element.id !== action.payload,
			);
		},
		clearDrawingElements: (state) => {
			state.drawingElements = [];
		},
		setConnectionState: (
			state,
			action: PayloadAction<Partial<ConnectionState>>,
		) => {
			state.connection = { ...state.connection, ...action.payload };
		},
		setConnected: (state, action: PayloadAction<boolean>) => {
			state.connection.isConnected = action.payload;
			if (!action.payload) {
				state.connection.isConnecting = false;
				state.connection.playerId = null;
				state.connection.roomId = null;
			}
		},
		setConnecting: (state, action: PayloadAction<boolean>) => {
			state.connection.isConnecting = action.payload;
		},
		setServerUrl: (state, action: PayloadAction<string>) => {
			state.connection.serverUrl = action.payload;
		},
		setPlayerId: (state, action: PayloadAction<string | null>) => {
			state.connection.playerId = action.payload;
		},
		setRoomId: (state, action: PayloadAction<string | null>) => {
			state.connection.roomId = action.payload;
		},
		updatePing: (state) => {
			state.connection.lastPing = Date.now();
		},
		setSelectedTool: (
			state,
			action: PayloadAction<UIState["selectedTool"]>,
		) => {
			state.selectedTool = action.payload;
		},
		setDrawingColor: (state, action: PayloadAction<string>) => {
			state.drawingColor = action.payload;
		},
		setDrawingThickness: (state, action: PayloadAction<number>) => {
			state.drawingThickness = Math.max(1, Math.min(10, action.payload));
		},
		toggleGrid: (state) => {
			state.showGrid = !state.showGrid;
		},
		toggleCoordinates: (state) => {
			state.showCoordinates = !state.showCoordinates;
		},
		setZoomLevel: (state, action: PayloadAction<number>) => {
			state.zoomLevel = Math.max(0.1, Math.min(5, action.payload));
		},
		toggleTheme: (state) => {
			state.theme = state.theme === "dark" ? "light" : "dark";
		},
		addNotification: (
			state,
			action: PayloadAction<{
				message: string;
				type: UIState["notifications"][0]["type"];
				timeout?: number;
			}>,
		) => {
			const notification = {
				id: `notification_${Date.now()}`,
				message: action.payload.message,
				type: action.payload.type,
				timestamp: Date.now(),
				timeout: action.payload.timeout || 5000,
			};
			state.notifications.push(notification);
		},
		removeNotification: (state, action: PayloadAction<string>) => {
			state.notifications = state.notifications.filter(
				(notification) => notification.id !== action.payload,
			);
		},
		clearNotifications: (state) => {
			state.notifications = [];
		},
		resetUI: (state) => {
			state.chatMessages = [];
			state.drawingElements = [];
			state.connection = initialState.connection;
			state.selectedTool = initialState.selectedTool;
			state.drawingColor = initialState.drawingColor;
			state.drawingThickness = initialState.drawingThickness;
			state.showGrid = initialState.showGrid;
			state.showCoordinates = initialState.showCoordinates;
			state.zoomLevel = initialState.zoomLevel;
			state.notifications = [];
		},
	},
});

export const {
	togglePanel,
	setPanelWidth,
	addChatMessage,
	addSystemMessage,
	clearChat,
	addDrawingElement,
	removeDrawingElement,
	clearDrawingElements,
	setConnectionState,
	setConnected,
	setConnecting,
	setServerUrl,
	setPlayerId,
	setRoomId,
	updatePing,
	setSelectedTool,
	setDrawingColor,
	setDrawingThickness,
	toggleGrid,
	toggleCoordinates,
	setZoomLevel,
	toggleTheme,
	addNotification,
	removeNotification,
	clearNotifications,
	resetUI,
} = uiSlice.actions;

export default uiSlice.reducer;
