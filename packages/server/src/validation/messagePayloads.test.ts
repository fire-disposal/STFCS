import { describe, expect, it } from "vitest";
import {
	parseCreateObjectPayload,
	parseMoveTokenPayload,
	parseNetPingPayload,
	parseSetArmorPayload,
	parseToggleReadyPayload,
} from "./messagePayloads.js";

describe("messagePayloads", () => {
	it("accepts a valid incremental move payload", () => {
		const payload = parseMoveTokenPayload({
			shipId: "ship-1",
			x: 100,
			y: 200,
			heading: 90,
			isIncremental: true,
			phase: "PHASE_A",
			movementPlan: {
				phaseAForward: 5,
				phaseAStrafe: 2,
				turnAngle: 10,
				phaseBForward: 4,
				phaseBStrafe: 1,
			},
		});

		expect(payload.shipId).toBe("ship-1");
		expect(payload.phase).toBe("PHASE_A");
		expect(payload.isIncremental).toBe(true);
	});

	it("rejects unknown move phase", () => {
		expect(() =>
			parseMoveTokenPayload({
				shipId: "ship-1",
				x: 1,
				y: 2,
				heading: 3,
				phase: "PHASE_D",
			})
		).toThrow("移动命令格式错误");
	});

	it("accepts create object payload with a known faction only", () => {
		const ok = parseCreateObjectPayload({
			type: "ship",
			x: 10,
			y: 20,
			faction: "hegemony",
		});
		expect(ok.faction).toBe("hegemony");

		expect(() =>
			parseCreateObjectPayload({
				type: "ship",
				x: 10,
				y: 20,
				faction: "unknown_faction",
			})
		).toThrow("创建对象命令格式错误");
	});

	it("requires integer armor section", () => {
		expect(() =>
			parseSetArmorPayload({ shipId: "ship-1", section: 1.5, value: 100 })
		).toThrow("护甲设置命令格式错误");
	});

	it("rejects invalid ping payload", () => {
		expect(() => parseNetPingPayload({ seq: -1, clientSentAt: Date.now() })).toThrow(
			"网络心跳命令格式错误"
		);
		expect(() =>
			parseNetPingPayload({ seq: 1, clientSentAt: Date.now() + 10_000 })
		).toThrow("网络心跳命令格式错误");
	});

	it("parses toggle ready payload", () => {
		const payload = parseToggleReadyPayload({ isReady: true });
		expect(payload.isReady).toBe(true);
	});
});
