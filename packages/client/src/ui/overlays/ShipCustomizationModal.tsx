/**
 * ShipCustomizationModal - 舰船自定义弹窗
 *
 * 顶栏按钮触发的独立弹窗：
 * - 选择要编辑的舰船
 * - 展开 ShipCustomizationPanel 进行编辑
 * - 保存修改到后端
 *
 * 仅 DM 可使用
 */

import type { ShipState } from "@/sync/types";
import { Faction } from "@/sync/types";
import { Settings, Crown, Rocket, CheckCircle } from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { ShipCustomizationPanel } from "../panels/ShipCustomizationPanel";
import type { CustomizeShipPayload, ShipCustomizationConfig } from "@vt/data";
import { ClientCommand } from "@vt/data";
import { notify } from "../shared/Notification";
import "./ship-customization-modal.css";

interface ShipCustomizationModalProps {
	/** 是否打开 */
	isOpen: boolean;
	/** 关闭回调 */
	onClose: () => void;
	/** 舰船列表 */
	ships: ShipState[];
	/** 网络管理器 */
	networkManager: any;
	/** 当前会话ID */
	currentSessionId: string;
}

export const ShipCustomizationModal: React.FC<ShipCustomizationModalProps> = ({
	isOpen,
	onClose,
	ships,
	networkManager,
	currentSessionId,
}) => {
	// 选中的舰船ID
	const [selectedShipId, setSelectedShipId] = useState<string | null>(null);
	// 保存状态
	const [isSaving, setIsSaving] = useState(false);

	// 可编辑的舰船列表（所有玩家可编辑）
	const editableShips = useMemo(() => {
		if (!ships) return [];
		return ships.filter((s) => !s.isDestroyed);
	}, [ships]);

	// 选中的舰船
	const selectedShip = useMemo(() => {
		return editableShips.find((s) => s.id === selectedShipId) || null;
	}, [editableShips, selectedShipId]);

	// 发送自定义命令到后端
	const sendCustomizeCommand = useCallback(
		async (payload: CustomizeShipPayload) => {
			if (!networkManager) {
				notify.error("网络连接不可用");
				return;
			}

			setIsSaving(true);

			try {
				const room = networkManager.getCurrentRoom();
				if (!room) {
					throw new Error("未连接到房间");
				}

				// 发送命令
				await room.send(ClientCommand.CMD_CUSTOMIZE_SHIP, payload);

				notify.success("舰船配置已保存");
			} catch (error: any) {
				console.error("[ShipCustomizationModal] Save error:", error);
				notify.error(error.message || "保存失败");
			} finally {
				setIsSaving(false);
			}
		},
		[networkManager]
	);

	// 处理配置更新
	const handleConfigUpdate = useCallback(
		(config: ShipCustomizationConfig) => {
			if (!selectedShipId) return;

			const payload: CustomizeShipPayload = {
				shipId: selectedShipId,
				...config,
			};

			sendCustomizeCommand(payload);
		},
		[selectedShipId, sendCustomizeCommand]
	);

	if (!isOpen) return null;

	return (
		<div className="game-modal-overlay" onClick={onClose}>
			<div
				className="game-modal game-modal--wide"
				onClick={(e) => e.stopPropagation()}
			>
				{/* 头部 */}
				<div className="game-panel__header">
					<div className="game-panel__title">
						<Crown className="game-panel__title-icon" />
						舰船自定义
						<span className="game-panel__title-badge">DM</span>
					</div>
					<button className="game-panel__close" onClick={onClose}>×</button>
				</div>

				{/* 内容区 */}
				<div className="game-panel__content">
					{/* 舰船选择区 */}
					<div className="ship-customization-modal__selector">
						<div className="ship-customization-modal__selector-header">
							<Rocket className="ship-customization-modal__selector-icon" />
							选择舰船
						</div>

						{editableShips.length > 0 ? (
							<div className="ship-customization-modal__ship-list">
								{editableShips.map((ship) => {
									const isSelected = selectedShipId === ship.id;
									const factionColor =
										ship.faction === Faction.PLAYER ? "#4a9eff" : "#ff6f8f";

									return (
										<button
											key={ship.id}
											className={`ship-customization-modal__ship-item ${
												isSelected
													? "ship-customization-modal__ship-item--selected"
													: ""
											}`}
											onClick={() => setSelectedShipId(ship.id)}
										>
											<div
												className="ship-customization-modal__ship-faction"
												style={{ backgroundColor: factionColor }}
											/>
											<div className="ship-customization-modal__ship-info">
												<span className="ship-customization-modal__ship-name">
													{ship.name || ship.hullType}
												</span>
												<span className="ship-customization-modal__ship-meta">
													{ship.hullType} | HP: {ship.hull.current}/{ship.hull.max}
												</span>
											</div>
											{isSelected && (
												<CheckCircle className="ship-customization-modal__ship-check" />
											)}
										</button>
									);
								})}
							</div>
						) : (
							<div className="ship-customization-modal__empty">
								暂无可编辑的舰船
							</div>
						)}
					</div>

					{/* 自定义面板 */}
					{selectedShip && (
						<div className="ship-customization-modal__panel">
							<ShipCustomizationPanel
								ship={selectedShip}
								isDM={true}
								networkManager={networkManager}
								onConfigUpdate={handleConfigUpdate}
								disabled={isSaving}
							/>
						</div>
					)}

					{/* 未选择舰船提示 */}
					{!selectedShip && editableShips.length > 0 && (
						<div className="ship-customization-modal__hint">
							请先选择要编辑的舰船
						</div>
					)}
				</div>

				{/* 底部操作 */}
				<div className="game-panel__footer">
					<div className="game-panel__hint">
						提示：舰船配置将实时保存到服务器
					</div>
					<button
						className="game-btn game-btn--primary"
						onClick={onClose}
						disabled={isSaving}
					>
						完成
					</button>
				</div>
			</div>
		</div>
	);
};

export default ShipCustomizationModal;