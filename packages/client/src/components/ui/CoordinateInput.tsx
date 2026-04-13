/**
 * 一体化坐标输入组件
 *
 * 显示/编辑 X-Y-R-Z 坐标（位置 X、位置 Y、旋转 R、缩放 Z）
 * 支持粘贴解析、合法性验证、状态反馈
 *
 * 状态：
 * - IDLE: 空闲状态，显示当前坐标（蓝色）
 * - EDITING: 编辑状态，用户正在输入（蓝色）
 * - VALID: 内容合法，可跳转（绿色）
 * - INVALID: 内容非法，不可跳转（红色）
 */

import { Check, Copy, Move, X } from "lucide-react";
import React, { useState, useCallback, useEffect, useRef } from "react";

export type CoordinateState = "IDLE" | "EDITING" | "VALID" | "INVALID";

export interface CoordinateData {
	x: number;
	y: number;
	r?: number | null;
	z?: number | null;
}

export interface CoordinateInputProps {
	// 当前坐标
	cameraX: number;
	cameraY: number;
	viewRotation: number;
	zoom: number;

	// 坐标变化时的回调
	onCameraChange: (x: number, y: number) => void;
	onViewRotationChange: (rotation: number) => void;
	onZoomChange: (zoom: number) => void;

	// 可选的动画跳转函数（如果提供则使用动画）
	animateToCoords?: (
		x: number,
		y: number,
		rotation?: number,
		zoom?: number,
		options?: { duration?: number }
	) => void;

	// 世界边界（用于验证坐标合法性）
	worldBounds?: {
		minX: number;
		maxX: number;
		minY: number;
		maxY: number;
		minZoom?: number;
		maxZoom?: number;
	};
}

// 坐标格式正则表达式
// 支持：x,y,r,z 或 x,y,r 或 x,y 或 (x,y,r,z) 等格式
const COORDINATE_REGEX =
	/^\s*\(?\s*(-?\d+(?:\.\d+)?)\s*[,]\s*(-?\d+(?:\.\d+)?)\s*(?:[,]\s*(-?\d+(?:\.\d+)?)\s*(?:[,]\s*(-?\d+(?:\.\d+)?)\s*)?)?\)?\s*$/;

// 默认世界边界
const DEFAULT_WORLD_BOUNDS = {
	minX: -10000,
	maxX: 10000,
	minY: -10000,
	maxY: 10000,
	minZoom: 0.1,
	maxZoom: 5,
};

export const CoordinateInput: React.FC<CoordinateInputProps> = ({
	cameraX,
	cameraY,
	viewRotation,
	zoom,
	onCameraChange,
	onViewRotationChange,
	onZoomChange,
	animateToCoords,
	worldBounds = DEFAULT_WORLD_BOUNDS,
}) => {
	// 状态
	const [state, setState] = useState<CoordinateState>("IDLE");
	const [inputValue, setInputValue] = useState<string>("");
	const [parsedCoords, setParsedCoords] = useState<CoordinateData | null>(null);

	// 引用
	const inputRef = useRef<HTMLInputElement>(null);
	const isExternalChange = useRef(false);

	// 格式化当前坐标
	const formatCurrentCoords = useCallback(() => {
		const r = Math.round(viewRotation);
		const z = zoom.toFixed(2);
		// 显示完整坐标 X,Y,R,Z
		return `${Math.round(cameraX)},${Math.round(cameraY)},${r},${z}`;
	}, [cameraX, cameraY, viewRotation, zoom]);

	// 解析坐标字符串
	const parseCoordinates = useCallback(
		(text: string): CoordinateData | null => {
			const match = text.match(COORDINATE_REGEX);
			if (!match) return null;

			const x = parseFloat(match[1]);
			const y = parseFloat(match[2]);
			const r = match[3] !== undefined ? parseFloat(match[3]) : null;
			const z = match[4] !== undefined ? parseFloat(match[4]) : null;

			// 验证数值合法性
			if (isNaN(x) || isNaN(y)) return null;
			if (r !== null && isNaN(r)) return null;
			if (z !== null && isNaN(z)) return null;

			// 验证世界边界
			if (x < worldBounds.minX || x > worldBounds.maxX) return null;
			if (y < worldBounds.minY || y > worldBounds.maxY) return null;
			if (r !== null && (r < -360 || r > 360)) return null;
			if (z !== null && (z < (worldBounds.minZoom || 0.1) || z > (worldBounds.maxZoom || 5)))
				return null;

			return { x, y, r, z };
		},
		[worldBounds]
	);

	// 处理输入变化
	const handleInputChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const value = e.target.value;
			setInputValue(value);

			if (value.trim() === "") {
				setState("EDITING");
				setParsedCoords(null);
				return;
			}

			const parsed = parseCoordinates(value);
			if (parsed) {
				setState("VALID");
				setParsedCoords(parsed);
			} else {
				setState("INVALID");
				setParsedCoords(null);
			}
		},
		[parseCoordinates]
	);

	// 处理粘贴
	const handlePaste = useCallback((e: React.ClipboardEvent<HTMLInputElement>) => {
		// 允许默认粘贴行为，然后在 onChange 中处理
		setState("EDITING");
	}, []);

	// 处理聚焦
	const handleFocus = useCallback(() => {
		setState("EDITING");
		// 聚焦时全选，方便用户直接替换
		if (inputRef.current) {
			inputRef.current.select();
		}
	}, []);

	// 处理失焦
	const handleBlur = useCallback(() => {
		if (state === "EDITING" && !parsedCoords) {
			// 无效输入，恢复当前坐标
			setInputValue(formatCurrentCoords());
			setState("IDLE");
		}
		// VALID 状态不自动恢复，允许用户点击跳转按钮
	}, [state, parsedCoords, formatCurrentCoords]);

	// 处理跳转
	const handleJump = useCallback(() => {
		if (state !== "VALID" || !parsedCoords) return;

		// 标记为外部变化，防止 useEffect 立即覆盖
		isExternalChange.current = true;

		// 如果提供了动画函数，使用动画；否则直接跳转
		if (animateToCoords) {
			animateToCoords(
				parsedCoords.x,
				parsedCoords.y,
				parsedCoords.r !== null ? parsedCoords.r : undefined,
				parsedCoords.z !== null ? parsedCoords.z : undefined,
				{ duration: 400 } // 动画时长 400ms
			);
		} else {
			// 立即跳转
			if (parsedCoords.x !== cameraX || parsedCoords.y !== cameraY) {
				onCameraChange(parsedCoords.x, parsedCoords.y);
			}
			if (parsedCoords.r !== null && parsedCoords.r !== Math.round(viewRotation)) {
				onViewRotationChange(parsedCoords.r % 360);
			}
			if (parsedCoords.z !== null && parsedCoords.z !== parseFloat(zoom.toFixed(2))) {
				onZoomChange(parsedCoords.z);
			}
		}

		// 跳转后恢复空闲状态
		setState("IDLE");
		setInputValue(formatCurrentCoords());
	}, [
		state,
		parsedCoords,
		cameraX,
		cameraY,
		viewRotation,
		zoom,
		animateToCoords,
		onCameraChange,
		onViewRotationChange,
		onZoomChange,
		formatCurrentCoords,
	]);

	// 处理复制
	const handleCopy = useCallback(async () => {
		try {
			await navigator.clipboard.writeText(formatCurrentCoords());
		} catch (err) {
			console.error("复制失败:", err);
		}
	}, [formatCurrentCoords]);

	// 清空输入
	const handleClear = useCallback(() => {
		setInputValue("");
		setParsedCoords(null);
		setState("EDITING");
		inputRef.current?.focus();
	}, []);

	// 监听外部坐标变化（摄像机移动）
	useEffect(() => {
		if (isExternalChange.current) {
			isExternalChange.current = false;
			return;
		}

		// 只在 IDLE 状态下才同步外部坐标变化
		// 如果用户正在编辑（EDITING/VALID/INVALID），不要覆盖用户输入
		if (state === "IDLE") {
			setInputValue(formatCurrentCoords());
		}
	}, [cameraX, cameraY, viewRotation, zoom, formatCurrentCoords, state]);

	// 初始化
	useEffect(() => {
		setInputValue(formatCurrentCoords());
	}, []);

	// 获取状态对应的样式类
	const getStateClass = () => {
		switch (state) {
			case "VALID":
				return "coordinate-input--valid";
			case "INVALID":
				return "coordinate-input--invalid";
			case "EDITING":
				return "coordinate-input--editing";
			default:
				return "coordinate-input--idle";
		}
	};

	// 获取按钮状态
	const getButtonConfig = () => {
		if (state === "VALID") {
			return {
				text: "跳转",
				icon: Move,
				onClick: handleJump,
				disabled: false,
				className: "coordinate-input__btn coordinate-input__btn--jump",
			};
		} else if (state === "INVALID") {
			return {
				text: "无效",
				icon: X,
				onClick: () => {},
				disabled: true,
				className: "coordinate-input__btn coordinate-input__btn--invalid",
			};
		} else {
			return {
				text: "复制",
				icon: Copy,
				onClick: handleCopy,
				disabled: false,
				className: "coordinate-input__btn coordinate-input__btn--copy",
			};
		}
	};

	const buttonConfig = getButtonConfig();
	const ButtonIcon = buttonConfig.icon;

	return (
		<div className={`coordinate-input ${getStateClass()}`}>
			{/* 坐标输入框和复制按钮 - 同一行 */}
			<div className="coordinate-input__row">
				{/* 坐标输入框 */}
				<div className="coordinate-input__wrapper">
					<input
						ref={inputRef}
						type="text"
						className="coordinate-input__field"
						value={inputValue}
						onChange={handleInputChange}
						onPaste={handlePaste}
						onFocus={handleFocus}
						onBlur={handleBlur}
						placeholder="X,Y,R,Z"
						title="格式：X,Y,R,Z（R=旋转，Z=缩放，可为空）"
					/>
					{state !== "IDLE" && inputValue && (
						<button className="coordinate-input__clear" onClick={handleClear} title="清空">
							<X className="coordinate-input__clear-icon" />
						</button>
					)}
				</div>

				{/* 操作按钮 */}
				<button
					data-magnetic
					className={buttonConfig.className}
					onClick={buttonConfig.onClick}
					disabled={buttonConfig.disabled}
					title={state === "VALID" ? "跳转到输入坐标" : "复制当前坐标"}
				>
					<ButtonIcon className="coordinate-input__btn-icon" />
					<span className="coordinate-input__btn-text">{buttonConfig.text}</span>
				</button>
			</div>

			{/* 状态指示 */}
			{state !== "IDLE" && (
				<div className="coordinate-input__status">
					{state === "VALID" && parsedCoords && (
						<span className="coordinate-input__status-text">
							<Check className="coordinate-input__status-icon" />
							{parsedCoords.r !== null
								? `跳转至 (${Math.round(parsedCoords.x)},${Math.round(parsedCoords.y)},${Math.round(parsedCoords.r)}°)`
								: `跳转至 (${Math.round(parsedCoords.x)},${Math.round(parsedCoords.y)})`}
							{parsedCoords.z !== null && `, ${parsedCoords.z}x`}
						</span>
					)}
					{state === "INVALID" && (
						<span className="coordinate-input__status-text coordinate-input__status-text--error">
							<X className="coordinate-input__status-icon" />
							坐标格式错误或超出世界边界
						</span>
					)}
				</div>
			)}
		</div>
	);
};

export default CoordinateInput;
