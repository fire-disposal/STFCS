/**
 * 底部战斗面板 - 横向长条布局，6个Tab
 */

import React, { useState } from "react";
import { ChevronUp, ChevronDown } from "lucide-react";
import { Box, Flex, IconButton, Tabs, Text, Tooltip } from "@radix-ui/themes";
import { useUIStore } from "@/state/stores/uiStore";
import "./battle-panel.css";

export interface TabConfig {
	id: string;
	label: string;
	icon: React.ReactNode;
	component: React.ReactNode;
	enabled?: boolean;
}

export interface BattlePanelProps {
	tabs: TabConfig[];
	defaultActiveTab?: string;
}

export const BattlePanel: React.FC<BattlePanelProps> = ({ tabs }) => {
	const [collapsed, setCollapsed] = useState(false);
	const activeTab = useUIStore((state) => state.activeBottomTab);
	const setActiveTab = useUIStore((state) => state.setActiveBottomTab);

	const enabledTabs = tabs.filter((tab) => tab.enabled !== false);
	const safeActiveTab = enabledTabs.some((tab) => tab.id === activeTab) ? activeTab : enabledTabs[0]?.id || "";

	return (
		<Box className={`battle-bar ${collapsed ? "battle-bar--collapsed" : ""}`}>
			<Tabs.Root value={safeActiveTab} onValueChange={setActiveTab}>
				<Flex className="battle-bar__header" align="center" gap="2">
					<Tooltip content={collapsed ? "展开面板" : "折叠面板"}>
						<IconButton variant="ghost" size="1" onClick={() => setCollapsed(!collapsed)} data-magnetic>
							{collapsed ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
						</IconButton>
					</Tooltip>

					{collapsed ? (
						<Text size="1" color="gray">战斗面板</Text>
					) : (
						<Tabs.List className="battle-bar__tabs">
							{enabledTabs.map((tab) => (
								<Tabs.Trigger key={tab.id} value={tab.id} data-magnetic>
									<Flex align="center" gap="1">
										{tab.icon}
										<Text size="1">{tab.label}</Text>
									</Flex>
								</Tabs.Trigger>
							))}
						</Tabs.List>
					)}
				</Flex>

				{!collapsed && (
					<Box className="battle-bar__content">
						{enabledTabs.find((tab) => tab.id === safeActiveTab)?.component}
					</Box>
				)}
			</Tabs.Root>
		</Box>
	);
};

export default BattlePanel;