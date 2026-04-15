import { DMControlPanel, DMObjectCreator } from "@/features/dm";
import { useCameraAnimation } from "@/hooks/useCameraAnimation";
import { useUIStore } from "@/store/uiStore";
import type { FactionValue, PlayerState, ShipState } from "@vt/types";
import { ChevronLeft, ChevronRight, FileText, Monitor, Palette } from "lucide-react";
import React, { useState } from "react";
import { CombatLogPanel } from "./CombatLogPanel";
import { ViewControlPanel } from "./ViewControlPanel";

type TabId = "view" | "log" | "dm";

interface TabDef {
	id: TabId;
	label: string;
	Icon: React.ComponentType<{ className?: string }>;
}

interface RightSidePanelProps {
	isDM: boolean;
	ships: ShipState[];
	players: PlayerState[];
	onCreateObject: (payload: {
		type: "ship" | "station" | "asteroid";
		hullId?: string;
		x: number;
		y: number;
		heading: number;
		faction: FactionValue;
		ownerId?: string;
		name?: string;
	}) => void;
	onCreateTestShip: (faction: "player" | "dm", x: number, y: number) => void;
	onClearOverload: (shipId: string) => void;
	onSetArmor: (shipId: string, section: number, value: number) => void;
	onAssignShip: (shipId: string, targetSessionId: string) => void;
	onNextPhase: () => void;
	onResetView: () => void;
}

export const RightSidePanel: React.FC<RightSidePanelProps> = ({
	isDM,
	ships,
	players,
	onCreateObject,
	onCreateTestShip,
	onClearOverload,
	onSetArmor,
	onAssignShip,
	onNextPhase,
	onResetView,
}) => {
	const [activeTab, setActiveTab] = useState<TabId>("view");
	const [isCollapsed, setIsCollapsed] = useState(false);
	const { cameraPosition, zoom, viewRotation, setCameraPosition, setViewRotation, setZoom } =
		useUIStore();

	const cameraAnimation = useCameraAnimation({
		onCameraChange: setCameraPosition,
		onViewRotationChange: setViewRotation,
		onZoomChange: setZoom,
		currentX: cameraPosition.x,
		currentY: cameraPosition.y,
		currentRotation: viewRotation,
		currentZoom: zoom,
	});

	const { mapCursor } = useUIStore();

	const tabs: TabDef[] = [
		{ id: "view", label: "视图", Icon: Monitor },
		{ id: "log", label: "日志", Icon: FileText },
		...(isDM ? [{ id: "dm", label: "DM", Icon: Palette } as TabDef] : []),
	];

	const ToggleButton = ({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) => (
		<button
			data-magnetic
			className={collapsed ? "right-side-panel__expand-btn" : "right-side-panel__collapse-btn"}
			onClick={onClick}
			title={collapsed ? "展开面板" : "折叠面板"}
		>
			{collapsed ? (
				<ChevronRight style={{ width: 12, height: 12 }} />
			) : (
				<ChevronLeft style={{ width: 12, height: 12 }} />
			)}
		</button>
	);

	return (
		<div className={`right-side-panel ${isCollapsed ? "right-side-panel--collapsed" : ""}`}>
			{/* 内容区 - 收起时不渲染 */}
			{!isCollapsed && (
				<div className="right-side-panel__content-wrapper">
					<div className="right-side-panel__tabs">
						{tabs.map((tab) => (
							<button
								key={tab.id}
								className={`right-side-panel__tab ${activeTab === tab.id ? "right-side-panel__tab--active" : ""}`}
								onClick={() => setActiveTab(tab.id)}
							>
								<tab.Icon className="right-side-panel__tab-icon" />
								<span className="right-side-panel__tab-label">{tab.label}</span>
							</button>
						))}
					</div>

					<div className="right-side-panel__content">
						{activeTab === "view" && (
							<ViewControlPanel cameraAnimation={cameraAnimation} onResetView={onResetView} />
						)}

						{activeTab === "log" && (
							<CombatLogPanel isOpen={true} onClose={() => setActiveTab("view")} />
						)}

						{activeTab === "dm" && isDM && (
							<div className="dm-panel">
								<DMObjectCreator
									onCreateObject={onCreateObject}
									players={players
										.filter((p) => p.role !== "DM")
										.map((p) => ({
											sessionId: p.sessionId,
											name: p.nickname || p.name,
											role: p.role,
										}))}
									mapCursor={mapCursor}
								/>

								<DMControlPanel
									ships={ships}
									players={players}
									isDM={true}
									onCreateTestShip={onCreateTestShip}
									onClearOverload={onClearOverload}
									onSetArmor={onSetArmor}
									onAssignShip={onAssignShip}
									onNextPhase={onNextPhase}
								/>
							</div>
						)}
					</div>
				</div>
			)}

			{/* 右侧固定条 - 始终可见 */}
			<div className="right-side-panel__strip">
				<ToggleButton collapsed={isCollapsed} onClick={() => setIsCollapsed(!isCollapsed)} />
			</div>
		</div>
	);
};

export default RightSidePanel;
