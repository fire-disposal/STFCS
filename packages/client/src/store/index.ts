import { configureStore } from "@reduxjs/toolkit";
import type { TypedUseSelectorHook } from "react-redux";
import { useDispatch, useSelector } from "react-redux";
import cameraReducer from "./slices/cameraSlice";
import combatReducer from "./slices/combatSlice";
import interactionReducer from "./slices/interactionSlice";
import hangarReducer from "./slices/hangarSlice";
import layerReducer from "./slices/layerSlice";
import mapReducer from "./slices/mapSlice";
import playerReducer from "./slices/playerSlice";
import shipReducer from "./slices/shipSlice";
import turnReducer from "./slices/turnSlice";
import uiReducer from "./slices/uiSlice";
import selectionReducer from "./slices/selectionSlice";

export const store = configureStore({
	reducer: {
		camera: cameraReducer,
		layers: layerReducer,
		map: mapReducer,
		player: playerReducer,
		ship: shipReducer,
		combat: combatReducer,
		turn: turnReducer,
		ui: uiReducer,
		selection: selectionReducer,
		interaction: interactionReducer,
		hangar: hangarReducer,
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
