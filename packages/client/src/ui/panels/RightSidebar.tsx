/**
 * RightSidebar - 右侧栏组件
 *
 * 结构：
 * - 上折叠栏：视图控制 + 战斗Log（占位）
 * - 下折叠栏：舰船预设 + 现实修改（仅HOST可见）
 *
 * 折叠时：仅显示展开按钮条（32px）
 */

import React, { useMemo } from "react";
import { Eye, FileText, Rocket, Edit } from "lucide-react";
import { CollapsiblePanel, type TabConfig } from "@/ui/shared/CollapsiblePanel";
import { ViewControlSidebarPanel } from "./ViewControlSidebarPanel";
import { ShipPresetSidebarPanel } from "./ShipPresetSidebarPanel";
import { RealityEditSidebarPanel } from "./RealityEditSidebarPanel";
import { CombatLogPlaceholder } from "./CombatLogPlaceholder";
import type { SocketNetworkManager } from "@/network";
import type { RoomPlayerState } from "@vt/data";
import "./right-sidebar.css";

interface RightSidebarProps {
	networkManager: SocketNetworkManager;
	players: Record<string, RoomPlayerState>;
	isHost: boolean;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({
	networkManager,
	players,
	isHost,
}) => {
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
			component: (
				<RealityEditSidebarPanel
					players={players}
				/>
			),
			enabled: Boolean(isHost),
		},
	], [networkManager, players, isHost]);

	return (
		<div className="right-sidebar">
			<div className="right-sidebar__upper">
				<CollapsiblePanel
					direction="vertical"
					tabs={upperTabs}
					defaultTab="view-control"
					defaultCollapsed={false}
					position="top"
				/>
			</div>

			<div className="right-sidebar__spacer" />

			<div className="right-sidebar__lower">
				<CollapsiblePanel
					direction="vertical"
					tabs={lowerTabs}
					defaultTab="ship-preset"
					defaultCollapsed={false}
					position="bottom"
				/>
			</div>
		</div>
	);
};

export default RightSidebar;