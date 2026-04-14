import { useCameraAnimation } from "@/hooks/useCameraAnimation";
import { useUIStore } from "@/store/uiStore";
import type { FactionValue, PlayerState, ShipState } from "@vt/contracts";
import { ChevronLeft, ChevronRight, FileText, Monitor, Palette } from "lucide-react";
import React, { useState } from "react";
import { CombatLogPanel } from "./CombatLogPanel";
import { ViewControlPanel } from "./ViewControlPanel";
import { DMControlPanel, DMObjectCreator } from "@/features/dm";

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
	const { cameraPosition, zoom, viewRotation, setCameraPosition, setViewRotation, setZoom } = useUIStore();

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

	if (isCollapsed) {
		return (
			<div className="right-side-panel right-side-panel--collapsed">
				<button
					data-magnetic
					className="right-side-panel__expand-btn"
					onClick={() => setIsCollapsed(false)}
					title="展开面板"
				>
					<ChevronLeft className="game-icon--md" />
				</button>
				<div className="right-side-panel__mini-tabs">
					{tabs.map((tab) => (
						<button
							key={tab.id}
							data-magnetic
							className={`right-side-panel__mini-tab ${activeTab === tab.id ? "right-side-panel__mini-tab--active" : ""}`}
							onClick={() => {
								setActiveTab(tab.id);
								setIsCollapsed(false);
							}}
							title={tab.label}
						>
							<tab.Icon className="game-icon--sm" />
						</button>
					))}
				</div>
			</div>
		);
	}

	return (
		<div className="right-side-panel">
			<button
				data-magnetic
				className="right-side-panel__collapse-btn"
				onClick={() => setIsCollapsed(true)}
				title="折叠面板"
			>
				<ChevronRight className="game-icon--md" />
			</button>

			<div className="right-side-panel__tabs">
				{tabs.map((tab) => (
					<button
						key={tab.id}
						data-magnetic
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
					<ViewControlPanel
						cameraAnimation={cameraAnimation}
						onResetView={onResetView}
					/>
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
	);
};

export default RightSidePanel;