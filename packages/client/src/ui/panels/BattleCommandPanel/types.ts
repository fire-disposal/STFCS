/**
 * BattleCommandPanel 共享类型定义
 */

import type { MovementPreviewState } from "@/renderer";
import type { ShipState } from "@/sync/types";

/** 面板 Props 共享上下文 */
export interface BattlePanelContext {
	selectedShip: ShipState | null;
	disabled: boolean;
	networkManager: any;
	onMovementPreviewChange?: (preview: MovementPreviewState) => void;
}

/** ShipPortrait Props */
export interface ShipPortraitProps {
	ship: ShipState;
}

/** ShipInfoSummary Props */
export interface ShipInfoSummaryProps {
	ship: ShipState;
}

/** StatBlocks Props */
export interface StatBlocksProps {
	ship: ShipState;
	compact?: boolean;  // 紧凑模式
}

/** MovementPanel Props */
export interface MovementPanelProps {
	ship: ShipState;
	disabled: boolean;
	networkManager: any;
	onMovementPreviewChange?: (preview: MovementPreviewState) => void;
}

/** WeaponPanel Props */
export interface WeaponPanelProps {
	ship: ShipState;
	ships: Map<string, ShipState>;
	disabled: boolean;
	networkManager: any;
}

/** SkillsPanel Props */
export interface SkillsPanelProps {
	ship: ShipState;
	disabled: boolean;
	onVent?: () => void;
}

/** ShieldPanel Props */
export interface ShieldPanelProps {
	ship: ShipState;
	disabled: boolean;
	onToggleShield?: () => void;
	onSetShieldOrientation?: (orientation: number) => void;
}

/** 阶段配置 */
export interface PhaseConfigItem {
	label: string;
	sub: string;
	icon: React.ComponentType<{ className?: string }>;
}

export const PHASE_CONFIG: Record<"A" | "B" | "C", PhaseConfigItem> = {
	A: { label: "Phase A", sub: "平移", icon: (() => null) as any },
	B: { label: "Phase B", sub: "转向", icon: (() => null) as any },
	C: { label: "Phase C", sub: "平移", icon: (() => null) as any },
};

/** 伤害类型颜色 */
export const DAMAGE_TYPE_COLORS: Record<string, string> = {
	KINETIC: "#ffd700",
	HIGH_EXPLOSIVE: "#ff6b35",
	ENERGY: "#7b68ee",
	FRAGMENTATION: "#32cd32",
};
