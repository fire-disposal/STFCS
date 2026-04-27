/**
 * PanelSection - 统一的区块组件
 * 
 * 替代 panel-section CSS，支持多种布局变体
 */

import React from "react";
import { Box } from "@radix-ui/themes";

type Direction = "row" | "column";

interface PanelSectionProps {
	children: React.ReactNode;
	direction?: Direction;
	gap?: number;
	minWidth?: number | string;
	flex?: number | string;
	padding?: string;
	background?: string;
	border?: boolean;
	active?: boolean;
	className?: string;
	style?: React.CSSProperties;
}

const BASE_STYLE: React.CSSProperties = {
	display: "flex",
	padding: "8px 12px",
	background: "rgba(10, 30, 50, 0.6)",
	border: "1px solid rgba(43, 66, 97, 0.5)",
	borderRadius: 4,
	transition: "border-color 0.15s, background 0.15s",
};

const ACTIVE_STYLE: React.CSSProperties = {
	borderColor: "rgba(74, 158, 255, 0.4)",
	background: "rgba(74, 158, 255, 0.08)",
};

export const PanelSection: React.FC<PanelSectionProps> = ({
	children,
	direction = "row",
	gap = 10,
	minWidth,
	flex,
	padding,
	background,
	border = true,
	active = false,
	className,
	style,
}) => {
	const computedStyle: React.CSSProperties = {
		...BASE_STYLE,
		flexDirection: direction,
		alignItems: direction === "row" ? "center" : "flex-start",
		gap: gap,
		...(active && ACTIVE_STYLE),
		...(minWidth && { minWidth }),
		...(flex && { flex }),
		...(padding && { padding }),
		...(background && { background }),
		...(border === false && { border: "none" }),
		...style,
	};

	return (
		<Box className={className} style={computedStyle}>
			{children}
		</Box>
	);
};

PanelSection.displayName = "PanelSection";

export default PanelSection;