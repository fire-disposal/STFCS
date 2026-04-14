/**
 * 游标坐标输入组件
 *
 * 显示/编辑游标位置坐标（仅 X,Y）
 * 支持复制和跳转功能
 */

import { Check, Copy, Move, X } from "lucide-react";
import React, { useState, useCallback, useEffect, useRef } from "react";

export type CursorCoordinateState = "IDLE" | "EDITING" | "VALID" | "INVALID";

export interface CursorCoordinateData {
	x: number;
	y: number;
	r?: number;
}

export interface CursorCoordinateInputProps {
	cursorX: number | null;
	cursorY: number | null;
	cursorR: number | null;
	cameraX: number;
	cameraY: number;
	viewRotation: number;
	onCameraChange: (x: number, y: number) => void;
	onSetMapCursor: (x: number, y: number, r: number) => void;
	onClearMapCursor: () => void;
	worldBounds?: {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
	};
}

// 支持 X,Y 或 X,Y,R 格式
const CURSOR_COORDINATE_REGEX =
	/^\s*\(?\s*(-?\d+(?:\.\d+)?)\s*[,]\s*(-?\d+(?:\.\d+)?)\s*(?:[,]\s*(-?\d+(?:\.\d+)?)\s*)?\)?\s*$/;

const DEFAULT_WORLD_BOUNDS = {
	minX: -10000,
	maxX: 10000,
	minY: -10000,
	maxY: 10000,
};

export const CursorCoordinateInput: React.FC<CursorCoordinateInputProps> = ({
	cursorX,
	cursorY,
	cursorR,
	cameraX,
	cameraY,
	viewRotation,
	onCameraChange,
	onSetMapCursor,
	onClearMapCursor,
	worldBounds = DEFAULT_WORLD_BOUNDS,
}) => {
	const [state, setCursorState] = useState<CursorCoordinateState>("IDLE");
	const [inputValue, setInputValue] = useState<string>("");
	const [parsedCoords, setParsedCoords] = useState<CursorCoordinateData | null>(null);

	const inputRef = useRef<HTMLInputElement>(null);
	const isExternalChange = useRef(false);

	const formatCurrentCoords = useCallback(() => {
		if (cursorX === null || cursorY === null) {
			return `${Math.round(cameraX)},${Math.round(cameraY)}`;
		}
		// 显示 R 值（如果有）
		const r = cursorR !== null ? cursorR : Math.round(viewRotation);
		return `${Math.round(cursorX)},${Math.round(cursorY)},${r}`;
	}, [cursorX, cursorY, cursorR, cameraX, cameraY, viewRotation]);

	const parseCoordinates = useCallback(
		(text: string): CursorCoordinateData | null => {
			const match = text.match(CURSOR_COORDINATE_REGEX);
			if (!match) return null;

			const x = parseFloat(match[1]);
			const y = parseFloat(match[2]);
			const r = match[3] !== undefined ? parseFloat(match[3]) : undefined;

			if (isNaN(x) || isNaN(y)) return null;
			if (x < worldBounds.minX || x > worldBounds.maxX) return null;
			if (y < worldBounds.minY || y > worldBounds.maxY) return null;
			if (r !== undefined && isNaN(r)) return null;

			return { x, y, r };
		},
		[worldBounds]
	);

	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setInputValue(value);

			if (value.trim() === "") {
				setCursorState("EDITING");
				setParsedCoords(null);
				return;
			}

			const parsed = parseCoordinates(value);
			if (parsed) {
				setCursorState("VALID");
				setParsedCoords(parsed);
			} else {
				setCursorState("INVALID");
				setParsedCoords(null);
			}
		},
		[parseCoordinates]
	);

	const handleFocus = useCallback(() => {
		setCursorState("EDITING");
		if (inputRef.current) {
			inputRef.current.select();
		}
	}, []);

	const handleBlur = useCallback(() => {
		if (state === "EDITING" && !parsedCoords) {
			setInputValue(formatCurrentCoords());
			setCursorState("IDLE");
		}
	}, [state, parsedCoords, formatCurrentCoords]);

	const handleJump = useCallback(() => {
		if (state !== "VALID" || !parsedCoords) return;

		isExternalChange.current = true;
		// 使用输入的 R 值，如果没有则使用当前视图旋转
		const rotation = parsedCoords.r !== undefined ? parsedCoords.r : viewRotation;
		onSetMapCursor(parsedCoords.x, parsedCoords.y, rotation);
		onCameraChange(parsedCoords.x, parsedCoords.y);

		setCursorState("IDLE");
		setInputValue(formatCurrentCoords());
	}, [state, parsedCoords, viewRotation, onSetMapCursor, onCameraChange, formatCurrentCoords]);

	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(formatCurrentCoords());
		} catch (err) {
			console.error("复制失败:", err);
		}
	}, [formatCurrentCoords]);

	const handleClear = useCallback(() => {
		onClearMapCursor();
		setInputValue("");
		setParsedCoords(null);
		setCursorState("EDITING");
		inputRef.current?.focus();
	}, [onClearMapCursor]);

	useEffect(() => {
		if (isExternalChange.current) {
			isExternalChange.current = false;
			return;
		}

		if (state === "IDLE") {
			setInputValue(formatCurrentCoords());
		}
	}, [cameraX, cameraY, cursorX, cursorY, formatCurrentCoords, state]);

	useEffect(() => {
		setInputValue(formatCurrentCoords());
	}, []);

	const getStateClass = () => {
		switch (state) {
			case "VALID":
				return "cursor-coordinate-input--valid";
			case "INVALID":
				return "cursor-coordinate-input--invalid";
			case "EDITING":
				return "cursor-coordinate-input--editing";
			default:
				return "cursor-coordinate-input--idle";
		}
	};

	const getButtonConfig = () => {
		if (state === "VALID") {
			return {
				text: "跳转",
				icon: Move,
				onClick: handleJump,
				disabled: false,
				className: "cursor-coordinate-input__btn cursor-coordinate-input__btn--jump",
			};
		} else if (state === "INVALID") {
			return {
				text: "无效",
				icon: X,
				onClick: () => {},
				disabled: true,
				className: "cursor-coordinate-input__btn cursor-coordinate-input__btn--invalid",
			};
		} else {
			return {
				text: "复制",
				icon: Copy,
				onClick: handleCopy,
				disabled: false,
				className: "cursor-coordinate-input__btn cursor-coordinate-input__btn--copy",
			};
		}
	};

	const buttonConfig = getButtonConfig();
	const ButtonIcon = buttonConfig.icon;

	return (
		<div className={`cursor-coordinate-input ${getStateClass()}`}>
			<div className="cursor-coordinate-input__row">
				<div className="cursor-coordinate-input__wrapper">
					<input
						ref={inputRef}
						type="text"
						className="cursor-coordinate-input__field"
						value={inputValue}
						onChange={handleInputChange}
						onFocus={handleFocus}
						onBlur={handleBlur}
						placeholder="X,Y"
						title="格式：X,Y"
					/>
					{state !== "IDLE" && inputValue && (
						<button
							className="cursor-coordinate-input__clear"
							onClick={handleClear}
							title="清空游标"
						>
							<X className="cursor-coordinate-input__clear-icon" />
						</button>
					)}
				</div>

				<button
					data-magnetic
					className={buttonConfig.className}
					onClick={buttonConfig.onClick}
					disabled={buttonConfig.disabled}
					title={state === "VALID" ? "跳转至输入坐标" : "复制当前坐标"}
				>
					<ButtonIcon className="cursor-coordinate-input__btn-icon" />
					<span className="cursor-coordinate-input__btn-text">{buttonConfig.text}</span>
				</button>
			</div>

			{state !== "IDLE" && (
				<div className="cursor-coordinate-input__status">
					{state === "VALID" && parsedCoords && (
						<span className="cursor-coordinate-input__status-text">
							<Check className="cursor-coordinate-input__status-icon" />
							跳转至 ({Math.round(parsedCoords.x)},{Math.round(parsedCoords.y)})
						</span>
					)}
					{state === "INVALID" && (
						<span className="cursor-coordinate-input__status-text cursor-coordinate-input__status-text--error">
							<X className="cursor-coordinate-input__status-icon" />
							坐标格式错误或超出世界边界
						</span>
					)}
				</div>
			)}
		</div>
	);
};

export default CursorCoordinateInput;
