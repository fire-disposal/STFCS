/**
 * 右侧面板组件
 *
 * 包含三个栏目：
 * - 视图：坐标、角度、缩放控制和图层显示
 * - 日志：战斗日志
 * - DM：DM 控制中心
 *
 * 支持向右折叠收缩
 */

import { useCameraAnimation } from "@/hooks/useCameraAnimation";
import { useUIStore } from "@/store/uiStore";
import type { Room } from "@colyseus/sdk";
import type { FactionValue, GameRoomState, PlayerState, ShipState } from "@vt/contracts";
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
	room: Room<GameRoomState> | null;
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
	isPlacementMode: boolean;
	onTogglePlacementMode: () => void;
	onCreateTestShip: (faction: "player" | "dm", x: number, y: number) => void;
	onClearOverload: (shipId: string) => void;
	onSetArmor: (shipId: string, section: number, value: number) => void;
	onAssignShip: (shipId: string, targetSessionId: string) => void;
	onNextPhase: () => void;
	// 视图控制相关
	zoom: number;
	cameraX: number;
	cameraY: number;
	viewRotation: number;
	showGrid: boolean;
	showBackground: boolean;
	showWeaponArcs: boolean;
	showMovementRange: boolean;
	onZoomChange: (zoom: number) => void;
	onCameraChange: (x: number, y: number) => void;
	onViewRotationChange: (rotation: number) => void;
	onToggleGrid: () => void;
	onToggleBackground: () => void;
	onToggleWeaponArcs: () => void;
	onToggleMovementRange: () => void;
	onResetView: () => void;
}

export const RightSidePanel: React.FC<RightSidePanelProps> = ({
	room,
	isDM,
	ships,
	players,
	onCreateObject,
	isPlacementMode,
	onTogglePlacementMode,
	onCreateTestShip,
	onClearOverload,
	onSetArmor,
	onAssignShip,
	onNextPhase,
	// 视图控制
	zoom,
	cameraX,
	cameraY,
	viewRotation,
	showGrid,
	showBackground,
	showWeaponArcs,
	showMovementRange,
	onZoomChange,
	onCameraChange,
	onViewRotationChange,
	onToggleGrid,
	onToggleBackground,
	onToggleWeaponArcs,
	onToggleMovementRange,
	onResetView,
}) => {
	const [activeTab, setActiveTab] = useState<TabId>("view");
	const [isCollapsed, setIsCollapsed] = useState(false);

	// 摄像机动画 Hook
	const cameraAnimation = useCameraAnimation({
		onCameraChange,
		onViewRotationChange,
		onZoomChange,
		currentX: cameraX,
		currentY: cameraY,
		currentRotation: viewRotation,
		currentZoom: zoom,
	});

	// 游标状态
	const { mapCursor, setMapCursor, clearMapCursor } = useUIStore();

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
			{/* 折叠按钮 */}
			<button
				data-magnetic
				className="right-side-panel__collapse-btn"
				onClick={() => setIsCollapsed(true)}
				title="折叠面板"
			>
				<ChevronRight className="game-icon--md" />
			</button>

			{/* Tab 头部 */}
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

			{/* Tab 内容 */}
			<div className="right-side-panel__content">
				{activeTab === "view" && (
					<ViewControlPanel
						zoom={zoom}
						cameraX={cameraX}
						cameraY={cameraY}
						viewRotation={viewRotation}
						showGrid={showGrid}
						showBackground={showBackground}
						showWeaponArcs={showWeaponArcs}
						showMovementRange={showMovementRange}
						onZoomChange={onZoomChange}
						onCameraChange={onCameraChange}
						onViewRotationChange={onViewRotationChange}
						onToggleGrid={onToggleGrid}
						onToggleBackground={onToggleBackground}
						onToggleWeaponArcs={onToggleWeaponArcs}
						onToggleMovementRange={onToggleMovementRange}
						cameraAnimation={cameraAnimation}
						onResetView={onResetView}
						mapCursor={mapCursor}
						onSetMapCursor={setMapCursor}
						onClearMapCursor={clearMapCursor}
						cursorR={mapCursor?.heading ?? null}
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

// DM 组件导入（复用现有组件）
import { DMControlPanel, DMObjectCreator } from "@/features/dm";

export default RightSidePanel;
