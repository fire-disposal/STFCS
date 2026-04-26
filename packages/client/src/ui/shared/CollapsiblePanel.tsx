/**
 * CollapsiblePanel - 可复用折叠面板组件
 *
 * 支持：
 * - horizontal（底部栏） / vertical（右侧栏）
 * - 多Tab切换
 * - 折叠/展开动画
 * - 统一的 Radix UI 组件库风格
 */

import React, { useState, useCallback } from "react";
import { Tabs, Flex, Box, Text, IconButton, Tooltip } from "@radix-ui/themes";
import { ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import "./collapsible-panel.css";

export interface TabConfig {
	id: string;
	label: string;
	icon?: React.ReactNode;
	component: React.ReactNode;
	enabled?: boolean;
	badge?: React.ReactNode;
}

export interface CollapsiblePanelProps {
	direction: "horizontal" | "vertical";
	tabs: TabConfig[];
	defaultTab?: string;
	defaultCollapsed?: boolean;
	className?: string;
	position?: "top" | "bottom";
	showTabWhenCollapsed?: boolean;
}

export const CollapsiblePanel: React.FC<CollapsiblePanelProps> = ({
	direction,
	tabs,
	defaultTab,
	defaultCollapsed = false,
	className = "",
	position = "bottom",
	showTabWhenCollapsed = false,
}) => {
	const [collapsed, setCollapsed] = useState(defaultCollapsed);
	const [activeTab, setActiveTab] = useState(defaultTab || tabs[0]?.id || "");

	const enabledTabs = tabs.filter((tab) => tab.enabled !== false);
	const safeActiveTab = enabledTabs.some((tab) => tab.id === activeTab)
		? activeTab
		: enabledTabs[0]?.id || "";

	const toggleCollapse = useCallback(() => {
		setCollapsed(!collapsed);
	}, [collapsed]);

	const collapseIcon =
		direction === "horizontal"
			? collapsed
				? <ChevronUp size={14} />
				: <ChevronDown size={14} />
			: collapsed
				? <ChevronLeft size={14} />
				: <ChevronRight size={14} />;

	const collapseTooltip =
		direction === "horizontal"
			? collapsed ? "展开面板" : "折叠面板"
			: collapsed ? "展开侧栏" : "折叠侧栏";

	const isVertical = direction === "vertical";
	const isTopPanel = position === "top";

	return (
		<Box
			className={`collapsible-panel collapsible-panel--${direction} ${
				collapsed ? "collapsible-panel--collapsed" : ""
			} ${isTopPanel ? "collapsible-panel--top" : ""} ${className}`}
		>
			{isVertical && collapsed && !showTabWhenCollapsed ? (
				<Flex className="collapsible-panel__strip" align="center" justify="center">
					<Tooltip content={collapseTooltip}>
						<IconButton
							size="1"
							variant="ghost"
							onClick={toggleCollapse}
							className="collapsible-panel__strip-btn"
						>
							{collapseIcon}
						</IconButton>
					</Tooltip>
				</Flex>
			) : (
				<Tabs.Root value={safeActiveTab} onValueChange={setActiveTab}>
					<Flex
						className={`collapsible-panel__header collapsible-panel__header--${direction}`}
						align="center"
						gap="2"
					>
						<Tooltip content={collapseTooltip}>
							<IconButton
								size="1"
								variant="ghost"
								onClick={toggleCollapse}
								className="collapsible-panel__collapse-btn"
							>
								{collapseIcon}
							</IconButton>
						</Tooltip>

						{(collapsed && showTabWhenCollapsed) || !collapsed ? (
							<Tabs.List
								className={`collapsible-panel__tabs collapsible-panel__tabs--${direction}`}
							>
								{enabledTabs.map((tab) => (
									<Tabs.Trigger
										key={tab.id}
										value={tab.id}
										className="collapsible-panel__tab"
									>
										<Flex align="center" gap="1">
											{tab.icon}
											{(!collapsed || showTabWhenCollapsed) && (
												<Text size="1">{tab.label}</Text>
											)}
											{tab.badge}
										</Flex>
									</Tabs.Trigger>
								))}
							</Tabs.List>
						) : (
							<Text size="1" color="gray" className="collapsible-panel__collapsed-label">
								{enabledTabs.length > 1
									? `${enabledTabs.length} 个面板`
									: enabledTabs[0]?.label || "面板"}
							</Text>
						)}
					</Flex>

					{!collapsed && (
						<Box className={`collapsible-panel__content collapsible-panel__content--${direction}`}>
							{enabledTabs.find((tab) => tab.id === safeActiveTab)?.component}
						</Box>
					)}
				</Tabs.Root>
			)}
		</Box>
	);
};

export default CollapsiblePanel;