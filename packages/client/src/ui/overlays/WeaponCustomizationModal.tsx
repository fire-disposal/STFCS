/**
 * WeaponCustomizationModal - 武器自定义弹窗
 *
 * DM专用，创建自定义武器
 */

import type { PlayerRoleValue } from "@/sync/types";
import { PlayerRole } from "@/sync/types";
import {
	Crosshair,
	Zap,
	Shield,
	Target,
	AlertTriangle,
	CheckCircle,
	Box,
} from "lucide-react";
import React, { useState, useCallback } from "react";
import type { CreateCustomWeaponPayload } from "@vt/data";
import {
	WeaponCategoryValue,
	DamageTypeValue,
	WeaponSlotSizeValue,
	ClientCommand,
} from "@vt/data";
import { notify } from "../shared/Notification";
import "./weapon-customization-modal.css";

interface WeaponCustomizationModalProps {
	isOpen: boolean;
	onClose: () => void;
	networkManager: any;
	playerRole: PlayerRoleValue;
}

export const WeaponCustomizationModal: React.FC<WeaponCustomizationModalProps> = ({
	isOpen,
	onClose,
	networkManager,
	playerRole,
}) => {
	const [name, setName] = useState("自定义武器");
	const [category, setCategory] = useState<WeaponCategoryValue>("BALLISTIC");
	const [size, setSize] = useState<WeaponSlotSizeValue>("SMALL");
	const [damageType, setDamageType] = useState<DamageTypeValue>("KINETIC");
	const [damage, setDamage] = useState(100);
	const [range, setRange] = useState(500);
	const [arc, setArc] = useState(180);
	const [fluxCost, setFluxCost] = useState(50);
	const [cooldown, setCooldown] = useState(1);
	const [opCost, setOpCost] = useState(5);
	const [isPD, setIsPD] = useState(false);
	const [isSaving, setIsSaving] = useState(false);

	const isOwner = playerRole === PlayerRole.OWNER;

	const damageTypeColors: Record<DamageTypeValue, string> = {
		KINETIC: "#4a9eff",
		HIGH_EXPLOSIVE: "#e74c3c",
		ENERGY: "#f1c40f",
		FRAGMENTATION: "#888888",
	};

	const handleSave = useCallback(async () => {
		if (!isOwner) {
			notify.error("仅DM可创建武器");
			return;
		}

		setIsSaving(true);

		try {
			const room = networkManager?.getCurrentRoom();
			if (!room) throw new Error("未连接");

			const payload: CreateCustomWeaponPayload = {
				name,
				category,
				size,
				damageType,
				damagePerShot: damage,
				range,
				arc,
				fluxCost,
				cooldown,
				opCost,
				isPD,
			};

			await room.send(ClientCommand.CMD_CREATE_CUSTOM_WEAPON, payload);
			notify.success("武器已创建");
			onClose();
		} catch (err: any) {
			notify.error(err.message || "失败");
		} finally {
			setIsSaving(false);
		}
	}, [isOwner, name, category, size, damageType, damage, range, arc, fluxCost, cooldown, opCost, isPD, networkManager, onClose]);

	if (!isOwner) {
		return (
			<div className="game-modal-overlay" onClick={onClose}>
				<div className="game-modal" onClick={(e) => e.stopPropagation()}>
					<div className="game-panel__header">
						<div className="game-panel__title">
							<Crosshair className="game-panel__title-icon" />
							武器自定义
						</div>
						<button className="game-panel__close" onClick={onClose}>×</button>
					</div>
					<div className="game-panel__content">
						<div className="weapon-customization-modal__restricted">
							<AlertTriangle className="weapon-customization-modal__restricted-icon" />
							仅 DM 可创建武器
						</div>
					</div>
				</div>
			</div>
		);
	}

	if (!isOpen) return null;

	return (
		<div className="game-modal-overlay" onClick={onClose}>
			<div className="game-modal" onClick={(e) => e.stopPropagation()}>
				<div className="game-panel__header">
					<div className="game-panel__title">
						<Crosshair className="game-panel__title-icon" />
						武器自定义
						<span className="game-panel__title-badge">DM</span>
					</div>
					<button className="game-panel__close" onClick={onClose}>×</button>
				</div>

				<div className="game-panel__content">
					<div className="weapon-customization-form">
						{/* 基本信息 */}
						<div className="weapon-customization-section">
							<div className="weapon-customization-section__title">
								<Box className="weapon-customization-section__icon" />
								基本信息
							</div>
							<div className="weapon-customization-row">
								<div className="weapon-customization-field">
									<label>名称</label>
									<input type="text" value={name} onChange={(e) => setName(e.target.value)} />
								</div>
								<div className="weapon-customization-field">
									<label>类别</label>
									<select value={category} onChange={(e) => setCategory(e.target.value as WeaponCategoryValue)}>
										<option value="BALLISTIC">弹道</option>
										<option value="ENERGY">能量</option>
										<option value="MISSILE">导弹</option>
									</select>
								</div>
								<div className="weapon-customization-field">
									<label>尺寸</label>
									<select value={size} onChange={(e) => setSize(e.target.value as WeaponSlotSizeValue)}>
										<option value="SMALL">小型</option>
										<option value="MEDIUM">中型</option>
										<option value="LARGE">大型</option>
									</select>
								</div>
							</div>
						</div>

						{/* 伤害 */}
						<div className="weapon-customization-section">
							<div className="weapon-customization-section__title">
								<Target className="weapon-customization-section__icon" />
								伤害
							</div>
							<div className="weapon-customization-row">
								<div className="weapon-customization-field">
									<label>伤害类型</label>
									<select
										value={damageType}
										onChange={(e) => setDamageType(e.target.value as DamageTypeValue)}
										style={{ color: damageTypeColors[damageType] }}
									>
										<option value="KINETIC">动能</option>
										<option value="HIGH_EXPLOSIVE">高爆</option>
										<option value="ENERGY">能量</option>
										<option value="FRAGMENTATION">破片</option>
									</select>
								</div>
								<div className="weapon-customization-field">
									<label>单发伤害</label>
									<input type="number" value={damage} onChange={(e) => setDamage(Number(e.target.value))} />
								</div>
							</div>
							<div className="weapon-customization-hint">
								{damageType === "KINETIC" && "动能: 护盾2x, 护甲0.5x穿甲"}
								{damageType === "HIGH_EXPLOSIVE" && "高爆: 护盾0.5x, 护甲2x穿甲"}
								{damageType === "ENERGY" && "能量: 无修正"}
								{damageType === "FRAGMENTATION" && "破片: 护盾/护甲0.25x"}
							</div>
						</div>

						{/* 射程 */}
						<div className="weapon-customization-section">
							<div className="weapon-customization-section__title">
								<Crosshair className="weapon-customization-section__icon" />
								射程
							</div>
							<div className="weapon-customization-row">
								<div className="weapon-customization-field">
									<label>最大射程</label>
									<input type="number" value={range} onChange={(e) => setRange(Number(e.target.value))} />
								</div>
								<div className="weapon-customization-field">
									<label>射界°</label>
									<input type="number" value={arc} onChange={(e) => setArc(Number(e.target.value))} max={360} />
								</div>
							</div>
						</div>

						{/* 资源 */}
						<div className="weapon-customization-section">
							<div className="weapon-customization-section__title">
								<Zap className="weapon-customization-section__icon" />
								资源
							</div>
							<div className="weapon-customization-row">
								<div className="weapon-customization-field">
									<label>辐能消耗</label>
									<input type="number" value={fluxCost} onChange={(e) => setFluxCost(Number(e.target.value))} />
								</div>
								<div className="weapon-customization-field">
									<label>冷却回合</label>
									<input type="number" value={cooldown} onChange={(e) => setCooldown(Number(e.target.value))} />
								</div>
								<div className="weapon-customization-field">
									<label>OP成本</label>
									<input type="number" value={opCost} onChange={(e) => setOpCost(Number(e.target.value))} />
								</div>
							</div>
						</div>

						{/* 特殊 */}
						<div className="weapon-customization-section">
							<div className="weapon-customization-section__title">
								<Shield className="weapon-customization-section__icon" />
								特殊
							</div>
							<label className="weapon-customization-checkbox">
								<input type="checkbox" checked={isPD} onChange={(e) => setIsPD(e.target.checked)} />
								点防御 (PD)
							</label>
						</div>
					</div>
				</div>

				<div className="game-panel__footer">
					<button className="game-btn game-btn--secondary" onClick={onClose} disabled={isSaving}>
						取消
					</button>
					<button className="game-btn game-btn--primary" onClick={handleSave} disabled={isSaving}>
						<CheckCircle className="game-btn__icon game-btn__icon--left" />
						{isSaving ? "创建中..." : "创建武器"}
					</button>
				</div>
			</div>
		</div>
	);
};

export default WeaponCustomizationModal;