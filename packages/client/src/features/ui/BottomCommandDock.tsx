/**
 * 底部命令 Dock 组件 - 星际争霸风格布局
 *
 * 布局结构：
 * - 左侧：舰船立绘预留区
 * - 中部：舰船信息 / 辐能 / 护甲整合展示区
 * - 右侧：武器操作区 / 舰船技能区
 */

import type { ShipState } from "@vt/contracts";
import { Faction } from "@vt/contracts";
import {
	Activity,
	Bomb,
	Crosshair,
	Heart,
	Navigation2,
	Rocket,
	Shield,
	Target,
	Wind,
	Zap,
} from "lucide-react";
import React, { useMemo } from "react";

interface BottomCommandDockProps {
	selectedShip?: ShipState | null;
	playerRole: string;
	onMove?: () => void;
	onToggleShield?: () => void;
	onFire?: () => void;
	onVent?: () => void;
	onVentFlux?: () => void;
	disabled?: boolean;
}

const quadrantNames = ["前", "前右", "后右", "后", "后左", "前左"];

export const BottomCommandDock: React.FC<BottomCommandDockProps> = ({
	selectedShip,
	playerRole,
	onMove,
	onToggleShield,
	onFire,
	onVent,
	onVentFlux,
	disabled = false,
}) => {
	// 计算护甲百分比
	const armorPercentages = useMemo(() => {
		if (!selectedShip) return [];
		return selectedShip.armorCurrent.map((current: number, i: number) => {
			const max = selectedShip.armorMax[i] || 1;
			return Math.round((current / max) * 100);
		});
	}, [selectedShip]);

	// 计算辐能百分比
	const fluxPercentage = useMemo(() => {
		if (!selectedShip || selectedShip.fluxMax <= 0) return 0;
		return Math.round(
			((selectedShip.fluxHard + selectedShip.fluxSoft) / selectedShip.fluxMax) * 100
		);
	}, [selectedShip]);

	// 计算船体百分比
	const hullPercentage = useMemo(() => {
		if (!selectedShip || selectedShip.hullMax <= 0) return 0;
		return Math.round((selectedShip.hullCurrent / selectedShip.hullMax) * 100);
	}, [selectedShip]);

	// 获取颜色
	const getArmorColor = (percent: number): string => {
		if (percent > 75) return "#2ecc71";
		if (percent > 50) return "#f1c40f";
		if (percent > 25) return "#e67e22";
		return "#e74c3c";
	};

	const getFluxColor = (percent: number, isOverloaded: boolean): string => {
		if (isOverloaded) return "#e74c3c";
		if (percent > 80) return "#e67e22";
		if (percent > 50) return "#f1c40f";
		return "#3498db";
	};

	const getHullColor = (percent: number): string => {
		if (percent > 50) return "#2ecc71";
		if (percent > 25) return "#e67e22";
		return "#e74c3c";
	};

	if (!selectedShip) {
		return (
			<div className="bottom-command-dock">
				<div className="bottom-command-dock__empty">
					<Rocket className="game-icon--lg" />
					<span>未选择舰船</span>
				</div>
			</div>
		);
	}

	const isPlayer = selectedShip.faction === Faction.PLAYER;

	return (
		<div className="bottom-command-dock">
			{/* 左侧：舰船立绘区 */}
			<div className="bottom-command-dock__ship-portrait">
				<div className="ship-portrait">
					<div className="ship-portrait__frame">
						<Rocket className="ship-portrait__icon" />
					</div>
					<div className="ship-portrait__info">
						<div className="ship-portrait__name">{selectedShip.hullType || "舰船"}</div>
						<div
							className={`ship-portrait__faction ${isPlayer ? "faction--player" : "faction--dm"}`}
						>
							{isPlayer ? "友军" : "敌方"}
						</div>
						<div className="ship-portrait__id">ID: {selectedShip.id.slice(-8)}</div>
					</div>
				</div>
			</div>

			{/* 中部：信息展示区 */}
			<div className="bottom-command-dock__info-section">
				{/* 船体状态 */}
				<div className="info-block info-block--hull">
					<div className="info-block__header">
						<Heart className="info-block__icon" style={{ color: "#e74c3c" }} />
						<span className="info-block__title">船体</span>
						<span className="info-block__value">
							{Math.round(selectedShip.hullCurrent)} / {selectedShip.hullMax}
						</span>
					</div>
					<div className="info-block__bar">
						<div
							className="info-block__bar-fill"
							style={{ width: `${hullPercentage}%`, backgroundColor: getHullColor(hullPercentage) }}
						/>
					</div>
				</div>

				{/* 辐能系统 */}
				<div className="info-block info-block--flux">
					<div className="info-block__header">
						<Zap className="info-block__icon" style={{ color: "#f1c40f" }} />
						<span className="info-block__title">辐能</span>
						<span className="info-block__value">
							{Math.round(selectedShip.fluxSoft + selectedShip.fluxHard)} / {selectedShip.fluxMax}
						</span>
					</div>
					<div className="info-block__bar">
						<div
							className="info-block__bar-fill"
							style={{
								width: `${fluxPercentage}%`,
								backgroundColor: getFluxColor(fluxPercentage, selectedShip.isOverloaded),
							}}
						/>
					</div>
					<div className="info-block__sub-stats">
						<span className="sub-stat">软：{Math.round(selectedShip.fluxSoft)}</span>
						<span className="sub-stat">硬：{Math.round(selectedShip.fluxHard)}</span>
						{selectedShip.isOverloaded && (
							<span className="sub-stat sub-stat--warning">
								过载 {Math.round(selectedShip.overloadTime)}s
							</span>
						)}
					</div>
				</div>

				{/* 护甲状态 - 6 象限 */}
				<div className="info-block info-block--armor">
					<div className="info-block__header">
						<Shield className="info-block__icon" style={{ color: "#f39c12" }} />
						<span className="info-block__title">护甲</span>
					</div>
					<div className="armor-grid">
						{armorPercentages.map((percent: number, i: number) => (
							<div
								key={i}
								className="armor-cell"
								style={{ borderColor: getArmorColor(percent) }}
								title={`${quadrantNames[i]}: ${selectedShip.armorCurrent[i]}/${selectedShip.armorMax[i]}`}
							>
								<span className="armor-cell__name">{quadrantNames[i]}</span>
								<span className="armor-cell__value">{selectedShip.armorCurrent[i]}</span>
							</div>
						))}
					</div>
				</div>

				{/* 机动参数 */}
				<div className="info-block info-block--movement">
					<div className="info-block__header">
						<Navigation2 className="info-block__icon" style={{ color: "#3498db" }} />
						<span className="info-block__title">机动</span>
					</div>
					<div className="movement-stats">
						<div className="movement-stat">
							<span className="movement-stat__label">速度</span>
							<span className="movement-stat__value">{selectedShip.maxSpeed}</span>
						</div>
						<div className="movement-stat">
							<span className="movement-stat__label">转向</span>
							<span className="movement-stat__value">{selectedShip.maxTurnRate}°</span>
						</div>
						<div className="movement-stat">
							<span className="movement-stat__label">加速</span>
							<span className="movement-stat__value">{selectedShip.acceleration}</span>
						</div>
						<div className="movement-stat">
							<span className="movement-stat__label">朝向</span>
							<span className="movement-stat__value">
								{selectedShip.transform.heading.toFixed(0)}°
							</span>
						</div>
					</div>
				</div>
			</div>

			{/* 右侧：操作区 */}
			<div className="bottom-command-dock__action-section">
				{/* 武器操作区 */}
				<div className="action-group">
					<div className="action-group__title">
						<Crosshair className="action-group__icon" />
						<span>武器系统</span>
					</div>
					<div className="action-buttons">
						<button
							data-magnetic
							className="action-btn action-btn--fire"
							onClick={onFire}
							disabled={disabled || selectedShip.hasFired || selectedShip.isOverloaded}
						>
							<Bomb className="action-btn__icon" />
							<span className="action-btn__label">开火</span>
						</button>
						{Array.from(selectedShip.weapons.values()).map((weapon, index) => {
							const w = weapon as unknown as { mountId: string; name: string; damageType: string };
							return (
								<button
									key={weapon.mountId}
									data-magnetic
									className="action-btn action-btn--weapon"
									disabled={disabled}
									title={w.name || weapon.mountId}
								>
									<Target className="action-btn__icon" />
									<span className="action-btn__label">武器 {index + 1}</span>
								</button>
							);
						})}
					</div>
				</div>

				{/* 舰船技能区 */}
				<div className="action-group">
					<div className="action-group__title">
						<Activity className="action-group__icon" />
						<span>舰船技能</span>
					</div>
					<div className="action-buttons">
						<button
							data-magnetic
							className="action-btn action-btn--move"
							onClick={onMove}
							disabled={disabled || selectedShip.hasMoved || selectedShip.isOverloaded}
						>
							<Rocket className="action-btn__icon" />
							<span className="action-btn__label">移动</span>
						</button>
						<button
							data-magnetic
							className={`action-btn action-btn--shield ${selectedShip.isShieldUp ? "action-btn--active" : ""}`}
							onClick={onToggleShield}
							disabled={disabled || (selectedShip.isOverloaded && !selectedShip.isShieldUp)}
						>
							<Shield className="action-btn__icon" />
							<span className="action-btn__label">{selectedShip.isShieldUp ? "关盾" : "开盾"}</span>
						</button>
						<button
							data-magnetic
							className="action-btn action-btn--vent"
							onClick={onVent}
							disabled={
								disabled ||
								selectedShip.isShieldUp ||
								selectedShip.fluxHard + selectedShip.fluxSoft <= 0
							}
						>
							<Wind className="action-btn__icon" />
							<span className="action-btn__label">排散</span>
						</button>
					</div>
				</div>

				{/* 状态指示 */}
				<div className="action-group action-group--status">
					<div className="status-indicators">
						{selectedShip.hasMoved && (
							<span className="status-badge status-badge--used">已移动</span>
						)}
						{selectedShip.hasFired && (
							<span className="status-badge status-badge--used">已开火</span>
						)}
						{selectedShip.isShieldUp && (
							<span className="status-badge status-badge--shield">护盾开启</span>
						)}
						{selectedShip.isOverloaded && (
							<span className="status-badge status-badge--overload">过载</span>
						)}
					</div>
				</div>
			</div>
		</div>
	);
};

export default BottomCommandDock;
