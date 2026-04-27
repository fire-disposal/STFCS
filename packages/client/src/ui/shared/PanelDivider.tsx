/**
 * PanelDivider - 统一的分隔线组件
 * 
 * 替代 panel-divider CSS，使用 Radix Separator
 */

import React from "react";
import { Separator } from "@radix-ui/themes";

interface PanelDividerProps {
	orientation?: "horizontal" | "vertical";
	size?: "1" | "2" | "3" | "4";
	decorative?: boolean;
	margin?: number | string;
}

export const PanelDivider: React.FC<PanelDividerProps> = ({
	orientation = "vertical",
	size = "1",
	decorative = true,
	margin = 4,
}) => {
	if (orientation === "vertical") {
		return (
			<div
				style={{
					width: 1,
					alignSelf: "stretch",
					background: "linear-gradient(180deg, transparent, rgba(74, 158, 255, 0.2), transparent)",
					margin: `0 ${margin}px`,
					flexShrink: 0,
				}}
			/>
		);
	}

	return (
		<Separator
			orientation="horizontal"
			size={size}
			decorative={decorative}
			style={{ margin: `${margin}px 0` }}
		/>
	);
};

PanelDivider.displayName = "PanelDivider";

export default PanelDivider;