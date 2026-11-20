/**
 * 星空背景渲染 Hook
 *
 * 职责：
 * 1. 渲染多层视差星空背景
 * 2. 实现视差滚动效果（不同层不同速度）
 * 3. 渲染星云辉光效果
 *
 * 渲染层：
 * - world.background (zIndex 0)
 * - world.starfieldNebula (zIndex 0)
 * - world.starfieldDeep (zIndex 1)
 * - world.starfieldMid (zIndex 2)
 * - world.starfieldNear (zIndex 3)
 *
 * 视差效果：
 * - Deep 层：视差强度弱，移动慢
 * - Mid 层：视差强度中
 * - Near 层：视差强度强，移动快
 * - Nebula：独立视差计算
 */

import type { StarfieldGenerator } from "./StarfieldBackground";
import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "../core/useLayerSystem";

export function useStarfieldRendering(
	layers: LayerRegistry | null,
	starfield: StarfieldGenerator,
	animate = false
): void {
	const deepGraphicsRef = useRef<Graphics | null>(null);
	const midGraphicsRef = useRef<Graphics | null>(null);
	const nearGraphicsRef = useRef<Graphics | null>(null);
	const nebulaGraphicsRef = useRef<Graphics | null>(null);
	const frameCountRef = useRef(0);

	useEffect(() => {
		if (!layers || !starfield) return;

		let deepGraphics = deepGraphicsRef.current;
		let midGraphics = midGraphicsRef.current;
		let nearGraphics = nearGraphicsRef.current;
		let nebulaGraphics = nebulaGraphicsRef.current;

		if (!deepGraphics) {
			deepGraphics = new Graphics();
			deepGraphicsRef.current = deepGraphics;
			layers.starfieldDeep.addChild(deepGraphics);
		}

		if (!midGraphics) {
			midGraphics = new Graphics();
			midGraphicsRef.current = midGraphics;
			layers.starfieldMid.addChild(midGraphics);
		}

		if (!nearGraphics) {
			nearGraphics = new Graphics();
			nearGraphicsRef.current = nearGraphics;
			layers.starfieldNear.addChild(nearGraphics);
		}

		if (!nebulaGraphics) {
			nebulaGraphics = new Graphics();
			nebulaGraphicsRef.current = nebulaGraphics;
			layers.starfieldNebula.addChild(nebulaGraphics);
		}

		nebulaGraphics.clear();
		starfield.drawNebula(nebulaGraphics);

		deepGraphics.clear();
		starfield.drawDeepStars(deepGraphics);

		midGraphics.clear();
		starfield.drawMidStars(midGraphics);

		nearGraphics.clear();
		starfield.drawNearStars(nearGraphics);
	}, [layers, starfield]);

	useEffect(() => {
		if (!layers || !starfield || !animate) return;

		let rafId = 0;
		let lastDrawAt = 0;
		const FRAME_MS = 1000 / 15;

		const loop = (now: number) => {
			rafId = requestAnimationFrame(loop);
			if (now - lastDrawAt < FRAME_MS) return;
			const deltaTime = lastDrawAt === 0 ? 0 : Math.min((now - lastDrawAt) / 1000, 0.1);
			lastDrawAt = now;
			frameCountRef.current++;
			starfield.update(deltaTime);

			const deepGraphics = deepGraphicsRef.current;
			const midGraphics = midGraphicsRef.current;
			const nearGraphics = nearGraphicsRef.current;
			const nebulaGraphics = nebulaGraphicsRef.current;

			if (deepGraphics && frameCountRef.current % 3 === 0) {
				deepGraphics.clear();
				starfield.drawDeepStars(deepGraphics);
			}

			if (midGraphics && frameCountRef.current % 2 === 0) {
				midGraphics.clear();
				starfield.drawMidStars(midGraphics);
			}

			if (nearGraphics) {
				nearGraphics.clear();
				starfield.drawNearStars(nearGraphics);
			}

			if (nebulaGraphics) {
				nebulaGraphics.clear();
				starfield.drawNebula(nebulaGraphics);
			}
		};

		rafId = requestAnimationFrame(loop);
		return () => cancelAnimationFrame(rafId);
	}, [layers, starfield, animate]);

	useEffect(() => {
		return () => {
			const deepGraphics = deepGraphicsRef.current;
			const midGraphics = midGraphicsRef.current;
			const nearGraphics = nearGraphicsRef.current;
			const nebulaGraphics = nebulaGraphicsRef.current;

			if (deepGraphics && layers?.starfieldDeep.children.includes(deepGraphics)) {
				layers.starfieldDeep.removeChild(deepGraphics);
			}
			if (midGraphics && layers?.starfieldMid.children.includes(midGraphics)) {
				layers.starfieldMid.removeChild(midGraphics);
			}
			if (nearGraphics && layers?.starfieldNear.children.includes(nearGraphics)) {
				layers.starfieldNear.removeChild(nearGraphics);
			}
			if (nebulaGraphics && layers?.starfieldNebula.children.includes(nebulaGraphics)) {
				layers.starfieldNebula.removeChild(nebulaGraphics);
			}
		};
	}, [layers]);
}