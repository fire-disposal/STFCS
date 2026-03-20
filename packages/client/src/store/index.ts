import { configureStore } from "@reduxjs/toolkit";
import type { TypedUseSelectorHook } from "react-redux";
import { useDispatch, useSelector } from "react-redux";
import cameraReducer from "./slices/cameraSlice";
import combatReducer from "./slices/combatSlice";
import combatUIReducer from "./slices/combatUISlice";
import deploymentReducer from "./slices/deploymentSlice";
import factionReducer from "./slices/factionSlice";
import factionTurnReducer from "./slices/factionTurnSlice";
import gameFlowReducer from "./slices/gameFlowSlice";
import interactionReducer from "./slices/interactionSlice";
import layerReducer from "./slices/layerSlice";
import mapReducer from "./slices/mapSlice";
import playerReducer from "./slices/playerSlice";
import shipReducer from "./slices/shipSlice";
import uiReducer from "./slices/uiSlice";
import selectionReducer from "./slices/selectionSlice";

export const store = configureStore({
	reducer: {
		camera: cameraReducer,
		combat: combatReducer,
		combatUI: combatUIReducer,
		deployment: deploymentReducer,
		faction: factionReducer,
		factionTurn: factionTurnReducer,
		gameFlow: gameFlowReducer,
		interaction: interactionReducer,
		layers: layerReducer,
		map: mapReducer,
		player: playerReducer,
		selection: selectionReducer,
		ship: shipReducer,
		ui: uiReducer,
	},
	middleware: (getDefaultMiddleware) =>
		getDefaultMiddleware({
			serializableCheck: {
				ignoredActions: ["map/addToken", "map/updateToken"],
				ignoredPaths: ["map.tokens"],
			},
		}),
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch: () => AppDispatch = useDispatch;
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
