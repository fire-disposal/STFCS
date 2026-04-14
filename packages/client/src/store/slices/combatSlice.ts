import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { AttackCommand, CombatResult, ExplosionData } from "@vt/types";

export interface DamageNumber {
	id: string;
	position: { x: number; y: number };
	damage: number;
	color: string;
	timestamp: number;
	lifeTime: number;
}

export interface FiringArc {
	shipId: string;
	weaponMountId: string;
	startAngle: number;
	endAngle: number;
	range: number;
	active: boolean;
}

interface CombatState {
	explosions: ExplosionData[];
	attackQueue: AttackCommand[];
	combatResults: CombatResult[];
	damageNumbers: DamageNumber[];
	firingArcs: FiringArc[];
	selectedWeaponMountId: string | null;
	combatPhase: "idle" | "planning" | "executing" | "resolving";
	roundNumber: number;
}

const initialState: CombatState = {
	explosions: [],
	attackQueue: [],
	combatResults: [],
	damageNumbers: [],
	firingArcs: [],
	selectedWeaponMountId: null,
	combatPhase: "idle",
	roundNumber: 1,
};

const combatSlice = createSlice({
	name: "combat",
	initialState,
	reducers: {
		addExplosion: (state, action: PayloadAction<ExplosionData>) => {
			state.explosions.push(action.payload);
		},
		removeExplosion: (state, action: PayloadAction<string>) => {
			state.explosions = state.explosions.filter((explosion) => explosion.id !== action.payload);
		},
		clearExplosions: (state) => {
			state.explosions = [];
		},
		addAttack: (state, action: PayloadAction<AttackCommand>) => {
			state.attackQueue.push(action.payload);
		},
		removeAttack: (state, action: PayloadAction<string>) => {
			state.attackQueue = state.attackQueue.filter(
				(attack) => attack.weaponMountId !== action.payload
			);
		},
		clearAttackQueue: (state) => {
			state.attackQueue = [];
		},
		addCombatResult: (state, action: PayloadAction<CombatResult>) => {
			state.combatResults.push(action.payload);
		},
		clearCombatResults: (state) => {
			state.combatResults = [];
		},
		addDamageNumber: (state, action: PayloadAction<DamageNumber>) => {
			state.damageNumbers.push(action.payload);
		},
		removeDamageNumber: (state, action: PayloadAction<string>) => {
			state.damageNumbers = state.damageNumbers.filter((damage) => damage.id !== action.payload);
		},
		clearDamageNumbers: (state) => {
			state.damageNumbers = [];
		},
		addFiringArc: (state, action: PayloadAction<FiringArc>) => {
			state.firingArcs.push(action.payload);
		},
		removeFiringArc: (state, action: PayloadAction<{ shipId: string; weaponMountId: string }>) => {
			state.firingArcs = state.firingArcs.filter(
				(arc) =>
					!(
						arc.shipId === action.payload.shipId &&
						arc.weaponMountId === action.payload.weaponMountId
					)
			);
		},
		clearFiringArcs: (state) => {
			state.firingArcs = [];
		},
		setSelectedWeaponMount: (state, action: PayloadAction<string | null>) => {
			state.selectedWeaponMountId = action.payload;
		},
		setCombatPhase: (state, action: PayloadAction<CombatState["combatPhase"]>) => {
			state.combatPhase = action.payload;
		},
		incrementRound: (state) => {
			state.roundNumber += 1;
		},
		resetRound: (state) => {
			state.roundNumber = 1;
		},
		clearCombat: (state) => {
			state.explosions = [];
			state.attackQueue = [];
			state.combatResults = [];
			state.damageNumbers = [];
			state.firingArcs = [];
			state.selectedWeaponMountId = null;
			state.combatPhase = "idle";
		},
	},
});

export const {
	addExplosion,
	removeExplosion,
	clearExplosions,
	addAttack,
	removeAttack,
	clearAttackQueue,
	addCombatResult,
	clearCombatResults,
	addDamageNumber,
	removeDamageNumber,
	clearDamageNumbers,
	addFiringArc,
	removeFiringArc,
	clearFiringArcs,
	setSelectedWeaponMount,
	setCombatPhase,
	incrementRound,
	resetRound,
	clearCombat,
} = combatSlice.actions;

export default combatSlice.reducer;
