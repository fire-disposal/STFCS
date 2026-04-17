/**
 * 战斗命令面板
 *
 * 三大区域布局：
 * - 面板A（左侧）：舰船立绘 + 信息摘要
 * - 面板B（中间）：Tab切换 + 内容区
 * - 面板C（右侧）：战术工具区
 */

import type { MovementPreviewState } from "@/renderer";
import type { ShipState } from "@/sync/types";
import { Navigation2, Rocket, Settings, Shield, Target, Wind } from "lucide-react";
import React, { useMemo, useState } from "react";
import { MovementPanel } from "./MovementPanel";
import { ShieldPanel } from "./ShieldPanel";
import { ShipPortrait } from "./ShipPortrait";
import { ShipInfoSummary } from "./ShipInfoSummary";
import { SkillsPanel } from "./SkillsPanel";
import { WeaponPanel } from "./WeaponPanel";
import "./index.css";

// Tab定义
const TABS = [
	{ id: "move", label: "移动", icon: Navigation2 },
	{ id: "fire", label: "火控", icon: Target },
	{ id: "shield", label: "护盾", icon: Shield },
	{ id: "skill", label: "技能", icon: Wind },
	{ id: "config", label: "舰装", icon: Settings },
] as const;

type TabId = typeof TABS[number]["id"];

// 战术工具按钮（占位）
const TOOL_BUTTONS = [
	{ id: "A", label: "占位A" },
	{ id: "B", label: "占位B" },
	{ id: "C", label: "占位C" },
	{ id: "D", label: "占位D" },
];

interface BattleCommandPanelProps {
	selectedShip?: ShipState | null;
	ships: ShipState[];
	networkManager: any;
	onToggleShield?: () => void;
	onSetShieldOrientation?: (orientation: number) => void;
	onVent?: () => void;
	disabled?: boolean;
	onMovementPreviewChange?: (preview: MovementPreviewState) => void;
}

export const BattleCommandPanel: React.FC<BattleCommandPanelProps> = ({
	selectedShip,
	ships,
	networkManager,
	onToggleShield,
	onSetShieldOrientation,
	onVent,
	disabled = false,
	onMovementPreviewChange,
}) => {
	const [activeTab, setActiveTab] = useState<TabId>("move");

	// 舰船Map
	const shipsMap = useMemo(() => {
		const map = new Map<string, ShipState>();
		ships.forEach((ship) => map.set(ship.id, ship));
		return map;
	}, [ships]);

	// 渲染Tab内容
	const renderTabContent = () => {
		if (!selectedShip) {
			return (
				<div className="battle-panel__placeholder">
					<Rocket className="battle-panel__placeholder-icon" />
					<span>选择舰船以操作</span>
				</div>
			);
		}

		switch (activeTab) {
			case "move":
				return (
					<MovementPanel
						ship={selectedShip}
						disabled={disabled}
						networkManager={networkManager}
						onMovementPreviewChange={onMovementPreviewChange}
					/>
				);
			case "fire":
				return (
					<WeaponPanel
						ship={selectedShip}
						ships={shipsMap}
						disabled={disabled}
						networkManager={networkManager}
					/>
				);
			case "shield":
				return (
					<ShieldPanel
						ship={selectedShip}
						disabled={disabled}
						onToggleShield={onToggleShield}
						onSetShieldOrientation={onSetShieldOrientation}
					/>
				);
			case "skill":
				return (
					<SkillsPanel
						ship={selectedShip}
						disabled={disabled}
						onVent={onVent}
					/>
				);
			case "config":
				return (
					<div className="battle-panel__placeholder">
						<Settings className="battle-panel__placeholder-icon" />
						<span>舰装配置（开发中）</span>
					</div>
				);
			default:
				return null;
		}
	};

	return (
		<div className="game-layout__battle-panel">
			<div className="battle-panel">
				{/* 面板A：舰船立绘 + 信息摘要 */}
				<div className="battle-panel__section-a">
					<div className="battle-panel__portrait-side">
						{selectedShip ? (
							<ShipPortrait ship={selectedShip} />
						) : (
							<div className="battle-panel__portrait-placeholder">
								<Rocket className="battle-panel__portrait-placeholder-icon" />
							</div>
						)}
					</div>
					<div className="battle-panel__info-side">
						{selectedShip ? (
							<ShipInfoSummary ship={selectedShip} />
						) : (
							<div className="battle-panel__placeholder">
								<span>未选择舰船</span>
							</div>
						)}
					</div>
				</div>

				{/* 面板B：Tab操作区 */}
				<div className="battle-panel__section-b">
					<div className="battle-panel__tab-bar">
						{TABS.map((tab) => {
							const Icon = tab.icon;
							return (
								<button
									key={tab.id}
									className={`battle-panel__tab-btn ${activeTab === tab.id ? "battle-panel__tab-btn--active" : ""}`}
									onClick={() => setActiveTab(tab.id)}
									title={tab.label}
								>
									<Icon className="battle-panel__tab-icon" />
									<span className="battle-panel__tab-label">{tab.label}</span>
								</button>
							);
						})}
					</div>
					<div className="battle-panel__tab-content">
						{renderTabContent()}
					</div>
				</div>

				{/* 面板C：战术工具区 */}
				<div className="battle-panel__section-c">
					<div className="battle-panel__tools-header">工具</div>
					{TOOL_BUTTONS.map((btn) => (
						<button key={btn.id} className="battle-panel__tools-btn">
							{btn.label}
						</button>
					))}
				</div>
			</div>
		</div>
	);
};

export default BattleCommandPanel;