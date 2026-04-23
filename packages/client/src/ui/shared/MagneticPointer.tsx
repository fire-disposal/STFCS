/**
 * 磁性吸附指针组件 - 战术终端风格
 *
 * 优化版本：
 * - 使用 Context + 自动发现双模式，兼容 data-magnetic 属性
 * - 使用 requestAnimationFrame throttling 减少 mousemove 开销
 * - 使用定时扫描替代 MutationObserver，性能更好
 * - 支持动态启用/禁用
 * - 四个角为 L 型线条，无阴影，优化过渡动画
 */

import { useUIStore } from "@/state/stores/uiStore";
import React, { createContext, useContext, useEffect, useRef, useCallback, useMemo, useState } from "react";

interface MagneticContextValue {
	registerTarget: (element: HTMLElement) => void;
	unregisterTarget: (element: HTMLElement) => void;
	isEnabled: boolean;
}

const MagneticContext = createContext<MagneticContextValue>({
	registerTarget: () => {},
	unregisterTarget: () => {},
	isEnabled: false,
});

export const useMagneticContext = () => useContext(MagneticContext);

const SCAN_INTERVAL = 500;

export const MagneticPointerProvider: React.FC<{ 
	children: React.ReactNode;
	enabled?: boolean;
}> = ({ children, enabled = true }) => {
	const pointerRef = useRef<HTMLDivElement>(null);
	const currentTargetRef = useRef<HTMLElement | null>(null);
	const mousePos = useRef({ x: 0, y: 0 });
	const sizeRef = useRef({ width: 4, height: 4 });
	const rafIdRef = useRef<number | null>(null);
	const targetsRef = useRef<Set<HTMLElement>>(new Set());
	const scanTimerRef = useRef<number | null>(null);
	const hideNativeCursor = useUIStore((state) => state.hideNativeCursor);
	const [isEnabled, setIsEnabled] = useState(enabled);

	useEffect(() => {
		setIsEnabled(enabled);
	}, [enabled]);

	const resetPointerState = useCallback(() => {
		currentTargetRef.current = null;
		sizeRef.current = { width: 4, height: 4 };

		if (pointerRef.current) {
			pointerRef.current.style.width = "4px";
			pointerRef.current.style.height = "4px";
			pointerRef.current.style.top = "-2px";
			pointerRef.current.style.left = "-2px";
		}
	}, []);

	const updatePointerPosition = useCallback(() => {
		if (!pointerRef.current || !isEnabled) return;

		let x = mousePos.current.x;
		let y = mousePos.current.y;

		if (currentTargetRef.current) {
			if (!currentTargetRef.current.isConnected) {
				resetPointerState();
			} else {
				const rect = currentTargetRef.current.getBoundingClientRect();
				const centerX = rect.left + rect.width / 2;
				const centerY = rect.top + rect.height / 2;
				x = centerX + (x - centerX) * 0.1;
				y = centerY + (y - centerY) * 0.1;
			}
		}

		pointerRef.current.style.transform = `translate(${x}px, ${y}px)`;
		pointerRef.current.style.display = "block";
	}, [isEnabled, resetPointerState]);

	const handleMouseMove = useCallback((e: MouseEvent) => {
		mousePos.current = { x: e.clientX, y: e.clientY };

		if (rafIdRef.current === null) {
			rafIdRef.current = requestAnimationFrame(() => {
				updatePointerPosition();
				rafIdRef.current = null;
			});
		}
	}, [updatePointerPosition]);

	const handleMouseEnter = useCallback((target: HTMLElement) => {
		if (!isEnabled) return;

		currentTargetRef.current = target;
		const rect = target.getBoundingClientRect();

		const padding = Math.min(window.innerWidth / 50, 40);
		sizeRef.current = {
			width: rect.width + padding,
			height: rect.height + padding,
		};

		if (pointerRef.current) {
			pointerRef.current.style.width = `${sizeRef.current.width}px`;
			pointerRef.current.style.height = `${sizeRef.current.height}px`;
			pointerRef.current.style.top = `calc(${sizeRef.current.height}px / -2)`;
			pointerRef.current.style.left = `calc(${sizeRef.current.width}px / -2)`;
		}
	}, [isEnabled]);

	const handleMouseLeave = useCallback(() => {
		resetPointerState();
	}, [resetPointerState]);

	const bindElementEvents = useCallback((element: HTMLElement) => {
		element.addEventListener("mouseenter", () => handleMouseEnter(element));
		element.addEventListener("mouseleave", handleMouseLeave);
	}, [handleMouseEnter, handleMouseLeave]);

	const unbindElementEvents = useCallback((element: HTMLElement) => {
		element.removeEventListener("mouseenter", () => handleMouseEnter(element));
		element.removeEventListener("mouseleave", handleMouseLeave);
	}, [handleMouseEnter, handleMouseLeave]);

	const registerTarget = useCallback((element: HTMLElement) => {
		if (targetsRef.current.has(element)) return;
		targetsRef.current.add(element);
		bindElementEvents(element);
	}, [bindElementEvents]);

	const unregisterTarget = useCallback((element: HTMLElement) => {
		if (!targetsRef.current.has(element)) return;
		targetsRef.current.delete(element);
		unbindElementEvents(element);
	}, [unbindElementEvents]);

	const scanAndRegisterTargets = useCallback(() => {
		if (!isEnabled) return;

		const elements = document.querySelectorAll("[data-magnetic]");
		const currentTargets = new Set<HTMLElement>();

		elements.forEach((el) => {
			const htmlEl = el as HTMLElement;
			currentTargets.add(htmlEl);

			if (!targetsRef.current.has(htmlEl)) {
				registerTarget(htmlEl);
			}
		});

		targetsRef.current.forEach((el) => {
			if (!currentTargets.has(el) || !el.isConnected) {
				unregisterTarget(el);
			}
		});
	}, [isEnabled, registerTarget, unregisterTarget]);

	useEffect(() => {
		if (!isEnabled) {
			resetPointerState();
			if (scanTimerRef.current !== null) {
				window.clearInterval(scanTimerRef.current);
				scanTimerRef.current = null;
			}
			targetsRef.current.forEach((el) => unregisterTarget(el));
			targetsRef.current.clear();
			return;
		}

		window.addEventListener("mousemove", handleMouseMove);
		scanAndRegisterTargets();
		scanTimerRef.current = window.setInterval(scanAndRegisterTargets, SCAN_INTERVAL);

		return () => {
			window.removeEventListener("mousemove", handleMouseMove);
			if (rafIdRef.current !== null) {
				cancelAnimationFrame(rafIdRef.current);
			}
			if (scanTimerRef.current !== null) {
				window.clearInterval(scanTimerRef.current);
			}
			targetsRef.current.forEach((el) => unregisterTarget(el));
			targetsRef.current.clear();
			resetPointerState();
		};
	}, [isEnabled, handleMouseMove, scanAndRegisterTargets, unregisterTarget, resetPointerState]);

	const contextValue = useMemo(() => ({
		registerTarget,
		unregisterTarget,
		isEnabled,
	}), [registerTarget, unregisterTarget, isEnabled]);

	return (
		<MagneticContext.Provider value={contextValue}>
			{isEnabled && (
				<div
					ref={pointerRef}
					style={{
						position: "fixed",
						top: "-2px",
						left: "-2px",
						width: "4px",
						height: "4px",
						pointerEvents: "none",
						zIndex: 100000,
						transition: "width 0.2s ease-out, height 0.2s ease-out, top 0.2s ease-out, left 0.2s ease-out",
						display: "none",
					}}
				>
					<div style={{ position: "absolute", top: 0, left: 0, width: "12px", height: "12px", borderLeft: "2px solid #4a9eff", borderTop: "2px solid #4a9eff" }} />
					<div style={{ position: "absolute", top: 0, right: 0, width: "12px", height: "12px", borderRight: "2px solid #4a9eff", borderTop: "2px solid #4a9eff" }} />
					<div style={{ position: "absolute", bottom: 0, left: 0, width: "12px", height: "12px", borderLeft: "2px solid #4a9eff", borderBottom: "2px solid #4a9eff" }} />
					<div style={{ position: "absolute", bottom: 0, right: 0, width: "12px", height: "12px", borderRight: "2px solid #4a9eff", borderBottom: "2px solid #4a9eff" }} />
				</div>
			)}

			<style>{`
				${hideNativeCursor
					? `* { cursor: none !important; } *:disabled, *[aria-disabled="true"] { cursor: not-allowed !important; }`
					: `[data-magnetic] { cursor: none !important; } [data-magnetic]:disabled, [data-magnetic][aria-disabled="true"] { cursor: not-allowed !important; }`
				}
			`}</style>

			{children}
		</MagneticContext.Provider>
	);
};

interface MagneticTargetProps {
	children: React.ReactNode;
	className?: string;
	style?: React.CSSProperties;
	onClick?: () => void;
	disabled?: boolean;
}

export const MagneticTarget: React.FC<MagneticTargetProps> = ({
	children,
	className = "",
	style = {},
	onClick,
	disabled = false,
}) => {
	const elementRef = useRef<HTMLDivElement>(null);
	const { registerTarget, unregisterTarget, isEnabled } = useMagneticContext();

	useEffect(() => {
		const element = elementRef.current;
		if (!element || !isEnabled) return;

		registerTarget(element);

		return () => {
			unregisterTarget(element);
		};
	}, [registerTarget, unregisterTarget, isEnabled]);

	return (
		<div
			ref={elementRef}
			data-magnetic
			className={className}
			style={style}
			onClick={disabled ? undefined : onClick}
			aria-disabled={disabled}
		>
			{children}
		</div>
	);
};

export default MagneticPointerProvider;