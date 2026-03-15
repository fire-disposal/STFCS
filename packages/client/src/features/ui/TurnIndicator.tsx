import React, { useMemo, useCallback, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Crown, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
	useAppDispatch,
	useAppSelector,
} from "@/store";
import {
	selectTurnOrder,
	selectCurrentUnit,
	selectCurrentIndex,
	selectTurnUnits,
	selectHoveredUnitId,
	selectVisibleStartIndex,
	selectMaxVisibleUnits,
	setHoveredUnit,
	setVisibleStartIndex,
	nextTurnUnit,
	previousTurnUnit,
	setCurrentTurnIndex,
} from "@/store/slices/turnSlice";
import type { TurnUnit } from "@vt/shared/types";

interface TurnIndicatorProps {
	onUnitClick?: (unit: TurnUnit) => void;
	onUnitHover?: (unit: TurnUnit | null) => void;
	onNextTurn?: () => void;
	className?: string;
}

/**
 * 回合指示器组件
 * 
 * 功能特性：
 * - 支持无限单位显示（通过滚动循环）
 * - 健壮的显示轮换逻辑
 * - 丰富的可扩展性（鼠标悬停、点击事件）
 * - 与周围配色和谐的 UI 设计
 */
const TurnIndicator: React.FC<TurnIndicatorProps> = ({
	onUnitClick,
	onUnitHover,
	onNextTurn,
	className = "",
}) => {
	const dispatch = useAppDispatch();
	const { t } = useTranslation();
	const turnOrder = useAppSelector(selectTurnOrder);
	const currentUnit = useAppSelector(selectCurrentUnit);
	const currentIndex = useAppSelector(selectCurrentIndex);
	const units = useAppSelector(selectTurnUnits);
	const hoveredUnitId = useAppSelector(selectHoveredUnitId);
	const visibleStartIndex = useAppSelector(selectVisibleStartIndex);
	const maxVisibleUnits = useAppSelector(selectMaxVisibleUnits);

	const containerRef = useRef<HTMLDivElement>(null);
	const unitRefs = useRef<Map<string, HTMLDivElement>>(new Map());

	// 计算可见单位（支持循环滚动）
	const visibleUnits = useMemo(() => {
		if (!units || units.length === 0) return [];

		const result: TurnUnit[] = [];
		const count = Math.min(maxVisibleUnits, units.length);

		for (let i = 0; i < count; i++) {
			const index = (visibleStartIndex + i) % units.length;
			result.push(units[index]);
		}

		return result;
	}, [units, visibleStartIndex, maxVisibleUnits]);

	// 确保当前单位始终可见
	useEffect(() => {
		if (currentIndex < 0 || !turnOrder) return;

		const unitsCount = units.length;
		if (unitsCount === 0) return;

		// 计算当前单位应该在可见区域的位置
		let newStartIndex = visibleStartIndex;

		// 如果当前单位不在可见区域内，调整起始索引
		const isBeforeVisible = currentIndex < visibleStartIndex;
		const isAfterVisible = currentIndex >= visibleStartIndex + maxVisibleUnits;

		if (isBeforeVisible) {
			newStartIndex = currentIndex;
		} else if (isAfterVisible) {
			newStartIndex = currentIndex - maxVisibleUnits + 1;
		}

		// 处理循环滚动
		if (newStartIndex < 0) {
			newStartIndex = Math.max(0, unitsCount - maxVisibleUnits);
		} else if (newStartIndex >= unitsCount) {
			newStartIndex = 0;
		}

		if (newStartIndex !== visibleStartIndex) {
			dispatch(setVisibleStartIndex(newStartIndex));
		}
	}, [currentIndex, units.length, visibleStartIndex, maxVisibleUnits, turnOrder, dispatch]);

	// 处理单位点击
	const handleUnitClick = useCallback(
		(unit: TurnUnit, index: number) => {
			dispatch(setCurrentTurnIndex(index));
			onUnitClick?.(unit);
		},
		[dispatch, onUnitClick]
	);

	// 处理单位悬停
	const handleUnitMouseEnter = useCallback(
		(unit: TurnUnit) => {
			dispatch(setHoveredUnit(unit.id));
			onUnitHover?.(unit);
		},
		[dispatch, onUnitHover]
	);

	const handleUnitMouseLeave = useCallback(() => {
		dispatch(setHoveredUnit(null));
		onUnitHover?.(null);
	}, [dispatch, onUnitHover]);

	// 处理滚动
	const handleScrollLeft = useCallback(() => {
		if (units.length <= maxVisibleUnits) return;
		const newIndex =
			(visibleStartIndex - 1 + units.length) % units.length;
		dispatch(setVisibleStartIndex(newIndex));
	}, [units.length, maxVisibleUnits, visibleStartIndex, dispatch]);

	const handleScrollRight = useCallback(() => {
		if (units.length <= maxVisibleUnits) return;
		const newIndex = (visibleStartIndex + 1) % units.length;
		dispatch(setVisibleStartIndex(newIndex));
	}, [units.length, maxVisibleUnits, visibleStartIndex, dispatch]);

	// 处理上一回合/下一回合
	const handlePreviousTurn = useCallback(() => {
		dispatch(previousTurnUnit());
	}, [dispatch]);

	const handleNextTurnClick = useCallback(() => {
		dispatch(nextTurnUnit());
		onNextTurn?.();
	}, [dispatch, onNextTurn]);

	// 获取单位状态样式
	const getUnitStateStyle = (unit: TurnUnit, isCurrent: boolean): string => {
		const baseStyle = "turn-indicator__unit";
		const stateStyles: Record<string, string> = {
			waiting: "turn-indicator__unit--waiting",
			active: "turn-indicator__unit--active",
			moved: "turn-indicator__unit--moved",
			acted: "turn-indicator__unit--acted",
			ended: "turn-indicator__unit--ended",
		};

		return `${baseStyle} ${stateStyles[unit.state] || ""} ${
			isCurrent ? "turn-indicator__unit--current" : ""
		} ${hoveredUnitId === unit.id ? "turn-indicator__unit--hovered" : ""}`;
	};

	// 渲染单位项
	const renderUnitItem = (unit: TurnUnit, displayIndex: number) => {
		const actualIndex = (visibleStartIndex + displayIndex) % units.length;
		const isCurrent = actualIndex === currentIndex;
		const stateStyle = getUnitStateStyle(unit, isCurrent);

		return (
			<div
				key={unit.id}
				ref={(el) => {
					if (el) unitRefs.current.set(unit.id, el);
					else unitRefs.current.delete(unit.id);
				}}
				className={stateStyle}
				onClick={() => handleUnitClick(unit, actualIndex)}
				onMouseEnter={() => handleUnitMouseEnter(unit)}
				onMouseLeave={handleUnitMouseLeave}
				title={`${unit.name} (${unit.ownerName})`}
				role="button"
				tabIndex={0}
				aria-label={`${unit.name}'s turn`}
				aria-current={isCurrent ? "true" : undefined}
			>
				<div className="turn-indicator__unit-avatar">
					{unit.unitType === "ship" ? (
						<Crown size={14} />
					) : (
						<User size={14} />
					)}
				</div>
				<div className="turn-indicator__unit-info">
					<span className="turn-indicator__unit-name">{unit.name}</span>
					{isCurrent && (
						<span className="turn-indicator__unit-owner">{unit.ownerName}</span>
					)}
				</div>
				{isCurrent && (
					<div className="turn-indicator__unit-indicator">
						<div className="turn-indicator__pulse" />
					</div>
				)}
			</div>
		);
	};

	if (!turnOrder || units.length === 0) {
		return (
			<div className={`turn-indicator turn-indicator--empty ${className}`}>
				<span className="turn-indicator__placeholder">{t("token.notInitialized")}</span>
			</div>
		);
	}

	const showScrollButtons = units.length > maxVisibleUnits;

	return (
		<div className={`turn-indicator ${className}`} ref={containerRef}>
			{/* 回合信息头部 */}
			<div className="turn-indicator__header">
				<div className="turn-indicator__round-info">
					<span className="turn-indicator__round-label">{t("turn.round")}</span>
					<span className="turn-indicator__round-number">{turnOrder.roundNumber}</span>
				</div>
				<div className="turn-indicator__phase">
					<span className={`turn-indicator__phase-badge turn-indicator__phase-badge--${turnOrder.phase}`}>
						{turnOrder.phase.toUpperCase()}
					</span>
				</div>
				<div className="turn-indicator__counter">
					<span>{t("turn.unitsCounter", { current: currentIndex + 1, total: units.length })}</span>
				</div>
			</div>

			{/* 单位列表 */}
			<div className="turn-indicator__units-container">
				{showScrollButtons && (
					<button
						className="turn-indicator__scroll-btn turn-indicator__scroll-btn--left"
						onClick={handleScrollLeft}
						aria-label="Scroll left"
					>
						<ChevronLeft size={16} />
					</button>
				)}

				<div className="turn-indicator__units">
					{visibleUnits.map((unit, index) => renderUnitItem(unit, index))}
				</div>

				{showScrollButtons && (
					<button
						className="turn-indicator__scroll-btn turn-indicator__scroll-btn--right"
						onClick={handleScrollRight}
						aria-label="Scroll right"
					>
						<ChevronRight size={16} />
					</button>
				)}
			</div>

			{/* 当前单位详情 */}
			{currentUnit && (
				<div className="turn-indicator__current-unit">
					<div className="turn-indicator__current-unit-info">
						<span className="turn-indicator__current-label">{t("turn.currentTurn")}</span>
						<span className="turn-indicator__current-name">{currentUnit.name}</span>
						<span className="turn-indicator__current-owner">({currentUnit.ownerName})</span>
					</div>
					<div className="turn-indicator__actions">
						<button
							className="turn-indicator__nav-btn"
							onClick={handlePreviousTurn}
							title={t("turn.previousUnit")}
						>
							<ChevronLeft size={16} />
							<span>{t("ui.previous")}</span>
						</button>
						<button
							className="turn-indicator__nav-btn turn-indicator__nav-btn--next"
							onClick={handleNextTurnClick}
							title={t("turn.nextUnit")}
						>
							<span>{t("ui.next")}</span>
							<ChevronRight size={16} />
						</button>
					</div>
				</div>
			)}

			{/* 进度条 */}
			<div className="turn-indicator__progress">
				<div
					className="turn-indicator__progress-bar"
					style={{
						width: `${((currentIndex + 1) / units.length) * 100}%`,
					}}
				/>
			</div>
		</div>
	);
};

export default TurnIndicator;
