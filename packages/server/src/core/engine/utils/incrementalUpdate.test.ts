/**
 * 增量更新工具测试
 */

import { describe, it, expect } from "vitest";
import {
	getValueByPath,
	setValueByPath,
	applyPathUpdates,
	deepClone,
	diffObjects,
	describeChange,
} from "./incrementalUpdate.js";

describe("Incremental Update Utils", () => {
	describe("getValueByPath", () => {
		it("should get nested values", () => {
			const obj = { a: { b: { c: 42 } } };
			expect(getValueByPath(obj, "a.b.c")).toBe(42);
		});

		it("should return undefined for missing paths", () => {
			const obj = { a: {} };
			expect(getValueByPath(obj, "a.b.c")).toBeUndefined();
		});
	});

	describe("setValueByPath", () => {
		it("should set nested values", () => {
			const obj: Record<string, unknown> = {};
			const change = setValueByPath(obj, "a.b.c", 42);
			expect(obj.a).toEqual({ b: { c: 42 } });
			expect(change.path).toBe("a.b.c");
			expect(change.newValue).toBe(42);
		});

		it("should track old values", () => {
			const obj = { x: 10 };
			const change = setValueByPath(obj, "x", 20);
			expect(change.oldValue).toBe(10);
			expect(change.newValue).toBe(20);
		});
	});

	describe("applyPathUpdates", () => {
		it("should apply multiple updates", () => {
			const obj: Record<string, unknown> = { runtime: { hull: 100, armor: [50, 50] } };
			const changes = applyPathUpdates(obj, {
				"runtime.hull": 80,
				"runtime.armor.0": 40,
			});

			expect(changes).toHaveLength(2);
			expect(getValueByPath(obj, "runtime.hull")).toBe(80);
			expect(getValueByPath(obj, "runtime.armor.0")).toBe(40);
		});
	});

	describe("deepClone", () => {
		it("should deeply clone objects", () => {
			const obj = { a: { b: [1, 2, 3] } };
			const cloned = deepClone(obj);
			expect(cloned).toEqual(obj);
			expect(cloned).not.toBe(obj);
			expect(cloned.a).not.toBe(obj.a);
			expect(cloned.a.b).not.toBe(obj.a.b);
		});
	});

	describe("diffObjects", () => {
		it("should detect added fields", () => {
			const old = { a: 1 };
			const neu = { a: 1, b: 2 };
			const changes = diffObjects(old, neu);
			expect(changes).toHaveLength(1);
			expect(changes[0].path).toBe("b");
			expect(changes[0].type).toBe("add");
		});

		it("should detect removed fields", () => {
			const old = { a: 1, b: 2 };
			const neu = { a: 1 };
			const changes = diffObjects(old, neu);
			expect(changes).toHaveLength(1);
			expect(changes[0].path).toBe("b");
			expect(changes[0].type).toBe("remove");
		});

		it("should detect changed values", () => {
			const old = { a: 1 };
			const neu = { a: 2 };
			const changes = diffObjects(old, neu);
			expect(changes).toHaveLength(1);
			expect(changes[0].type).toBe("replace");
			expect(changes[0].oldValue).toBe(1);
			expect(changes[0].newValue).toBe(2);
		});
	});

	describe("describeChange", () => {
		it("should describe replace changes", () => {
			const desc = describeChange({
				path: "runtime.hull",
				type: "replace",
				oldValue: 100,
				newValue: 80,
			});
			expect(desc).toContain("runtime.hull");
			expect(desc).toContain("100");
			expect(desc).toContain("80");
		});
	});
});
