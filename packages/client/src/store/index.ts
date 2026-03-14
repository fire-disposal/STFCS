import { configureStore } from "@reduxjs/toolkit";
import type { TypedUseSelectorHook } from "react-redux";
import { useDispatch, useSelector } from "react-redux";
import combatReducer from "./slices/combatSlice";
import mapReducer from "./slices/mapSlice";
import playerReducer from "./slices/playerSlice";
import shipReducer from "./slices/shipSlice";
import uiReducer from "./slices/uiSlice";

export const store = configureStore({
	reducer: {
		map: mapReducer,
		player: playerReducer,
		ship: shipReducer,
		combat: combatReducer,
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
