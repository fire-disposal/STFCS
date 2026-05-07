/**
 * RightSidebar - 右侧栏组件
 *
 * 根据 mode 动态调整 Tab：
 * - COMBAT/DEPLOYMENT: 视图 + 日志 + 预设 + 修改 + DM
 * - WORLD: 星图信息 + 日志 + DM
 */

import React, { useMemo } from "react";
import { Eye, FileText, Rocket, Edit, Crown, Globe } from "lucide-react";
import { CollapsiblePanel, type TabConfig } from "@/ui/shared/CollapsiblePanel";
import { ViewControlSidebarPanel } from "./ViewControlSidebarPanel";
import { ShipPresetSidebarPanel } from "./ShipPresetSidebarPanel";
import { RealityEditSidebarPanel } from "./RealityEditSidebarPanel";
import { CombatLogPanel } from "./CombatLogPanel";
import { DMControlSidebarPanel } from "./DMControlSidebarPanel";
import { WorldInfoPanel } from "./WorldInfoPanel";
import type { SocketNetworkManager } from "@/network";
import { useGameCurrentPlayer, useGameMode } from "@/state/stores/gameStore";
import "./right-sidebar.css";

interface RightSidebarProps {
	networkManager: SocketNetworkManager;
}

export const RightSidebar: React.FC<RightSidebarProps> = ({ networkManager }) => {
	const currentPlayer = useGameCurrentPlayer();
	const gameMode = useGameMode();
	const isHost = currentPlayer?.role === "HOST";
	const isWorld = gameMode === "WORLD";

	const upperTabs: TabConfig[] = useMemo(() => {
		const tabs: TabConfig[] = [];
		if (isWorld) {
			tabs.push({
				id: "world-info",
				label: "星图",
				icon: <Globe size={14} />,
				component: <WorldInfoPanel />,
				enabled: true,
			});
		} else {
			tabs.push({
				id: "view-control",
				label: "视图",
				icon: <Eye size={14} />,
				component: <ViewControlSidebarPanel />,
				enabled: true,
			});
		}
		tabs.push({
			id: "combat-log",
			label: "日志",
			icon: <FileText size={14} />,
			component: <CombatLogPanel />,
			enabled: true,
		});
		return tabs;
	}, [isWorld]);

	const lowerTabs: TabConfig[] = useMemo(
		() => [
			{
				id: "ship-preset",
				label: "预设",
				icon: <Rocket size={14} />,
				component: <ShipPresetSidebarPanel networkManager={networkManager} />,
				enabled: !isWorld,
			},
			{
				id: "reality-edit",
				label: "修改",
				icon: <Edit size={14} />,
				component: <RealityEditSidebarPanel />,
				enabled: Boolean(isHost) && !isWorld,
			},
			{
				id: "dm-control",
				label: "DM控制",
				icon: <Crown size={14} />,
				component: <DMControlSidebarPanel networkManager={networkManager} />,
				enabled: Boolean(isHost),
			},
		],
		[networkManager, isHost, isWorld]
	);

	return (
		<div className="right-sidebar">
			<div className="right-sidebar__upper">
				<CollapsiblePanel
					direction="vertical"
					tabs={upperTabs}
					defaultTab={isWorld ? "world-info" : "view-control"}
					collapsible={false}
				/>
			</div>
			<div className="right-sidebar__spacer" />
			<div className="right-sidebar__lower">
				<CollapsiblePanel
					direction="vertical"
					tabs={lowerTabs}
					defaultTab="dm-control"
					collapsible={false}
				/>
			</div>
		</div>
	);
};

export default RightSidebar;
