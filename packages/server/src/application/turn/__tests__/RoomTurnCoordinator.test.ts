import { describe, it, expect, beforeEach } from "vitest";
import { PlayerService } from "../../player/PlayerService";
import { RoomManager } from "../../../infrastructure/ws/RoomManager";
import { RoomTurnCoordinator } from "../RoomTurnCoordinator";

describe("RoomTurnCoordinator", () => {
	let playerService: PlayerService;
	let roomManager: RoomManager;
	let coordinator: RoomTurnCoordinator;

	beforeEach(async () => {
		playerService = new PlayerService();
		roomManager = new RoomManager();
		playerService.setRoomManager(roomManager);

		await playerService.join({
			id: "p1",
			name: "P1",
			joinedAt: Date.now(),
			isActive: true,
			isDMMode: false,
		}, "r1");

		await playerService.join({
			id: "p2",
			name: "P2",
			joinedAt: Date.now(),
			isActive: true,
			isDMMode: false,
		}, "r1");

		roomManager.upsertTokenPosition("r1", "ship_p1", { x: 100, y: 100 }, 0, "p1", "ship", 56);
		roomManager.upsertTokenPosition("r1", "ship_p2", { x: 100, y: 8100 }, 0, "p2", "ship", 56);

		coordinator = new RoomTurnCoordinator(playerService, roomManager);
		coordinator.initialize("r1");
	});

	it("should initialize in deployment phase", () => {
		const state = coordinator.getState("r1");
		expect(state.phase).toBe("deployment");
		expect(state.order).toEqual(["p1", "p2"]);
	});

	it("should validate deployment zone by owner slot", () => {
		const ok = coordinator.validateDeployment("r1", "p1", { x: 200, y: 200 });
		expect(ok.ok).toBe(true);

		const fail = coordinator.validateDeployment("r1", "p1", { x: 200, y: 8100 });
		expect(fail.ok).toBe(false);
		expect(fail.reason).toContain("Deployment position");
	});

	it("should reject movement when not in movement phase", () => {
		const snapshot = roomManager.getMapSnapshot("r1");
		const token = snapshot.tokens.find((t) => t.id === "ship_p1");
		const result = coordinator.validateMovement("r1", "p1", token, 120);
		expect(result.ok).toBe(false);
		expect(result.reason).toContain("movement phase");
	});

	it("should consume movement budget in movement phase", () => {
		coordinator.setPhase("r1", "movement");
		const snapshot = roomManager.getMapSnapshot("r1");
		const token = snapshot.tokens.find((t) => t.id === "ship_p1");
		expect(token).toBeTruthy();

		const validation = coordinator.validateMovement("r1", "p1", token, 50);
		expect(validation.ok).toBe(true);
		const updated = coordinator.consumeMovementBudget("r1", "ship_p1", 50);
		expect(updated?.remainingMovement).toBe(250);
		expect(updated?.turnState).toBe("moved");
	});
});

