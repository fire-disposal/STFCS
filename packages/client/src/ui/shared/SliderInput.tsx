/**
 * SliderInput - 统一的滑动条+数值输入组件
 *
 * 替代 slider + TextField 的重复组合
 * 紧凑设计，适合底部栏和侧边栏
 */

import React from "react";
import { Flex, Text, TextField } from "@radix-ui/themes";

interface SliderInputProps {
	value: number;
	min: number;
	max: number;
	step?: number;
	onChange: (value: number) => void;
	disabled?: boolean;
	label?: string;
	unit?: string;
	showInput?: boolean;
	width?: number;
}

export const SliderInput: React.FC<SliderInputProps> = ({
	value,
	min,
	max,
	step = 1,
	onChange,
	disabled = false,
	label,
	unit,
	showInput = true,
	width = 200,
}) => {
	const handleSliderChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		onChange(Number(e.target.value));
	};

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const v = Number(e.target.value) || min;
		onChange(Math.max(min, Math.min(max, v)));
	};

	return (
		<Flex align="center" gap="2" style={{ minWidth: width }}>
			{label && (
				<Text size="1" style={{ color: "#6b8aaa", minWidth: 28 }}>
					{label}
				</Text>
			)}

			<input
				type="range"
				min={min}
				max={max}
				step={step}
				value={value}
				onChange={handleSliderChange}
				disabled={disabled}
				style={{
					flex: 1,
					minWidth: 80,
					maxWidth: 140,
					height: 4,
					background: "rgba(74, 158, 255, 0.2)",
					borderRadius: 2,
					WebkitAppearance: "none",
					cursor: disabled ? "not-allowed" : "pointer",
				}}
			/>

			{showInput && (
				<TextField.Root
					size="1"
					value={value.toString()}
					onChange={handleInputChange}
					disabled={disabled}
					style={{ width: 48 }}
				/>
			)}

			{unit && (
				<Text size="1" style={{ color: "#8ba4c7" }}>
					{unit}
				</Text>
			)}
		</Flex>
	);
};

export default SliderInput;