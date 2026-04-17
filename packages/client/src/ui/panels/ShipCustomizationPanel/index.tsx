/**
 * ShipCustomizationPanel - 舰船自定义面板
 *
 * DM专用面板，用于完整舰船属性自定义：
 * - 基本信息（名称、尺寸、派系）
 * - 贴图管理（导入、透明色、定位）
 * - 生存属性（结构值、六象限护甲）
 * - 辐能系统（容量、散逸率）
 * - 护盾系统（类型、覆盖角度）
 * - 机动属性（航速、转向）
 * - 武器挂点管理（添加/删除/编辑）
 * - 配置摘要统计
 *
 * 设计理念：
 * - 舰船实例与模板语义平等，不引入"变体"概念
 * - 高自由度自定义，依赖DM人工审查
 * - 所有属性可编辑
 */

import type { ShipState } from "@/sync/types";
import { PlayerRole } from "@/sync/types";
import {
	ChevronDown,
	ChevronRight,
	Settings,
	Box,
	Shield,
	Zap,
	Rocket,
	Crosshair,
	Image,
	AlertTriangle,
	CheckCircle,
} from "lucide-react";
import React, { useState, useMemo, useCallback } from "react";
import { ArmorEditor } from "./ArmorEditor";
import { BasicInfoSection } from "./BasicInfoSection";
import { FluxSystemSection } from "./FluxSystemSection";
import { MobilitySection } from "./MobilitySection";
import { ShieldSystemSection } from "./ShieldSystemSection";
import { TextureSection } from "./TextureSection";
import { WeaponMountSection } from "./WeaponMountSection";
import type {
	TextureConfig,
	ShipCustomizationConfig,
	CustomWeaponMount,
	ShipStatsSummary,
} from "@vt/data";
import { DEFAULT_TEXTURE_CONFIG } from "@vt/data";
import "./index.css";

// 折叠状态类型
type CollapsedState = {
	basic: boolean;
	texture: boolean;
	hull: boolean;
	flux: boolean;
	shield: boolean;
	mobility: boolean;
	weapon: boolean;
};

interface ShipCustomizationPanelProps {
	/** 目标舰船 */
	ship: ShipState;
	/** 是否为DM */
	isDM: boolean;
	/** 网络管理器 */
	networkManager: any;
	/** 配置更新回调 */
	onConfigUpdate?: (config: ShipCustomizationConfig) => void;
	/** 关闭面板回调 */
	onClose?: () => void;
	/** 禁用状态 */
	disabled?: boolean;
}

export const ShipCustomizationPanel: React.FC<ShipCustomizationPanelProps> = ({
	ship,
	isDM,
	networkManager,
	onConfigUpdate,
	onClose,
	disabled = false,
}) => {
	// 折叠状态管理
	const [collapsed, setCollapsed] = useState<CollapsedState>({
		basic: false,
		texture: true, // 贴图区默认折叠
		hull: false,
		flux: false,
		shield: true,
		mobility: true,
		weapon: false,
	});

	// 本地编辑状态
	const [localConfig, setLocalConfig] = useState<ShipCustomizationConfig>(() => {
		// 从舰船状态初始化
		return {
			name: ship.name,
			hullType: ship.hullType,
			size: undefined, // 从 hullType 推断
			hullPointsMax: ship.hull.max,
			hullPointsCurrent: ship.hull.current,
			armorMaxPerQuadrant: ship.armor.maxPerQuadrant,
			armorQuadrants: [
				ship.armor.quadrants[0],
				ship.armor.quadrants[1],
				ship.armor.quadrants[2],
				ship.armor.quadrants[3],
				ship.armor.quadrants[4],
				ship.armor.quadrants[5],
			],
			armorMinReductionRatio: ship.armor.minReductionRatio,
			armorMaxReductionRatio: ship.armor.maxReductionRatio,
			fluxCapacityMax: ship.flux.max,
			fluxDissipation: ship.flux.dissipation,
			fluxSoftCurrent: ship.flux.soft,
			fluxHardCurrent: ship.flux.hard,
			shieldType: ship.shield.type,
			shieldArc: ship.shield.arc,
			shieldEfficiency: ship.shield.efficiency,
			shieldRadius: ship.shield.radius,
			maxSpeed: ship.maxSpeed,
			maxTurnRate: ship.maxTurnRate,
		};
	});

	// 贴图配置（暂使用默认值）
	const [textureConfig, setTextureConfig] = useState<TextureConfig>(DEFAULT_TEXTURE_CONFIG);

	// 武器挂点列表（从舰船状态初始化）
	const [weaponMounts, setWeaponMounts] = useState<CustomWeaponMount[]>(() => {
		const mounts: CustomWeaponMount[] = [];
		ship.weapons.forEach((slot, mountId) => {
			mounts.push({
				id: mountId,
				displayName: slot.displayName || mountId,
				position: { x: slot.mountOffsetX, y: slot.mountOffsetY },
				facing: slot.mountFacing,
				arc: slot.arc,
				hardpointArc: slot.hardpointArc,
				size: slot.mountSize,
				mountType: slot.mountType === "TURRET" ? "turret" : "hardpoint",
				slotCategory: slot.slotCategory,
				acceptsTurret: slot.acceptsTurret,
				acceptsHardpoint: slot.acceptsHardpoint,
				builtin: slot.isBuiltIn,
				currentWeaponId: slot.weaponSpecId || undefined,
			});
		});
		return mounts;
	});

	// 切换折叠状态
	const toggleCollapse = useCallback((section: keyof CollapsedState) => {
		setCollapsed((prev) => ({ ...prev, [section]: !prev[section] }));
	}, []);

	// 更新本地配置
	const updateConfig = useCallback((updates: Partial<ShipCustomizationConfig>) => {
		setLocalConfig((prev) => ({ ...prev, ...updates }));
	}, []);

	// 计算统计摘要（TODO: 实现完整计算）
	const statsSummary = useMemo<ShipStatsSummary>(() => {
		// 简化计算，待完善
		const totalDamage = 0;
		const totalFlux = 0;
		const opUsed = 0;
		const opMax = 0;

		return {
			totalDamagePerShot: totalDamage,
			totalFluxPerShot: totalFlux,
			effectiveRangeMin: 0,
			effectiveRangeMax: 0,
			dpsEstimate: 0,
			kineticDamageRatio: 0,
			highExplosiveDamageRatio: 0,
			energyDamageRatio: 0,
			fragmentationDamageRatio: 0,
			effectiveHP: ship.hull.max + ship.armor.maxPerQuadrant * 6,
			shieldCoverage: ship.shield.arc,
			fluxDissipationRate: ship.flux.dissipation,
			maxSpeed: ship.maxSpeed,
			maxTurnRate: ship.maxTurnRate,
			opUsed,
			opMax,
			opStatus: opMax > 0 ? (opUsed > opMax ? "exceeded" : "compliant") : "disabled",
		};
	}, [ship, weaponMounts]);

	// 保存修改
	const handleSave = useCallback(() => {
		const fullConfig: ShipCustomizationConfig = {
			...localConfig,
			texture: textureConfig,
			weaponMounts,
		};
		onConfigUpdate?.(fullConfig);

		// TODO: 发送网络命令
		console.log("[ShipCustomizationPanel] Saving config:", fullConfig);
	}, [localConfig, textureConfig, weaponMounts, onConfigUpdate]);

	// 非DM用户禁用编辑
	const canEdit = isDM && !disabled;

	return (
		<div className="ship-customization-panel">
			{/* 头部 */}
			<div className="ship-customization-panel__header">
				<div className="ship-customization-panel__title">
					<Settings className="ship-customization-panel__title-icon" />
					<span>{ship.name || ship.hullType} 自定义</span>
				</div>
				<div className="ship-customization-panel__status">
					{isDM ? (
						<span className="ship-customization-panel__status-badge ship-customization-panel__status-badge--dm">
							DM 编辑模式
						</span>
					) : (
						<span className="ship-customization-panel__status-badge ship-customization-panel__status-badge--restricted">
							仅查看
						</span>
					)}
				</div>
				{onClose && (
					<button className="ship-customization-panel__close" onClick={onClose}>
						×
					</button>
				)}
			</div>

			{/* 内容区 */}
			<div className="ship-customization-panel__content">
				{/* 基本信息区 */}
				<Section
					title="基本信息"
					icon={<Box />}
					collapsed={collapsed.basic}
					onToggle={() => toggleCollapse("basic")}
				>
					<BasicInfoSection
						config={localConfig}
						onChange={updateConfig}
						disabled={!canEdit}
					/>
				</Section>

				{/* 贴图管理区 */}
				<Section
					title="贴图管理"
					icon={<Image />}
					collapsed={collapsed.texture}
					onToggle={() => toggleCollapse("texture")}
				>
					<TextureSection
						textureConfig={textureConfig}
						onChange={setTextureConfig}
						disabled={!canEdit}
						shipWidth={ship.width}
						shipLength={ship.length}
					/>
				</Section>

				{/* 船体属性区（包含护甲可视化编辑器） */}
				<Section
					title="船体属性"
					icon={<Shield />}
					collapsed={collapsed.hull}
					onToggle={() => toggleCollapse("hull")}
				>
					<div className="ship-customization-section__grid">
						{/* 结构值 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">结构值上限</label>
							<input
								className="ship-customization-field__input"
								type="number"
								value={localConfig.hullPointsMax ?? ship.hull.max}
								onChange={(e) => updateConfig({ hullPointsMax: Number(e.target.value) })}
								disabled={!canEdit}
							/>
						</div>
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">当前结构值</label>
							<input
								className="ship-customization-field__input"
								type="number"
								value={localConfig.hullPointsCurrent ?? ship.hull.current}
								onChange={(e) => updateConfig({ hullPointsCurrent: Number(e.target.value) })}
								min={0}
								max={localConfig.hullPointsMax ?? ship.hull.max}
								disabled={!canEdit}
							/>
						</div>
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">护甲上限（单象限）</label>
							<input
								className="ship-customization-field__input"
								type="number"
								value={localConfig.armorMaxPerQuadrant ?? ship.armor.maxPerQuadrant}
								onChange={(e) => updateConfig({ armorMaxPerQuadrant: Number(e.target.value) })}
								disabled={!canEdit}
							/>
						</div>
					</div>
					{/* 六象限护甲可视化编辑器 */}
					<ArmorEditor
						quadrants={localConfig.armorQuadrants ?? [
							ship.armor.quadrants[0],
							ship.armor.quadrants[1],
							ship.armor.quadrants[2],
							ship.armor.quadrants[3],
							ship.armor.quadrants[4],
							ship.armor.quadrants[5],
						]}
						maxPerQuadrant={localConfig.armorMaxPerQuadrant ?? ship.armor.maxPerQuadrant}
						onChange={(quadrants) => updateConfig({ armorQuadrants: quadrants })}
						disabled={!canEdit}
					/>
					{/* 护甲减伤配置 */}
					<div className="ship-customization-section__grid">
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">最小护甲减伤比</label>
							<input
								className="ship-customization-field__input"
								type="number"
								step="0.01"
								value={localConfig.armorMinReductionRatio ?? ship.armor.minReductionRatio}
								onChange={(e) => updateConfig({ armorMinReductionRatio: Number(e.target.value) })}
								min={0}
								max={1}
								disabled={!canEdit}
							/>
						</div>
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">最大护甲减伤比</label>
							<input
								className="ship-customization-field__input"
								type="number"
								step="0.01"
								value={localConfig.armorMaxReductionRatio ?? ship.armor.maxReductionRatio}
								onChange={(e) => updateConfig({ armorMaxReductionRatio: Number(e.target.value) })}
								min={0}
								max={1}
								disabled={!canEdit}
							/>
						</div>
					</div>
				</Section>

				{/* 辐能系统区 */}
				<Section
					title="辐能系统"
					icon={<Zap />}
					collapsed={collapsed.flux}
					onToggle={() => toggleCollapse("flux")}
				>
					<FluxSystemSection
						config={localConfig}
						onChange={updateConfig}
						disabled={!canEdit}
						ship={ship}
					/>
				</Section>

				{/* 护盾系统区 */}
				<Section
					title="护盾系统"
					icon={<Shield />}
					collapsed={collapsed.shield}
					onToggle={() => toggleCollapse("shield")}
				>
					<ShieldSystemSection
						config={localConfig}
						onChange={updateConfig}
						disabled={!canEdit}
						ship={ship}
					/>
				</Section>

				{/* 机动属性区 */}
				<Section
					title="机动属性"
					icon={<Rocket />}
					collapsed={collapsed.mobility}
					onToggle={() => toggleCollapse("mobility")}
				>
					<MobilitySection
						config={localConfig}
						onChange={updateConfig}
						disabled={!canEdit}
						ship={ship}
					/>
				</Section>

				{/* 武器挂点管理区 */}
				<Section
					title="武器挂点"
					icon={<Crosshair />}
					collapsed={collapsed.weapon}
					onToggle={() => toggleCollapse("weapon")}
				>
					<WeaponMountSection
						mounts={weaponMounts}
						onChange={setWeaponMounts}
						disabled={!canEdit}
						ship={ship}
						networkManager={networkManager}
					/>
				</Section>
			</div>

			{/* 配置摘要区 */}
			<div className="ship-customization-panel__summary">
				<div className="ship-customization-summary__row">
					<span className="ship-customization-summary__label">有效HP</span>
					<span className="ship-customization-summary__value">{statsSummary.effectiveHP}</span>
				</div>
				<div className="ship-customization-summary__row">
					<span className="ship-customization-summary__label">护盾覆盖</span>
					<span className="ship-customization-summary__value">{statsSummary.shieldCoverage}°</span>
				</div>
				<div className="ship-customization-summary__row">
					<span className="ship-customization-summary__label">航速</span>
					<span className="ship-customization-summary__value">{statsSummary.maxSpeed}</span>
				</div>
				<div className="ship-customization-summary__row">
					<span className="ship-customization-summary__label">转向</span>
					<span className="ship-customization-summary__value">{statsSummary.maxTurnRate}°</span>
				</div>
				{statsSummary.opStatus !== "disabled" && (
					<div className="ship-customization-summary__row">
						<span className="ship-customization-summary__label">OP预算</span>
						<span
							className={`ship-customization-summary__value ${
								statsSummary.opStatus === "exceeded"
									? "ship-customization-summary__value--warning"
									: ""
							}`}
						>
							{statsSummary.opUsed}/{statsSummary.opMax}
							{statsSummary.opStatus === "exceeded" && <AlertTriangle className="ship-customization-summary__icon" />}
						</span>
					</div>
				)}
			</div>

			{/* 操作按钮 */}
			<div className="ship-customization-panel__actions">
				<button
					className="ship-customization-panel__button ship-customization-panel__button--primary"
					onClick={handleSave}
					disabled={!canEdit}
				>
					<CheckCircle className="ship-customization-panel__button-icon" />
					保存修改
				</button>
				<button
					className="ship-customization-panel__button ship-customization-panel__button--secondary"
					onClick={() => setLocalConfig({})}
					disabled={!canEdit}
				>
					重置
				</button>
			</div>
		</div>
	);
};

// 可折叠区块组件
interface SectionProps {
	title: string;
	icon: React.ReactNode;
	collapsed: boolean;
	onToggle: () => void;
	children: React.ReactNode;
}

const Section: React.FC<SectionProps> = ({ title, icon, collapsed, onToggle, children }) => {
	return (
		<div className="ship-customization-section">
			<div className="ship-customization-section__header" onClick={onToggle}>
				<div className="ship-customization-section__title">
					{icon}
					<span>{title}</span>
				</div>
				<button className="ship-customization-section__toggle">
					{collapsed ? <ChevronRight /> : <ChevronDown />}
				</button>
			</div>
			{!collapsed && <div className="ship-customization-section__content">{children}</div>}
		</div>
	);
};

export default ShipCustomizationPanel;