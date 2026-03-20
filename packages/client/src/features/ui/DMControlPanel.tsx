/**
 * DM控制面板
 *
 * DM专属控制面板，提供：
 * 1. 游戏流程控制（暂停/恢复/结束）
 * 2. 回合阶段控制（推进阶段）
 * 3. 敌方单位控制
 * 4. DM专属操作
 */

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import {
	Pause,
	Play,
	Square,
	SkipForward,
	Users,
	Sword,
	Shield,
	Target,
	ChevronDown,
	ChevronUp,
	X,
	AlertTriangle,
} from "lucide-react";
import { useAppDispatch, useAppSelector } from "@/store";
import { websocketService } from "@/services/websocket";
import { WS_MESSAGE_TYPES } from "@vt/shared/ws";

interface EnemyUnit {
	id: string;
	name: string;
	type: string;
	hp: number;
	maxHp: number;
	position: { x: number; y: number };
	actions: string[];
}

interface DMControlPanelProps {
	className?: string;
}

const DMControlPanel: React.FC<DMControlPanelProps> = ({ className = "" }) => {
	const { t } = useTranslation();
	const dispatch = useAppDispatch();
	const { isDMMode } = useAppSelector((state) => state.ui.dmMode);
	const currentPlayerId = useAppSelector((state) => state.player.currentPlayerId);
	const roomId = useAppSelector((state) => state.player.roomId);
	const tokens = useAppSelector((state) => state.map.tokens);

	// 游戏状态
	const [gamePhase, setGamePhase] = useState<string>("lobby");
	const [turnPhase, setTurnPhase] = useState<string>("player_action");
	const [isPaused, setIsPaused] = useState(false);

	// 敌方单位
	const [enemyUnits, setEnemyUnits] = useState<EnemyUnit[]>([]);
	const [selectedEnemy, setSelectedEnemy] = useState<EnemyUnit | null>(null);
	const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
		flow: true,
		turn: true,
		enemies: true,
	});

	// 加载状态
	const [isLoading, setIsLoading] = useState<Record<string, boolean>>({});

	// 确认模态框
	const [confirmModal, setConfirmModal] = useState<{
		action: string;
		title: string;
		message: string;
		onConfirm: () => void;
	} | null>(null);

	// 监听游戏状态更新
	useEffect(() => {
		const handleGameStateUpdate = (payload: unknown) => {
			const data = payload as { phase?: string; turnPhase?: string; isPaused?: boolean };
			if (data.phase) setGamePhase(data.phase);
			if (data.turnPhase) setTurnPhase(data.turnPhase);
			if (data.isPaused !== undefined) setIsPaused(data.isPaused);
		};

		websocketService.on(WS_MESSAGE_TYPES.GAME_STATE_UPDATE, handleGameStateUpdate);

		return () => {
			websocketService.off(WS_MESSAGE_TYPES.GAME_STATE_UPDATE, handleGameStateUpdate);
		};
	}, []);

	// 从tokens中提取敌方单位
	useEffect(() => {
		const enemies: EnemyUnit[] = Object.values(tokens)
			.filter((token: any) => token.faction === "enemy" || token.type === "enemy")
			.map((token: any) => ({
				id: token.id,
				name: token.name || `Enemy ${token.id.slice(0, 4)}`,
				type: token.type || "ship",
				hp: token.hp ?? 100,
				maxHp: token.maxHp ?? 100,
				position: token.position || { x: 0, y: 0 },
				actions: token.availableActions || ["move", "attack", "defend"],
			}));
		setEnemyUnits(enemies);
	}, [tokens]);

	// 发送DM请求
	const sendDMRequest = useCallback(async (
		action: "game.pause" | "game.resume" | "game.end" | "game.advancePhase" | "game.controlEnemy",
		params: Record<string, unknown> = {}
	) => {
		if (!currentPlayerId || !roomId) return;

		setIsLoading((prev) => ({ ...prev, [action]: true }));
		try {
			await websocketService.sendRequest(action, {
				...params,
				roomId,
			});
		} catch (error) {
			console.error(`[DM] Failed to execute ${action}:`, error);
			throw error;
		} finally {
			setIsLoading((prev) => ({ ...prev, [action]: false }));
		}
	}, [currentPlayerId, roomId]);

	// 游戏流程控制
	const handlePauseGame = () => sendDMRequest("game.pause");
	const handleResumeGame = () => sendDMRequest("game.resume");

	const handleEndGame = () => {
		setConfirmModal({
			action: "endGame",
			title: t("dm.confirm.endGame.title"),
			message: t("dm.confirm.endGame.message"),
			onConfirm: () => sendDMRequest("game.end"),
		});
	};

	// 回合阶段控制
	const handleAdvancePhase = () => sendDMRequest("game.advancePhase");

	// 敌方单位控制
	const handleControlEnemy = useCallback((enemy: EnemyUnit, action: string) => {
		setSelectedEnemy(enemy);
		sendDMRequest("game.controlEnemy", {
			enemyId: enemy.id,
			action,
		});
	}, [sendDMRequest]);

	// 切换展开状态
	const toggleSection = (section: string) => {
		setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }));
	};

	// 如果不是DM模式，不显示
	if (!isDMMode) return null;

	return (
		<div className={`dmcp-container ${className}`}>
			{/* 标题 */}
			<div className="dmcp-header">
				<Shield className="dmcp-header-icon" />
				<span className="dmcp-header-title">{t("dm.controlPanel.title")}</span>
			</div>

			{/* 游戏流程控制 */}
			<div className="dmcp-section">
				<button
					className="dmcp-section-header"
					onClick={() => toggleSection("flow")}
					type="button"
				>
					<span>{t("dm.controlPanel.gameFlow")}</span>
					{expandedSections.flow ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
				</button>
				<AnimatePresence>
					{expandedSections.flow && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="dmcp-section-content"
						>
							<div className="dmcp-flow-controls">
								{isPaused ? (
									<button
										className="dmcp-btn dmcp-btn--success"
										onClick={handleResumeGame}
										disabled={isLoading["game.resume"]}
										type="button"
									>
										<Play size={14} />
										<span>{t("dm.controlPanel.resume")}</span>
									</button>
								) : (
									<button
										className="dmcp-btn dmcp-btn--warning"
										onClick={handlePauseGame}
										disabled={isLoading["game.pause"]}
										type="button"
									>
										<Pause size={14} />
										<span>{t("dm.controlPanel.pause")}</span>
									</button>
								)}
								<button
									className="dmcp-btn dmcp-btn--danger"
									onClick={handleEndGame}
									disabled={isLoading["game.end"]}
									type="button"
								>
									<Square size={14} />
									<span>{t("dm.controlPanel.endGame")}</span>
								</button>
							</div>
							<div className="dmcp-status">
								<span className="dmcp-status-label">{t("dm.controlPanel.phase")}:</span>
								<span className={`dmcp-status-value dmcp-status-value--${gamePhase}`}>
									{t(`game.phase.${gamePhase}`)}
								</span>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* 回合阶段控制 */}
			<div className="dmcp-section">
				<button
					className="dmcp-section-header"
					onClick={() => toggleSection("turn")}
					type="button"
				>
					<span>{t("dm.controlPanel.turnControl")}</span>
					{expandedSections.turn ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
				</button>
				<AnimatePresence>
					{expandedSections.turn && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="dmcp-section-content"
						>
							<div className="dmcp-turn-controls">
								<button
									className="dmcp-btn dmcp-btn--primary"
									onClick={handleAdvancePhase}
									disabled={isLoading["game.advancePhase"]}
									type="button"
								>
									<SkipForward size={14} />
									<span>{t("dm.controlPanel.advancePhase")}</span>
								</button>
							</div>
							<div className="dmcp-status">
								<span className="dmcp-status-label">{t("dm.controlPanel.currentPhase")}:</span>
								<span className={`dmcp-status-value dmcp-turn-phase--${turnPhase}`}>
									{t(`game.turnPhase.${turnPhase}`)}
								</span>
							</div>
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* 敌方单位控制 */}
			<div className="dmcp-section">
				<button
					className="dmcp-section-header"
					onClick={() => toggleSection("enemies")}
					type="button"
				>
					<span>{t("dm.controlPanel.enemyUnits")}</span>
					<span className="dmcp-badge">{enemyUnits.length}</span>
					{expandedSections.enemies ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
				</button>
				<AnimatePresence>
					{expandedSections.enemies && (
						<motion.div
							initial={{ height: 0, opacity: 0 }}
							animate={{ height: "auto", opacity: 1 }}
							exit={{ height: 0, opacity: 0 }}
							transition={{ duration: 0.2 }}
							className="dmcp-section-content"
						>
							{enemyUnits.length === 0 ? (
								<div className="dmcp-empty">
									<Target size={24} />
									<span>{t("dm.controlPanel.noEnemies")}</span>
								</div>
							) : (
								<div className="dmcp-enemy-list">
									{enemyUnits.map((enemy) => (
										<div
											key={enemy.id}
											className={`dmcp-enemy-card ${selectedEnemy?.id === enemy.id ? "dmcp-enemy-card--selected" : ""}`}
										>
											<div className="dmcp-enemy-header">
												<span className="dmcp-enemy-name">{enemy.name}</span>
												<span className="dmcp-enemy-type">{enemy.type}</span>
											</div>
											<div className="dmcp-enemy-hp">
												<div
													className="dmcp-enemy-hp-bar"
													style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}
												/>
												<span className="dmcp-enemy-hp-text">
													{enemy.hp}/{enemy.maxHp}
												</span>
											</div>
											<div className="dmcp-enemy-actions">
												{enemy.actions.map((action) => (
													<button
														key={action}
														className="dmcp-action-btn"
														onClick={() => handleControlEnemy(enemy, action)}
														type="button"
													>
														{action === "attack" && <Sword size={12} />}
														{action === "defend" && <Shield size={12} />}
														{action === "move" && <Target size={12} />}
														<span>{t(`dm.action.${action}`)}</span>
													</button>
												))}
											</div>
										</div>
									))}
								</div>
							)}
						</motion.div>
					)}
				</AnimatePresence>
			</div>

			{/* 确认模态框 */}
			<AnimatePresence>
				{confirmModal && (
					<motion.div
						initial={{ opacity: 0 }}
						animate={{ opacity: 1 }}
						exit={{ opacity: 0 }}
						className="dmcp-modal-overlay"
					>
						<motion.div
							initial={{ scale: 0.9, opacity: 0 }}
							animate={{ scale: 1, opacity: 1 }}
							exit={{ scale: 0.9, opacity: 0 }}
							className="dmcp-modal"
						>
							<div className="dmcp-modal-header">
								<AlertTriangle size={20} className="dmcp-modal-icon" />
								<span>{confirmModal.title}</span>
							</div>
							<p className="dmcp-modal-message">{confirmModal.message}</p>
							<div className="dmcp-modal-actions">
								<button
									className="dmcp-btn dmcp-btn--secondary"
									onClick={() => setConfirmModal(null)}
									type="button"
								>
									{t("common.cancel")}
								</button>
								<button
									className="dmcp-btn dmcp-btn--danger"
									onClick={() => {
										confirmModal.onConfirm();
										setConfirmModal(null);
									}}
									type="button"
								>
									{t("common.confirm")}
								</button>
							</div>
						</motion.div>
					</motion.div>
				)}
			</AnimatePresence>

			<style>{`
				.dmcp-container {
					position: fixed;
					top: 80px;
					right: 60px;
					width: 280px;
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-md);
					box-shadow: var(--shadow-lg);
					z-index: var(--z-dropdown);
					overflow: hidden;
				}

				.dmcp-header {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					padding: var(--space-3);
					background: linear-gradient(135deg, rgba(255, 68, 68, 0.15), rgba(255, 68, 68, 0.05));
					border-bottom: 1px solid rgba(255, 68, 68, 0.3);
				}

				.dmcp-header-icon {
					color: var(--color-danger);
				}

				.dmcp-header-title {
					font-size: var(--text-sm);
					font-weight: var(--font-semibold);
					color: var(--color-danger);
					text-transform: uppercase;
					letter-spacing: var(--tracking-wide);
				}

				/* 区块 */
				.dmcp-section {
					border-bottom: 1px solid var(--border-color);
				}

				.dmcp-section:last-child {
					border-bottom: none;
				}

				.dmcp-section-header {
					display: flex;
					align-items: center;
					justify-content: space-between;
					width: 100%;
					padding: var(--space-2) var(--space-3);
					background: transparent;
					border: none;
					color: var(--text-primary);
					font-size: var(--text-xs);
					font-weight: var(--font-semibold);
					text-transform: uppercase;
					letter-spacing: var(--tracking-wide);
					cursor: pointer;
					transition: var(--transition-fast);
				}

				.dmcp-section-header:hover {
					background: rgba(74, 158, 255, 0.1);
				}

				.dmcp-section-content {
					padding: 0 var(--space-3) var(--space-3);
					overflow: hidden;
				}

				/* 按钮 */
				.dmcp-btn {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					gap: var(--space-1);
					padding: var(--space-2) var(--space-3);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-sm);
					font-size: var(--text-xs);
					font-weight: var(--font-medium);
					cursor: pointer;
					transition: var(--transition-fast);
					white-space: nowrap;
				}

				.dmcp-btn:disabled {
					opacity: 0.5;
					cursor: not-allowed;
				}

				.dmcp-btn--primary {
					background: rgba(74, 158, 255, 0.15);
					border-color: rgba(74, 158, 255, 0.4);
					color: var(--color-primary);
				}

				.dmcp-btn--primary:hover:not(:disabled) {
					background: rgba(74, 158, 255, 0.25);
					border-color: rgba(74, 158, 255, 0.6);
				}

				.dmcp-btn--success {
					background: rgba(34, 197, 94, 0.15);
					border-color: rgba(34, 197, 94, 0.4);
					color: var(--color-success);
				}

				.dmcp-btn--success:hover:not(:disabled) {
					background: rgba(34, 197, 94, 0.25);
					border-color: rgba(34, 197, 94, 0.6);
				}

				.dmcp-btn--warning {
					background: rgba(234, 179, 8, 0.15);
					border-color: rgba(234, 179, 8, 0.4);
					color: var(--color-warning);
				}

				.dmcp-btn--warning:hover:not(:disabled) {
					background: rgba(234, 179, 8, 0.25);
					border-color: rgba(234, 179, 8, 0.6);
				}

				.dmcp-btn--danger {
					background: rgba(255, 68, 68, 0.15);
					border-color: rgba(255, 68, 68, 0.4);
					color: var(--color-danger);
				}

				.dmcp-btn--danger:hover:not(:disabled) {
					background: rgba(255, 68, 68, 0.25);
					border-color: rgba(255, 68, 68, 0.6);
				}

				.dmcp-btn--secondary {
					background: rgba(100, 116, 139, 0.15);
					border-color: rgba(100, 116, 139, 0.4);
					color: var(--text-secondary);
				}

				.dmcp-btn--secondary:hover:not(:disabled) {
					background: rgba(100, 116, 139, 0.25);
				}

				/* 流程控制 */
				.dmcp-flow-controls {
					display: flex;
					gap: var(--space-2);
					margin-bottom: var(--space-2);
				}

				.dmcp-flow-controls .dmcp-btn {
					flex: 1;
				}

				/* 状态显示 */
				.dmcp-status {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					padding: var(--space-2);
					background: rgba(0, 0, 0, 0.2);
					border-radius: var(--radius-sm);
				}

				.dmcp-status-label {
					font-size: var(--text-xs);
					color: var(--text-tertiary);
				}

				.dmcp-status-value {
					font-size: var(--text-xs);
					font-weight: var(--font-semibold);
					text-transform: uppercase;
				}

				.dmcp-status-value--lobby { color: var(--text-tertiary); }
				.dmcp-status-value--deployment { color: var(--color-warning); }
				.dmcp-status-value--playing { color: var(--color-success); }
				.dmcp-status-value--paused { color: var(--color-warning); }
				.dmcp-status-value--ended { color: var(--text-tertiary); }

				.dmcp-turn-phase--player_action { color: var(--color-primary); }
				.dmcp-turn-phase--dm_action { color: var(--color-danger); }
				.dmcp-turn-phase--resolution { color: var(--color-warning); }

				/* 回合控制 */
				.dmcp-turn-controls {
					margin-bottom: var(--space-2);
				}

				.dmcp-turn-controls .dmcp-btn {
					width: 100%;
				}

				/* 徽章 */
				.dmcp-badge {
					display: inline-flex;
					align-items: center;
					justify-content: center;
					min-width: 18px;
					height: 18px;
					padding: 0 var(--space-1);
					background: rgba(74, 158, 255, 0.2);
					border-radius: var(--radius-full);
					font-size: 10px;
					font-weight: var(--font-semibold);
					color: var(--color-primary);
				}

				/* 敌方单位列表 */
				.dmcp-enemy-list {
					display: flex;
					flex-direction: column;
					gap: var(--space-2);
					max-height: 200px;
					overflow-y: auto;
				}

				.dmcp-enemy-card {
					padding: var(--space-2);
					background: rgba(0, 0, 0, 0.2);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-sm);
					transition: var(--transition-fast);
				}

				.dmcp-enemy-card--selected {
					border-color: rgba(255, 68, 68, 0.5);
					background: rgba(255, 68, 68, 0.1);
				}

				.dmcp-enemy-header {
					display: flex;
					justify-content: space-between;
					align-items: center;
					margin-bottom: var(--space-1);
				}

				.dmcp-enemy-name {
					font-size: var(--text-xs);
					font-weight: var(--font-semibold);
					color: var(--text-primary);
				}

				.dmcp-enemy-type {
					font-size: 10px;
					color: var(--text-tertiary);
					text-transform: uppercase;
				}

				.dmcp-enemy-hp {
					position: relative;
					height: 16px;
					background: rgba(0, 0, 0, 0.3);
					border-radius: var(--radius-sm);
					overflow: hidden;
					margin-bottom: var(--space-2);
				}

				.dmcp-enemy-hp-bar {
					position: absolute;
					top: 0;
					left: 0;
					height: 100%;
					background: linear-gradient(90deg, rgba(255, 68, 68, 0.8), rgba(255, 68, 68, 0.6));
					transition: width var(--transition-normal);
				}

				.dmcp-enemy-hp-text {
					position: absolute;
					inset: 0;
					display: flex;
					align-items: center;
					justify-content: center;
					font-size: 10px;
					font-weight: var(--font-semibold);
					color: var(--text-primary);
				}

				.dmcp-enemy-actions {
					display: flex;
					gap: var(--space-1);
					flex-wrap: wrap;
				}

				.dmcp-action-btn {
					display: inline-flex;
					align-items: center;
					gap: 2px;
					padding: 2px var(--space-2);
					background: rgba(74, 158, 255, 0.1);
					border: 1px solid rgba(74, 158, 255, 0.3);
					border-radius: var(--radius-sm);
					font-size: 10px;
					color: var(--color-primary);
					cursor: pointer;
					transition: var(--transition-fast);
				}

				.dmcp-action-btn:hover {
					background: rgba(74, 158, 255, 0.2);
					border-color: rgba(74, 158, 255, 0.5);
				}

				/* 空状态 */
				.dmcp-empty {
					display: flex;
					flex-direction: column;
					align-items: center;
					gap: var(--space-2);
					padding: var(--space-4);
					color: var(--text-tertiary);
				}

				.dmcp-empty span {
					font-size: var(--text-xs);
				}

				/* 模态框 */
				.dmcp-modal-overlay {
					position: fixed;
					inset: 0;
					background: rgba(0, 0, 0, 0.6);
					display: flex;
					align-items: center;
					justify-content: center;
					z-index: var(--z-modal-backdrop);
				}

				.dmcp-modal {
					background: var(--bg-panel);
					border: 1px solid var(--border-color);
					border-radius: var(--radius-md);
					padding: var(--space-4);
					min-width: 300px;
					max-width: 400px;
				}

				.dmcp-modal-header {
					display: flex;
					align-items: center;
					gap: var(--space-2);
					font-size: var(--text-base);
					font-weight: var(--font-semibold);
					color: var(--color-danger);
					margin-bottom: var(--space-3);
				}

				.dmcp-modal-icon {
					color: var(--color-warning);
				}

				.dmcp-modal-message {
					font-size: var(--text-sm);
					color: var(--text-secondary);
					margin-bottom: var(--space-4);
				}

				.dmcp-modal-actions {
					display: flex;
					justify-content: flex-end;
					gap: var(--space-2);
				}

				/* 响应式 */
				@media (max-width: 768px) {
					.dmcp-container {
						right: 10px;
						width: 240px;
					}
				}
			`}</style>
		</div>
	);
};

export default DMControlPanel;