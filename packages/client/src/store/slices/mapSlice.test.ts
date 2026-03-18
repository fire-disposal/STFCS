import { describe, expect, it } from "vitest";
import reducer, {
	addPlanet,
	addStar,
	enterStarSystem,
	exitStarSystem,
	loadMapSnapshot,
	removeStar,
	updatePlanet,
	updateStar,
} from "./mapSlice";

const baseState = reducer(undefined, { type: "init" });

describe("mapSlice star map", () => {
	it("supports two-layer star map navigation", () => {
		const withStar = reducer(
			baseState,
			addStar({
				id: "star_sol",
				name: "Sol",
				position: { x: 1, y: 2 },
				spectralType: "G2V",
				description: "Home star",
				tags: ["human"],
				updatedAt: Date.now(),
			})
		);

		const inSystem = reducer(withStar, enterStarSystem("star_sol"));
		expect(inSystem.starMap.currentLayer).toBe("system");
		expect(inSystem.starMap.currentStarId).toBe("star_sol");

		const exited = reducer(inSystem, exitStarSystem());
		expect(exited.starMap.currentLayer).toBe("galaxy");
		expect(exited.starMap.currentStarId).toBeNull();
	});

	it("supports editing star and planet descriptions", () => {
		const withStar = reducer(
			baseState,
			addStar({
				id: "star_alpha",
				name: "Alpha",
				position: { x: 10, y: 10 },
				spectralType: "A",
				description: "",
				tags: [],
				updatedAt: Date.now(),
			})
		);
		const withPlanet = reducer(
			withStar,
			addPlanet({
				starId: "star_alpha",
				planet: {
					id: "planet_alpha_1",
					starId: "star_alpha",
					name: "Alpha-I",
					orbitIndex: 1,
					kind: "terrestrial",
					description: "原始描述",
					tags: [],
					updatedAt: Date.now(),
				},
			})
		);

		const updatedStar = reducer(
			withPlanet,
			updateStar({
				id: "star_alpha",
				updates: { description: "已编辑恒星描述" },
			})
		);
		expect(updatedStar.starMap.stars.star_alpha.description).toBe("已编辑恒星描述");

		const updatedPlanet = reducer(
			updatedStar,
			updatePlanet({
				starId: "star_alpha",
				planetId: "planet_alpha_1",
				updates: { description: "已编辑行星描述" },
			})
		);
		expect(updatedPlanet.starMap.systems.star_alpha.planets.planet_alpha_1.description).toBe(
			"已编辑行星描述"
		);
	});

	it("cleans navigation context when deleting a focused star", () => {
		const withStar = reducer(
			baseState,
			addStar({
				id: "star_beta",
				name: "Beta",
				position: { x: 100, y: 100 },
				spectralType: "K",
				description: "",
				tags: [],
				updatedAt: Date.now(),
			})
		);
		const inSystem = reducer(withStar, enterStarSystem("star_beta"));
		const removed = reducer(inSystem, removeStar("star_beta"));
		expect(removed.starMap.currentLayer).toBe("galaxy");
		expect(removed.starMap.currentStarId).toBeNull();
		expect(removed.starMap.stars.star_beta).toBeUndefined();
	});

	it("loads map snapshot as save-archive restore baseline", () => {
		const restored = reducer(
			baseState,
			loadMapSnapshot({
				version: "1.0.0",
				savedAt: Date.now(),
				map: { id: "custom", width: 8000, height: 8000, name: "Custom" },
				tokens: [],
				starMap: {
					stars: {
						star_gamma: {
							id: "star_gamma",
							name: "Gamma",
							position: { x: 12, y: 24 },
							spectralType: "F",
							description: "snapshot",
							tags: ["archive"],
							updatedAt: Date.now(),
						},
					},
					systems: {
						star_gamma: {
							starId: "star_gamma",
							updatedAt: Date.now(),
							planets: {},
						},
					},
				},
			})
		);

		expect(restored.config.id).toBe("custom");
		expect(restored.starMap.stars.star_gamma.name).toBe("Gamma");
		expect(restored.starMap.currentLayer).toBe("galaxy");
	});
});
