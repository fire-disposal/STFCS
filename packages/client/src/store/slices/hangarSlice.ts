import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { PlayerHangar, ShipAssetDefinition } from "@vt/shared/types";

interface HangarState {
	assets: ShipAssetDefinition[];
	currentPlayerHangar: PlayerHangar | null;
	selectedDockedShipId: string | null;
}

const initialState: HangarState = {
	assets: [],
	currentPlayerHangar: null,
	selectedDockedShipId: null,
};

const hangarSlice = createSlice({
	name: "hangar",
	initialState,
	reducers: {
		setShipAssets: (state, action: PayloadAction<ShipAssetDefinition[]>) => {
			state.assets = action.payload;
		},
		setCurrentPlayerHangar: (state, action: PayloadAction<PlayerHangar | null>) => {
			state.currentPlayerHangar = action.payload;
			if (!action.payload) {
				state.selectedDockedShipId = null;
				return;
			}
			if (!state.selectedDockedShipId) {
				state.selectedDockedShipId =
					action.payload.activeShipId ?? action.payload.dockedShips[0]?.id ?? null;
			}
		},
		selectDockedShip: (state, action: PayloadAction<string | null>) => {
			state.selectedDockedShipId = action.payload;
		},
	},
});

export const { setShipAssets, setCurrentPlayerHangar, selectDockedShip } = hangarSlice.actions;
export default hangarSlice.reducer;

