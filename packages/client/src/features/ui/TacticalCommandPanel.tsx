/**
 * 战术指挥面板组件
 * 位于底部，纯游戏相关功能，无系统设置按钮
 * 提供舰船操作、武器控制、状态显示等战术功能
 */

import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector } from "@/store";
import { Shield, Zap, Target, Move, Crosshair, AlertTriangle } from "lucide-react";
import { useRoomOperations } from "@/room";
import type { RoomClient, OperationMap } from "@/room";

interface TacticalCommandPanelProps {
	className?: string;
	// 房间客户端
	client: RoomClient<OperationMap> | null;
	// GameView 传递的 props
	phase?: string;
	round?: number;
	turnPhase?: string;
	tokens?: Record<string, unknown>;
	selectedTokenId?: string | null;
}

/**
 * 战术指挥面板
 *
 * 设计原则:
 * 1. 纯游戏相关 - 只包含战术操作，无系统设置
 * 2. 动态自适应 - 根据选中对象类型切换显示
 * 3. 信息密度高 - 在有限空间展示关键数据
 * 4. 硬朗风格 - 最小圆角，锐利线条
 * 5. 统一样式 - 使用设计系统CSS变量
 */
export const TacticalCommandPanel: React.FC<TacticalCommandPanelProps> = ({
	className = "",
	client,
}) => {
	const { t } = useTranslation();

	// 展开/折叠状态
	const [isExpanded, setIsExpanded] = useState(false);

	// 当前选中标签
	const [activeTab, setActiveTab] = useState<"move" | "weapons" | "systems">("move");

	// 获取房间操作调用器
	const ops = useRoomOperations(client);

	// 从Redux获取状态
	const selectedTokenId = useAppSelector((state) => state.selection.selectedTokenId);
	const tokens = useAppSelector((state) => state.map.tokens);
	const ships = useAppSelector((state) => state.ship.ships);
	const currentFaction = useAppSelector((state) => state.factionTurn.currentFaction);
	const selectedFaction = useAppSelector((state) => state.faction.selectedFaction);
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const players = useAppSelector((state) => state.player.players);
	const currentPlayer = currentPlayerId ? players[currentPlayerId] : null;

	// 获取选中单位数据
	const selectedToken = selectedTokenId ? tokens[selectedTokenId] : null;
	const selectedShip = selectedTokenId ? ships[selectedTokenId] : null;

	// 判断当前玩家是否属于当前行动阵营
	const isCurrentTurn = selectedFaction === currentFaction;

	// 处理单位选择
	const handleUnitClick = useCallback(() => {
		if (selectedTokenId) {
			setIsExpanded(!isExpanded);
		}
	}, [selectedTokenId, isExpanded]);

	// 处理结束回合
	const handleEndTurn = useCallback(async () => {
		if (!currentPlayerId || !selectedFaction) return;

		try {
			await ops?.endTurn();
		} catch (error) {
			console.error('Failed to end turn:', error);
		}
	}, [currentPlayerId, selectedFaction, ops]);

	// 处理紧急规避
	const handleEmergencyEvasion = useCallback(async () => {
		if (!selectedTokenId) return;

		try {
			// 紧急规避：结束舰船行动
			await ops?.endShipAction(selectedTokenId);
		} catch (error) {
			console.error('Failed to execute emergency evasion:', error);
		}
	}, [selectedTokenId, ops]);

	// 处理护盾开关
	const handleShieldToggle = useCallback(async () => {
		if (!selectedTokenId) return;

		try {
			await ops?.toggleShield(selectedTokenId);
		} catch (error) {
			console.error('Failed to toggle shield:', error);
		}
	}, [selectedTokenId, ops]);

	// 处理散热
	const handleVentFlux = useCallback(async () => {
		if (!selectedTokenId) return;

		try {
			await ops?.ventFlux(selectedTokenId);
		} catch (error) {
			console.error('Failed to vent flux:', error);
		}
	}, [selectedTokenId, ops]);

	// 渲染单位概览
	const renderUnitOverview = () => {
		if (!selectedToken) {
			return (
				<div className="tcp-unit-empty">
					<span className="tcp-empty-text">{t("tactical.noSelection")}</span>
				</div>
			);
		}

		const isShip = selectedToken.type === "ship";
		const shipData = isShip ? selectedShip : null;

		return (
			<div className="tcp-unit-overview">
				{/* 单位缩略图 */}
				<div className="tcp-unit-thumbnail">
					<div className={`tcp-unit-icon tcp-unit-icon--${selectedToken.type}`}>
						{isShip ? <Target size={20} /> : <Crosshair size={20} />}
					</div>
					{/* 朝向指示器 */}
					<div
						className="tcp-heading-indicator"
						style={{ transform: `rotate(${selectedToken.heading}deg)` }}
					/>
				</div>

				{/* 单位信息 */}
				<div className="tcp-unit-info">
					<div className="tcp-unit-name">
						{(selectedToken.metadata?.name as string) || selectedToken.id}
						{isCurrentTurn && <span className="tcp-turn-badge">{t("tactical.current")}</span>}
					</div>
					<div className="tcp-unit-type">
						{t(`token.type.${selectedToken.type}`)} · {selectedToken.ownerId}
					</div>

					{/* 状态条 */}
					{shipData && (
						<div className="tcp-status-bars">
							<div className="tcp-status-bar">
								<div className="tcp-bar-label">{t("status.shield")}</div>
								<div className="tcp-bar-track">
									<div
										className="tcp-bar-fill tcp-bar-fill--shield"
										style={{
											width: `${(shipData.shield.current / shipData.shield.max) * 100}%`
										}}
									/>
								</div>
								<span className="tcp-bar-value">
									{Math.round((shipData.shield.current / shipData.shield.max) * 100)}%
								</span>
							</div>
						</div>
					)}
				</div>

				{/* 展开按钮 */}
				<button
					className="tcp-expand-btn"
					onClick={handleUnitClick}
					type="button"
					aria-label={isExpanded ? "Collapse panel" : "Expand panel"}
				>
					{isExpanded ? "▲" : "▼"}
				</button>
			</div>
		);
	};

	// 渲染中央控制台
	const renderCommandConsole = () => {
		if (!selectedToken || selectedToken.type !== "ship") {
			return (
				<div className="tcp-console-empty">
					<div className="tcp-global-status">
						<span className="tcp-global-label">{t("tactical.globalView")}</span>
						<span className="tcp-current-unit">
							{t("tactical.currentTurn")}: {currentFaction === 'federation' ? t('faction.federation') : t('faction.empire')}
						</span>
					</div>
				</div>
			);
		}

		return (
			<div className="tcp-command-console">
				{/* 标签切换 */}
				<div className="tcp-console-tabs">
					<button
						className={`btn-tactical-tab ${activeTab === "move" ? "active" : ""}`}
						onClick={() => setActiveTab("move")}
						type="button"
					>
						<Move size={14} />
						<span>{t("tactical.move")}</span>
					</button>
					<button
						className={`btn-tactical-tab ${activeTab === "weapons" ? "active" : ""}`}
						onClick={() => setActiveTab("weapons")}
						type="button"
					>
						<Crosshair size={14} />
						<span>{t("tactical.weapons")}</span>
					</button>
					<button
						className={`btn-tactical-tab ${activeTab === "systems" ? "active" : ""}`}
						onClick={() => setActiveTab("systems")}
						type="button"
					>
						<Zap size={14} />
						<span>{t("tactical.systems")}</span>
					</button>
				</div>

				{/* 控制台内容 */}
				<div className="tcp-console-content">
					{activeTab === "move" && (
						<div className="tcp-move-controls">
							<div className="tactical-control-placeholder">
								<Move size={24} />
								<span>{t("tactical.headingControl")}</span>
							</div>
							<div className="tactical-control-placeholder">
								<Target size={24} />
								<span>{t("tactical.distanceControl")}</span>
							</div>
						</div>
					)}
					{activeTab === "weapons" && (
						<div className="tcp-weapons-controls">
							<div className="tactical-control-placeholder">
								<Crosshair size={24} />
								<span>{t("tactical.weaponMounts")}</span>
							</div>
						</div>
					)}
					{activeTab === "systems" && (
						<div className="tcp-systems-controls">
							<div className="tactical-control-placeholder">
								<Zap size={24} />
								<span>{t("tactical.systemManagement")}</span>
							</div>
						</div>
					)}
				</div>
			</div>
		);
	};

	// 渲染右侧战斗状态
	const renderCombatStatus = () => {
		if (!selectedShip) {
			return (
				<div className="tcp-combat-empty">
					<span className="tcp-combat-label">{t("tactical.noShipSelected")}</span>
				</div>
			);
		}

		return (
			<div className="tcp-combat-status">
				{/* 状态条组 */}
				<div className="tcp-status-group">
					<div className="tcp-status-row">
						<Shield size={12} />
						<div className="tactical-status-track">
							<div
								className="tactical-status-fill tactical-status-fill--shield"
								style={{ width: `${(selectedShip.shield.current / selectedShip.shield.max) * 100}%` }}
							/>
						</div>
						<button
							className={`btn-tactical-toggle ${selectedShip.shield.active ? "active" : ""}`}
							onClick={handleShieldToggle}
							type="button"
						>
							{selectedShip.shield.active ? t("tactical.on") : t("tactical.off")}
						</button>
					</div>

					<div className="tcp-status-row">
						<Zap size={12} />
						<div className="tactical-status-track">
							<div
								className="tactical-status-fill tactical-status-fill--flux"
								style={{ width: `${(selectedShip.flux.current / selectedShip.flux.capacity) * 100}%` }}
							/>
						</div>
						<button
							className="btn-tactical btn-tactical--warning"
							onClick={handleVentFlux}
							type="button"
						>
							{t("tactical.vent")}
						</button>
					</div>
				</div>

				{/* 行动点 */}
				<div className="tcp-action-points">
					<span className="tcp-ap-label">{t("tactical.actionPoints")}</span>
					<div className="tcp-ap-dots">
						{Array.from({ length: selectedShip.actionsPerTurn || 3 }).map((_, i) => (
							<span
								key={i}
								className={`tactical-ap-dot ${i < (selectedShip.remainingActions || 0) ? "active" : ""}`}
							/>
						))}
					</div>
				</div>

				{/* 战术按钮 */}
				<div className="tcp-action-buttons">
					<button
						className="btn-tactical btn-tactical--primary"
						onClick={handleEndTurn}
						disabled={!isCurrentTurn}
						type="button"
					>
						{t("tactical.endTurn")}
					</button>
					<button
						className="btn-tactical btn-tactical--danger"
						onClick={handleEmergencyEvasion}
						type="button"
					>
						<AlertTriangle size={14} />
						{t("tactical.evasion")}
					</button>
				</div>
			</div>
		);
	};

	return (
		<div className={`tcp-panel ${isExpanded ? "tcp-panel--expanded" : ""} ${className}`}>
			{/* 紧凑模式 */}
			<div className="tcp-compact">
				{/* 左侧：单位概览 */}
				<div className="tcp-section tcp-section--left">
					{renderUnitOverview()}
				</div>

				{/* 中央：控制台 */}
				<div className="tcp-section tcp-section--center">
					{renderCommandConsole()}
				</div>

				{/* 右侧：战斗状态 */}
				<div className="tcp-section tcp-section--right">
					{renderCombatStatus()}
				</div>
			</div>

			{/* 展开详细模式 */}
			{isExpanded && selectedToken && (
				<div className="tcp-expanded">
					<div className="tcp-expanded-content">
						<div className="tcp-expanded-placeholder">
							<span>{t("tactical.detailedView")}</span>
							<p>{t("tactical.detailedViewDescription")}</p>
						</div>
					</div>
				</div>
			)}

			<style>{`
				/* ====== 战术指挥面板 ====== */
				.tcp-panel {
					position: fixed;
					bottom: 0;
					left: 0;
					right: 0;
					height: var(--bottom-panel-height);
					background: var(--tactical-bg);
					border-top: 1px solid var(--tactical-border);
					z-index: var(--z-sticky);
					transition: height var(--transition-slow);
				}

				.tcp-panel--expanded {
					height: var(--bottom-panel-expanded);
				}

				/* 紧凑模式 */
				.tcp-compact {
					display: flex;
					height: var(--bottom-panel-height);
					padding: var(--space-2) var(--space-4);
					gap: var(--space-4);
				}

				.tcp-section {
					display: flex;
					align-items: center;
				}

				.tcp-section--left {
					width: 220px;
					flex-shrink: 0;
				}

				.tcp-section--center {
					flex: 1;
					min-width: 0;
				}

				.tcp-section--right {
					width: 200px;
					flex-shrink: 0;
				}

				/* 单位概览 */
				.tcp-unit-empty {
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100%;
					color: var(--text-tertiary);
					font-size: var(--text-xs);
				}

				.tcp-unit-overview {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					width: 100%;
				}

				.tcp-unit-thumbnail {
					position: relative;
					width: 44px;
					height: 44px;
					background: var(--tactical-section-bg);
					border: 1px solid rgba(74, 158, 255, 0.4);
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: var(--radius-sm);
				}

				.tcp-unit-icon {
					color: var(--color-primary);
				}

				.tcp-unit-icon--ship {
					color: var(--color-primary);
				}

				.tcp-heading-indicator {
					position: absolute;
					top: 4px;
					left: 50%;
					width: 0;
					height: 0;
					border-left: 3px solid transparent;
					border-right: 3px solid transparent;
					border-bottom: 5px solid var(--color-primary);
					transform-origin: 50% 250%;
					transform: translateX(-50%);
				}

				.tcp-unit-info {
					flex: 1;
					min-width: 0;
				}

				.tcp-unit-name {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					font-size: var(--text-sm);
					font-weight: var(--font-semibold);
					color: var(--text-primary);
					margin-bottom: 2px;
				}

				.tcp-turn-badge {
					font-size: 9px;
					padding: 1px 4px;
					background: var(--tactical-hover);
					border: 1px solid rgba(74, 158, 255, 0.4);
					color: var(--color-primary);
					border-radius: var(--radius-sm);
				}

				.tcp-unit-type {
					font-size: var(--text-xs);
					color: var(--text-secondary);
					margin-bottom: var(--space-1);
				}

				.tcp-status-bars {
					display: flex;
					flex-direction: column;
					gap: 3px;
				}

				.tcp-status-bar {
					display: flex;
					align-items: center;
					gap: var(--space-2);
				}

				.tcp-bar-label {
					font-size: 9px;
					color: var(--text-tertiary);
					width: 30px;
					text-transform: uppercase;
				}

				.tcp-bar-track {
					flex: 1;
					height: 4px;
					background: rgba(0, 0, 0, 0.5);
					position: relative;
				}

				.tcp-bar-fill {
					height: 100%;
					transition: width var(--transition-slow);
				}

				.tcp-bar-fill--shield {
					background: var(--status-shield);
					box-shadow: 0 0 6px rgba(74, 158, 255, 0.3);
				}

				.tcp-bar-value {
					font-size: 9px;
					color: var(--color-primary);
					font-family: var(--font-mono);
					width: 28px;
					text-align: right;
				}

				.tcp-expand-btn {
					width: 20px;
					height: 20px;
					background: rgba(40, 50, 70, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.3);
					color: var(--text-secondary);
					font-size: 10px;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					transition: var(--transition-fast);
					border-radius: var(--radius-sm);
					padding: 0;
				}

				.tcp-expand-btn:hover {
					background: var(--tactical-hover);
					border-color: rgba(74, 158, 255, 0.5);
					color: var(--color-primary);
				}

				/* 控制台 */
				.tcp-console-empty {
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100%;
				}

				.tcp-global-status {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: var(--space-1);
				}

				.tcp-global-label {
					font-size: var(--text-xs);
					color: var(--text-tertiary);
					text-transform: uppercase;
					letter-spacing: var(--tracking-wide);
				}

				.tcp-current-unit {
					font-size: var(--text-sm);
					color: var(--color-primary);
				}

				.tcp-command-console {
					display: flex;
					flex-direction: column;
					width: 100%;
					height: 100%;
				}

				.tcp-console-tabs {
					display: flex;
					gap: var(--space-1);
					margin-bottom: var(--space-2);
				}

				.tcp-console-content {
					flex: 1;
					background: rgba(15, 18, 25, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.15);
					border-radius: var(--radius-sm);
					padding: var(--space-2);
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.tcp-move-controls,
				.tcp-weapons-controls,
				.tcp-systems-controls {
					display: flex;
					gap: var(--space-4);
					align-items: center;
				}

				/* 战斗状态 */
				.tcp-combat-empty {
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100%;
					color: var(--text-tertiary);
					font-size: var(--text-xs);
				}

				.tcp-combat-status {
					display: flex;
					flex-direction: column;
					gap: var(--space-2);
					width: 100%;
				}

				.tcp-status-group {
					display: flex;
					flex-direction: column;
					gap: var(--space-2);
				}

				.tcp-status-row {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					color: var(--text-secondary);
				}

				.tcp-action-points {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: var(--space-1) 0;
					border-top: 1px solid rgba(74, 158, 255, 0.1);
					border-bottom: 1px solid rgba(74, 158, 255, 0.1);
				}

				.tcp-ap-label {
					font-size: var(--text-xs);
					color: var(--text-tertiary);
				}

				.tcp-ap-dots {
					display: flex;
					gap: var(--space-1);
				}

				.tcp-action-buttons {
					display: flex;
					gap: var(--space-2);
				}

				/* 展开详细模式 */
				.tcp-expanded {
					height: calc(var(--bottom-panel-expanded) - var(--bottom-panel-height) - var(--space-4));
					border-top: 1px solid rgba(74, 158, 255, 0.2);
					padding: var(--space-4);
					overflow: hidden;
				}

				.tcp-expanded-content {
					height: 100%;
					background: rgba(15, 18, 25, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.15);
					border-radius: var(--radius-sm);
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.tcp-expanded-placeholder {
					text-align: center;
					color: var(--text-tertiary);
				}

				.tcp-expanded-placeholder span {
					font-size: var(--text-base);
					color: var(--text-secondary);
					display: block;
					margin-bottom: var(--space-2);
				}

				.tcp-expanded-placeholder p {
					font-size: var(--text-xs);
				}

				/* 响应式 */
				@media (max-width: 1024px) {
					.tcp-section--left {
						width: 180px;
					}

					.tcp-section--right {
						width: 160px;
					}

					.tcp-compact {
						padding: var(--space-2) var(--space-3);
						gap: var(--space-3);
					}
				}

				@media (max-width: 768px) {
					.tcp-panel {
						display: none; /* 移动端使用抽屉式面板 */
					}
				}
			`}</style>
		</div>
	);
};

export default TacticalCommandPanel;