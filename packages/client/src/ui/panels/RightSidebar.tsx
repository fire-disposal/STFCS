/**
 * RightSidebar - 右侧栏组件
 *
 * 结构：
 * - 上侧栏：视图控制 + 战斗日志（Tab切换，横向显示）
 * - 下侧栏：舰船预设 + 现实修改 + DM控制（Tab切换，横向显示，仅HOST可见修改和DM控制）
 */

import React, { useMemo } from "react";
import { Eye, FileText, Rocket, Edit, Crown } from "lucide-react";
import { CollapsiblePanel, type TabConfig } from "@/ui/shared/CollapsiblePanel";
import { ViewControlSidebarPanel } from "./ViewControlSidebarPanel";
import { ShipPresetSidebarPanel } from "./ShipPresetSidebarPanel";
import { RealityEditSidebarPanel } from "./RealityEditSidebarPanel";
import { CombatLogPlaceholder } from "./CombatLogPlaceholder";
import { DMControlSidebarPanel } from "./DMControlSidebarPanel";
import type { SocketNetworkManager } from "@/network";
import { useGameCurrentPlayer } from "@/state/stores/gameStore";
import "./right-sidebar.css";

interface RightSidebarProps {
	networkManager: SocketNetworkManager;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
	networkManager,
}) => {
	const currentPlayer = useGameCurrentPlayer();
	const isHost = currentPlayer?.role === "HOST";

	const upperTabs: TabConfig[] = useMemo(() => [
		{
			id: "view-control",
			label: "视图",
			icon: <Eye size={14} />,
			component: <ViewControlSidebarPanel />,
			enabled: true,
		},
		{
			id: "combat-log",
			label: "日志",
			icon: <FileText size={14} />,
			component: <CombatLogPlaceholder />,
			enabled: true,
		},
	], []);

	const lowerTabs: TabConfig[] = useMemo(() => [
		{
			id: "ship-preset",
			label: "预设",
			icon: <Rocket size={14} />,
			component: (
				<ShipPresetSidebarPanel
					networkManager={networkManager}
				/>
			),
			enabled: true,
		},
		{
			id: "reality-edit",
			label: "修改",
			icon: <Edit size={14} />,
			component: <RealityEditSidebarPanel />,
			enabled: Boolean(isHost),
		},
		{
			id: "dm-control",
			label: "DM控制",
			icon: <Crown size={14} />,
			component: (
				<DMControlSidebarPanel
					networkManager={networkManager}
				/>
			),
			enabled: Boolean(isHost),
		},
	], [networkManager, isHost]);

	return (
		<div className="right-sidebar">
			<div className="right-sidebar__upper">
				<CollapsiblePanel
					direction="vertical"
					tabs={upperTabs}
					defaultTab="view-control"
					collapsible={false}
				/>
			</div>

			<div className="right-sidebar__spacer" />

			<div className="right-sidebar__lower">
				<CollapsiblePanel
					direction="vertical"
					tabs={lowerTabs}
					defaultTab="ship-preset"
					collapsible={false}
				/>
			</div>
		</div>
	);
};

export default RightSidebar;
