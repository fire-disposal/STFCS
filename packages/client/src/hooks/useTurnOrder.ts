/**
 * 回合顺序 Hook
 * 管理回合系统的状态和操作
 */

import { useCallback } from "react";
import { useAppDispatch, useAppSelector } from "@/store";
import {
	selectTurnOrder,
	selectCurrentUnit,
	selectCurrentIndex,
	selectTurnUnits,
	selectHoveredUnitId,
	selectIsTurnInitialized,
	nextTurnUnit,
	previousTurnUnit,
	setCurrentTurnIndex,
	updateUnitState,
	setTurnPhase,
	setRoundNumber,
	incrementRound,
	setTurnComplete,
	addUnit,
	removeUnit,
	setHoveredUnit,
} from "@/store/slices/turnSlice";
import type { TurnUnit, UnitTurnState, TurnPhase } from "@vt/shared/types";

export function useTurnOrder() {
	const dispatch = useAppDispatch();

	// 状态选择器
	const turnOrder = useAppSelector(selectTurnOrder);
	const currentUnit = useAppSelector(selectCurrentUnit);
	const currentIndex = useAppSelector(selectCurrentIndex);
	const units = useAppSelector(selectTurnUnits);
	const hoveredUnitId = useAppSelector(selectHoveredUnitId);
	const isInitialized = useAppSelector(selectIsTurnInitialized);

	// 导航操作
	const nextUnit = useCallback(() => {
		dispatch(nextTurnUnit());
	}, [dispatch]);

	const previousUnit = useCallback(() => {
		dispatch(previousTurnUnit());
	}, [dispatch]);

	const setCurrentUnit = useCallback(
		(index: number) => {
			dispatch(setCurrentTurnIndex(index));
		},
		[dispatch]
	);

	// 单位状态操作
	const updateUnit = useCallback(
		(unitId: string, state: UnitTurnState) => {
			dispatch(updateUnitState({ unitId, state }));
		},
		[dispatch]
	);

	const setUnitWaiting = useCallback(
		(unitId: string) => {
			dispatch(updateUnitState({ unitId, state: "waiting" }));
		},
		[dispatch]
	);

	const setUnitActive = useCallback(
		(unitId: string) => {
			dispatch(updateUnitState({ unitId, state: "active" }));
		},
		[dispatch]
	);

	const setUnitMoved = useCallback(
		(unitId: string) => {
			dispatch(updateUnitState({ unitId, state: "moved" }));
		},
		[dispatch]
	);

	const setUnitActed = useCallback(
		(unitId: string) => {
			dispatch(updateUnitState({ unitId, state: "acted" }));
		},
		[dispatch]
	);

	const setUnitEnded = useCallback(
		(unitId: string) => {
			dispatch(updateUnitState({ unitId, state: "ended" }));
		},
		[dispatch]
	);

	// 回合阶段操作
	const setPhase = useCallback(
		(phase: TurnPhase) => {
			dispatch(setTurnPhase(phase));
		},
		[dispatch]
	);

	const setPhasePlanning = useCallback(() => {
		dispatch(setTurnPhase("planning"));
	}, [dispatch]);

	const setPhaseMovement = useCallback(() => {
		dispatch(setTurnPhase("movement"));
	}, [dispatch]);

	const setPhaseAction = useCallback(() => {
		dispatch(setTurnPhase("action"));
	}, [dispatch]);

	const setPhaseResolution = useCallback(() => {
		dispatch(setTurnPhase("resolution"));
	}, [dispatch]);

	// 回合数操作
	const setRound = useCallback(
		(roundNumber: number) => {
			dispatch(setRoundNumber(roundNumber));
		},
		[dispatch]
	);

	const nextRound = useCallback(() => {
		dispatch(incrementRound());
	}, [dispatch]);

	// 完成状态
	const setComplete = useCallback(
		(isComplete: boolean) => {
			dispatch(setTurnComplete(isComplete));
		},
		[dispatch]
	);

	// 单位管理
	const addTurnUnit = useCallback(
		(unit: TurnUnit) => {
			dispatch(addUnit(unit));
		},
		[dispatch]
	);

	const removeTurnUnit = useCallback(
		(unitId: string) => {
			dispatch(removeUnit(unitId));
		},
		[dispatch]
	);

	// UI 操作
	const setHovered = useCallback(
		(unitId: string | null) => {
			dispatch(setHoveredUnit(unitId));
		},
		[dispatch]
	);

	// 计算属性
	const totalUnits = units.length;
	const progress = totalUnits > 0 ? ((currentIndex + 1) / totalUnits) * 100 : 0;
	const currentPhase = turnOrder?.phase ?? "deployment";
	const currentRound = turnOrder?.roundNumber ?? 1;

	// 获取指定单位的索引
	const getUnitIndex = useCallback(
		(unitId: string) => {
			return units.findIndex((u) => u.id === unitId);
		},
		[units]
	);

	// 检查是否是当前单位
	const isCurrentUnit = useCallback(
		(unitId: string) => {
			return units[currentIndex]?.id === unitId;
		},
		[units, currentIndex]
	);

	// 获取下一个单位
	const getNextUnit = useCallback(() => {
		if (units.length === 0) return null;
		const nextIndex = (currentIndex + 1) % units.length;
		return units[nextIndex];
	}, [units, currentIndex]);

	// 获取上一个单位
	const getPreviousUnit = useCallback(() => {
		if (units.length === 0) return null;
		const prevIndex = ((currentIndex - 1) % units.length + units.length) % units.length;
		return units[prevIndex];
	}, [units, currentIndex]);

	return {
		// 状态
		turnOrder,
		currentUnit,
		currentIndex,
		units,
		hoveredUnitId,
		isInitialized,
		totalUnits,
		progress,
		currentPhase,
		currentRound,

		// 导航
		nextUnit,
		previousUnit,
		setCurrentUnit,

		// 单位状态
		updateUnit,
		setUnitWaiting,
		setUnitActive,
		setUnitMoved,
		setUnitActed,
		setUnitEnded,

		// 回合阶段
		setPhase,
		setPhasePlanning,
		setPhaseMovement,
		setPhaseAction,
		setPhaseResolution,

		// 回合数
		setRound,
		nextRound,

		// 完成状态
		setComplete,

		// 单位管理
		addTurnUnit,
		removeTurnUnit,

		// UI
		setHovered,

		// 工具
		getUnitIndex,
		isCurrentUnit,
		getNextUnit,
		getPreviousUnit,
	};
}
