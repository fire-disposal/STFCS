import { type PayloadAction, createSlice } from "@reduxjs/toolkit";
import type { WeaponSpec } from "@vt/types";
import type { FluxOverloadState, ShipMovement, ShipStatus, WeaponMount } from "@/types";

export type FluxType = "soft" | "hard";

interface ShipState {
	ships: Record<string, ShipStatus>;
	selectedShipId: string | null;
	weapons: Record<string, WeaponSpec>;
	weaponMounts: Record<string, WeaponMount>;
	movementQueue: ShipMovement[];
}

const initialState: ShipState = {
	ships: {},
	selectedShipId: null,
	weapons: {},
	weaponMounts: {},
	movementQueue: [],
};

const shipSlice = createSlice({
	name: "ship",
	initialState,
	reducers: {
		addShip: (state, action: PayloadAction<ShipStatus>) => {
			state.ships[action.payload.id] = action.payload;
		},
		updateShip: (state, action: PayloadAction<{ id: string; updates: Partial<ShipStatus> }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				state.ships[action.payload.id] = {
					...ship,
					...action.payload.updates,
				};
			}
		},
		removeShip: (state, action: PayloadAction<string>) => {
			delete state.ships[action.payload];
			if (state.selectedShipId === action.payload) {
				state.selectedShipId = null;
			}
		},
		selectShip: (state, action: PayloadAction<string | null>) => {
			state.selectedShipId = action.payload;
		},
		updateHull: (state, action: PayloadAction<{ id: string; current: number }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.hull.current = Math.max(0, Math.min(ship.hull.max, action.payload.current));
			}
		},
		updateArmor: (
			state,
			action: PayloadAction<{
				id: string;
				quadrant: ArmorQuadrantValue;
				value: number;
			}>
		) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.armor.quadrants[action.payload.quadrant] = Math.max(
					0,
					Math.min(ship.armor.maxQuadArmor, action.payload.value)
				);
			}
		},
		updateFlux: (state, action: PayloadAction<{ id: string; current: number }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.flux.current = Math.max(0, Math.min(ship.flux.capacity, action.payload.current));
			}
		},
		addFlux: (state, action: PayloadAction<{ id: string; amount: number; type: FluxType }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				const newFlux = ship.flux.current + action.payload.amount;
				ship.flux.current = Math.min(ship.flux.capacity, newFlux);

				if (action.payload.type === "soft") {
					ship.flux.softFlux += action.payload.amount;
				} else {
					ship.flux.hardFlux += action.payload.amount;
				}
			}
		},
		dissipateFlux: (state, action: PayloadAction<{ id: string; amount: number }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				const softFluxToRemove = Math.min(ship.flux.softFlux, action.payload.amount);
				const hardFluxToRemove = Math.min(
					ship.flux.hardFlux,
					action.payload.amount - softFluxToRemove
				);

				ship.flux.softFlux -= softFluxToRemove;
				ship.flux.hardFlux -= hardFluxToRemove;
				ship.flux.current = Math.max(0, ship.flux.current - (softFluxToRemove + hardFluxToRemove));
			}
		},
		setFluxState: (state, action: PayloadAction<{ id: string; state: FluxOverloadState }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.fluxState = action.payload.state;
			}
		},
		toggleShield: (state, action: PayloadAction<string>) => {
			const ship = state.ships[action.payload];
			if (ship) {
				ship.shield.active = !ship.shield.active;
			}
		},
		updatePosition: (
			state,
			action: PayloadAction<{ id: string; position: { x: number; y: number } }>
		) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.position = action.payload.position;
			}
		},
		updateHeading: (state, action: PayloadAction<{ id: string; heading: number }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.heading = action.payload.heading;
			}
		},
		updateSpeed: (state, action: PayloadAction<{ id: string; speed: number }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.speed = Math.max(0, action.payload.speed);
			}
		},
		setDisabled: (state, action: PayloadAction<{ id: string; disabled: boolean }>) => {
			const ship = state.ships[action.payload.id];
			if (ship) {
				ship.disabled = action.payload.disabled;
			}
		},
		addWeapon: (state, action: PayloadAction<WeaponSpec>) => {
			state.weapons[action.payload.id] = action.payload;
		},
		addWeaponMount: (state, action: PayloadAction<WeaponMount>) => {
			state.weaponMounts[action.payload.id] = action.payload;
		},
		addMovement: (state, action: PayloadAction<ShipMovement>) => {
			state.movementQueue.push(action.payload);
		},
		clearMovementQueue: (state) => {
			state.movementQueue = [];
		},
		removeMovement: (state, action: PayloadAction<string>) => {
			state.movementQueue = state.movementQueue.filter(
				(movement) => movement.shipId !== action.payload
			);
		},
		clearShips: (state) => {
			state.ships = {};
			state.selectedShipId = null;
			state.movementQueue = [];
		},
	},
});

export const {
	addShip,
	updateShip,
	removeShip,
	selectShip,
	updateHull,
	updateArmor,
	updateFlux,
	addFlux,
	dissipateFlux,
	setFluxState,
	toggleShield,
	updatePosition,
	updateHeading,
	updateSpeed,
	setDisabled,
	addWeapon,
	addWeaponMount,
	addMovement,
	clearMovementQueue,
	removeMovement,
	clearShips,
} = shipSlice.actions;

export const selectCurrentShip = (state: any) => state.ship.selectedShipId;

export default shipSlice.reducer;
