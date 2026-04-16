import { describe, expect, it } from "vitest";
import { GamePhase, PlayerRole, WeaponState } from "@vt/data";
import { ObjectFactory } from "../rooms/battle/ObjectFactory.js";
import { CommandDispatcher } from "./CommandDispatcher.js";
import { GameRoomState, PlayerState, WeaponSlot } from "../schema/index.js";

function setupState() {
	const state = new GameRoomState();
	state.currentPhase = GamePhase.PLAYER_TURN;

	const player = new PlayerState();
	player.sessionId = "p1";
	player.role = PlayerRole.PLAYER;
	state.players.set(player.sessionId, player);

	const targetOwner = new PlayerState();
	targetOwner.sessionId = "p2";
	targetOwner.role = PlayerRole.PLAYER;
	state.players.set(targetOwner.sessionId, targetOwner);

	return { state, client: { sessionId: "p1" } as any, factory: new ObjectFactory() };
}

describe("CommandDispatcher 核心业务", () => {
	it("允许单阶段内多次增量移动，直到资源耗尽", () => {
		const { state, client, factory } = setupState();
		const ship = factory.createShip("frigate", 0, 0, 0, "PLAYER", "p1");
		expect(ship).not.toBeNull();
		const s = ship!;
		state.ships.set(s.id, s);

		const dispatcher = new CommandDispatcher(state);

		dispatcher.dispatchMoveToken(client, {
			shipId: s.id,
			x: 0,
			y: 0,
			heading: 0,
			isIncremental: true,
			phase: "PHASE_A",
			movementPlan: { phaseAForward: 120, phaseAStrafe: 0, turnAngle: 0, phaseCForward: 0, phaseCStrafe: 0 },
		});
		dispatcher.dispatchMoveToken(client, {
			shipId: s.id,
			x: 0,
			y: 0,
			heading: 0,
			isIncremental: true,
			phase: "PHASE_A",
			movementPlan: { phaseAForward: 80, phaseAStrafe: 0, turnAngle: 0, phaseCForward: 0, phaseCStrafe: 0 },
		});

		expect(s.phaseAForwardUsed).toBe(200);

		expect(() =>
			dispatcher.dispatchMoveToken(client, {
				shipId: s.id,
				x: 0,
				y: 0,
				heading: 0,
				isIncremental: true,
				phase: "PHASE_A",
				movementPlan: {
					phaseAForward: 1,
					phaseAStrafe: 0,
					turnAngle: 0,
					phaseCForward: 0,
					phaseCStrafe: 0,
				},
			})
		).toThrow("阶段A前进燃料不足");
	});

	it("支持多武器分别开火（每个武器按各自状态限制）", () => {
		const { state, client, factory } = setupState();
		const attacker = factory.createShip("destroyer", 0, 0, 0, "PLAYER", "p1")!;
		const target = factory.createShip("frigate", 300, 0, 180, "PLAYER", "p2")!;
		state.ships.set(attacker.id, attacker);
		state.ships.set(target.id, target);

		const secondWeapon = new WeaponSlot();
		secondWeapon.mountId = "m_extra";
		secondWeapon.mountFacing = 0;
		secondWeapon.mountOffsetX = 0;
		secondWeapon.mountOffsetY = 0;
		secondWeapon.arc = 120;
		secondWeapon.damage = 50;
		secondWeapon.range = 500;
		secondWeapon.fluxCost = 0;
		secondWeapon.cooldownMax = 0.1;
		secondWeapon.state = WeaponState.READY;
		secondWeapon.maxAmmo = 10;
		secondWeapon.currentAmmo = 10;
		attacker.weapons.set("m_extra", secondWeapon);

		const dispatcher = new CommandDispatcher(state);
		dispatcher.dispatchFireWeapon(client, { attackerId: attacker.id, weaponId: "m1", targetId: target.id });
		dispatcher.dispatchFireWeapon(client, {
			attackerId: attacker.id,
			weaponId: "m_extra",
			targetId: target.id,
		});

		expect(attacker.weapons.get("m1")?.hasFiredThisTurn).toBe(true);
		expect(attacker.weapons.get("m_extra")?.hasFiredThisTurn).toBe(true);

		expect(() =>
			dispatcher.dispatchFireWeapon(client, { attackerId: attacker.id, weaponId: "m1", targetId: target.id })
		).toThrow("武器状态");
	});

	it("武器射界会考虑挂点朝向并拒绝背向目标", () => {
		const { state, client, factory } = setupState();
		const attacker = factory.createShip("frigate", 0, 0, 0, "PLAYER", "p1")!;
		const targetBehind = factory.createShip("frigate", 0, 160, 0, "PLAYER", "p2")!;
		state.ships.set(attacker.id, attacker);
		state.ships.set(targetBehind.id, targetBehind);

		const weapon = attacker.weapons.get("m1")!;
		weapon.arc = 60;
		weapon.mountFacing = 0;
		weapon.state = WeaponState.READY;
		weapon.range = 500;
		weapon.maxAmmo = 0;

		const dispatcher = new CommandDispatcher(state);
		expect(() =>
			dispatcher.dispatchFireWeapon(client, {
				attackerId: attacker.id,
				weaponId: "m1",
				targetId: targetBehind.id,
			})
		).toThrow("目标不在武器射界内");
	});
});