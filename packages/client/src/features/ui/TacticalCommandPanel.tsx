/**
 * 战术指挥面板组件
 * 位于底部，纯游戏相关功能，无系统设置按钮
 * 提供舰船操作、武器控制、状态显示等战术功能
 */

import React, { useState, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useAppSelector, useAppDispatch } from "@/store";
import { selectToken } from "@/store/slices/selectionSlice";
import { selectDockedShip, setCurrentPlayerHangar } from "@/store/slices/hangarSlice";
import { websocketService } from "@/services/websocket";
import { Shield, Zap, Target, Move, Crosshair, AlertTriangle } from "lucide-react";

// 子组件导入（后续实现）
// import { HeadingControl } from "./HeadingControl";
// import { DistanceControl } from "./DistanceControl";
// import { WeaponMountPanel } from "./WeaponMountPanel";
// import { StatusBar } from "./StatusBar";

interface TacticalCommandPanelProps {
	className?: string;
}

/**
 * 战术指挥面板
 * 
 * 设计原则:
 * 1. 纯游戏相关 - 只包含战术操作，无系统设置
 * 2. 动态自适应 - 根据选中对象类型切换显示
 * 3. 信息密度高 - 在有限空间展示关键数据
 * 4. 硬朗风格 - 最小圆角，锐利线条
 */
export const TacticalCommandPanel: React.FC<TacticalCommandPanelProps> = ({
	className = "",
}) => {
	const { t } = useTranslation();
	const dispatch = useAppDispatch();
	
	// 展开/折叠状态
	const [isExpanded, setIsExpanded] = useState(false);
	
	// 当前选中标签
	const [activeTab, setActiveTab] = useState<"move" | "weapons" | "systems">("move");
	
	// 从Redux获取状态
	const selectedTokenId = useAppSelector((state) => state.selection.selectedTokenId);
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const tokens = useAppSelector((state) => state.map.tokens);
	const ships = useAppSelector((state) => state.ship.ships);
	const currentPhase = useAppSelector((state) => state.turn.order?.phase ?? "deployment");
	const hangar = useAppSelector((state) => state.hangar.currentPlayerHangar);
	const selectedDockedShipId = useAppSelector((state) => state.hangar.selectedDockedShipId);
	const shipAssets = useAppSelector((state) => state.hangar.assets);
	const currentUnit = useAppSelector((state) => {
		const turnOrder = state.turn.order;
		if (!turnOrder) return null;
		return turnOrder.units[turnOrder.currentIndex];
	});

	// 获取选中单位数据
	const selectedToken = selectedTokenId ? tokens[selectedTokenId] : null;
	const selectedShip = selectedTokenId ? ships[selectedTokenId] : null;
	const selectedDockedShip = hangar?.dockedShips.find((ship) => ship.id === selectedDockedShipId) ?? null;
	const selectedDockedAsset = shipAssets.find((asset) => asset.id === selectedDockedShip?.assetId);

	// 判断是否为当前回合单位
	const isCurrentTurn = currentUnit?.id === selectedTokenId;

	// 处理单位选择
	const handleUnitClick = useCallback(() => {
		if (selectedTokenId) {
			// 可以展开详细面板
			setIsExpanded(!isExpanded);
		}
	}, [selectedTokenId, isExpanded]);

	// 处理结束回合
	const handleEndTurn = useCallback(() => {
		// TODO: 实现结束回合逻辑
		console.log("End turn");
	}, []);

	// 处理紧急规避
	const handleEmergencyEvasion = useCallback(() => {
		// TODO: 实现紧急规避逻辑
		console.log("Emergency evasion");
	}, []);

	// 处理护盾开关
	const handleShieldToggle = useCallback(() => {
		// TODO: 实现护盾开关逻辑
		console.log("Toggle shield");
	}, []);

	const [step1Forward, setStep1Forward] = useState(0);
	const [step2Rotation, setStep2Rotation] = useState(0);
	const [step3Forward, setStep3Forward] = useState(0);

	const handleMoveStep = useCallback(
		async (stepIndex: 1 | 2 | 3) => {
			if (!selectedTokenId) return;
			if (!isCurrentTurn) return;
			if (stepIndex === 1) {
				await websocketService.moveMapTokenStep(selectedTokenId, { stepIndex, forward: step1Forward });
			}
			if (stepIndex === 2) {
				await websocketService.moveMapTokenStep(selectedTokenId, { stepIndex, rotation: step2Rotation });
			}
			if (stepIndex === 3) {
				await websocketService.moveMapTokenStep(selectedTokenId, { stepIndex, forward: step3Forward });
			}
		},
		[selectedTokenId, isCurrentTurn, step1Forward, step2Rotation, step3Forward]
	);

	const handleSelectDockedShip = useCallback(
		async (dockedShipId: string) => {
			dispatch(selectDockedShip(dockedShipId));
			const updated = await websocketService.setActiveDockedShip(dockedShipId);
			dispatch(setCurrentPlayerHangar(updated));
		},
		[dispatch]
	);

	const handleDeployFromDock = useCallback(async () => {
		if (!currentPlayerId || !selectedDockedShip || !selectedDockedAsset) return;
		const deployIndex = hangar?.dockedShips.findIndex((ship) => ship.id === selectedDockedShip.id) ?? 0;
		const position = {
			x: 500 + deployIndex * 180,
			y: 240,
		};
		await websocketService.deployMapToken(
			`ship_${currentPlayerId}_${selectedDockedShip.id}`,
			position,
			0,
			undefined,
			currentPlayerId,
			{
				shipAssetId: selectedDockedAsset.id,
				dockedShipId: selectedDockedShip.id,
				customization: selectedDockedShip.customization,
			}
		);
		const refreshed = await websocketService.getPlayerHangar();
		dispatch(setCurrentPlayerHangar(refreshed));
	}, [currentPlayerId, selectedDockedShip, selectedDockedAsset, hangar, dispatch]);

	// 处理散热
	const handleVentFlux = useCallback(() => {
		// TODO: 实现散热逻辑
		console.log("Vent flux");
	}, []);

	// 渲染单位概览
	const renderUnitOverview = () => {
		if (!selectedToken) {
			return (
				<div className="tactical-unit-empty">
					<span className="tactical-empty-text">{t("tactical.noSelection")}</span>
				</div>
			);
		}

		const isShip = selectedToken.type === "ship";
		const shipData = isShip ? selectedShip : null;

		return (
			<div className="tactical-unit-overview">
				{/* 单位缩略图 */}
				<div className="tactical-unit-thumbnail">
					<div className={`tactical-unit-icon ${selectedToken.type}`}>
						{isShip ? <Target size={20} /> : <Crosshair size={20} />}
					</div>
					{/* 朝向指示器 */}
					<div 
						className="tactical-heading-indicator"
						style={{ transform: `rotate(${selectedToken.heading}deg)` }}
					/>
				</div>

				{/* 单位信息 */}
				<div className="tactical-unit-info">
					<div className="tactical-unit-name">
						{(selectedToken.metadata?.name as string) || selectedToken.id}
						{isCurrentTurn ? <span className="tactical-turn-badge">{t("tactical.current")}</span> : null}
					</div>
					<div className="tactical-unit-type">
						{t(`token.type.${selectedToken.type}`)} · {selectedToken.ownerId}
					</div>
					
					{/* 状态条 */}
					{shipData && (
						<div className="tactical-status-bars">
							<div className="tactical-status-bar">
								<div className="tactical-bar-label">{t("status.shield")}</div>
								<div className="tactical-bar-track">
									<div 
										className="tactical-bar-fill shield"
										style={{ 
											width: `${(shipData.shield.current / shipData.shield.max) * 100}%` 
										}}
									/>
								</div>
								<span className="tactical-bar-value">
									{Math.round((shipData.shield.current / shipData.shield.max) * 100)}%
								</span>
							</div>
						</div>
					)}
				</div>

				{/* 展开按钮 */}
				<button 
					className="tactical-expand-btn"
					onClick={handleUnitClick}
					type="button"
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
				<div className="tactical-console-empty">
					<div className="tactical-global-status">
						<span className="tactical-global-label">{t("tactical.globalView")}</span>
						{currentUnit && (
							<span className="tactical-current-unit">
								{t("tactical.currentTurn")}: {currentUnit.name}
							</span>
						)}
					</div>
				</div>
			);
		}

		return (
			<div className="tactical-command-console">
				{/* 标签切换 */}
				<div className="tactical-console-tabs">
					<button
						className={`tactical-tab ${activeTab === "move" ? "active" : ""}`}
						onClick={() => setActiveTab("move")}
						type="button"
					>
						<Move size={14} />
						<span>{t("tactical.move")}</span>
					</button>
					<button
						className={`tactical-tab ${activeTab === "weapons" ? "active" : ""}`}
						onClick={() => setActiveTab("weapons")}
						type="button"
					>
						<Crosshair size={14} />
						<span>{t("tactical.weapons")}</span>
					</button>
					<button
						className={`tactical-tab ${activeTab === "systems" ? "active" : ""}`}
						onClick={() => setActiveTab("systems")}
						type="button"
					>
						<Zap size={14} />
						<span>{t("tactical.systems")}</span>
					</button>
				</div>

				{/* 控制台内容 */}
				<div className="tactical-console-content">
					{activeTab === "move" && (
						<div className="tactical-move-controls">
							<div className="tactical-move-step">
								<label>Step1 平移A</label>
								<input
									type="number"
									value={step1Forward}
									onChange={(e) => setStep1Forward(Number(e.target.value))}
								/>
								<button type="button" onClick={() => handleMoveStep(1)} disabled={!isCurrentTurn || currentPhase !== "movement"}>
									应用
								</button>
							</div>
							<div className="tactical-move-step">
								<label>Step2 转向</label>
								<input
									type="number"
									value={step2Rotation}
									onChange={(e) => setStep2Rotation(Number(e.target.value))}
								/>
								<button type="button" onClick={() => handleMoveStep(2)} disabled={!isCurrentTurn || currentPhase !== "movement"}>
									应用
								</button>
							</div>
							<div className="tactical-move-step">
								<label>Step3 平移B</label>
								<input
									type="number"
									value={step3Forward}
									onChange={(e) => setStep3Forward(Number(e.target.value))}
								/>
								<button type="button" onClick={() => handleMoveStep(3)} disabled={!isCurrentTurn || currentPhase !== "movement"}>
									应用
								</button>
							</div>
							<div className="tactical-dock-panel">
								<div className="tactical-dock-title">船坞与物品栏</div>
								<div className="tactical-dock-ships">
									{hangar?.dockedShips.map((ship) => (
										<button
											key={ship.id}
											type="button"
											className={ship.id === selectedDockedShipId ? "active" : ""}
											onClick={() => handleSelectDockedShip(ship.id)}
										>
											{ship.displayName}
										</button>
									))}
								</div>
								<button
									type="button"
									onClick={handleDeployFromDock}
									disabled={currentPhase !== "deployment" || !selectedDockedShip}
								>
									部署选中舰船
								</button>
								<div className="tactical-dock-inventory-count">
									物品栏：{hangar?.inventory.reduce((sum, item) => sum + item.quantity, 0) ?? 0}
								</div>
							</div>
						</div>
					)}
					{activeTab === "weapons" && (
						<div className="tactical-weapons-controls">
							<div className="tactical-control-placeholder">
								<Crosshair size={24} />
								<span>{t("tactical.weaponMounts")}</span>
							</div>
						</div>
					)}
					{activeTab === "systems" && (
						<div className="tactical-systems-controls">
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
				<div className="tactical-combat-empty">
					<span className="tactical-combat-label">{t("tactical.noShipSelected")}</span>
				</div>
			);
		}

		return (
			<div className="tactical-combat-status">
				{/* 状态条组 */}
				<div className="tactical-status-group">
					<div className="tactical-status-row">
						<Shield size={12} />
						<div className="tactical-mini-bar">
							<div 
								className="tactical-mini-fill shield"
								style={{ width: `${(selectedShip.shield.current / selectedShip.shield.max) * 100}%` }}
							/>
						</div>
						<button 
							className={`tactical-toggle-btn ${selectedShip.shield.active ? "active" : ""}`}
							onClick={handleShieldToggle}
							type="button"
						>
							{selectedShip.shield.active ? t("tactical.on") : t("tactical.off")}
						</button>
					</div>

					<div className="tactical-status-row">
						<Zap size={12} />
						<div className="tactical-mini-bar">
							<div 
								className="tactical-mini-fill flux"
								style={{ width: `${(selectedShip.flux.current / selectedShip.flux.capacity) * 100}%` }}
							/>
						</div>
						<button 
							className="tactical-action-btn"
							onClick={handleVentFlux}
							type="button"
						>
							{t("tactical.vent")}
						</button>
					</div>
				</div>

				{/* 行动点 */}
				<div className="tactical-action-points">
					<span className="tactical-ap-label">{t("tactical.actionPoints")}</span>
					<div className="tactical-ap-dots">
						{Array.from({ length: selectedShip.actionsPerTurn || 3 }).map((_, i) => (
							<span 
								key={i} 
								className={`tactical-ap-dot ${i < (selectedShip.remainingActions || 0) ? "active" : ""}`}
							/>
						))}
					</div>
				</div>

				{/* 战术按钮 */}
				<div className="tactical-action-buttons">
					<button 
						className="tactical-btn tactical-btn--primary"
						onClick={handleEndTurn}
						disabled={!isCurrentTurn}
						type="button"
					>
						{t("tactical.endTurn")}
					</button>
					<button 
						className="tactical-btn tactical-btn--danger"
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
		<div className={`tactical-command-panel ${isExpanded ? "expanded" : ""} ${className}`}>
			{/* 紧凑模式 */}
			<div className="tactical-panel-compact">
				{/* 左侧：单位概览 */}
				<div className="tactical-section tactical-section--left">
					{renderUnitOverview()}
				</div>

				{/* 中央：控制台 */}
				<div className="tactical-section tactical-section--center">
					{renderCommandConsole()}
				</div>

				{/* 右侧：战斗状态 */}
				<div className="tactical-section tactical-section--right">
					{renderCombatStatus()}
				</div>
			</div>

			{/* 展开详细模式 */}
			{isExpanded && selectedToken && (
				<div className="tactical-panel-expanded">
					<div className="tactical-expanded-content">
						<div className="tactical-expanded-placeholder">
							<span>{t("tactical.detailedView")}</span>
							<p>{t("tactical.detailedViewDescription")}</p>
						</div>
					</div>
				</div>
			)}

			<style>{`
				.tactical-command-panel {
					position: fixed;
					bottom: 0;
					left: 0;
					right: 0;
					height: 64px;
					background: rgba(10, 12, 20, 0.98);
					border-top: 1px solid rgba(74, 158, 255, 0.3);
					z-index: 1100;
					transition: height 0.3s ease;
				}

				.tactical-command-panel.expanded {
					height: 280px;
				}

				/* 紧凑模式 */
				.tactical-panel-compact {
					display: flex;
					height: 64px;
					padding: 8px 16px;
					gap: 16px;
				}

				.tactical-section {
					display: flex;
					align-items: center;
				}

				.tactical-section--left {
					width: 220px;
					flex-shrink: 0;
				}

				.tactical-section--center {
					flex: 1;
					min-width: 0;
				}

				.tactical-section--right {
					width: 200px;
					flex-shrink: 0;
				}

				/* 单位概览 */
				.tactical-unit-empty {
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100%;
					color: #5a6478;
					font-size: 12px;
				}

				.tactical-unit-overview {
					display: flex;
					align-items: center;
					gap: 10px;
					width: 100%;
				}

				.tactical-unit-thumbnail {
					position: relative;
					width: 44px;
					height: 44px;
					background: rgba(20, 25, 35, 0.8);
					border: 1px solid rgba(74, 158, 255, 0.4);
					display: flex;
					align-items: center;
					justify-content: center;
					border-radius: 0;
				}

				.tactical-unit-icon {
					color: #4a9eff;
				}

				.tactical-unit-icon.ship {
					color: #4a9eff;
				}

				.tactical-heading-indicator {
					position: absolute;
					top: 4px;
					left: 50%;
					width: 0;
					height: 0;
					border-left: 3px solid transparent;
					border-right: 3px solid transparent;
					border-bottom: 5px solid #4a9eff;
					transform-origin: 50% 250%;
					transform: translateX(-50%);
				}

				.tactical-unit-info {
					flex: 1;
					min-width: 0;
				}

				.tactical-unit-name {
					display: flex;
					align-items: center;
					gap: 6px;
					font-size: 13px;
					font-weight: 600;
					color: #e0e6f0;
					margin-bottom: 2px;
				}

				.tactical-turn-badge {
					font-size: 9px;
					padding: 1px 4px;
					background: rgba(74, 158, 255, 0.2);
					border: 1px solid rgba(74, 158, 255, 0.4);
					color: #4a9eff;
					border-radius: 0;
				}

				.tactical-unit-type {
					font-size: 10px;
					color: #6a7a9f;
					margin-bottom: 4px;
				}

				.tactical-status-bars {
					display: flex;
					flex-direction: column;
					gap: 3px;
				}

				.tactical-status-bar {
					display: flex;
					align-items: center;
					gap: 6px;
				}

				.tactical-bar-label {
					font-size: 9px;
					color: #5a6478;
					width: 30px;
					text-transform: uppercase;
				}

				.tactical-bar-track {
					flex: 1;
					height: 4px;
					background: rgba(0, 0, 0, 0.5);
					position: relative;
				}

				.tactical-bar-fill {
					height: 100%;
					transition: width 0.3s ease;
				}

				.tactical-bar-fill.shield {
					background: linear-gradient(90deg, #2a5a8a, #4a9eff);
					box-shadow: 0 0 6px rgba(74, 158, 255, 0.3);
				}

				.tactical-bar-value {
					font-size: 9px;
					color: #4a9eff;
					font-family: 'Share Tech Mono', monospace;
					width: 28px;
					text-align: right;
				}

				.tactical-expand-btn {
					width: 20px;
					height: 20px;
					background: rgba(40, 50, 70, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.3);
					color: #6a7a9f;
					font-size: 10px;
					display: flex;
					align-items: center;
					justify-content: center;
					cursor: pointer;
					transition: all 0.15s ease;
					border-radius: 0;
					padding: 0;
				}

				.tactical-expand-btn:hover {
					background: rgba(74, 158, 255, 0.2);
					border-color: rgba(74, 158, 255, 0.5);
					color: #4a9eff;
				}

				/* 控制台 */
				.tactical-console-empty {
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100%;
				}

				.tactical-global-status {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 4px;
				}

				.tactical-global-label {
					font-size: 11px;
					color: #5a6478;
					text-transform: uppercase;
					letter-spacing: 1px;
				}

				.tactical-current-unit {
					font-size: 12px;
					color: #4a9eff;
				}

				.tactical-command-console {
					display: flex;
					flex-direction: column;
					width: 100%;
					height: 100%;
				}

				.tactical-console-tabs {
					display: flex;
					gap: 4px;
					margin-bottom: 8px;
				}

				.tactical-tab {
					display: flex;
					align-items: center;
					gap: 6px;
					padding: 4px 12px;
					background: rgba(30, 35, 45, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.2);
					color: #6a7a9f;
					font-size: 11px;
					cursor: pointer;
					transition: all 0.15s ease;
					border-radius: 0;
				}

				.tactical-tab:hover {
					background: rgba(40, 50, 70, 0.6);
					border-color: rgba(74, 158, 255, 0.4);
					color: #8a9ebf;
				}

				.tactical-tab.active {
					background: rgba(74, 158, 255, 0.15);
					border-color: rgba(74, 158, 255, 0.5);
					color: #4a9eff;
				}

				.tactical-console-content {
					flex: 1;
					background: rgba(15, 18, 25, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.15);
					padding: 8px;
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.tactical-move-controls,
				.tactical-weapons-controls,
				.tactical-systems-controls {
					display: flex;
					gap: 16px;
					align-items: center;
				}

				.tactical-move-step {
					display: flex;
					flex-direction: column;
					gap: 6px;
					padding: 8px;
					background: rgba(20, 25, 35, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.25);
				}

				.tactical-move-step label {
					font-size: 10px;
					color: #8ea4d0;
				}

				.tactical-move-step input {
					width: 80px;
					background: rgba(5, 8, 14, 0.9);
					border: 1px solid rgba(74, 158, 255, 0.25);
					color: #c3d6ff;
					padding: 4px;
				}

				.tactical-move-step button,
				.tactical-dock-panel button {
					background: rgba(35, 48, 75, 0.7);
					border: 1px solid rgba(74, 158, 255, 0.3);
					color: #c8d9ff;
					padding: 4px 8px;
					font-size: 10px;
					cursor: pointer;
				}

				.tactical-dock-panel button.active {
					border-color: rgba(255, 188, 81, 0.8);
					color: #ffbc51;
				}

				.tactical-dock-panel {
					min-width: 220px;
					padding: 8px;
					border: 1px solid rgba(255, 188, 81, 0.3);
					background: rgba(26, 20, 12, 0.55);
					display: flex;
					flex-direction: column;
					gap: 6px;
				}

				.tactical-dock-title {
					font-size: 11px;
					color: #ffbc51;
				}

				.tactical-dock-ships {
					display: flex;
					flex-wrap: wrap;
					gap: 4px;
				}

				.tactical-dock-inventory-count {
					font-size: 10px;
					color: #9ea7b9;
				}

				.tactical-control-placeholder {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: 8px;
					padding: 12px 24px;
					background: rgba(20, 25, 35, 0.6);
					border: 1px dashed rgba(74, 158, 255, 0.3);
					color: #5a6478;
					font-size: 11px;
					border-radius: 0;
				}

				.tactical-control-placeholder svg {
					color: #4a9eff;
					opacity: 0.5;
				}

				/* 战斗状态 */
				.tactical-combat-empty {
					display: flex;
					align-items: center;
					justify-content: center;
					height: 100%;
					color: #5a6478;
					font-size: 11px;
				}

				.tactical-combat-status {
					display: flex;
					flex-direction: column;
					gap: 8px;
					width: 100%;
				}

				.tactical-status-group {
					display: flex;
					flex-direction: column;
					gap: 6px;
				}

				.tactical-status-row {
					display: flex;
					align-items: center;
					gap: 8px;
					color: #6a7a9f;
				}

				.tactical-mini-bar {
					flex: 1;
					height: 4px;
					background: rgba(0, 0, 0, 0.5);
					position: relative;
				}

				.tactical-mini-fill {
					height: 100%;
					transition: width 0.3s ease;
				}

				.tactical-mini-fill.shield {
					background: linear-gradient(90deg, #2a5a8a, #4a9eff);
				}

				.tactical-mini-fill.flux {
					background: linear-gradient(90deg, #8a2a8a, #ff44ff);
				}

				.tactical-toggle-btn {
					padding: 2px 6px;
					background: rgba(40, 50, 70, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.3);
					color: #6a7a9f;
					font-size: 9px;
					cursor: pointer;
					transition: all 0.15s ease;
					border-radius: 0;
					min-width: 28px;
				}

				.tactical-toggle-btn.active {
					background: rgba(74, 158, 255, 0.2);
					border-color: rgba(74, 158, 255, 0.5);
					color: #4a9eff;
				}

				.tactical-action-btn {
					padding: 2px 6px;
					background: rgba(100, 60, 20, 0.4);
					border: 1px solid rgba(255, 170, 0, 0.3);
					color: #ffaa00;
					font-size: 9px;
					cursor: pointer;
					transition: all 0.15s ease;
					border-radius: 0;
				}

				.tactical-action-btn:hover {
					background: rgba(255, 170, 0, 0.2);
					border-color: rgba(255, 170, 0, 0.5);
				}

				.tactical-action-points {
					display: flex;
					align-items: center;
					justify-content: space-between;
					padding: 4px 0;
					border-top: 1px solid rgba(74, 158, 255, 0.1);
					border-bottom: 1px solid rgba(74, 158, 255, 0.1);
				}

				.tactical-ap-label {
					font-size: 10px;
					color: #5a6478;
				}

				.tactical-ap-dots {
					display: flex;
					gap: 4px;
				}

				.tactical-ap-dot {
					width: 8px;
					height: 8px;
					background: rgba(40, 50, 70, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.3);
					border-radius: 0;
					transition: all 0.15s ease;
				}

				.tactical-ap-dot.active {
					background: #4a9eff;
					border-color: #4a9eff;
					box-shadow: 0 0 6px rgba(74, 158, 255, 0.4);
				}

				.tactical-action-buttons {
					display: flex;
					gap: 6px;
				}

				.tactical-btn {
					flex: 1;
					padding: 6px 10px;
					font-size: 10px;
					font-weight: 600;
					text-transform: uppercase;
					letter-spacing: 0.5px;
					cursor: pointer;
					transition: all 0.15s ease;
					display: flex;
					align-items: center;
					justify-content: center;
					gap: 4px;
					border-radius: 0;
					border: 1px solid transparent;
				}

				.tactical-btn:disabled {
					opacity: 0.3;
					cursor: not-allowed;
				}

				.tactical-btn--primary {
					background: rgba(74, 158, 255, 0.15);
					border-color: rgba(74, 158, 255, 0.4);
					color: #4a9eff;
				}

				.tactical-btn--primary:hover:not(:disabled) {
					background: rgba(74, 158, 255, 0.25);
					border-color: rgba(74, 158, 255, 0.6);
					box-shadow: 0 0 8px rgba(74, 158, 255, 0.3);
				}

				.tactical-btn--danger {
					background: rgba(180, 40, 40, 0.15);
					border-color: rgba(255, 68, 68, 0.4);
					color: #ff4444;
				}

				.tactical-btn--danger:hover:not(:disabled) {
					background: rgba(255, 68, 68, 0.2);
					border-color: rgba(255, 68, 68, 0.6);
					box-shadow: 0 0 8px rgba(255, 68, 68, 0.3);
				}

				/* 展开详细模式 */
				.tactical-panel-expanded {
					height: 216px;
					border-top: 1px solid rgba(74, 158, 255, 0.2);
					padding: 16px;
					overflow: hidden;
				}

				.tactical-expanded-content {
					height: 100%;
					background: rgba(15, 18, 25, 0.6);
					border: 1px solid rgba(74, 158, 255, 0.15);
					display: flex;
					align-items: center;
					justify-content: center;
				}

				.tactical-expanded-placeholder {
					text-align: center;
					color: #5a6478;
				}

				.tactical-expanded-placeholder span {
					font-size: 14px;
					color: #6a7a9f;
					display: block;
					margin-bottom: 8px;
				}

				.tactical-expanded-placeholder p {
					font-size: 11px;
				}

				/* 响应式 */
				@media (max-width: 1024px) {
					.tactical-section--left {
						width: 180px;
					}

					.tactical-section--right {
						width: 160px;
					}

					.tactical-panel-compact {
						padding: 8px 12px;
						gap: 12px;
					}
				}

				@media (max-width: 768px) {
					.tactical-command-panel {
						display: none; /* 移动端使用抽屉式面板 */
					}
				}
			`}</style>
		</div>
	);
};

export default TacticalCommandPanel;
