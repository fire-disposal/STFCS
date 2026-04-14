import type { StarfieldGenerator } from "@/features/game/rendering/StarfieldBackground";
import { Graphics } from "pixi.js";
import { useEffect, useRef } from "react";
import type { LayerRegistry } from "./useLayerSystem";

export function useStarfieldRendering(
	layers: LayerRegistry | null,
	starfield: StarfieldGenerator
): void {
	const deepGraphicsRef = useRef<Graphics | null>(null);
	const midGraphicsRef = useRef<Graphics | null>(null);
	const nearGraphicsRef = useRef<Graphics | null>(null);
	const nebulaGraphicsRef = useRef<Graphics | null>(null);
	const lastTimeRef = useRef<number>(0);
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
		starfield.drawNebula(nebulaGraphics, 0, 0);

		deepGraphics.clear();
		starfield.drawDeepStars(deepGraphics, 0, 0);

		midGraphics.clear();
		starfield.drawMidStars(midGraphics, 0, 0);

		nearGraphics.clear();
		starfield.drawNearStars(nearGraphics, 0, 0);
	}, [layers, starfield]);

	useEffect(() => {
		if (!layers || !starfield) return;

		const animate = () => {
			const timestamp = performance.now();
			const deltaTime = (timestamp - lastTimeRef.current) / 1000;
			lastTimeRef.current = timestamp;
			frameCountRef.current++;

			const safeDelta = Math.min(deltaTime, 0.1);
			starfield.update(safeDelta);

			const deepGraphics = deepGraphicsRef.current;
			const midGraphics = midGraphicsRef.current;
			const nearGraphics = nearGraphicsRef.current;

			if (deepGraphics && frameCountRef.current % 3 === 0) {
				deepGraphics.clear();
				starfield.drawDeepStars(deepGraphics, 0, 0);
			}

			if (midGraphics && frameCountRef.current % 2 === 0) {
				midGraphics.clear();
				starfield.drawMidStars(midGraphics, 0, 0);
			}

			if (nearGraphics) {
				nearGraphics.clear();
				starfield.drawNearStars(nearGraphics, 0, 0);
			}
		};

		if (layers.starfieldDeep.children[0]) {
			const ticker = (layers.starfieldDeep as any).__pixiApp?.ticker;
			if (ticker) {
				ticker.add(animate);
				return () => ticker.remove(animate);
			}
		}

		let rafId: number;
		const loop = () => {
			animate();
			rafId = requestAnimationFrame(loop);
		};
		rafId = requestAnimationFrame(loop);

		return () => cancelAnimationFrame(rafId);
	}, [layers, starfield]);

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