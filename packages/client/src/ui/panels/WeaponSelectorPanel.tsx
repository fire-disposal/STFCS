/**
 * WeaponSelectorPanel - 武器选择器面板
 *
 * 用于舰船配置界面，让 DM 或玩家选择武器安装到挂载点
 *
 * 功能：
 * - 显示舰船的所有挂载点
 * - 每个挂载点显示可选武器列表（尺寸兼容）
 * - OP 点数预算显示
 * - 武器详情预览
 */

import React, { useMemo, useState, useCallback } from "react";
import { notify } from "@/ui/shared/Notification";
import { getShipHullSpec, getWeaponSpec, isWeaponSizeCompatible, SIZE_COMPATIBILITY } from "@vt/data";
import type { ShipHullSpec, WeaponSpec, WeaponSlotSizeValue } from "@vt/data";
import { GameClient } from "@/sync/GameClient";
import type { ConfigureWeaponPayload } from "@vt/schema-types";
import {
	Target,
	Crosshair,
	Zap,
	ArrowUp,
	Shield,
	Box,
	AlertTriangle,
	CheckCircle,
	XCircle,
	Info,
} from "lucide-react";
import "./weapon-selector.css";

interface WeaponSelectorPanelProps {
	/** 目标舰船 ID */
	shipId: string;
	/** 舰船规格 ID */
	hullId: string;
	/** 当前武器配置（挂载点 ID -> 武器规格 ID） */
	currentLoadout: Map<string, string>;
	/** 网络管理器（用于发送命令） */
	networkManager: any;
	/** 是否为 DM（DM 有更多权限） */
	isDm: boolean;
	/** 配置完成回调 */
	onConfigureComplete?: (result: { opUsed: number; opMax: number }) => void;
	/** 关闭面板回调 */
	onClose?: () => void;
}

/** 武器分类图标 */
const WEAPON_CATEGORY_ICONS: Record<string, React.ComponentType<any>> = {
	BALLISTIC: Target,
	ENERGY: Zap,
	MISSILE: ArrowUp,
	BEAM: Crosshair,
};

/** 伤害类型颜色 */
const DAMAGE_TYPE_COLORS: Record<string, string> = {
	KINETIC: "#4a9eff",   // 蓝色
	ENERGY: "#f1c40f",    // 黄色
	HIGH_EXPLOSIVE: "#e74c3c", // 红色
	FRAGMENTATION: "#888", // 灰色
};

export const WeaponSelectorPanel: React.FC<WeaponSelectorPanelProps> = ({
	shipId,
	hullId,
	currentLoadout,
	networkManager,
	isDm,
	onConfigureComplete,
	onClose,
}) => {
	const [selectedMount, setSelectedMount] = useState<string | null>(null);
	const [hoveredWeapon, setHoveredWeapon] = useState<string | null>(null);
	const [isConfiguring, setIsConfiguring] = useState(false);

	// 获取舰船规格
	const hullSpec = useMemo(() => getShipHullSpec(hullId), [hullId]);

	// 获取所有武器规格
	const allWeapons = useMemo(() => {
		// 从 @vt/data 获取所有武器
		const weapons: WeaponSpec[] = [];
		// TODO: 需要从 @vt/data 导出 getAllWeapons 函数
		// 当前使用已知武器 ID 列表
		const weaponIds = [
			"railgun_s", "autocannon_s", "laser_s", "pulse_laser_s", "missile_s", "torpedo_s", "pd_s",
			"railgun_m", "autocannon_m", "heavy_laser_m", "pulse_laser_m", "missile_m", "torpedo_m", "pd_m", "beam_m", "flak_m", "ion_cannon_m", "plasma_cannon_m", "graviton_m",
			"railgun_l", "autocannon_l", "heavy_laser_l", "missile_l", "torpedo_l", "pd_l", "beam_l", "plasma_cannon_l",
		];
		for (const id of weaponIds) {
			const spec = getWeaponSpec(id);
			if (spec) weapons.push(spec);
		}
		return weapons;
	}, []);

	// 计算 OP 使用情况
	const opCalculation = useMemo(() => {
		if (!hullSpec) return { used: 0, max: 0 };

		let used = 0;
		currentLoadout.forEach((weaponSpecId) => {
			const spec = getWeaponSpec(weaponSpecId);
			if (spec) used += spec.opCost;
		});

		return { used, max: hullSpec.opCapacity };
	}, [hullSpec, currentLoadout]);

	// 获取挂载点列表
	const mounts = useMemo(() => {
		if (!hullSpec) return [];
		return hullSpec.weaponMounts;
	}, [hullSpec]);

	// 获取选中挂载点可选的武器
	const availableWeaponsForMount = useMemo(() => {
		if (!selectedMount) return [];

		const mount = mounts.find((m) => m.id === selectedMount);
		if (!mount) return [];

		return allWeapons.filter((weapon) => {
			// 尺寸兼容
			if (!isWeaponSizeCompatible(mount.size, weapon.size)) return false;

			// 类型限制
			if (mount.restrictedTypes && !mount.restrictedTypes.includes(weapon.category)) return false;

			return true;
		});
	}, [selectedMount, mounts, allWeapons]);

	// 当前选中挂载点的武器
	const currentWeaponForMount = useMemo(() => {
		if (!selectedMount) return null;
		const weaponSpecId = currentLoadout.get(selectedMount);
		if (!weaponSpecId) return null;
		return getWeaponSpec(weaponSpecId);
	}, [selectedMount, currentLoadout]);

	// hover 的武器详情
	const hoveredWeaponSpec = useMemo(() => {
		if (!hoveredWeapon) return null;
		return getWeaponSpec(hoveredWeapon);
	}, [hoveredWeapon]);

	// 配置武器
	const handleConfigureWeapon = useCallback(async (weaponSpecId: string) => {
		if (!selectedMount || !hullSpec) return;

		// 检查 OP 预算
		const newWeapon = getWeaponSpec(weaponSpecId);
		if (!newWeapon) return;

		const newOpUsed = opCalculation.used - (currentWeaponForMount?.opCost || 0) + newWeapon.opCost;
		if (newOpUsed > opCalculation.max) {
			notify.warning(`OP 点数超出预算: ${newOpUsed}/${opCalculation.max}`);
			// 软限制，允许配置但给出警告
		}

		setIsConfiguring(true);

		try {
			const room = networkManager.getCurrentRoom();
			if (!room) throw new Error("未连接到房间");

			const gameClient = new GameClient(room);
			gameClient.sendConfigureWeapon({
				shipId,
				mountId: selectedMount,
				weaponSpecId,
			});

			notify.success("武器配置成功");
			onConfigureComplete?.({ opUsed: newOpUsed, opMax: opCalculation.max });
		} catch (error: any) {
			notify.error(error.message || "配置失败");
		} finally {
			setIsConfiguring(false);
		}
	}, [selectedMount, hullSpec, shipId, opCalculation, currentWeaponForMount, networkManager, onConfigureComplete]);

	// 清空挂载点
	const handleClearMount = useCallback(async () => {
		if (!selectedMount) return;

		setIsConfiguring(true);

		try {
			const room = networkManager.getCurrentRoom();
			if (!room) throw new Error("未连接到房间");

			const gameClient = new GameClient(room);
			gameClient.sendConfigureWeapon({
				shipId,
				mountId: selectedMount,
				weaponSpecId: "", // 空字符串表示清空
			});

			notify.success("武器已卸下");
		} catch (error: any) {
			notify.error(error.message || "卸下失败");
		} finally {
			setIsConfiguring(false);
		}
	}, [selectedMount, shipId, networkManager]);

	// 无舰船规格
	if (!hullSpec) {
		return (
			<div className="weapon-selector weapon-selector--error">
				<AlertTriangle className="weapon-selector__error-icon" />
				<span>舰船规格不存在: {hullId}</span>
			</div>
		);
	}

	return (
		<div className="weapon-selector">
			{/* 头部 */}
			<div className="weapon-selector__header">
				<div className="weapon-selector__title">
					<Box className="weapon-selector__title-icon" />
					<span>{hullSpec.name} 武器配置</span>
				</div>
				<div className="weapon-selector__op-display">
					<span className="weapon-selector__op-label">OP</span>
					<span className={`weapon-selector__op-value ${opCalculation.used > opCalculation.max ? "weapon-selector__op-value--exceeded" : ""}`}>
						{opCalculation.used}/{opCalculation.max}
					</span>
					{opCalculation.used > opCalculation.max && (
						<AlertTriangle className="weapon-selector__op-warning" style={{ color: "#e74c3c" }} />
					)}
				</div>
				{onClose && (
					<button className="weapon-selector__close" onClick={onClose}>
						<XCircle />
					</button>
				)}
			</div>

			{/* 挂载点列表 */}
			<div className="weapon-selector__mounts">
				<div className="weapon-selector__mounts-header">挂载点</div>
				{mounts.map((mount) => {
					const isSelected = selectedMount === mount.id;
					const currentWeaponId = currentLoadout.get(mount.id);
					const currentWeapon = currentWeaponId ? getWeaponSpec(currentWeaponId) : null;

					return (
						<button
							key={mount.id}
							className={`weapon-selector__mount ${isSelected ? "weapon-selector__mount--selected" : ""}`}
							onClick={() => setSelectedMount(mount.id)}
						>
							<span className="weapon-selector__mount-size">{mount.size}</span>
							<span className="weapon-selector__mount-id">{mount.id}</span>
							<span className="weapon-selector__mount-type">{mount.type}</span>
							{currentWeapon && (
								<span className="weapon-selector__mount-current">
									{currentWeapon.name}
								</span>
							)}
							{!currentWeapon && (
								<span className="weapon-selector__mount-empty">空</span>
							)}
						</button>
					);
				})}
			</div>

			{/* 武器选择区域 */}
			{selectedMount && (
				<div className="weapon-selector__weapons">
					<div className="weapon-selector__weapons-header">
						可选武器
						<span className="weapon-selector__weapons-size">
							{mounts.find(m => m.id === selectedMount)?.size} 挂载点
						</span>
					</div>

					{/* 当前武器 */}
					{currentWeaponForMount && (
						<div className="weapon-selector__current-weapon">
							<span>当前: {currentWeaponForMount.name}</span>
							<button
								className="weapon-selector__clear-btn"
								onClick={handleClearMount}
								disabled={isConfiguring}
							>
								卸下
							</button>
						</div>
					)}

					{/* 可选武器列表 */}
					<div className="weapon-selector__weapon-list">
						{availableWeaponsForMount.map((weapon) => {
							const isHovered = hoveredWeapon === weapon.id;
							const isCurrent = currentWeaponForMount?.id === weapon.id;
							const Icon = WEAPON_CATEGORY_ICONS[weapon.category] || Target;

							return (
								<button
									key={weapon.id}
									className={`weapon-selector__weapon ${isHovered ? "weapon-selector__weapon--hovered" : ""} ${isCurrent ? "weapon-selector__weapon--current" : ""}`}
									onClick={() => handleConfigureWeapon(weapon.id)}
									onMouseEnter={() => setHoveredWeapon(weapon.id)}
									onMouseLeave={() => setHoveredWeapon(null)}
									disabled={isConfiguring || isCurrent}
								>
									<Icon className="weapon-selector__weapon-icon" style={{ color: DAMAGE_TYPE_COLORS[weapon.damageType] || "#888" }} />
									<span className="weapon-selector__weapon-name">{weapon.name}</span>
									<span className="weapon-selector__weapon-size">{weapon.size}</span>
									<span className="weapon-selector__weapon-op">{weapon.opCost} OP</span>
								</button>
							);
						})}
					</div>
				</div>
			)}

			{/* 武器详情预览 */}
			{hoveredWeaponSpec && (
				<div className="weapon-selector__preview">
					<div className="weapon-selector__preview-header">
						<Info className="weapon-selector__preview-icon" />
						<span>{hoveredWeaponSpec.name}</span>
					</div>
					<div className="weapon-selector__preview-stats">
						<div className="weapon-selector__preview-stat">
							<span>伤害类型</span>
							<span style={{ color: DAMAGE_TYPE_COLORS[hoveredWeaponSpec.damageType] }}>
								{hoveredWeaponSpec.damageType}
							</span>
						</div>
						<div className="weapon-selector__preview-stat">
							<span>伤害</span>
							<span>{hoveredWeaponSpec.damage}</span>
						</div>
						<div className="weapon-selector__preview-stat">
							<span>射程</span>
							<span>{hoveredWeaponSpec.range}</span>
						</div>
						<div className="weapon-selector__preview-stat">
							<span>射界</span>
							<span>{hoveredWeaponSpec.arc || "全向"}°</span>
						</div>
						<div className="weapon-selector__preview-stat">
							<span>辐能消耗</span>
							<span>{hoveredWeaponSpec.fluxCost}</span>
						</div>
						<div className="weapon-selector__preview-stat">
							<span>冷却</span>
							<span>{hoveredWeaponSpec.cooldown}s</span>
						</div>
						{hoveredWeaponSpec.ammo && (
							<div className="weapon-selector__preview-stat">
								<span>弹药</span>
								<span>{hoveredWeaponSpec.ammo}</span>
							</div>
						)}
						{hoveredWeaponSpec.empDamage && (
							<div className="weapon-selector__preview-stat">
								<span>EMP</span>
								<span style={{ color: "#9b59b6" }}>{hoveredWeaponSpec.empDamage}</span>
							</div>
						)}
					</div>
					<div className="weapon-selector__preview-tags">
						{hoveredWeaponSpec.ignoresShields && (
							<span className="weapon-selector__preview-tag weapon-selector__preview-tag--special">
								穿盾
							</span>
						)}
						{hoveredWeaponSpec.tracking && (
							<span className="weapon-selector__preview-tag weapon-selector__preview-tag--tracking">
								制导
							</span>
						)}
					</div>
				</div>
			)}

			{/* 底部提示 */}
			<div className="weapon-selector__footer">
				<span className="weapon-selector__hint">
					{isDm ? "DM 可自由配置" : "部署阶段可配置己方舰船"}
				</span>
				<span className="weapon-selector__hint">
					尺寸兼容: SMALL→MEDIUM→LARGE（向下兼容）
				</span>
			</div>
		</div>
	);
};

export default WeaponSelectorPanel;