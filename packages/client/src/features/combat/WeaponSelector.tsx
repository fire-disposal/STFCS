/**
 * 武器选择器组件
 *
 * 显示舰船可用武器列表，支持：
 * - 武器状态显示
 * - 射程和伤害信息
 * - 武器类型筛选
 */

import type { WeaponInstanceState } from "@vt/types";
import type { DamageType } from "@vt/types";
import React from "react";

// 样式
const styles = {
	container: {
		display: "flex",
		flexDirection: "column" as const,
		gap: "8px",
	},
	header: {
		fontSize: "14px",
		fontWeight: "bold",
		marginBottom: "8px",
	},
	weaponList: {
		maxHeight: "250px",
		overflow: "auto",
	},
	weaponCard: {
		display: "flex",
		alignItems: "center",
		padding: "10px",
		backgroundColor: "var(--color-background)",
		borderRadius: "0",
		cursor: "pointer",
		transition: "all 0.2s ease",
		border: "2px solid transparent",
		marginBottom: "6px",
	},
	weaponCardSelected: {
		borderColor: "var(--color-primary)",
		backgroundColor: "var(--color-primary-light)",
	},
	weaponCardDisabled: {
		opacity: 0.5,
		cursor: "not-allowed",
	},
	weaponIcon: {
		width: "36px",
		height: "36px",
		borderRadius: "0",
		display: "flex",
		alignItems: "center",
		justifyContent: "center",
		marginRight: "10px",
		fontSize: "18px",
	},
	weaponInfo: {
		flex: 1,
	},
	weaponName: {
		fontSize: "13px",
		fontWeight: "bold",
		marginBottom: "2px",
	},
	weaponStats: {
		fontSize: "11px",
		color: "var(--color-text-secondary)",
		display: "flex",
		gap: "8px",
	},
	weaponStatus: {
		display: "flex",
		flexDirection: "column" as const,
		alignItems: "flex-end",
		gap: "2px",
	},
	statusBadge: {
		padding: "2px 6px",
		borderRadius: "0",
		fontSize: "10px",
		fontWeight: "bold",
	},
	statusReady: {
		backgroundColor: "var(--color-success-light)",
		color: "var(--color-success)",
	},
	statusCooldown: {
		backgroundColor: "var(--color-warning-light)",
		color: "var(--color-warning)",
	},
	statusDisabled: {
		backgroundColor: "var(--color-error-light)",
		color: "var(--color-error)",
	},
	fluxCost: {
		fontSize: "11px",
		color: "var(--color-info)",
	},
	emptyState: {
		padding: "16px",
		textAlign: "center" as const,
		color: "var(--color-text-secondary)",
		fontSize: "13px",
	},
	categoryTitle: {
		fontSize: "11px",
		fontWeight: "bold",
		color: "var(--color-text-secondary)",
		padding: "4px 0",
		marginTop: "8px",
		textTransform: "uppercase" as const,
	},
};

// 伤害类型颜色映射
const damageTypeColors: Record<DamageType, string> = {
	KINETIC: "#4a90d9",
	HIGH_EXPLOSIVE: "#e74c3c",
	FRAGMENTATION: "#95a5a6",
	ENERGY: "#f39c12",
};

// 伤害类型图标
const damageTypeIcons: Record<DamageType, string> = {
	KINETIC: "🔵",
	HIGH_EXPLOSIVE: "🔴",
	FRAGMENTATION: "⚪",
	ENERGY: "🟡",
};

// 武器类别名称
const categoryNames: Record<string, string> = {
	BALLISTIC: "弹道武器",
	ENERGY: "能量武器",
	MISSILE: "导弹武器",
};

interface WeaponSelectorProps {
	weapons: WeaponInstanceState[];
	selectedWeaponId?: string;
	onSelect: (weaponInstanceId: string) => void;
	filterCategory?: "BALLISTIC" | "ENERGY" | "MISSILE" | "all";
}

export const WeaponSelector: React.FC<WeaponSelectorProps> = ({
	weapons,
	selectedWeaponId,
	onSelect,
	filterCategory = "all",
}) => {
	const [hoveredId, setHoveredId] = React.useState<string | null>(null);

	// 按类别分组
	const weaponsByCategory = React.useMemo(() => {
		const groups: Record<string, WeaponInstanceState[]> = {
			BALLISTIC: [],
			ENERGY: [],
			MISSILE: [],
		};

		for (const weapon of weapons) {
			if (filterCategory !== "all" && weapon.category !== filterCategory) continue;
			if (groups[weapon.category]) {
				groups[weapon.category].push(weapon);
			}
		}

		return groups;
	}, [weapons, filterCategory]);

	// 处理武器点击
	const handleWeaponClick = (weapon: WeaponInstanceState) => {
		if (weapon.state !== "ready" || weapon.hasFiredThisTurn) return;
		onSelect(weapon.instanceId);
	};

	if (weapons.length === 0) {
		return (
			<div style={styles.container}>
				<div style={styles.header}>选择武器</div>
				<div style={styles.emptyState}>没有可用武器</div>
			</div>
		);
	}

	return (
		<div style={styles.container}>
			<div style={styles.header}>选择武器</div>

			<div style={styles.weaponList}>
				{Object.entries(weaponsByCategory).map(([category, categoryWeapons]) => {
					if (categoryWeapons.length === 0) return null;

					return (
						<div key={category}>
							<div style={styles.categoryTitle}>{categoryNames[category] ?? category}</div>
							{categoryWeapons.map((weapon) => (
								<WeaponCard
									key={weapon.instanceId}
									weapon={weapon}
									isSelected={selectedWeaponId === weapon.instanceId}
									isHovered={hoveredId === weapon.instanceId}
									onClick={() => handleWeaponClick(weapon)}
									onHover={setHoveredId}
								/>
							))}
						</div>
					);
				})}
			</div>
		</div>
	);
};

// ==================== 武器卡片 ====================

interface WeaponCardProps {
	weapon: WeaponInstanceState;
	isSelected: boolean;
	isHovered: boolean;
	onClick: () => void;
	onHover: (id: string | null) => void;
}

const WeaponCard: React.FC<WeaponCardProps> = ({
	weapon,
	isSelected,
	isHovered,
	onClick,
	onHover,
}) => {
	const isDisabled = weapon.state !== "ready" || weapon.hasFiredThisTurn;

	const cardStyle = {
		...styles.weaponCard,
		...(isSelected ? styles.weaponCardSelected : {}),
		...(isDisabled ? styles.weaponCardDisabled : {}),
	};

	// 获取状态样式
	const getStatusStyle = () => {
		if (weapon.hasFiredThisTurn) return styles.statusDisabled;
		switch (weapon.state) {
			case "ready":
				return styles.statusReady;
			case "cooldown":
			case "charging":
			case "reloading":
				return styles.statusCooldown;
			default:
				return styles.statusDisabled;
		}
	};

	// 获取状态文本
	const getStatusText = () => {
		if (weapon.hasFiredThisTurn) return "已射击";
		switch (weapon.state) {
			case "ready":
				return "就绪";
			case "cooldown":
				return `冷却 ${weapon.cooldownRemaining.toFixed(1)}s`;
			case "charging":
				return "充能中";
			case "reloading":
				return "装填中";
			case "disabled":
				return "禁用";
			case "out_of_ammo":
				return "弹药耗尽";
			default:
				return weapon.state;
		}
	};

	return (
		<div
			style={cardStyle}
			onClick={onClick}
			onMouseEnter={() => onHover(weapon.instanceId)}
			onMouseLeave={() => onHover(null)}
		>
			{/* 武器图标 */}
			<div
				style={{
					...styles.weaponIcon,
					backgroundColor: damageTypeColors[weapon.damageType],
				}}
			>
				{damageTypeIcons[weapon.damageType]}
			</div>

			{/* 武器信息 */}
			<div style={styles.weaponInfo}>
				<div style={styles.weaponName}>{weapon.name}</div>
				<div style={styles.weaponStats}>
					<span>伤害: {weapon.baseDamage}</span>
					<span>射程: {weapon.range}</span>
					<span>射界: {weapon.arc}°</span>
				</div>
			</div>

			{/* 武器状态 */}
			<div style={styles.weaponStatus}>
				<div style={{ ...styles.statusBadge, ...getStatusStyle() }}>{getStatusText()}</div>
				<div style={styles.fluxCost}>Flux: {weapon.fluxCostPerShot}</div>
			</div>
		</div>
	);
};

export default WeaponSelector;
