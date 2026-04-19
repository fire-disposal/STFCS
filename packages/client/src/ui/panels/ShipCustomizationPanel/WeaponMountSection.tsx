/**
 * WeaponMountSection - 武器挂点管理区
 *
 * 管理舰船的武器挂点：
 * - 挂点列表展示
 * - 添加/删除挂点
 * - 挂点属性编辑
 * - 武器选择（集成WeaponSelectorPanel）
 */

import React, { useState, useCallback, useMemo } from "react";
import { Plus, Trash2, Edit, Box } from "lucide-react";
import type { ShipState, WeaponSlot } from "@/sync/types";
import type { CustomWeaponMount, WeaponSlotSizeValue, SlotCategoryValue } from "@vt/data";
import { getWeaponSpec } from "@vt/data";

interface WeaponMountSectionProps {
	mounts: CustomWeaponMount[];
	onChange: (mounts: CustomWeaponMount[]) => void;
	disabled?: boolean;
	ship: ShipState;
	networkManager: any;
}

export const WeaponMountSection: React.FC<WeaponMountSectionProps> = ({
	mounts,
	onChange,
	disabled = false,
	ship,
	networkManager,
}) => {
	// 选中的挂点
	const [selectedMountId, setSelectedMountId] = useState<string | null>(null);
	// 编辑模式
	const [isEditing, setIsEditing] = useState(false);

	// 选中的挂点
	const selectedMount = useMemo(() => {
		return mounts.find((m) => m.id === selectedMountId);
	}, [mounts, selectedMountId]);

	// 添加新挂点
	const handleAddMount = useCallback(() => {
		const newId = `mount_${Date.now()}`;
		const newMount: CustomWeaponMount = {
			id: newId,
			displayName: `挂点 ${mounts.length + 1}`,
			position: { x: 0, y: 0 },
			facing: 0,
			arc: 180,
			size: "SMALL",
			slotCategory: "UNIVERSAL_SLOT",
			builtin: false,
		};
		onChange([...mounts, newMount]);
		setSelectedMountId(newId);
	}, [mounts, onChange]);

	// 删除挂点
	const handleDeleteMount = useCallback(
		(mountId: string) => {
			if (disabled) return;

			// 检查是否为内置挂点
			const mount = mounts.find((m) => m.id === mountId);
			if (mount?.builtin) {
				alert("内置武器挂点不可删除");
				return;
			}

			onChange(mounts.filter((m) => m.id !== mountId));
			if (selectedMountId === mountId) {
				setSelectedMountId(null);
			}
		},
		[mounts, selectedMountId, disabled, onChange]
	);

	// 更新挂点属性
	const handleUpdateMount = useCallback(
		(mountId: string, updates: Partial<CustomWeaponMount>) => {
			onChange(
				mounts.map((m) => {
					if (m.id === mountId) {
						return { ...m, ...updates };
					}
					return m;
				})
			);
		},
		[mounts, onChange]
	);

	return (
		<div className="ship-customization-mount-section">
			{/* 挂点列表 */}
			<div className="ship-customization-mount-list">
				{mounts.length > 0 ? (
					mounts.map((mount) => {
						const isSelected = selectedMountId === mount.id;
						const weaponSpec = mount.currentWeaponId
							? getWeaponSpec(mount.currentWeaponId)
							: null;

						return (
							<div
								key={mount.id}
								className={`ship-customization-mount-item ${
									isSelected ? "ship-customization-mount-item--selected" : ""
								} ${mount.builtin ? "ship-customization-mount-item--builtin" : ""}`}
								onClick={() => setSelectedMountId(mount.id)}
							>
								{/* 挂点信息 */}
								<div className="ship-customization-mount-item__info">
									<span className="ship-customization-mount-item__name">
										{mount.displayName || mount.id}
										{mount.builtin && <span style={{ color: "#e74c3c", marginLeft: "4px" }}>内置</span>}
									</span>
									<span className="ship-customization-mount-item__meta">
										{mount.size} | {mount.slotCategory}
									</span>
								</div>

								{/* 当前武器 */}
								{weaponSpec && (
									<span className="ship-customization-mount-item__weapon">
										{weaponSpec.name}
									</span>
								)}

								{/* 操作按钮 */}
								<div className="ship-customization-mount-item__actions">
									{!mount.builtin && (
										<button
											className="ship-customization-mount-item__action"
											onClick={(e) => {
												e.stopPropagation();
												handleDeleteMount(mount.id);
											}}
											disabled={disabled}
											title="删除挂点"
										>
											<Trash2 className="ship-customization-mount-item__action-icon" />
										</button>
									)}
								</div>
							</div>
						);
					})
				) : (
					<div className="ship-customization-empty">暂无武器挂点</div>
				)}
			</div>

			{/* 添加挂点按钮 */}
			<button
				className="ship-customization-panel__button ship-customization-panel__button--primary"
				onClick={handleAddMount}
				disabled={disabled}
				style={{ marginTop: "8px" }}
			>
				<Plus className="ship-customization-panel__button-icon" />
				添加挂点
			</button>

			{/* 挂点编辑区 */}
			{selectedMount && (
				<div className="ship-customization-mount-editor">
					<div className="ship-customization-mount-editor__header">
						<span className="ship-customization-mount-editor__title">
							{selectedMount.displayName || selectedMount.id} 属性
						</span>
						{selectedMount.builtin && (
							<span className="ship-customization-mount-editor__badge">内置</span>
						)}
					</div>

					<div className="ship-customization-section__grid">
						{/* 显示名称 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">显示名称</label>
							<input
								className="ship-customization-field__input"
								type="text"
								value={selectedMount.displayName || ""}
								onChange={(e) =>
									handleUpdateMount(selectedMount.id, { displayName: e.target.value })
								}
								disabled={disabled || selectedMount.builtin}
							/>
						</div>

						{/* 尺寸 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">尺寸</label>
							<select
								className="ship-customization-field__select"
								value={selectedMount.size}
								onChange={(e) =>
									handleUpdateMount(selectedMount.id, {
										size: e.target.value as WeaponSlotSizeValue,
									})
								}
								disabled={disabled || selectedMount.builtin}
							>
								<option value="SMALL">SMALL (小型)</option>
								<option value="MEDIUM">MEDIUM (中型)</option>
								<option value="LARGE">LARGE (大型)</option>
							</select>
						</div>

						{/* 形态 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">形态</label>
							<select
								className="ship-customization-field__select"
								value={selectedMount.mountType}
								onChange={(e) =>
									handleUpdateMount(selectedMount.id, {
										mountType: e.target.value as "turret" | "hardpoint",
									})
								}
								disabled={disabled || selectedMount.builtin}
							>
								<option value="turret">炮塔 (可旋转)</option>
								<option value="hardpoint">硬点 (固定)</option>
							</select>
						</div>

						{/* 类别限制 */}
						<div className="ship-customization-field">
							<label className="ship-customization-field__label">类别限制</label>
							<select
								className="ship-customization-field__select"
								value={selectedMount.slotCategory}
								onChange={(e) =>
									handleUpdateMount(selectedMount.id, {
										slotCategory: e.target.value as SlotCategoryValue,
									})
								}
								disabled={disabled || selectedMount.builtin}
							>
								<option value="UNIVERSAL_SLOT">通用 (UNIVERSAL)</option>
								<option value="BALLISTIC_SLOT">弹道 (BALLISTIC)</option>
								<option value="ENERGY_SLOT">能量 (ENERGY)</option>
								<option value="MISSILE_SLOT">导弹 (MISSILE)</option>
								<option value="COMPOSITE_SLOT">复合 (COMPOSITE)</option>
								<option value="SYNERGY_SLOT">协同 (SYNERGY)</option>
							</select>
						</div>
					</div>

					{/* 位置编辑 */}
					<div className="ship-customization-mount-editor__position">
						<div className="ship-customization-section__title" style={{ fontSize: "9px" }}>
							位置与朝向
						</div>
						<div className="ship-customization-section__grid">
							<div className="ship-customization-field">
								<label className="ship-customization-field__label">位置 X</label>
								<input
									className="ship-customization-field__input"
									type="number"
									value={selectedMount.position.x}
									onChange={(e) =>
										handleUpdateMount(selectedMount.id, {
											position: {
												...selectedMount.position,
												x: Number(e.target.value),
											},
										})
									}
									disabled={disabled || selectedMount.builtin}
								/>
							</div>
							<div className="ship-customization-field">
								<label className="ship-customization-field__label">位置 Y</label>
								<input
									className="ship-customization-field__input"
									type="number"
									value={selectedMount.position.y}
									onChange={(e) =>
										handleUpdateMount(selectedMount.id, {
											position: {
												...selectedMount.position,
												y: Number(e.target.value),
											},
										})
									}
									disabled={disabled || selectedMount.builtin}
								/>
							</div>
							<div className="ship-customization-field">
								<label className="ship-customization-field__label">基准朝向 (°)</label>
								<input
									className="ship-customization-field__input"
									type="number"
									value={selectedMount.facing}
									onChange={(e) =>
										handleUpdateMount(selectedMount.id, { facing: Number(e.target.value) })
									}
									min={-180}
									max={180}
									disabled={disabled || selectedMount.builtin}
								/>
							</div>
						</div>
					</div>

					{/* 射界编辑 */}
					{selectedMount.mountType === "turret" && (
						<div className="ship-customization-mount-editor__arc">
							<div className="ship-customization-section__title" style={{ fontSize: "9px" }}>
								射界范围
							</div>
							<div className="ship-customization-field">
								<label className="ship-customization-field__label">射界角度 (°)</label>
								<input
									className="ship-customization-field__input"
									type="number"
									value={selectedMount.arc}
									onChange={(e) =>
										handleUpdateMount(selectedMount.id, { arc: Number(e.target.value) })
									}
									min={0}
									max={360}
									disabled={disabled || selectedMount.builtin}
								/>
							</div>
						</div>
					)}

					{/* 当前武器 */}
					{selectedMount.currentWeaponId && (
						<div className="ship-customization-mount-editor__weapon">
							<div className="ship-customization-section__title" style={{ fontSize: "9px" }}>
								当前武器
							</div>
							<div className="ship-customization-field__display">
								{getWeaponSpec(selectedMount.currentWeaponId)?.name || selectedMount.currentWeaponId}
							</div>
							{!selectedMount.builtin && !disabled && (
								<button
									className="ship-customization-panel__button ship-customization-panel__button--secondary"
									onClick={() => handleUpdateMount(selectedMount.id, { currentWeaponId: undefined })}
								>
									卸下武器
								</button>
							)}
						</div>
					)}
				</div>
			)}

			{/* 提示 */}
			<div className="ship-customization-hint">
				提示: 点击挂点可编辑属性；大型槽可装中型/小型武器；内置挂点不可修改
			</div>
		</div>
	);
};

export default WeaponMountSection;