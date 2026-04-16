/**
 * 战斗命令面板
 *
 * 5列紧凑布局：
 * - 列1：舰船头像 + 基本信息
 * - 列2：船体/辐能/护甲状态条
 * - 列3：移动控制
 * - 列4：武器面板
 * - 列5：技能
 */

import type { MovementPreviewState } from "@/renderer";
import type { ShipState } from "@/sync/types";
import { Rocket } from "lucide-react";
import React from "react";
import { MovementPanel } from "./MovementPanel";
import { ShipPortrait } from "./ShipPortrait";
import { SkillsPanel } from "./SkillsPanel";
import { StatBlocks } from "./StatBlocks";
import { WeaponPanel } from "./WeaponPanel";
import "./index.css";
import "./shared.css";

interface BattleCommandPanelProps {
	selectedShip?: ShipState | null;
	/** 舰船列表（数组形式，来自 Colyseus 同步） */
	ships: ShipState[];
	networkManager: any;
	onToggleShield?: () => void;
	onVent?: () => void;
	disabled?: boolean;
	onMovementPreviewChange?: (preview: MovementPreviewState) => void;
}

export const BattleCommandPanel: React.FC<BattleCommandPanelProps> = ({
	selectedShip,
	ships,
	networkManager,
	onToggleShield,
	onVent,
	disabled = false,
	onMovementPreviewChange,
}) => {
	// 将数组转换为 Map（供 WeaponPanel 使用）
	const shipsMap = React.useMemo(() => {
		const map = new Map<string, ShipState>();
		ships.forEach((ship) => map.set(ship.id, ship));
		return map;
	}, [ships]);

	if (!selectedShip) {
		return (
			<div className="battle-panel">
				<div className="battle-panel__empty">
					<Rocket className="battle-panel__empty-icon" />
					<span>选择舰船以查看详情</span>
				</div>
			</div>
		);
	}

	return (
		<div className="battle-panel">
			{/* 列1：舰船头像 */}
			<div className="battle-panel__column">
				<ShipPortrait ship={selectedShip} />
			</div>

			{/* 列2：状态条 */}
			<div className="battle-panel__column">
				<StatBlocks ship={selectedShip} />
			</div>

			{/* 列3：移动控制 */}
			<div className="battle-panel__column">
				<MovementPanel
					ship={selectedShip}
					disabled={disabled}
					networkManager={networkManager}
					onMovementPreviewChange={onMovementPreviewChange}
				/>
			</div>

			{/* 列4+5：武器面板 + 技能面板 */}
			<div className="battle-panel__column battle-panel__column--combat">
				<WeaponPanel
					ship={selectedShip}
					ships={shipsMap}
					disabled={disabled}
					networkManager={networkManager}
				/>
				<SkillsPanel
					ship={selectedShip}
					disabled={disabled}
					onToggleShield={onToggleShield}
					onVent={onVent}
				/>
			</div>
		</div>
	);
};

export default BattleCommandPanel;
