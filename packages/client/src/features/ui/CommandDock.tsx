/**
 * 命令 Dock 组件
 *
 * 类似星际争霸的底部命令区：
 * - 显示可用操作的按钮网格
 * - 根据选中单位和当前阶段动态变化
 * - 包含移动、护盾、武器、辐能等操作
 */

import type { PlayerRoleValue, ShipState } from "@vt/types";
import { Bomb, Rocket, RotateCcw, Shield, Zap, ZoomIn, ZoomOut } from "lucide-react";
import React, { useMemo } from "react";

interface CommandButton {
	id: string;
	Icon: React.ComponentType<{ className?: string }>;
	label: string;
	shortcut?: string;
	disabled?: boolean;
	active?: boolean;
	variant?: "default" | "primary" | "danger" | "active";
	onClick?: () => void;
}

interface CommandGroup {
	id: string;
	title: string;
	buttons: CommandButton[];
}

interface CommandDockProps {
	selectedShip?: ShipState | null;
	playerRole: PlayerRoleValue;
	onMove?: () => void;
	onToggleShield?: () => void;
	onFire?: () => void;
	onVent?: () => void;
	disabled?: boolean;
}

export const CommandDock: React.FC<CommandDockProps> = ({
	selectedShip,
	playerRole,
	onMove,
	onToggleShield,
	onFire,
	onVent,
	disabled = false,
}) => {
	const commandGroups = useMemo(() => {
		const groups: CommandGroup[] = [];

		if (selectedShip) {
			const shipGroup: CommandGroup = {
				id: "ship_commands",
				title: "舰船命令",
				buttons: [
					{
						id: "move",
						Icon: Rocket,
						label: "移动",
						shortcut: "M",
						disabled: disabled || selectedShip.hasMoved || selectedShip.isOverloaded,
						active: false,
						variant: "default",
						onClick: onMove,
					},
					{
						id: "shield",
						Icon: Shield,
						label: selectedShip.isShieldUp ? "关盾" : "开盾",
						shortcut: "S",
						disabled: disabled || (selectedShip.isOverloaded && !selectedShip.isShieldUp),
						active: selectedShip.isShieldUp,
						variant: selectedShip.isShieldUp ? "active" : "default",
						onClick: onToggleShield,
					},
					{
						id: "fire",
						Icon: Bomb,
						label: "开火",
						shortcut: "F",
						disabled: disabled || selectedShip.hasFired || selectedShip.isOverloaded,
						variant: "danger",
						onClick: onFire,
					},
					{
						id: "vent",
						Icon: Zap,
						label: "排散",
						shortcut: "V",
						disabled:
							disabled ||
							selectedShip.isShieldUp ||
							selectedShip.fluxHard + selectedShip.fluxSoft <= 0,
						variant: "default",
						onClick: onVent,
					},
				],
			};
			groups.push(shipGroup);
		}

		// DM 命令已集成到右侧 DM 控制中心面板，此处不再显示

		const viewGroup: CommandGroup = {
			id: "view_commands",
			title: "视图",
			buttons: [
				{
					id: "zoom_in",
					Icon: ZoomIn,
					label: "放大",
					shortcut: "+",
					variant: "default",
				},
				{
					id: "zoom_out",
					Icon: ZoomOut,
					label: "缩小",
					shortcut: "-",
					variant: "default",
				},
				{
					id: "reset_view",
					Icon: RotateCcw,
					label: "重置",
					shortcut: "R",
					variant: "default",
				},
			],
		};
		groups.push(viewGroup);

		return groups;
	}, [selectedShip, playerRole, disabled, onMove, onToggleShield, onFire, onVent]);

	return (
		<div className="game-layout__command-dock">
			{commandGroups.map((group) => (
				<div key={group.id} className="game-layout__command-section">
					<div className="game-layout__command-section-title">{group.title}</div>
					<div className="game-layout__command-grid">
						{group.buttons.map((btn) => (
							<button
								key={btn.id}
								data-magnetic
								className={`game-layout__command-btn ${
									btn.active ? "game-layout__command-btn--active" : ""
								} ${
									btn.variant === "primary"
										? "game-layout__command-btn--primary"
										: btn.variant === "danger"
											? "game-layout__command-btn--danger"
											: ""
								}`}
								disabled={btn.disabled}
								onClick={btn.onClick}
								title={`${btn.label} (${btn.shortcut || ""})`}
							>
								<btn.Icon className="game-layout__command-btn__icon" />
								<span className="game-layout__command-btn__label">{btn.label}</span>
							</button>
						))}
					</div>
				</div>
			))}
		</div>
	);
};

export default CommandDock;
