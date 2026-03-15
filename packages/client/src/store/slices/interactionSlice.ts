/**
 * 交互状态 Redux Slice
 * 统一管理画布和 Token 的交互状态
 */

import { type PayloadAction, createSlice } from "@reduxjs/toolkit";

/**
 * 交互模式类型
 */
export type InteractionMode =
	| "idle"           // 空闲状态
	| "hoverToken"     // 悬停在 Token 上
	| "hoverCanvas"    // 悬停在画布上
	| "dragToken"      // 拖拽 Token 中
	| "panCanvas"      // 拖拽画布中
	| "selectToken";   // 选择 Token 中

/**
 * 光标类型
 */
export type CursorType =
	| "default"        // 默认箭头
	| "pointer"        // 手型指针（可点击）
	| "grab"           // 抓取（可拖动）
	| "grabbing"       // 正在抓取
	| "move"           // 移动
	| "crosshair";     // 十字准星（工具模式）

/**
 * 拖拽状态
 */
export interface DragState {
	/** 拖拽类型 */
	type: "token" | "canvas";
	/** 拖拽开始时的屏幕坐标 */
	startScreen: { x: number; y: number };
	/** 拖拽开始时的世界坐标 */
	startWorld: { x: number; y: number };
	/** 拖拽开始时的相机位置 */
	startCamera: { centerX: number; centerY: number; zoom: number };
	/** 被拖拽的 Token ID（如果是 Token 拖拽） */
	tokenId?: string;
	/** Token 原始位置（如果是 Token 拖拽） */
	tokenOriginalPosition?: { x: number; y: number };
}

/**
 * 键盘状态
 */
export interface KeyboardState {
	isSpacePressed: boolean;
	isCtrlPressed: boolean;
	isShiftPressed: boolean;
	isAltPressed: boolean;
}

interface InteractionState {
	/** 当前交互模式 */
	mode: InteractionMode;
	/** 当前光标类型 */
	cursor: CursorType;
	/** 当前拖拽状态（如果有） */
	drag: DragState | null;
	/** 键盘状态 */
	keyboard: KeyboardState;
	/** 最后交互时间（用于防抖） */
	lastInteractionTime: number;
}

const initialState: InteractionState = {
	mode: "idle",
	cursor: "default",
	drag: null,
	keyboard: {
		isSpacePressed: false,
		isCtrlPressed: false,
		isShiftPressed: false,
		isAltPressed: false,
	},
	lastInteractionTime: 0,
};

const interactionSlice = createSlice({
	name: "interaction",
	initialState,
	reducers: {
		// 设置交互模式
		setInteractionMode: (state, action: PayloadAction<InteractionMode>) => {
			state.mode = action.payload;
			state.lastInteractionTime = Date.now();
		},

		// 设置光标类型
		setCursor: (state, action: PayloadAction<CursorType>) => {
			state.cursor = action.payload;
		},

		// 开始拖拽
		startDrag: (state, action: PayloadAction<DragState>) => {
			state.drag = action.payload;
			state.mode = action.payload.type === "token" ? "dragToken" : "panCanvas";
			state.cursor = "grabbing";
			state.lastInteractionTime = Date.now();
		},

		// 更新拖拽位置
		updateDrag: (state, _action: PayloadAction<{ screenX: number; screenY: number }>) => {
			// 位置更新通过外部回调处理，这里只更新时间戳
			if (state.drag) {
				state.lastInteractionTime = Date.now();
			}
		},

		// 结束拖拽
		endDrag: (state) => {
			state.drag = null;
			state.mode = "idle";
			state.cursor = "default";
			state.lastInteractionTime = Date.now();
		},

		// 更新键盘状态
		setKeyState: (state, action: PayloadAction<Partial<KeyboardState>>) => {
			state.keyboard = { ...state.keyboard, ...action.payload };
		},

		// 处理键盘按下
		keyDown: (state, action: PayloadAction<{ key: string; pressed: boolean }>) => {
			const { key, pressed } = action.payload;
			
			switch (key.toLowerCase()) {
				case " ":
				case "space":
					state.keyboard.isSpacePressed = pressed;
					break;
				case "control":
				case "ctrl":
					state.keyboard.isCtrlPressed = pressed;
					break;
				case "shift":
					state.keyboard.isShiftPressed = pressed;
					break;
				case "alt":
					state.keyboard.isAltPressed = pressed;
					break;
			}

			// 根据键盘状态更新光标
			if (pressed && key.toLowerCase() === " " && state.mode === "idle") {
				state.cursor = "grab";
			} else if (!pressed && key.toLowerCase() === " " && state.mode === "idle") {
				state.cursor = "default";
			}
		},

		// 悬停在 Token 上
		hoverToken: (state) => {
			if (state.mode === "idle" && !state.keyboard.isSpacePressed) {
				state.mode = "hoverToken";
				state.cursor = "pointer";
			}
		},

		// 离开 Token
		leaveToken: (state) => {
			if (state.mode === "hoverToken") {
				state.mode = state.keyboard.isSpacePressed ? "idle" : "hoverCanvas";
				state.cursor = state.keyboard.isSpacePressed ? "grab" : "default";
			}
		},

		// 重置交互状态
		resetInteraction: (state) => {
			state.mode = "idle";
			state.cursor = "default";
			state.drag = null;
			state.keyboard = initialState.keyboard;
			state.lastInteractionTime = 0;
		},
	},
});

export const {
	setInteractionMode,
	setCursor,
	startDrag,
	updateDrag,
	endDrag,
	setKeyState,
	keyDown,
	hoverToken,
	leaveToken,
	resetInteraction,
} = interactionSlice.actions;

export default interactionSlice.reducer;
