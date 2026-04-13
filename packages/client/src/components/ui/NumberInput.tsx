/**
 * 数字输入组件
 *
 * 带上下调整按钮的数字输入框
 * 支持步进、最小/最大值限制
 */

import { ChevronDown, ChevronUp } from "lucide-react";
import React, { useState, useCallback } from "react";

interface NumberInputProps {
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	placeholder?: string;
	disabled?: boolean;
	className?: string;
	style?: React.CSSProperties;
}

export const NumberInput: React.FC<NumberInputProps> = ({
	value,
	onChange,
	min = -Infinity,
	max = Infinity,
	step = 1,
	placeholder,
	disabled = false,
	className = "",
	style,
}) => {
	const [isFocused, setIsFocused] = useState(false);

	const handleChange = useCallback(
		(e: React.ChangeEvent<HTMLInputElement>) => {
			const newValue = parseFloat(e.target.value);
			if (!isNaN(newValue)) {
				onChange(newValue);
			} else if (e.target.value === "") {
				onChange(0);
			}
		},
		[onChange]
	);

	const increment = useCallback(() => {
		const newValue = Math.min(max, value + step);
		onChange(newValue);
	}, [value, step, max, onChange]);

	const decrement = useCallback(() => {
		const newValue = Math.max(min, value - step);
		onChange(newValue);
	}, [value, step, min, onChange]);

	const handleKeyDown = useCallback(
		(e: React.KeyboardEvent<HTMLInputElement>) => {
			if (e.key === "ArrowUp") {
				e.preventDefault();
				increment();
			} else if (e.key === "ArrowDown") {
				e.preventDefault();
				decrement();
			}
		},
		[increment, decrement]
	);

	return (
		<div
			className={`number-input-wrapper ${className}`}
			style={{
				position: "relative",
				display: "flex",
				alignItems: "center",
				...style,
			}}
		>
			<input
				type="number"
				className="game-input--stepped"
				value={value}
				onChange={handleChange}
				onFocus={() => setIsFocused(true)}
				onBlur={() => setIsFocused(false)}
				onKeyDown={handleKeyDown}
				min={min}
				max={max}
				step={step}
				placeholder={placeholder}
				disabled={disabled}
				style={{
					flex: 1,
					padding: "8px",
					paddingRight: "32px",
					borderRadius: "0",
					border: "1px solid rgba(90, 42, 58, 0.8)",
					backgroundColor: "rgba(26, 45, 66, 0.8)",
					color: "#cfe8ff",
					fontSize: "10px",
					outline: "none",
					boxSizing: "border-box",
				}}
			/>
			<div
				className="input-stepper"
				style={{
					position: "absolute",
					right: "0",
					top: "0",
					bottom: "0",
					width: "28px",
					display: "flex",
					flexDirection: "column",
					borderLeft: "1px solid rgba(90, 42, 58, 0.8)",
					overflow: "hidden",
					opacity: isFocused || !disabled ? 1 : 0.5,
					pointerEvents: disabled ? "none" : "auto",
				}}
			>
				<button
					type="button"
					className="input-stepper__button"
					onClick={increment}
					disabled={disabled || value >= max}
					style={{
						flex: 1,
						background: "transparent",
						border: "none",
						borderBottom: "1px solid rgba(90, 42, 58, 0.5)",
						color: "#cfe8ff",
						cursor: disabled || value >= max ? "not-allowed" : "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: "0",
					}}
				>
					<ChevronUp className="input-stepper__icon" />
				</button>
				<button
					type="button"
					className="input-stepper__button"
					onClick={decrement}
					disabled={disabled || value <= min}
					style={{
						flex: 1,
						background: "transparent",
						border: "none",
						color: "#cfe8ff",
						cursor: disabled || value <= min ? "not-allowed" : "pointer",
						display: "flex",
						alignItems: "center",
						justifyContent: "center",
						padding: "0",
					}}
				>
					<ChevronDown className="input-stepper__icon" />
				</button>
			</div>
		</div>
	);
};

export default NumberInput;
